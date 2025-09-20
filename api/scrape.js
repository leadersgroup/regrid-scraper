// api/scrape.js - Final working version with full scraping capability

module.exports = async function handler(req, res) {
  console.log('=== Regrid Property Scraper ===');
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ message: 'CORS OK' });
    }

    if (req.method === 'GET') {
      // Health check with full diagnostic
      console.log('Health check requested');
      
      try {
        const chromium = require('@sparticuz/chromium');
        const puppeteer = require('puppeteer-core');
        
        return res.status(200).json({
          status: 'healthy',
          message: 'Property scraper is ready',
          timestamp: new Date().toISOString(),
          nodeVersion: process.version,
          dependencies: {
            chromium: 'Available',
            puppeteer: 'Available'
          },
          ready: true
        });
      } catch (error) {
        return res.status(500).json({
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Main scraping functionality
    const { addresses } = req.body || {};
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length === 0) {
      return res.status(400).json({ error: 'At least one address is required' });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses per request' });
    }

    console.log(`Processing ${addresses.length} address(es):`, addresses);

    // Initialize scraping
    let browser = null;
    try {
      const chromium = require('@sparticuz/chromium');
      const puppeteer = require('puppeteer-core');
      
      console.log('Launching browser...');
      browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      
      // Set realistic user agent and headers
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log('Establishing session with Regrid...');
      await page.goto('https://app.regrid.com/us', {
        waitUntil: 'networkidle2',
        timeout: 25000
      });

      // Wait for page to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Session established successfully');

      // Process each address
      const results = [];
      for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        console.log(`Processing ${i + 1}/${addresses.length}: ${address}`);
        
        try {
          const result = await scrapeProperty(page, address);
          results.push(result);
          
          console.log(`Result for ${address}:`, result.error ? `Error: ${result.error}` : 'Success');
          
          // Rate limiting - delay between requests
          if (i < addresses.length - 1) {
            console.log('Waiting before next request...');
            await new Promise(resolve => setTimeout(resolve, 2000));
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

      console.log('Processing completed successfully');
      
      // Return results
      const successCount = results.filter(r => !r.error).length;
      return res.status(200).json({ 
        success: true, 
        data: results,
        summary: {
          total: addresses.length,
          successful: successCount,
          failed: addresses.length - successCount
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Scraping error:', error);
      
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError.message);
        }
      }
      
      return res.status(500).json({ 
        error: 'Scraping failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

async function scrapeProperty(page, address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

    console.log(`Searching: ${searchUrl}`);

    // Set headers for the API request
    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': 'https://app.regrid.com/us',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };

    await page.setExtraHTTPHeaders(headers);

    // Make the API request
    const response = await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: 20000
    });

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
    }

    const responseText = await response.text();
    console.log(`Response received, length: ${responseText.length}`);
    
    let searchResults;
    try {
      searchResults = JSON.parse(responseText);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Response preview:', responseText.substring(0, 200));
      throw new Error('Invalid JSON response from Regrid API');
    }

    return parsePropertyData(searchResults, address);

  } catch (error) {
    console.error(`Scraping error for ${address}:`, error.message);
    throw error;
  }
}

function parsePropertyData(results, originalAddress) {
  try {
    // Handle both array and object response formats
    let resultsArray;
    if (Array.isArray(results)) {
      resultsArray = results;
    } else if (results && results.results && Array.isArray(results.results)) {
      resultsArray = results.results;
    } else {
      return {
        originalAddress: originalAddress,
        error: 'No results found for this address'
      };
    }

    if (resultsArray.length === 0) {
      return {
        originalAddress: originalAddress,
        error: 'No properties found matching this address'
      };
    }

    console.log(`Found ${resultsArray.length} result(s) for ${originalAddress}`);

    // Take the first (most relevant) result
    const property = resultsArray[0];
    
    // Extract property data
    const propertyData = {
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

    console.log(`Extracted data for ${originalAddress}:`, {
      parcelId: propertyData.parcelId,
      owner: propertyData.ownerName,
      score: propertyData.score
    });

    return propertyData;

  } catch (error) {
    console.error(`Parse error for ${originalAddress}:`, error.message);
    return {
      originalAddress: originalAddress,
      error: `Data parsing failed: ${error.message}`
    };
  }
}

function extractCityFromContext(context) {
  if (!context || typeof context !== 'string') return null;
  const parts = context.split(',');
  return parts[0] ? parts[0].trim() : null;
}

function extractStateFromContext(context) {
  if (!context || typeof context !== 'string') return null;
  const parts = context.split(',');
  return parts[1] ? parts[1].trim() : null;
}