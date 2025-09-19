const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;
  
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses per request' });
    }

    console.log('Starting browser...');
    
    // Launch browser optimized for Vercel
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

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

    const results = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      console.log(`Processing ${i + 1}/${addresses.length}: ${address}`);
      
      try {
        const result = await searchProperty(page, address);
        results.push(result);
        
        // Add delay between requests
        if (i < addresses.length - 1) {
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

    res.status(200).json({ success: true, data: results });

  } catch (error) {
    console.error('Handler error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
}

async function searchProperty(page, address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

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
    let searchResults;
    
    try {
      searchResults = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error('Invalid JSON response from server');
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