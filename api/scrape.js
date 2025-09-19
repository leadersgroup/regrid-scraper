// api/scrape.js - Updated for Node.js 22 and latest dependencies

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  console.log('=== Function Start ===');
  console.log('Node version:', process.version);
  console.log('Method:', req.method);
  
  // Set headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    console.log('CORS preflight request');
    return res.status(200).json({ message: 'CORS OK' });
  }

  if (req.method === 'GET') {
    console.log('GET request - health check');
    try {
      const chromiumPath = await chromium.executablePath();
      return res.status(200).json({ 
        message: 'API is working',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        chromiumPath: chromiumPath ? 'Available' : 'Not found',
        method: 'GET'
      });
    } catch (error) {
      return res.status(200).json({
        message: 'API is working but Chromium check failed',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        chromiumError: error.message,
        method: 'GET'
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;
  
  try {
    console.log('Processing POST request');
    
    const { addresses } = req.body || {};
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses per request' });
    }

    console.log('Addresses to process:', addresses.length);

    // Initialize browser with updated settings for Node.js 22
    console.log('Starting Puppeteer...');
    
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--no-zygote'
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    console.log('Browser launched successfully');
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Establishing session with Regrid...');
    
    // Navigate to Regrid
    await page.goto('https://app.regrid.com/us', {
      waitUntil: 'networkidle2',
      timeout: 25000 // Reduced timeout for Vercel
    });

    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Session established');

    const results = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      console.log(`Processing ${i + 1}/${addresses.length}: ${address}`);
      
      try {
        const result = await searchProperty(page, address);
        results.push(result);
        console.log(`Result: ${result.error ? 'Error' : 'Success'}`);
        
        // Add delay between requests
        if (i < addresses.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (error) {
        console.error(`Error processing ${address}:`, error.message);
        results.push({
          originalAddress: address,
          error: error.message
        });
      }
    }

    await browser.close();
    browser = null;

    console.log('Processing complete');
    return res.status(200).json({ success: true, data: results });

  } catch (error) {
    console.error('=== Handler Error ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

async function searchProperty(page, address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

    console.log(`Searching: ${searchUrl}`);

    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://app.regrid.com/us',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    await page.setExtraHTTPHeaders(headers);

    const response = await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    if (!response || !response.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    const responseText = await response.text();
    console.log(`Response length: ${responseText.length}`);
    
    let searchResults;
    try {
      searchResults = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Invalid JSON response from Regrid');
    }

    return parseSearchResults(searchResults, address);

  } catch (error) {
    throw error;
  }
}

function parseSearchResults(results, originalAddress) {
  try {
    let resultsArray;
    if (Array.isArray(results)) {
      resultsArray = results;
    } else if (results && results.results && Array.isArray(results.results)) {
      resultsArray = results.results;
    } else {
      return {
        originalAddress: originalAddress,
        error: 'No results found'
      };
    }

    if (resultsArray.length === 0) {
      return {
        originalAddress: originalAddress,
        error: 'No results found'
      };
    }

    const property = resultsArray[0];
    
    const parcelData = {
      originalAddress: originalAddress,
      parcelId: property.parcelnumb || property.ll_uuid || property.parcel_id || property.id || 'Not found',
      ownerName: property.owner || 'Not found',
      address: property.headline || property.address || property.formatted_address || 'Not found',
      city: extractCityFromContext(property.context) || property.city || 'Not found',
      state: extractStateFromContext(property.context) || property.state || 'Not found',
      zipCode: property.zip || property.postal_code || 'Not found',
      county: property.county || 'Not found',
      propertyType: property.type || property.property_type || 'Not found',
      score: property.score || 'Not found',
      path: property.path || 'Not found'
    };

    return parcelData;

  } catch (error) {
    return {
      originalAddress: originalAddress,
      error: error.message
    };
  }
}

function extractCityFromContext(context) {
  if (!context) return null;
  const parts = context.split(',');
  return parts[0] ? parts[0].trim() : null;
}

function extractStateFromContext(context) {
  if (!context) return null;
  const parts = context.split(',');
  return parts[1] ? parts[1].trim() : null;
}