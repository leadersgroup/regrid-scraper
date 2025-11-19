const express = require('express');
const cors = require('cors');
const multer = require('multer');
const EmailVerifier = require('./email-verifier');
const BulkEmailVerifier = require('./bulk-verifier');
const { extractEmails } = require('./csv-utils');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, check against allowed origins from environment variable
    const allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['*']; // Allow all origins if not specified

    // Allow all origins in development or if wildcard is set
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-JSON', 'Content-Disposition', 'Content-Type'],
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory storage for bulk verification jobs
const verificationJobs = new Map();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV, TXT, and JSON files
    const allowedTypes = ['.csv', '.txt', '.json'];
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, TXT, and JSON files are allowed'));
    }
  }
});

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Simple rate limiting middleware
const rateLimitMap = new Map();
const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  maxRequests: 60  // 60 requests per minute
};

function rateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const requests = rateLimitMap.get(ip);

  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < RATE_LIMIT.windowMs);

  if (validRequests.length >= RATE_LIMIT.maxRequests) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((validRequests[0] + RATE_LIMIT.windowMs - now) / 1000)
    });
  }

  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);

  next();
}

// Apply rate limiting to all routes
app.use(rateLimit);

// Handle preflight requests
app.options('*', cors(corsOptions));

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET / - API information and health check
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Email Verifier API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: 'GET /health',
      verify: 'POST /api/verify',
      verifyBulk: 'POST /api/verify/bulk',
      jobStatus: 'GET /api/verify/bulk/:jobId',
      jobsList: 'GET /api/jobs'
    },
    documentation: '/api/docs'
  });
});

/**
 * GET /health - Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/docs - API Documentation
 */
app.get('/api/docs', (req, res) => {
  res.json({
    title: 'Email Verifier API Documentation',
    baseUrl: `http://localhost:${PORT}`,

    endpoints: [
      {
        method: 'POST',
        path: '/api/verify',
        description: 'Verify a single email address',
        body: {
          email: 'string (required) - Email address to verify'
        },
        response: {
          success: 'boolean',
          result: {
            email: 'string',
            valid: 'boolean',
            syntax: 'object',
            domain: 'object',
            mx: 'object',
            smtp: 'object',
            disposable: 'boolean',
            roleBased: 'boolean',
            catchAll: 'boolean',
            freeProvider: 'boolean',
            error: 'string | null',
            verifiedAt: 'string (ISO date)'
          }
        },
        example: {
          request: { email: 'test@example.com' },
          response: { success: true, result: '...' }
        }
      },
      {
        method: 'POST',
        path: '/api/verify/bulk',
        description: 'Verify multiple emails (up to 10,000)',
        body: {
          emails: 'array of strings (required) - Email addresses to verify',
          async: 'boolean (optional) - Process asynchronously (default: true for >100 emails)',
          webhook: 'string (optional) - URL to receive completion notification'
        },
        response: {
          success: 'boolean',
          jobId: 'string (if async)',
          results: 'array (if sync)',
          stats: 'object (if sync)',
          message: 'string'
        }
      },
      {
        method: 'GET',
        path: '/api/verify/bulk/:jobId',
        description: 'Get status of bulk verification job',
        response: {
          success: 'boolean',
          job: {
            jobId: 'string',
            status: 'pending | processing | completed | failed',
            progress: 'object',
            results: 'array (if completed)',
            stats: 'object (if completed)',
            error: 'string (if failed)'
          }
        }
      },
      {
        method: 'GET',
        path: '/api/jobs',
        description: 'List all verification jobs',
        response: {
          success: 'boolean',
          jobs: 'array of job objects'
        }
      }
    ],

    rateLimits: {
      requests: `${RATE_LIMIT.maxRequests} requests per ${RATE_LIMIT.windowMs / 1000} seconds`,
      bulkEmails: 'Up to 10,000 emails per request'
    },

    examples: {
      curl_single: `curl -X POST http://localhost:${PORT}/api/verify -H "Content-Type: application/json" -d '{"email":"test@example.com"}'`,
      curl_bulk: `curl -X POST http://localhost:${PORT}/api/verify/bulk -H "Content-Type: application/json" -d '{"emails":["test1@example.com","test2@example.com"]}'`,
      curl_status: `curl http://localhost:${PORT}/api/verify/bulk/JOB_ID`
    }
  });
});

/**
 * POST /api/verify - Verify a single email
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { email } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required'
      });
    }

    if (typeof email !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Email must be a string'
      });
    }

    // Verify email
    const verifier = new EmailVerifier();
    const result = await verifier.verify(email);

    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/verify/bulk - Verify multiple emails
 */
