// api/scrape.js - Timeout-optimized version for Vercel

const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async function handler(req, res) {
  console.log('=== Regrid Scraper (Timeout Optimized) ===');
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).json({ message: 'CORS OK' });
    }

    if (req.method === 'GET') {
      return res.status(200).json({
        status: 'ready',
        message: 'Regrid Property Scraper API (Optimized)',
        timestamp: new Date().toISOString()
      });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { addresses } = req.body || {};
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length > 5) { // Reduced for faster processing
      return res.status(400).json({ error: 'Maximum 5 addresses per request' });
    }

    console.log(`Processing ${addresses.length} address(es)`);

    // Initialize with aggressive timeouts
    const scraper = new FastRegridScraper();
    
    try {
      await scraper.initialize();
      await scraper.establishSession();
      
      const results = await scraper.searchMultipleProperties(addresses);
      
      await scraper.close();
      
      return res.status(200).json({ 
        success: true, 
        data: results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      await scraper.close();
      throw error;
    }

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message
    });
  }
};

class FastRegridScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.csrfToken = null;
    }

    async initialize() {
        console.log('Fast browser init...');
        
        // Optimized browser launch with minimal args
        this.browser = await puppeteer.launch({
            args: [
                ...chromium.args,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--single-process',
                '--disable-extensions',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows'
            ],
            defaultViewport: { width: 1280, height: 720 },
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true
        });

        this.page = await this.browser.newPage();
        
        // Minimal setup
        await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('Browser ready');
    }

    async establishSession() {
        try {
            console.log('Quick session setup...');
            
            // Faster navigation with reduced timeout
            await this.page.goto('https://app.regrid.com/us', {
                waitUntil: 'domcontentloaded', // Faster than networkidle2
                timeout: 15000 // Reduced timeout
            });

            // Shorter wait
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Quick CSRF token extraction
            try {
                this.csrfToken = await this.page.evaluate(() => {
                    const metaTag = document.querySelector('meta[name="csrf-token"]');
                    return metaTag ? metaTag.getAttribute('content') : null;
                });
            } catch (error) {
                console.log('No CSRF token found');
            }

            console.log('Session ready');

        } catch (error) {
            console.error('Session error:', error);
            throw error;
        }
    }

    async searchProperty(address) {
        try {
            console.log(`Searching: ${address}`);

            const encodedAddress = encodeURIComponent(address);
            const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

            // Essential headers only
            const headers = {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://app.regrid.com/us'
            };

            if (this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }

            await this.page.setExtraHTTPHeaders(headers);

            // Faster navigation
            const response = await this.page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            if (!response || !response.ok()) {
                throw new Error(`HTTP ${response?.status()}: ${response?.statusText()}`);
            }

            const responseText = await response.text();
            let searchResults;
            
            try {
                searchResults = JSON.parse(responseText);
            } catch (parseError) {
                throw new Error('Invalid JSON response');
            }

            return this.parseResults(searchResults, address);

        } catch (error) {
            console.error(`Search error for ${address}:`, error.message);
            throw error;
        }
    }

    parseResults(results, originalAddress) {
        try {
            let resultsArray = Array.isArray(results) ? results : (results?.results || []);

            if (resultsArray.length === 0) {
                return {
                    originalAddress: originalAddress,
                    error: 'No results found'
                };
            }

            const property = resultsArray[0];
            
            return {
                originalAddress: originalAddress,
                parcelId: property.parcelnumb || property.id || 'Not found',
                ownerName: property.owner || 'Not found',
                address: property.headline || property.address || 'Not found',
                city: this.extractCity(property.context) || 'Not found',
                state: this.extractState(property.context) || 'Not found',
                propertyType: property.type || 'Not found',
                score: property.score || 'Not found'
            };

        } catch (error) {
            return {
                originalAddress: originalAddress,
                error: error.message
            };
        }
    }

    extractCity(context) {
        if (!context) return null;
        const parts = context.split(',');
        return parts[0] ? parts[0].trim() : null;
    }

    extractState(context) {
        if (!context) return null;
        const parts = context.split(',');
        return parts[1] ? parts[1].trim() : null;
    }

    async searchMultipleProperties(addresses) {
        const results = [];
        
        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            console.log(`Processing ${i + 1}/${addresses.length}: ${address}`);
            
            try {
                const result = await this.searchProperty(address);
                results.push(result);
                
                // Shorter delay
                if (i < addresses.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                results.push({
                    originalAddress: address,
                    error: error.message
                });
            }
        }

        return results;
    }

    async close() {
        if (this.browser) {
            try {
                await this.browser.close();
                console.log('Browser closed');
            } catch (error) {
                console.error('Error closing browser:', error);
            }
        }
    }
}