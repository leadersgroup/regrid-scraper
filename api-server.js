/**
 * Deed Scraper REST API Server
 *
 * Provides API endpoints for downloading prior deed PDFs from Orange County, FL
 * and other supported counties.
 *
 * Usage:
 *   TWOCAPTCHA_TOKEN=your_api_key node api-server.js
 *
 * Endpoints:
 *   POST /api/deed/download - Download a deed PDF by address
 *   GET /api/health - Health check
 *   GET /api/counties - List supported counties
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// Import county implementations
const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');
const HillsboroughCountyFloridaScraper = require('./county-implementations/hillsborough-county-florida');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

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
      }
    ]
  });
});

// Helper function to process deed download request
async function processDeedDownload(address, county, state, options = {}) {
  // Initialize scraper based on county (default to Orange County, FL)
  let scraper;
  const detectedCounty = county || 'Orange';
  const detectedState = state || 'FL';

  if (detectedCounty === 'Orange' && detectedState === 'FL') {
    scraper = new OrangeCountyFloridaScraper({
      headless: options?.headless !== false, // Default to headless
      timeout: options?.timeout || 120000,
      verbose: options?.verbose || false
    });
  } else if (detectedCounty === 'Hillsborough' && detectedState === 'FL') {
    scraper = new HillsboroughCountyFloridaScraper({
      headless: options?.headless !== false, // Default to headless
      timeout: options?.timeout || 120000,
      verbose: options?.verbose || false
    });
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

    // Check if 2Captcha API key is configured
    if (!process.env.TWOCAPTCHA_TOKEN) {
      return res.status(503).json({
        success: false,
        error: 'CAPTCHA solver not configured',
        message: 'Set TWOCAPTCHA_TOKEN environment variable to enable deed downloads',
        documentation: 'See CAPTCHA_SOLVING_SETUP.md for setup instructions'
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`📥 NEW REQUEST [/api/getPriorDeed]: ${address}`);
    console.log(`${'='.repeat(80)}\n`);

    const result = await processDeedDownload(address, county, state);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ REQUEST COMPLETED in ${duration}s`);
    console.log(`${'='.repeat(80)}\n`);

    // If successful and PDF was downloaded, include base64 for immediate download
    if (result.success && result.download?.success) {
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /api/health',
      'GET /api/counties',
      'POST /api/scrape',
      'POST /api/getPriorDeed'
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
  console.log('🚀 DEED SCRAPER API SERVER');
  console.log('='.repeat(80));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🔧 2Captcha API: ${process.env.TWOCAPTCHA_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`📁 Download path: ${process.env.DEED_DOWNLOAD_PATH || './downloads'}`);
  console.log('\n📖 Available endpoints:');
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/counties`);
  console.log(`   POST http://localhost:${PORT}/api/scrape`);
  console.log(`   POST http://localhost:${PORT}/api/getPriorDeed`);
  console.log('\n💡 Example request:');
  console.log(`   curl -X POST http://localhost:${PORT}/api/getPriorDeed \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'`);
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
