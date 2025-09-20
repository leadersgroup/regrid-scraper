// api/scrape.js - Vercel serverless function using Playwright

class RegridScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cookies = null;
        this.csrfToken = null;
    }

    async initialize() {
        console.log('Initializing browser with Playwright...');
        
        const isVercel = !!process.env.VERCEL_ENV;
        console.log('Is Vercel environment:', isVercel);
        
        let playwright;
        let launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        };

        if (isVercel) {
            try {
                // Use Playwright AWS Lambda for Vercel
                console.log('Loading Playwright for Vercel...');
                const playwrightAWS = await import('playwright-aws-lambda');
                
                this.browser = await playwrightAWS.launchChromium({
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor',
                        '--disable-background-timer-throttling',
                        '--disable-renderer-backgrounding',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-sync',
                        '--disable-translate',
                        '--disable-default-apps',
                        '--no-first-run',
                        '--no-default-browser-check'
                    ]
                });
                
                console.log('✓ Playwright browser launched successfully');
                
            } catch (playwrightError) {
                console.error('Error loading Playwright AWS:', playwrightError);
                throw new Error(`Failed to load Playwright: ${playwrightError.message}`);
            }
        } else {
            // Use regular Playwright for local development
            console.log('Loading regular Playwright for local development...');
            const { chromium } = await import('playwright');
            this.browser = await chromium.launch(launchOptions);
        }

        this.page = await this.browser.newPage();

        // Set timeouts appropriate for serverless
        this.page.setDefaultNavigationTimeout(25000);
        this.page.setDefaultTimeout(25000);

        // Set realistic viewport and user agent
        await this.page.setViewportSize({ width: 1366, height: 768 });
        await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Set extra headers
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });

        console.log('Browser initialized successfully');
    }

    async establishSession() {
        try {
            console.log('Establishing session with Regrid...');
            
            await this.page.goto('https://app.regrid.com/us', {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });

            await this.page.waitForSelector('body', { timeout: 5000 });
            await this.page.waitForTimeout(2000);

            // Get cookies
            const cookies = await this.page.context().cookies();
            this.cookies = cookies;
            
            try {
                this.csrfToken = await this.page.evaluate(() => {
                    const metaTag = document.querySelector('meta[name="csrf-token"]');
                    if (metaTag) {
                        return metaTag.getAttribute('content');
                    }
                    
                    const scriptTags = Array.from(document.querySelectorAll('script'));
                    for (const script of scriptTags) {
                        const text = script.textContent || script.innerText;
                        const match = text.match(/csrf[_-]?token["']?\s*[:=]\s*["']([^"']+)["']/i);
                        if (match) {
                            return match[1];
                        }
                    }
                    
                    return null;
                });
            } catch (error) {
                console.log('Could not extract CSRF token from page');
            }

            console.log('✓ Session established');
            console.log(`Found ${this.cookies.length} cookies`);

        } catch (error) {
            console.error('Error establishing session:', error);
            throw error;
        }
    }

    async searchProperty(address) {
        try {
            console.log(`Searching for property: ${address}`);

            const encodedAddress = encodeURIComponent(address);
            const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

            const headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://app.regrid.com/us',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            };

            if (this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }

            await this.page.setExtraHTTPHeaders(headers);

            const response = await this.page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            if (!response || !response.ok()) {
                throw new Error(`HTTP ${response?.status() || 'unknown'}: ${response?.statusText() || 'No response'}`);
            }

            const responseText = await response.text();
            let searchResults;
            
            try {
                searchResults = JSON.parse(responseText);
                console.log('✓ Search results received');
            } catch (parseError) {
                throw new Error('Invalid JSON response from server');
            }

            return this.parseSearchResults(searchResults, address);

        } catch (error) {
            console.error('Error searching property:', error);
            return {
                originalAddress: address,
                error: error.message
            };
        }
    }

    parseSearchResults(results, originalAddress) {
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
            
            if (!property) {
                return {
                    originalAddress: originalAddress,
                    error: 'No property data found'
                };
            }

            const parcelData = {
                originalAddress: originalAddress,
                parcelId: property.parcelnumb || property.ll_uuid || property.parcel_id || property.id || 'Not found',
                ownerName: property.owner || this.extractOwnerName(property),
                address: property.headline || property.address || property.formatted_address || 'Not found',
                city: this.extractCityFromContext(property.context) || property.city || 'Not found',
                state: this.extractStateFromContext(property.context) || property.state || 'Not found',
                zipCode: property.zip || property.postal_code || 'Not found',
                county: property.county || 'Not found',
                propertyType: property.type || property.property_type || 'Not found',
                score: property.score || 'Not found',
                path: property.path || 'Not found',
                centroid: property.centroid || 'Not found'
            };

            return parcelData;

        } catch (error) {
            console.error('Error parsing search results:', error);
            return {
                originalAddress: originalAddress,
                error: error.message
            };
        }
    }

    extractOwnerName(property) {
        const ownerFields = [
            'owner',
            'owner_name', 
            'owner_1',
            'owner_full_name',
            'property_owner',
            'owner_display_name'
        ];

        for (const field of ownerFields) {
            if (property[field]) {
                return property[field];
            }
        }

        if (property.owner_info) {
            return property.owner_info.name || property.owner_info.full_name || 'Owner info found but name unclear';
        }

        return 'Not found';
    }

    extractCityFromContext(context) {
        if (!context) return null;
        const parts = context.split(',');
        return parts[0] ? parts[0].trim() : null;
    }

    extractStateFromContext(context) {
        if (!context) return null;
        const parts = context.split(',');
        return parts[1] ? parts[1].trim() : null;
    }

    async searchMultipleProperties(addresses) {
        const results = [];
        
        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            console.log(`Processing ${i + 1}/${addresses.length}: ${address}`);
            
            const result = await this.searchProperty(address);
            results.push(result);
            
            // Small delay between requests
            if (i < addresses.length - 1) {
                await this.page.waitForTimeout(1000);
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

// Main handler function
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'ready',
            message: 'Regrid Property Scraper API (Vercel + Playwright)',
            timestamp: new Date().toISOString(),
            platform: 'vercel',
            engine: 'playwright',
            nodeVersion: process.version,
            environment: process.env.VERCEL_ENV || 'local'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== Scraping Request (Vercel + Playwright) ===');
    console.log('Environment:', process.env.VERCEL_ENV);
    console.log('Node version:', process.version);
    
    let scraper = null;
    
    try {
        const { addresses } = req.body || {};
        
        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' });
        }

        if (addresses.length > 2) {
            return res.status(400).json({ error: 'Maximum 2 addresses per request on Vercel' });
        }

        console.log(`Processing ${addresses.length} addresses:`, addresses);

        scraper = new RegridScraper();
        
        await scraper.initialize();
        await scraper.establishSession();
        
        const results = await scraper.searchMultipleProperties(addresses);

        const successCount = results.filter(r => r && !r.error).length;
        
        console.log(`Completed: ${successCount}/${addresses.length} successful`);
        
        return res.status(200).json({
            success: true,
            data: results,
            summary: {
                total: addresses.length,
                successful: successCount,
                failed: addresses.length - successCount
            },
            timestamp: new Date().toISOString(),
            platform: 'vercel',
            engine: 'playwright',
            environment: process.env.VERCEL_ENV || 'local'
        });

    } catch (error) {
        console.error('Scraping error:', error);
        return res.status(500).json({
            error: 'Scraping failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString(),
            platform: 'vercel',
            engine: 'playwright',
            environment: process.env.VERCEL_ENV || 'local'
        });
    } finally {
        if (scraper) {
            await scraper.close();
        }
    }
};