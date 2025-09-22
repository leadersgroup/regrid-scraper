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

    // Launch Puppeteer browser with anti-detection measures
    const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;

    browser = await puppeteer.launch({
      headless: true,
      executablePath: isRailway ? '/usr/bin/google-chrome-stable' : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--disable-features=TranslateUI,VizDisplayCompositor',
        // Additional anti-detection flags
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    const page = await browser.newPage();

    // Enhanced anti-detection measures
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock chrome runtime
      window.chrome = {
        runtime: {},
      };

      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' }) :
          originalQuery(parameters)
      );
    });

    // Set a realistic user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set realistic viewport with some randomization
    const viewports = [
      { width: 1366, height: 768 },
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 1440, height: 900 }
    ];
    const randomViewport = viewports[Math.floor(Math.random() * viewports.length)];
    await page.setViewport(randomViewport);

    // Add extra headers to appear more human-like
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    });

    const results = [];

    for (const address of addresses) {
      console.log(`🏠 Processing: ${address}`);

      // Clean address for Regrid search - remove commas and periods that cause search failures
      const cleanAddress = address.replace(/[,.]/g, '').trim();
      console.log(`🧹 Cleaned address: ${cleanAddress}`);

      try {
        // Navigate to Regrid with human-like behavior
        console.log(`🌐 Navigating to Regrid for: ${address}`);
        await page.goto('https://app.regrid.com/us', {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Simulate human behavior - random wait and scroll
        const randomWait = Math.random() * 3000 + 2000; // 2-5 seconds
        await new Promise(resolve => setTimeout(resolve, randomWait));

        // Simulate reading the page by scrolling a bit
        await page.evaluate(() => {
          window.scrollTo(0, 100);
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        await page.evaluate(() => {
          window.scrollTo(0, 0);
        });
        await new Promise(resolve => setTimeout(resolve, 300));

        // Check for rate limiting error
        const pageContent = await page.content();
        if (pageContent.includes('Error 429') || pageContent.includes('too many requests')) {
          throw new Error('Rate limited by Regrid. Please wait before trying again.');
        }

        // Wait for search input and enter address
        console.log(`🔍 Looking for Regrid search input...`);

        // Try multiple possible search input selectors for Regrid
        const searchSelectors = [
          'input[placeholder*="Search"]',
          'input[placeholder*="search"]',
          'input[placeholder*="address"]',
          'input[placeholder*="Enter"]',
          '.search-input',
          '#search-input',
          'input[type="search"]',
          'input[type="text"]',
          '.geocoder-input',
          '.mapboxgl-ctrl-geocoder input'
        ];

        let searchInput = null;
        for (const selector of searchSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 3000 });
            searchInput = selector;
            console.log(`✅ Found search input with selector: ${selector}`);
            break;
          } catch (e) {
            console.log(`❌ Selector ${selector} not found`);
          }
        }

        if (!searchInput) {
          throw new Error('Could not find search input on Regrid page');
        }

        // Human-like interaction with search input
        console.log(`⌨️ Typing cleaned address: ${cleanAddress}`);

        // Move mouse to search input and click
        const searchElement = await page.$(searchInput);
        const box = await searchElement.boundingBox();
        if (box) {
          // Move mouse to a random point within the element
          const x = box.x + Math.random() * box.width;
          const y = box.y + Math.random() * box.height;
          await page.mouse.move(x, y);
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        }

        await page.click(searchInput);
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 300));

        // Clear any existing text
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await new Promise(resolve => setTimeout(resolve, 50));

        // Type cleaned address with human-like delays
        for (const char of cleanAddress) {
          await page.keyboard.type(char);
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
        }

        // Wait for reactive search results to appear (no Enter needed)
        console.log(`🔍 Waiting for reactive search results...`);
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

        // Wait for results with more sophisticated loading detection
        console.log(`⏳ Waiting for search results...`);

        // Shorter wait since results appear reactively
        let totalWait = 0;
        const maxWait = 8000; // 8 seconds max for reactive results

        while (totalWait < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          totalWait += 1000;

          // Check if we have meaningful search results
          const hasResults = await page.evaluate(() => {
            const bodyText = document.body.innerText || '';
            // Look for signs that search results are displayed
            return bodyText.includes('Parcel') ||
                   bodyText.includes('Owner') ||
                   bodyText.match(/\d{2,}/); // Contains numbers that might be parcel IDs
          });

          if (hasResults) {
            console.log(`✅ Search results detected after ${totalWait}ms`);
            break;
          }

          console.log(`⏳ Waiting for reactive results... (${totalWait}ms elapsed)`);
        }

        // Short wait to ensure results are stable
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Extract property data
        const propertyData = await page.evaluate(() => {
          // Get page title and URL for debugging
          const pageInfo = {
            title: document.title,
            url: window.location.href,
            bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body'
          };

          // Look for parcel ID and owner name in search results or property details
          const parcelIdSelectors = [
            // Search result specific selectors (avoid styling elements)
            '.search-result .property-id',
            '.search-result .parcel-number',
            '.search-result .apn',
            '.result-item .property-id',
            '.result-item .parcel-number',
            // Sidebar or info panel selectors (be more specific)
            '.sidebar .property-id',
            '.sidebar .parcel-number',
            '.info-panel .property-id',
            '.info-panel .parcel-number',
            // General property info (avoid styling)
            '.property-info .id',
            '.property-details .id'
          ];

          const ownerNameSelectors = [
            // Common patterns for owner names
            '*[class*="owner"]:not([class*="style"])',
            '*[id*="owner"]',
            '.owner-name',
            '.property-owner',
            '.owner-info',
            // General selectors for owner info
            '.owner-details',
            '.owner',
            // Search result selectors
            '.search-result *',
            '.property-details *',
            '.result-item *',
            // Sidebar or info panel selectors
            '.sidebar *',
            '.info-panel *',
            '.property-info *'
          ];

          let parcelId = null;
          let ownerName = null;
          let foundElements = [];

          // Try to find parcel ID (skip styling elements and addresses)
          for (const selector of parcelIdSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                const text = element.textContent.trim();
                // Skip CSS styling elements, addresses, and other non-parcel content
                if (!text.includes('Base Parcel') &&
                    !text.includes('Style') &&
                    !text.includes('Color') &&
                    !text.includes('#') &&
                    !text.includes('Hovered') &&
                    !text.includes('Selected') &&
                    !text.includes('Reset') &&
                    !text.includes('Default') &&
                    !text.match(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd)\b/i) &&
                    text.length < 100) { // Reasonable length for a parcel ID
                  parcelId = text;
                  foundElements.push(`Parcel found with ${selector}: ${parcelId}`);
                  break;
                }
              }
            } catch (e) {}
          }

          // Try to find owner name
          for (const selector of ownerNameSelectors) {
            try {
              const element = document.querySelector(selector);
              if (element && element.textContent.trim()) {
                ownerName = element.textContent.trim();
                foundElements.push(`Owner found with ${selector}: ${ownerName}`);
                break;
              }
            } catch (e) {}
          }

          // Look for any text that might contain parcel or owner info
          const textNodes = Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent?.toLowerCase() || '';
            return (text.includes('parcel') || text.includes('owner') || text.includes('apn') ||
                   text.match(/\d{2,}/)) && // Look for numbers that might be parcel IDs
                   text.length < 200 && el.children.length === 0 &&
                   !text.includes('style') && !text.includes('color'); // Exclude styling elements
          }).map(el => el.textContent?.trim()).filter(Boolean).slice(0, 15);

          // Also look for any visible text that looks like parcel IDs or names
          const allVisibleText = document.body.innerText || '';
          const parcelIdPatterns = [
            /parcel\s*(?:id|number)?[:\s]+([A-Z0-9\-]+)/gi,
            /apn[:\s]+([A-Z0-9\-]+)/gi,
            /property\s*id[:\s]+([A-Z0-9\-]+)/gi
          ];

          const ownerPatterns = [
            /owner[:\s]+([A-Za-z\s,]+?)(?:\n|$|[A-Z]{2}\s+\d)/gi,
            /owned\s*by[:\s]+([A-Za-z\s,]+?)(?:\n|$|[A-Z]{2}\s+\d)/gi
          ];

          // Try pattern matching on visible text
          let patternMatches = [];

          for (const pattern of parcelIdPatterns) {
            const matches = [...allVisibleText.matchAll(pattern)];
            if (matches.length > 0 && !parcelId) {
              parcelId = matches[0][1].trim();
              patternMatches.push(`Parcel ID found via pattern: ${parcelId}`);
              break;
            }
          }

          for (const pattern of ownerPatterns) {
            const matches = [...allVisibleText.matchAll(pattern)];
            if (matches.length > 0 && !ownerName) {
              ownerName = matches[0][1].trim();
              patternMatches.push(`Owner found via pattern: ${ownerName}`);
              break;
            }
          }

          // Final check: Look for Regrid-specific parcel ID formats
          const regridParcelPatterns = [
            /\b(\d{4}-\d{3}-\d{3})\b/,               // Format: "4139-029-027" (hyphenated)
            /\b(\d{2}\s+\d{4}\s+[A-Z0-9]{6})\b/,     // Format: "17 0036 LL0847"
            /\b(\d{2}\s+\d{3}\s+\d{2}\s+\d{3})\b/,   // Format: "18 276 14 016"
            /\b(\d{2}\s+\d{3}\s+\d{3})\b/,           // Format: "18 276 016"
            /\b(\d{1,2}\s+\d{3,4}\s+\d{2,6})\b/,     // General format
            /\b(\d{10,20})\b/,                        // Long numeric IDs like \"06424712060010010\"
            /\b(\d{6,9})\b/                           // Medium numeric IDs like \"06141234\"
          ];

          let regridParcelMatch = null;
          for (const pattern of regridParcelPatterns) {
            regridParcelMatch = allVisibleText.match(pattern);
            if (regridParcelMatch) break;
          }
          if (regridParcelMatch) {
            // Override CSS selector result if we found a pattern match (more reliable)
            parcelId = regridParcelMatch[1];
            patternMatches.push(`Regrid parcel ID found via pattern: ${parcelId}`);
          }

          // Additional check for long numeric parcel IDs (Florida format) or if address was incorrectly selected
          if (!parcelId || parcelId.includes('Ave') || parcelId.includes('St') || parcelId.includes('Drive') || parcelId.includes('Road')) {
            const longNumericMatch = allVisibleText.match(/\b(\d{10,20})\b/);
            if (longNumericMatch) {
              parcelId = longNumericMatch[1];
              patternMatches.push(`Long numeric parcel ID found: ${parcelId}`);
            }
          }

          return {
            parcelId,
            ownerName,
            pageInfo,
            foundElements: [...foundElements, ...patternMatches],
            relevantText: textNodes,
            bodyTextSample: allVisibleText.substring(0, 1000) // Include more text for debugging
          };
        });

        results.push({
          originalAddress: address,
          parcelId: propertyData.parcelId || 'Not found',
          ownerName: propertyData.ownerName || 'Not found',
          status: 'success',
          debug: {
            pageTitle: propertyData.pageInfo?.title,
            pageUrl: propertyData.pageInfo?.url,
            bodyPreview: propertyData.pageInfo?.bodyText,
            foundElements: propertyData.foundElements || [],
            relevantText: propertyData.relevantText || []
          }
        });

        console.log(`✅ Completed: ${address} - Parcel: ${propertyData.parcelId || 'N/A'}`);
        console.log(`📄 Page: ${propertyData.pageInfo?.title || 'Unknown'}`);
        console.log(`🔍 Found elements: ${propertyData.foundElements?.length || 0}`);
        console.log(`📝 Relevant text: ${propertyData.relevantText?.length || 0} items`);

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

      // Add longer delay between requests to avoid rate limiting
      if (addresses.indexOf(address) < addresses.length - 1) {
        console.log(`⏸️ Waiting before next address...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
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