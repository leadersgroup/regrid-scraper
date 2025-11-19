/**
 * Deed Scraper REST API Server
 *
 * Provides API endpoints for downloading prior deed PDFs from Orange County, FL
 * and other supported counties across multiple states.
 *
 * Usage:
 *   TWOCAPTCHA_TOKEN=your_api_key node api-server.js
 *
 * Endpoints:
 *   POST /api/deed/download - Download a deed PDF by address
 *   GET /api/health - Health check
 *   GET /api/counties - List supported counties
 *
 * Last updated: 2025-11-04
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Import email verification modules
const EmailVerifier = require('./email-verifier/email-verifier');
const BulkEmailVerifier = require('./email-verifier/bulk-verifier');
const { extractEmails } = require('./email-verifier/csv-utils');
const emailConfig = require('./email-verifier/config');

// Import county implementations
const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');
const HillsboroughCountyFloridaScraper = require('./county-implementations/hillsborough-county-florida');
const DuvalCountyFloridaScraper = require('./county-implementations/duval-county-florida');
const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee');
const PolkCountyFloridaScraper = require('./county-implementations/polk-county-florida');
const PinellasCountyFloridaScraper = require('./county-implementations/pinellas-county-florida');
const BrevardCountyFloridaScraper = require('./county-implementations/brevard-county-florida');
const LeeCountyFloridaScraper = require('./county-implementations/lee-county-florida');
const PalmBeachCountyFloridaScraper = require('./county-implementations/palm-beach-county-florida');
const MiamiDadeCountyFloridaScraper = require('./county-implementations/miami-dade-county-florida');
const BrowardCountyFloridaScraper = require('./county-implementations/broward-county-florida');
const ShelbyCountyTennesseeScraper = require('./county-implementations/shelby-county-tennessee');
const HarrisCountyTexasScraper = require('./county-implementations/harris-county-texas');
const TarrantCountyTexasScraper = require('./county-implementations/tarrant-county-texas');
const DallasCountyTexasScraper = require('./county-implementations/dallas-county-texas');
const BexarCountyTexasScraper = require('./county-implementations/bexar-county-texas');
const DurhamCountyNorthCarolinaScraper = require('./county-implementations/durham-county-north-carolina');
const WakeCountyNorthCarolinaScraper = require('./county-implementations/wake-county-north-carolina');
const MecklenburgCountyNorthCarolinaScraper = require('./county-implementations/mecklenburg-county-north-carolina');
const GuilfordCountyNorthCarolinaScraper = require('./county-implementations/guilford-county-north-carolina');
const ForsythCountyNorthCarolinaScraper = require('./county-implementations/forsyth-county-north-carolina');
const KingCountyWashingtonScraper = require('./county-implementations/king-county-washington');
const PierceCountyWashingtonScraper = require('./county-implementations/pierce-county-washington');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Configure multer for email-verifier file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept all files - we'll validate content during processing
    // This handles edge cases like uppercase extensions, no extensions, etc.
    cb(null, true);
  }
});

// In-memory storage for email verification jobs
const verificationJobs = new Map();

// Railway health check endpoint (required by railway.json)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API health check endpoint
app.get('/api/health', (req, res) => {
  const has2CaptchaKey = !!process.env.TWOCAPTCHA_TOKEN;

  res.json({
    status: 'healthy',
    version: '1.0.0',
    captchaSolver: has2CaptchaKey ? 'enabled' : 'disabled',
    timestamp: new Date().toISOString()
  });
});

// List supported counties
app.get('/api/counties', (req, res) => {
  res.json({
    success: true,
    counties: [
      {
        name: 'Orange County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Automatic CAPTCHA solving',
          'Full PDF download',
          'Transaction history extraction'
        ],
        cost: '$0.001 per deed (with 2Captcha API)'
      },
      {
        name: 'Hillsborough County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'CFN and Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Duval County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'Instrument Number and Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Davidson County',
        state: 'TN',
        stateCode: 'Tennessee',
        features: [
          'Property assessor search',
          'Transaction history extraction',
          'Deed reference information (Instrument No, Book/Page)'
        ],
        cost: 'Free (property search)',
        note: 'Deed PDF download requires subscription ($50/month) or free mobile app',
        alternativeAccess: {
          subscription: 'https://davidsonportal.com/ ($50/month)',
          mobileApp: 'Nashville - Davidson Co. ROD (Free on iOS/Android)',
          inPerson: '501 Broadway, Suite 301, Nashville, TN 37203'
        }
      },
      {
        name: 'Polk County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Pinellas County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'Document Number and Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Brevard County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'Instrument Number and Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Lee County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'Instrument number and Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Palm Beach County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'ORB/Book and Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Miami-Dade County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'Instrument Number and Book/Page support'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Broward County',
        state: 'FL',
        stateCode: 'Florida',
        features: [
          'Full PDF download',
          'Transaction history extraction',
          'CIN and Book/Page support',
          'Direct address search'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Shelby County',
        state: 'TN',
        stateCode: 'Tennessee',
        features: [
          'Full PDF download',
          'Sales history extraction',
          'Deed number support',
          'Register of Deeds integration'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Tarrant County',
        state: 'TX',
        stateCode: 'Texas',
        features: [
          'TAD property search',
          'Account number detection',
          'Instrument number extraction',
          'Automatic login',
          'Full PDF download'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Dallas County',
        state: 'TX',
        stateCode: 'Texas',
        features: [
          'Dallas CAD property search',
          'Legal description extraction',
          'Instrument number detection',
          'Book/Page support',
          'Full PDF download'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Bexar County',
        state: 'TX',
        stateCode: 'Texas',
        features: [
          'BCAD property search by address',
          'Property Deed History extraction',
          'Doc number detection',
          'Public search integration',
          'Automatic CAPTCHA solving',
          'Full PDF download'
        ],
        cost: '$0.001 per deed (with 2Captcha API)'
      },
      {
        name: 'Durham County',
        state: 'NC',
        stateCode: 'North Carolina',
        features: [
          'Property search by address',
          'Book and Page extraction',
          'Register of Deeds integration',
          'Full PDF download'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Wake County',
        state: 'NC',
        stateCode: 'North Carolina',
        features: [
          'Property search by street number and name',
          'Deeds tab integration',
          'Page number extraction',
          'Automatic CAPTCHA solving',
          'Full PDF download'
        ],
        cost: '$0.001 per deed (with 2Captcha API)'
      },
      {
        name: 'Mecklenburg County',
        state: 'NC',
        stateCode: 'North Carolina',
        features: [
          'Property search with autocomplete',
          'Deeds and Sale Price tab integration',
          'Book-Page link extraction',
          'Disclaimer page handling',
          'Full PDF download'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Guilford County',
        state: 'NC',
        stateCode: 'North Carolina',
        features: [
          'Property search by street number and name',
          'Location address search integration',
          'Parcel number extraction',
          'Deeds tab integration',
          'Automatic CAPTCHA solving',
          'Full PDF download'
        ],
        cost: '$0.001 per deed (with 2Captcha API)'
      },
      {
        name: 'Forsyth County',
        state: 'NC',
        stateCode: 'North Carolina',
        features: [
          'Property search by street number and name',
          'Location address search integration',
          'Parcel number extraction',
          'Deeds tab integration',
          'Automatic CAPTCHA solving',
          'Full PDF download'
        ],
        cost: '$0.001 per deed (with 2Captcha API)'
      },
      {
        name: 'King County',
        state: 'WA',
        stateCode: 'Washington',
        features: [
          'Property search by address',
          'RCW 42.56.070(9) acknowledgment',
          'Property Detail page navigation',
          'Sales History table extraction',
          'Recording number detection',
          'Document download from Register of Deeds',
          'TIF to PDF conversion (if needed)'
        ],
        cost: 'Free (no CAPTCHA)'
      },
      {
        name: 'Pierce County',
        state: 'WA',
        stateCode: 'Washington',
        features: [
          'Property search by parcel ID',
          'Disclaimer acknowledgment',
          'Document type filtering (excludes excise tax affidavits)',
          'Instrument number detection',
          'Image viewer integration',
          'PDF download'
        ],
        cost: 'Free (no CAPTCHA)',
        note: 'Requires parcel ID (can be obtained from Regrid.com)'
      }
    ]
  });
});

// Helper function to normalize county names
function normalizeCountyName(county) {
  if (!county) return '';

  // Convert to lowercase and trim
  let normalized = county.toLowerCase().trim();

  // Remove "county" suffix if present
  normalized = normalized.replace(/\s+county$/i, '');

  // Handle common variations
  const countyMap = {
    'miami-dade': 'Miami-Dade',
    'miami dade': 'Miami-Dade',
    'miamidade': 'Miami-Dade',
    'orange': 'Orange',
    'hillsborough': 'Hillsborough',
    'broward': 'Broward',
    'shelby': 'Shelby',
    'harris': 'Harris',
    'tarrant': 'Tarrant',
    'dallas': 'Dallas',
    'bexar': 'Bexar',
    'durham': 'Durham',
    'wake': 'Wake',
    'mecklenburg': 'Mecklenburg',
    'guilford': 'Guilford',
    'forsyth': 'Forsyth',
    'king': 'King',
    'pierce': 'Pierce'
  };

  return countyMap[normalized] || county;
}

// Helper function to process deed download request
async function processDeedDownload(address, county, state, options = {}) {
  // Initialize scraper based on county (default to Orange County, FL)
  let scraper;
  const detectedCounty = normalizeCountyName(county) || 'Orange';
  const detectedState = (state || 'FL').toUpperCase();

  console.log(`🔍 Routing request: County="${detectedCounty}", State="${detectedState}"`);

  // Default options for Railway deployment with verbose logging enabled
  const scraperOptions = {
    headless: options?.headless !== false, // Default to headless
    timeout: options?.timeout || 120000,
    verbose: options?.verbose !== false  // Default to true for Railway debugging
  };

  if (detectedCounty === 'Orange' && detectedState === 'FL') {
    scraper = new OrangeCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Hillsborough' && detectedState === 'FL') {
    scraper = new HillsboroughCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Duval' && detectedState === 'FL') {
    scraper = new DuvalCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Davidson' && detectedState === 'TN') {
    scraper = new DavidsonCountyTennesseeScraper(scraperOptions);
  } else if (detectedCounty === 'Polk' && detectedState === 'FL') {
    scraper = new PolkCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Pinellas' && detectedState === 'FL') {
    scraper = new PinellasCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Brevard' && detectedState === 'FL') {
    scraper = new BrevardCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Lee' && detectedState === 'FL') {
    scraper = new LeeCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Palm Beach' && detectedState === 'FL') {
    scraper = new PalmBeachCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Miami-Dade' && detectedState === 'FL') {
    scraper = new MiamiDadeCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Broward' && detectedState === 'FL') {
    scraper = new BrowardCountyFloridaScraper(scraperOptions);
  } else if (detectedCounty === 'Shelby' && detectedState === 'TN') {
    scraper = new ShelbyCountyTennesseeScraper(scraperOptions);
  } else if (detectedCounty === 'Harris' && detectedState === 'TX') {
    scraper = new HarrisCountyTexasScraper(scraperOptions);
  } else if (detectedCounty === 'Tarrant' && detectedState === 'TX') {
    scraper = new TarrantCountyTexasScraper(scraperOptions);
  } else if (detectedCounty === 'Dallas' && detectedState === 'TX') {
    scraper = new DallasCountyTexasScraper(scraperOptions);
  } else if (detectedCounty === 'Bexar' && detectedState === 'TX') {
    scraper = new BexarCountyTexasScraper(scraperOptions);
  } else if (detectedCounty === 'Durham' && detectedState === 'NC') {
    scraper = new DurhamCountyNorthCarolinaScraper(scraperOptions);
  } else if (detectedCounty === 'Wake' && detectedState === 'NC') {
    scraper = new WakeCountyNorthCarolinaScraper(scraperOptions);
  } else if (detectedCounty === 'Mecklenburg' && detectedState === 'NC') {
    scraper = new MecklenburgCountyNorthCarolinaScraper(scraperOptions);
  } else if (detectedCounty === 'Guilford' && detectedState === 'NC') {
    scraper = new GuilfordCountyNorthCarolinaScraper(scraperOptions);
  } else if (detectedCounty === 'Forsyth' && detectedState === 'NC') {
    scraper = new ForsythCountyNorthCarolinaScraper(scraperOptions);
  } else if (detectedCounty === 'King' && detectedState === 'WA') {
    scraper = new KingCountyWashingtonScraper(scraperOptions);
  } else if (detectedCounty === 'Pierce' && detectedState === 'WA') {
    scraper = new PierceCountyWashingtonScraper(scraperOptions);
  } else {
    throw new Error(`County "${detectedCounty}, ${detectedState}" is not yet supported`);
  }

  try {
    // Initialize scraper
    await scraper.initialize();

    // Download the deed
    const result = await scraper.getPriorDeed(address);

    // Close scraper
    await scraper.close();

    return result;
  } catch (scraperError) {
    await scraper.close();
    throw scraperError;
  }
}

// Main endpoint - /api/getPriorDeed
app.post('/api/getPriorDeed', async (req, res) => {
  const startTime = Date.now();

  try {
    const { address, county, state } = req.body;

    // Validate required parameters
    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: address',
        message: 'Please provide an address to search for'
      });
    }

    // Normalize county name for routing
    const normalizedCounty = normalizeCountyName(county) || 'Orange';
    const normalizedState = (state || 'FL').toUpperCase();

    // Check if 2Captcha API key is configured (required for some counties)
    const countiesRequiringCaptcha = ['Orange', 'Bexar', 'Wake', 'Guilford', 'Forsyth'];
    if (countiesRequiringCaptcha.includes(normalizedCounty) && !process.env.TWOCAPTCHA_TOKEN) {
      return res.status(503).json({
        success: false,
        error: 'CAPTCHA solver not configured',
        message: `${normalizedCounty} County requires CAPTCHA solving. Set TWOCAPTCHA_TOKEN environment variable to enable deed downloads.`,
        documentation: 'See CAPTCHA_SOLVING_SETUP.md for setup instructions',
        hint: 'Durham, Hillsborough and Miami-Dade counties do not require CAPTCHA'
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📥 NEW REQUEST [/api/getPriorDeed]`);
    console.log(`   Address: ${address}`);
    console.log(`   County: ${normalizedCounty}, ${normalizedState}`);
    console.log(`${'='.repeat(80)}\n`);

    const result = await processDeedDownload(address, county, state, {
      verbose: true,  // Enable detailed logging for Railway debugging
      headless: true,
      timeout: 120000
    });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ REQUEST COMPLETED in ${duration}s`);
    console.log(`${'='.repeat(80)}\n`);

    // If successful and PDF was downloaded, include base64 for immediate download
    if (result.success && result.download?.success) {
      // Check if pdfBase64 is already provided (e.g., from in-memory download)
      if (result.download.pdfBase64) {
        console.log(`📦 PDF base64 already provided (${Buffer.from(result.download.pdfBase64, 'base64').length} bytes)`);
        result.download.contentType = 'application/pdf';
      } else if (result.download.downloadPath && result.download.filename) {
        // Otherwise, read from disk
        const pdfPath = path.join(
          result.download.downloadPath,
          result.download.filename
        );

        // Check if file exists and convert to base64
        if (fs.existsSync(pdfPath)) {
          const pdfBuffer = fs.readFileSync(pdfPath);
          const pdfBase64 = pdfBuffer.toString('base64');

          console.log(`📦 Including PDF as base64 (${pdfBuffer.length} bytes)`);

          // Add base64 to response
          result.download.pdfBase64 = pdfBase64;
          result.download.contentType = 'application/pdf';
        } else {
          console.log(`⚠️  PDF file not found: ${pdfPath}`);
        }
      }
    }

    // Return result in original format
    return res.json({
      ...result,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n❌ ERROR after ${duration}s:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message,
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    });
  }
});

// Regrid parcel ID lookup endpoint
app.post('/api/scrape', async (req, res) => {
  const RegridScraper = require('./regrid-scraper-railway');
  let scraper = null;

  try {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: 'Please provide an array of addresses',
        timestamp: new Date().toISOString()
      });
    }

    if (addresses.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Too many addresses',
        message: 'Maximum 10 addresses allowed per request',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📥 NEW REQUEST [/api/scrape]: ${addresses.length} addresses`);
    console.log(`${'='.repeat(80)}\n`);

    // Initialize Regrid scraper
    scraper = new RegridScraper();
    await scraper.initialize();
    await scraper.establishSession();

    // Search for properties
    const results = await scraper.searchMultipleProperties(addresses);

    await scraper.close();

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Scraping completed: ${results.length} addresses processed`);
    console.log(`${'='.repeat(80)}\n`);

    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        successful: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    res.status(500).json({
      success: false,
      error: 'Scraping failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (scraper) {
      await scraper.close();
    }
  }
});

// ============================================================================
// EMAIL VERIFICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/verify - Verify a single email address
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { email } = req.body;

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

    if (emails.length > emailConfig.bulk.maxEmails) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${emailConfig.bulk.maxEmails} emails allowed per request`
      });
    }

    const shouldAsync = async && emails.length > 100;

    if (!shouldAsync) {
      const bulkVerifier = new BulkEmailVerifier();
      const { results, stats } = await bulkVerifier.verifyBulk(emails, {
        outputFile: null
      });

      return res.json({
        success: true,
        results,
        stats,
        message: `Verified ${stats.processed} email(s)`
      });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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
app.post('/api/verify/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('❌ Multer error:', err.code, err.message);
      return res.status(400).json({
        success: false,
        error: `File upload error: ${err.message}`
      });
    } else if (err) {
      console.error('❌ Upload error:', err.message);
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
}, async (req, res) => {
  try {
    console.log('📤 Upload request received');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Please upload a CSV file.'
      });
    }

    const filename = req.file.originalname;
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));

    console.log(`📁 Processing file: ${filename} (${ext})`);

    // Only accept CSV files
    if (ext !== '.csv') {
      return res.status(400).json({
        success: false,
        error: 'Only CSV files are supported. Please upload a .csv file.'
      });
    }

    // Parse CSV file and preserve original structure
    const fileContent = req.file.buffer.toString('utf8');
    const rows = fileContent.split('\n').map(line => line.trim()).filter(line => line);

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is empty'
      });
    }

    // Parse CSV rows (handle quoted values)
    const parseCSVRow = (row) => {
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result.map(cell => cell.replace(/^"|"$/g, ''));
    };

    const originalHeaders = parseCSVRow(rows[0]);
    const dataRows = rows.slice(1)
      .map(row => parseCSVRow(row))
      .filter(row => {
        // Skip empty rows (rows with no data or all empty cells)
        return row.some(cell => cell && cell.trim().length > 0);
      });

    // Find email column
    const emailColIndex = originalHeaders.findIndex(h =>
      h.toLowerCase().includes('email') || h.toLowerCase().includes('e-mail')
    );

    if (emailColIndex === -1) {
      return res.status(400).json({
        success: false,
        error: 'No email column found in CSV. Please ensure there is a column named "email" or "e-mail".'
      });
    }

    // Extract emails for verification
    const emails = dataRows.map(row => row[emailColIndex]).filter(email => email && email.includes('@'));

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email addresses found in the email column.'
      });
    }

    if (emails.length > emailConfig.bulk.maxEmails) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${emailConfig.bulk.maxEmails} emails allowed. File contains ${emails.length} emails.`
      });
    }

    console.log(`🔍 Verifying ${emails.length} emails...`);

    // Verify emails
    const bulkVerifier = new BulkEmailVerifier();
    const { results, stats, quotaExceeded } = await bulkVerifier.verifyBulk(emails, {
      outputFile: null
    });

    if (quotaExceeded) {
      console.log(`⚠️  API quota exceeded. Processed ${stats.processed} of ${emails.length} emails.`);
    } else {
      console.log(`✅ Verification complete: ${stats.valid} valid, ${stats.invalid} invalid`);
    }

    // Create verification results map
    const verificationMap = new Map();
    results.forEach(r => {
      verificationMap.set(r.email, r);
    });

    // Add validation columns to original headers
    const newHeaders = [
      ...originalHeaders,
      'valid',
      'smtp_status',
      'disposable',
      'role_based',
      'catch_all',
      'free_provider',
      'verification_error'
    ];

    // Merge original data with validation results
    const enhancedRows = dataRows.map(originalRow => {
      const email = originalRow[emailColIndex];
      const verification = verificationMap.get(email);

      if (!verification) {
        // Email not verified (shouldn't happen, but handle it)
        return [
          ...originalRow,
          'no',
          'not_verified',
          'no',
          'no',
          'no',
          'no',
          'Not verified'
        ];
      }

      return [
        ...originalRow,
        verification.valid ? 'yes' : 'no',
        verification.smtp?.status || 'unknown',
        verification.disposable ? 'yes' : 'no',
        verification.roleBased ? 'yes' : 'no',
        verification.catchAll ? 'yes' : 'no',
        verification.freeProvider ? 'yes' : 'no',
        verification.error || ''
      ];
    });

    // Generate CSV output
    const csvRows = [newHeaders, ...enhancedRows];
    const csv = csvRows
      .map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="verified_emails.csv"');

    // Add warning header if quota exceeded
    if (quotaExceeded) {
      res.setHeader('X-Quota-Exceeded', 'true');
      res.setHeader('X-Processed-Count', stats.processed.toString());
      res.setHeader('X-Total-Count', emails.length.toString());
    }

    res.send(csv);

  } catch (error) {
    console.error('❌ File upload error:', error);
    console.error('   Stack:', error.stack);
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
 * GET /api/jobs - List all verification jobs
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
 * DELETE /api/jobs/:jobId - Delete a verification job
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

// Helper function for async job processing
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

    console.log(`✅ Job ${jobId} completed: ${stats.processed} emails verified`);

  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error.message;
  }
}

// ============================================================================
// END EMAIL VERIFICATION ENDPOINTS
// ============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/counties',
      'POST /api/scrape',
      'POST /api/getPriorDeed',
      'POST /api/verify',
      'POST /api/verify/bulk',
      'POST /api/verify/upload',
      'GET /api/verify/bulk/:jobId',
      'GET /api/jobs',
      'DELETE /api/jobs/:jobId'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 COMBINED API SERVER - Deed Scraper + Email Verifier');
  console.log('='.repeat(80));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔧 2Captcha API: ${process.env.TWOCAPTCHA_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`📁 Download path: ${process.env.DEED_DOWNLOAD_PATH || './downloads'}`);
  console.log('\n📖 Deed Scraper Endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/counties`);
  console.log(`   POST http://localhost:${PORT}/api/scrape`);
  console.log(`   POST http://localhost:${PORT}/api/getPriorDeed`);
  console.log('\n📧 Email Verification Endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/verify`);
  console.log(`   POST http://localhost:${PORT}/api/verify/bulk`);
  console.log(`   POST http://localhost:${PORT}/api/verify/upload`);
  console.log(`   GET  http://localhost:${PORT}/api/verify/bulk/:jobId`);
  console.log(`   GET  http://localhost:${PORT}/api/jobs`);
  console.log('\n💡 Example requests:');
  console.log(`   # Deed download:`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/getPriorDeed \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'`);
  console.log(`\n   # Email verification:`);
  console.log(`   curl -X POST http://localhost:${PORT}/api/verify \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"email": "test@example.com"}'`);
  console.log('\n' + '='.repeat(80) + '\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
