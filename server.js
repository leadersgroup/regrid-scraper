// server.js - Fixed for Docker with proper signal handling
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Regrid Scraper server...');
console.log('Port:', PORT);
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Current time:', new Date().toISOString());

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Regrid Scraper API (Railway Docker)',
    timestamp: new Date().toISOString(),
    platform: 'railway-docker',
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Railway health check (they sometimes check root for health)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'working',
    message: 'Railway Docker deployment successful',
    timestamp: new Date().toISOString(),
    platform: 'railway-docker'
  });
});

// Property scraping endpoint
app.post('/api/scrape', async (req, res) => {
  const puppeteer = require('puppeteer');
  let browser = null;

  try {
    const { addresses } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Please provide an array of addresses',
        timestamp: new Date().toISOString()
      });
    }

    if (addresses.length > 10) {
      return res.status(400).json({
        error: 'Too many addresses',
        message: 'Maximum 10 addresses allowed per request',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`🔍 Starting scrape for ${addresses.length} addresses...`);

    // Launch Puppeteer browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const results = [];

    for (const address of addresses) {
      console.log(`🏠 Processing: ${address}`);

      try {
        // Navigate to Regrid
        await page.goto('https://app.regrid.com/us', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for search input and enter address
        await page.waitForSelector('input[placeholder*="search"], input[name*="search"], .search-input', { timeout: 10000 });

        // Clear any existing text and type the address
        await page.evaluate(() => {
          const searchInput = document.querySelector('input[placeholder*="search"], input[name*="search"], .search-input');
          if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
          }
        });

        await page.type('input[placeholder*="search"], input[name*="search"], .search-input', address);

        // Press Enter to search
        await page.keyboard.press('Enter');

        // Wait for results to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extract property data
        const propertyData = await page.evaluate(() => {
          // Look for parcel ID and owner name in various possible selectors
          const parcelIdSelectors = [
            '[data-testid*="parcel"]',
            '.parcel-id',
            '.property-id',
            '.parcel',
            '.apn'
          ];

          const ownerNameSelectors = [
            '[data-testid*="owner"]',
            '.owner-name',
            '.property-owner',
            '.owner-info',
            '.owner'
          ];

          let parcelId = null;
          let ownerName = null;

          // Try to find parcel ID
          for (const selector of parcelIdSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                parcelId = element.textContent.trim();
                break;
              }
            } catch (e) {}
          }

          // Try to find owner name
          for (const selector of ownerNameSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                ownerName = element.textContent.trim();
                break;
              }
            } catch (e) {}
          }

          return { parcelId, ownerName };
        });

        results.push({
          originalAddress: address,
          parcelId: propertyData.parcelId || 'Not found',
          ownerName: propertyData.ownerName || 'Not found',
          status: 'success'
        });

        console.log(`✅ Completed: ${address} - Parcel: ${propertyData.parcelId || 'N/A'}`);

      } catch (error) {
        console.error(`❌ Error processing ${address}:`, error.message);
        results.push({
          originalAddress: address,
          parcelId: 'Error',
          ownerName: 'Error',
          status: 'error',
          error: error.message
        });
      }

      // Add delay between requests to be respectful
      if (addresses.indexOf(address) < addresses.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`🎯 Scraping completed. Processed ${results.length} addresses.`);

    res.json({
      success: true,
      data: results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    res.status(500).json({
      error: 'Scraping failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔒 Browser closed');
    }
  }
});

// Simple home page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Regrid Property Scraper</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .container { text-align: center; }
        .badge { background: #0066cc; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; }
        .link { display: inline-block; margin: 10px; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; }
        .link:hover { background: #0052a3; }
        .test-form { margin: 20px 0; padding: 20px; background: #f5f5f5; border-radius: 5px; text-align: left; }
        .test-form input { width: 100%; padding: 8px; margin: 5px 0; }
        .test-form button { background: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 3px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 Regrid Property Scraper <span class="badge">Railway Docker</span></h1>
        <p>Server is running successfully with Puppeteer!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Platform: Railway with Docker</p>
        <p>Node.js: ${process.version}</p>

        <div>
            <a href="/api/test" class="link">🧪 Test API</a>
            <a href="/api/health" class="link">❤️ Health Check</a>
        </div>

        <div class="test-form">
            <h3>🔍 Test Property Scraper</h3>
            <p>Enter a property address to test the scraper:</p>
            <input type="text" id="address" placeholder="e.g., 123 Main St, Denver, CO" />
            <button onclick="testScraper()">Scrape Property</button>
            <div id="result" style="margin-top: 15px; padding: 10px; background: white; border-radius: 3px; min-height: 20px;"></div>
        </div>

        <script>
          async function testScraper() {
            const address = document.getElementById('address').value;
            const resultDiv = document.getElementById('result');

            if (!address.trim()) {
              resultDiv.innerHTML = '<span style="color: red;">Please enter an address</span>';
              return;
            }

            resultDiv.innerHTML = '⏳ Scraping property data...';

            try {
              const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ addresses: [address] })
              });

              const data = await response.json();

              if (data.success && data.data.length > 0) {
                const result = data.data[0];
                resultDiv.innerHTML = \`
                  <strong>✅ Success!</strong><br>
                  <strong>Address:</strong> \${result.originalAddress}<br>
                  <strong>Parcel ID:</strong> \${result.parcelId}<br>
                  <strong>Owner Name:</strong> \${result.ownerName}
                \`;
              } else {
                resultDiv.innerHTML = '<span style="color: red;">❌ Failed to scrape property data</span>';
              }
            } catch (error) {
              resultDiv.innerHTML = '<span style="color: red;">❌ Error: ' + error.message + '</span>';
            }
          }
        </script>
    </div>
</body>
</html>
  `);
});

// Catch all other routes
app.get('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    available_routes: ['/', '/api/test', '/api/health']
  });
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🧪 Test endpoint: http://0.0.0.0:${PORT}/api/test`);
  console.log(`❤️ Railway health: http://0.0.0.0:${PORT}/health`);

  // Signal to Railway that we're ready
  console.log('🎯 Server is ready to accept connections');
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  console.log('Server uptime:', process.uptime(), 'seconds');
  console.log('Memory usage:', process.memoryUsage());

  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 30 seconds (Railway needs more time)
  setTimeout(() => {
    console.log('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;