app.post('/api/verify/bulk', async (req, res) => {
  try {
    const { emails, async = true, webhook } = req.body;

    // Validation
    if (!emails || !Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Emails array cannot be empty'
      });
    }

    if (emails.length > config.bulk.maxEmails) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${config.bulk.maxEmails} emails allowed per request`
      });
    }

    // For small batches, process synchronously
    const shouldAsync = async && emails.length > 100;

    if (!shouldAsync) {
      // Synchronous processing
      const bulkVerifier = new BulkEmailVerifier();
      const { results, stats } = await bulkVerifier.verifyBulk(emails, {
        outputFile: null // Don't save to file for API
      });

      return res.json({
        success: true,
        results,
        stats,
        message: `Verified ${stats.processed} email(s)`
      });
    }

    // Asynchronous processing
    const jobId = generateJobId();

    const job = {
      jobId,
      status: 'pending',
      emails,
      webhook,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      progress: null,
      results: null,
      stats: null,
      error: null
    };

    verificationJobs.set(jobId, job);

    // Start processing in background
    processJobAsync(jobId);

    res.status(202).json({
      success: true,
      jobId,
      message: 'Bulk verification job started',
      statusUrl: `/api/verify/bulk/${jobId}`
    });

  } catch (error) {
    console.error('Bulk verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/verify/upload - Upload and verify emails from file
 */
app.post('/api/verify/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📤 Upload request received');
    console.log('   Headers:', JSON.stringify(req.headers));
    console.log('   File:', req.file ? req.file.originalname : 'NO FILE');
    console.log('   Body keys:', Object.keys(req.body));

    if (!req.file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload a CSV, TXT, or JSON file.'
      });
    }

    // Parse file content
    const fileContent = req.file.buffer.toString('utf8');
    const filename = req.file.originalname;
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

    let emails = [];

    // Extract emails based on file type
    if (ext === '.csv') {
      const { parseCSV } = require('./csv-utils');
      // Write buffer to temp location for parsing
      const fs = require('fs');
      const os = require('os');
      const path = require('path');

      const tempFile = path.join(os.tmpdir(), `upload_${Date.now()}.csv`);
      fs.writeFileSync(tempFile, req.file.buffer);
      emails = await parseCSV(tempFile);
      fs.unlinkSync(tempFile); // Clean up
    } else if (ext === '.txt') {
      emails = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && line.includes('@'));
    } else if (ext === '.json') {
      const data = JSON.parse(fileContent);
      if (Array.isArray(data)) {
        emails = data.filter(item => typeof item === 'string' && item.includes('@'));
      } else if (data.emails && Array.isArray(data.emails)) {
        emails = data.emails;
      }
    }

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email addresses found in file'
      });
    }

    if (emails.length > config.bulk.maxEmails) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${config.bulk.maxEmails} emails allowed. File contains ${emails.length} emails.`
      });
    }

    // Process emails
    const bulkVerifier = new BulkEmailVerifier();
    const { results, stats } = await bulkVerifier.verifyBulk(emails, {
      outputFile: null
    });

    // Generate CSV output
    const headers = [
      'email', 'valid', 'smtp_status', 'disposable', 'role_based',
      'catch_all', 'free_provider', 'domain', 'mx_records', 'error'
    ];

    const rows = results.map(r => [
      r.email,
      r.valid ? 'yes' : 'no',
      r.smtp?.status || 'unknown',
      r.disposable ? 'yes' : 'no',
      r.roleBased ? 'yes' : 'no',
      r.catchAll ? 'yes' : 'no',
      r.freeProvider ? 'yes' : 'no',
      r.domain?.name || '',
      r.mx?.records?.join(';') || '',
      r.error || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // Return CSV as blob
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="verified_emails.csv"');
    res.send(csv);

  } catch (error) {
    console.error('❌ File upload error:', error);
    console.error('   Error stack:', error.stack);

    // Check if it's a multer error
    if (error instanceof multer.MulterError) {
      console.error('   Multer error code:', error.code);
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File too large. Maximum size is 10MB.'
        });
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/verify/bulk/:jobId - Get job status
 */
app.get('/api/verify/bulk/:jobId', (req, res) => {
  const { jobId } = req.params;

  const job = verificationJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  // Return job without emails array for cleaner response
  const { emails, ...jobData } = job;

  res.json({
    success: true,
    job: {
      ...jobData,
      totalEmails: emails.length
    }
  });
});

/**
 * GET /api/jobs - List all jobs
 */
app.get('/api/jobs', (req, res) => {
  const jobs = Array.from(verificationJobs.values()).map(job => {
    const { emails, results, ...jobData } = job;
    return {
      ...jobData,
      totalEmails: emails.length,
      hasResults: results !== null
    };
  });

  res.json({
    success: true,
    jobs,
    total: jobs.length
  });
});

/**
 * DELETE /api/jobs/:jobId - Delete a job
 */
app.delete('/api/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;

  if (!verificationJobs.has(jobId)) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  verificationJobs.delete(jobId);

  res.json({
    success: true,
    message: 'Job deleted successfully'
  });
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique job ID
 */
function generateJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Process verification job asynchronously
 */
async function processJobAsync(jobId) {
  const job = verificationJobs.get(jobId);

  if (!job) return;

  try {
    job.status = 'processing';
    job.startedAt = new Date().toISOString();

    const bulkVerifier = new BulkEmailVerifier();

    const { results, stats } = await bulkVerifier.verifyBulk(job.emails, {
      outputFile: null,
      onProgress: (progress) => {
        job.progress = progress;
      }
    });

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.results = results;
    job.stats = stats;

    // Send webhook notification if provided
    if (job.webhook) {
      sendWebhookNotification(job.webhook, job);
    }

    console.log(`✅ Job ${jobId} completed: ${stats.processed} emails verified`);

  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);

    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error.message;
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(webhookUrl, job) {
  try {
    const https = require('https');
    const http = require('http');
    const url = require('url');

    const parsedUrl = url.parse(webhookUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const postData = JSON.stringify({
      jobId: job.jobId,
      status: job.status,
      stats: job.stats,
      completedAt: job.completedAt
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = protocol.request(options);
    req.write(postData);
    req.end();

    console.log(`📤 Webhook notification sent to ${webhookUrl}`);

  } catch (error) {
    console.error('Webhook notification failed:', error.message);
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ============================================================================
// SERVER START
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('📧 Email Verifier API Server');
  console.log('='.repeat(60));
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📖 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
  console.log('='.repeat(60));
  console.log('\nEndpoints:');
  console.log(`  POST   /api/verify          - Verify single email`);
  console.log(`  POST   /api/verify/bulk     - Verify multiple emails`);
  console.log(`  GET    /api/verify/bulk/:id - Check job status`);
  console.log(`  GET    /api/jobs            - List all jobs`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});
