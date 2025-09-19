const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  // Set headers first thing
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  console.log('=== Function Start ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  try {
    if (req.method === 'OPTIONS') {
      console.log('Handling CORS preflight');
      return res.status(200).json({ message: 'CORS OK' });
    }

    if (req.method === 'GET') {
      console.log('GET request - returning test response');
      return res.status(200).json({ 
        message: 'API is working', 
        timestamp: new Date().toISOString(),
        chromiumPath: await chromium.executablePath(),
        available: true 
      });
    }

    if (req.method !== 'POST') {
      console.log('Method not allowed:', req.method);
      return res.status(405).json({ error: `Method ${req.method} not allowed. Use POST.` });
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = req.body;
      if (typeof requestBody === 'string') {
        requestBody = JSON.parse(requestBody);
      }
    } catch (parseError) {
      console.error('Body parse error:', parseError);
      return res.status(400).json({ error: 'Invalid JSON in request body' });
    }

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    const { addresses } = requestBody;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length === 0) {
      return res.status(400).json({ error: 'At least one address is required' });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses per request' });
    }

    console.log('Processing addresses:', addresses);

    // Test if we can create a simple browser first
    let browser = null;
    try {
      console.log('Starting browser...');
      
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      console.log('Browser started successfully');
      const page = await browser.newPage();
      
      // Set realistic user agent
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');

      console.log('Establishing session...');
      
      // Navigate to Regrid to establish session
      await page.goto('https://app.regrid.com/us', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Session established');

      const results = [];
      
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        console.log(`Processing ${i + 1}/${addresses.length}: ${address}`);
        
        try {
          const result = await searchProperty(page, address);
          results.push(result);
          console.log(`Result for ${address}:`, result);
          
          // Add delay between requests
          if (i < addresses.length - 1) {
            console.log('Waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`Error processing ${address}:`, error);
          results.push({
            originalAddress: address,
            error: error.message
          });
        }
      }

      await browser.close();
      browser = null;

      console.log('Processing complete, returning results');
      return res.status(200).json({ success: true, data: results });

    } catch (browserError) {
      console.error('Browser error:', browserError);
      
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      
      return res.status(500).json({ 
        error: 'Browser initialization failed', 
        details: browserError.message,
        stack: browserError.stack
      });
    }

  } catch (error) {
    console.error('=== HANDLER ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

async function searchProperty(page, address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

    console.log('Searching URL:', searchUrl);

    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://app.regrid.com/us',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    await page.setExtraHTTPHeaders(headers);

    const response = await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (!response || !response.ok()) {
      throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
    }

    const responseText = await response.text();
    console.log('Search response preview:', responseText.substring(0, 200));
    
    let searchResults;
    try {
      searchResults = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse search response:', responseText.substring(0, 500));
      throw new Error('Invalid JSON response from Regrid API');
    }

    return parseSearchResults(searchResults, address);

  } catch (error) {
    console.error(`Search error for ${address}:`, error);
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