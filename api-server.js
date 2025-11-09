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
const fs = require('fs');
const path = require('path');

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
    'bexar': 'Bexar'
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
    const countiesRequiringCaptcha = ['Orange', 'Bexar'];
    if (countiesRequiringCaptcha.includes(normalizedCounty) && !process.env.TWOCAPTCHA_TOKEN) {
      return res.status(503).json({
        success: false,
        error: 'CAPTCHA solver not configured',
        message: `${normalizedCounty} County requires CAPTCHA solving. Set TWOCAPTCHA_TOKEN environment variable to enable deed downloads.`,
        documentation: 'See CAPTCHA_SOLVING_SETUP.md for setup instructions',
        hint: 'Hillsborough and Miami-Dade counties do not require CAPTCHA'
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
