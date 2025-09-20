// api/scrape.js - Progressive testing to isolate 503 error

module.exports = async function handler(req, res) {
  console.log('=== Function Started ===');
  
  // Set headers immediately
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  try {
    console.log('Method:', req.method);
    console.log('Node version:', process.version);
    console.log('Environment:', process.env.NODE_ENV);

    if (req.method === 'OPTIONS') {
      console.log('CORS preflight');
      return res.status(200).json({ message: 'CORS OK' });
    }

    if (req.method === 'GET') {
      console.log('GET request - running diagnostics');
      
      // Test 1: Basic function works
      const basicTest = {
        status: 'Function is running',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage()
      };

      // Test 2: Can we import dependencies?
      let dependencyTest = {};
      try {
        console.log('Testing dependency imports...');
        
        // Test Chromium import
        const chromium = require('@sparticuz/chromium');
        dependencyTest.chromium = 'Import successful';
        
        // Test Puppeteer import
        const puppeteer = require('puppeteer-core');
        dependencyTest.puppeteer = 'Import successful';
        
        // Test Chromium executable path
        const executablePath = await chromium.executablePath();
        dependencyTest.chromiumPath = executablePath ? 'Available' : 'Not found';
        
        console.log('Dependencies loaded successfully');
        
      } catch (depError) {
        console.error('Dependency error:', depError);
        dependencyTest.error = depError.message;
        dependencyTest.stack = depError.stack;
      }

      // Test 3: Can we start browser? (Only if dependencies work)
      let browserTest = {};
      if (!dependencyTest.error) {
        try {
          console.log('Testing browser launch...');
          
          const chromium = require('@sparticuz/chromium');
          const puppeteer = require('puppeteer-core');
          
          const browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
          });
          
          browserTest.launch = 'Success';
          console.log('Browser launched successfully');
          
          // Quick test
          const page = await browser.newPage();
          await page.goto('https://example.com', { timeout: 10000 });
          browserTest.navigation = 'Success';
          
          await browser.close();
          console.log('Browser test completed');
          
        } catch (browserError) {
          console.error('Browser error:', browserError);
          browserTest.error = browserError.message;
          browserTest.stack = browserError.stack?.substring(0, 500); // Truncate stack
        }
      } else {
        browserTest.skipped = 'Dependencies failed';
      }

      return res.status(200).json({
        message: 'Diagnostic complete',
        tests: {
          basic: basicTest,
          dependencies: dependencyTest,
          browser: browserTest
        }
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // POST request - simplified processing
    console.log('POST request received');
    
    const { addresses } = req.body || {};
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length > 5) { // Reduced limit for testing
      return res.status(400).json({ error: 'Maximum 5 addresses per request for testing' });
    }

    console.log('Processing addresses:', addresses);

    // For now, return mock data to test the pipeline
    const mockResults = addresses.map(address => ({
      originalAddress: address,
      parcelId: 'MOCK-123456',
      ownerName: 'MOCK OWNER NAME',
      address: 'Mock Address',
      city: 'Mock City',
      state: 'MC',
      zipCode: '12345',
      county: 'Mock County',
      propertyType: 'Mock Property',
      score: 95,
      note: 'This is mock data - real scraping temporarily disabled for testing'
    }));

    console.log('Returning mock results');
    return res.status(200).json({ 
      success: true, 
      data: mockResults,
      mode: 'mock'
    });

  } catch (error) {
    console.error('=== CRITICAL ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Function error',
      message: error.message,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};