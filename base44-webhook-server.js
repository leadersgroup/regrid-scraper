/**
 * Base44 Webhook Server
 *
 * This server exposes a webhook endpoint that Base44 can call
 * to trigger the scrapePriorDeed function.
 *
 * Base44 might work by calling YOUR server instead of you calling theirs.
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

// Store API key for validation
const BASE44_API_KEY = 'c085f441e8ad46ac8d866dc03bc8512f';

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-API-Key, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Middleware to verify API key
function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required'
    });
  }

  if (apiKey !== BASE44_API_KEY) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }

  next();
}

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Base44 Webhook Server',
    timestamp: new Date().toISOString()
  });
});

// Webhook endpoint for Base44 to call
app.post('/webhook/scrapePriorDeed', verifyApiKey, async (req, res) => {
  console.log('📥 Received webhook request from Base44');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  let scraper = null;

  try {
    const { address, county, state } = req.body;

    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Please provide a valid property address',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📄 Starting prior deed search for: ${address}`);
    console.log(`📍 County: ${county || 'Not specified'}, State: ${state || 'Not specified'}`);

    // Determine which county scraper to use
    const detectedCounty = county || 'Orange';
    const detectedState = state || 'FL';

    // Initialize county-specific scraper
    if (detectedCounty === 'Miami-Dade' && detectedState === 'FL') {
      const MiamiDadeCountyFloridaScraper = require('./county-implementations/miami-dade-county-florida');
      scraper = new MiamiDadeCountyFloridaScraper({
        headless: true,
        timeout: 120000,
        verbose: true
      });
    } else if (detectedCounty === 'Orange' && detectedState === 'FL') {
      const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');
      scraper = new OrangeCountyFloridaScraper({
        headless: true,
        timeout: 120000,
        verbose: true
      });
    } else if (detectedCounty === 'Hillsborough' && detectedState === 'FL') {
      const HillsboroughCountyFloridaScraper = require('./county-implementations/hillsborough-county-florida');
      scraper = new HillsboroughCountyFloridaScraper({
        headless: true,
        timeout: 120000,
        verbose: true
      });
    } else if (detectedCounty === 'Duval' && detectedState === 'FL') {
      const DuvalCountyFloridaScraper = require('./county-implementations/duval-county-florida');
      scraper = new DuvalCountyFloridaScraper({
        headless: true,
        timeout: 120000,
        verbose: true
      });
    } else {
      console.log(`⚠️  Using base DeedScraper for ${detectedCounty}, ${detectedState}`);
      const DeedScraper = require('./deed-scraper');
      scraper = new DeedScraper({
        headless: true,
        timeout: 60000,
        verbose: true
      });
    }

    await scraper.initialize();

    // Run complete workflow
    const result = await scraper.getPriorDeed(address);

    console.log(`📄 Deed search completed: ${result.success ? 'Success' : 'Failed'}`);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
      webhookSource: 'base44'
    });

  } catch (error) {
    console.error('❌ Deed scraping error:', error);
    res.status(500).json({
      error: 'Deed scraping failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (scraper) {
      await scraper.close();
      console.log('🔒 Deed scraper closed');
    }
  }
});

// Generic webhook endpoint (in case Base44 uses a different path)
app.post('/webhook/base44', verifyApiKey, async (req, res) => {
  console.log('📥 Received generic webhook from Base44');
  console.log('Body:', JSON.stringify(req.body, null, 2));

  const { action, params } = req.body;

  if (action === 'scrapePriorDeed') {
    // Forward to the scrapePriorDeed handler
    req.body = params;
    return app._router.handle(req, res);
  }

  res.json({
    success: true,
    message: 'Webhook received',
    action: action || 'unknown',
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 Base44 Webhook Server started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook/scrapePriorDeed`);
  console.log(`🔑 API Key: ${BASE44_API_KEY}`);
  console.log('');
  console.log('📋 To configure in Base44:');
  console.log(`   1. Set webhook URL to: http://your-server.com:${PORT}/webhook/scrapePriorDeed`);
  console.log(`   2. Set API key header: X-API-Key: ${BASE44_API_KEY}`);
  console.log(`   3. Send POST requests with: { "address": "...", "county": "...", "state": "..." }`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 SIGTERM received, closing server...');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('📴 SIGINT received, closing server...');
  server.close(() => {
    console.log('👋 Server closed');
    process.exit(0);
  });
});

module.exports = app;
