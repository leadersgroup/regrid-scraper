// regrid-scraper-render.js - Optimized for Render.com deployment
const puppeteer = require('puppeteer-core');

class RegridScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cookies = null;
        this.csrfToken = null;
    }

    async initialize() {
    console.log('Initializing browser on Render...');
    
    // Browser launch configuration for Render.com using puppeteer-core
    const launchOptions = {
        headless: true,
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
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    };

    // For Render, try these Chrome paths in order
    const chromePaths = [
        process.env.GOOGLE_CHROME_BIN,
        process.env.CHROME_BIN,
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
    ].filter(Boolean);

    let browserLaunched = false;
    let lastError = null;

    // Try each Chrome path
    for (const chromePath of chromePaths) {
        try {
            console.log(`Trying Chrome at: ${chromePath}`);
            launchOptions.executablePath = chromePath;
            this.browser = await puppeteer.launch(launchOptions);
            console.log(`Successfully launched Chrome from: ${chromePath}`);
            browserLaunched = true;
            break;
        } catch (error) {
            console.log(`Failed to launch Chrome from ${chromePath}:`, error.message);
            lastError = error;
        }
    }

    // If no specific path worked, try without executablePath
    if (!browserLaunched) {
        try {
            console.log('Trying to launch Chrome without specific path...');
            delete launchOptions.executablePath;
            this.browser = await puppeteer.launch(launchOptions);
            console.log('Successfully launched Chrome using system default');
            browserLaunched = true;
        } catch (error) {
            console.log('Failed to launch Chrome with system default:', error.message);
            lastError = error;
        }
    }

    if (!browserLaunched) {
        throw new Error(`Could not launch Chrome. Last error: ${lastError?.message}`);
    }

    this.page = await this.browser.newPage();

    // Set realistic viewport and user agent (same as your working version)
    await this.page.setViewport({ width: 1366, height: 768 });
    await this.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36');

    // Set extra headers (same as your working version)
    await this.page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br, zstd'
    });

    console.log('Browser initialized successfully');
}



    async establishSession() {
        try {
            console.log('Navigating to Regrid to establish session...');
            
            // Navigate to the main page first (exactly like your working version)
            await this.page.goto('https://app.regrid.com/us', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Wait a bit for the page to fully load
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract cookies and CSRF token from the page (same logic as your working version)
            this.cookies = await this.page.cookies();
            
            // Try to find CSRF token in meta tags or page content
            try {
                this.csrfToken = await this.page.evaluate(() => {
                    const metaTag = document.querySelector('meta[name="csrf-token"]');
                    if (metaTag) {
                        return metaTag.getAttribute('content');
                    }
                    
                    // Alternative: look for it in script tags or other locations
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

            console.log('Session established successfully');
            console.log(`Found ${this.cookies.length} cookies`);
            if (this.csrfToken) {
                console.log('CSRF token extracted');
            }

        } catch (error) {
            console.error('Error establishing session:', error);
            throw error;
        }
    }

    async searchProperty(address) {
        try {
            console.log(`Searching for property: ${address}`);

            // Prepare the search URL (exactly like your working version)
            const encodedAddress = encodeURIComponent(address);
            const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

            console.log('Making API request to:', searchUrl);

            // Set extra headers for the request (exactly like your working version)
            const headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br, zstd',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://app.regrid.com/us',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
            };

            if (this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }

            await this.page.setExtraHTTPHeaders(headers);

            // Navigate to the search URL
            const response = await this.page.goto(searchUrl, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            if (!response) {
                throw new Error('No response received from server');
            }

            if (!response.ok()) {
                throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
            }

            // Get the response text and parse as JSON (exactly like your working version)
            const responseText = await response.text();
            let searchResults;
            
            try {
                searchResults = JSON.parse(responseText);
                console.log('Search results received');
            } catch (parseError) {
                console.log('Response text:', responseText.substring(0, 200) + '...');
                throw new Error('Invalid JSON response from server');
            }

            return this.parseSearchResults(searchResults, address);

        } catch (error) {
            console.error('Error searching property:', error);
            throw error;
        }
    }

    parseSearchResults(results, originalAddress) {
        try {
            // Handle both array and object response formats (exactly like your working version)
            let resultsArray;
            if (Array.isArray(results)) {
                resultsArray = results;
            } else if (results && results.results && Array.isArray(results.results)) {
                resultsArray = results.results;
            } else {
                console.log('No results found or invalid format');
                return {
                    originalAddress: originalAddress,
                    error: 'No results found'
                };
            }

            if (resultsArray.length === 0) {
                console.log('No results found');
                return {
                    originalAddress: originalAddress,
                    error: 'No results found'
                };
            }

            console.log(`Found ${resultsArray.length} result(s)`);

            // Take the first result (most relevant)
            const property = resultsArray[0];
            
            if (!property) {
                console.log('No property data in results');
                return {
                    originalAddress: originalAddress,
                    error: 'No property data found'
                };
            }

            // Extract parcel ID and owner information (exactly like your working version)
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
        // Try different possible fields for owner name (exactly like your working version)
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

        // If no direct owner field, check nested objects
        if (property.owner_info) {
            return property.owner_info.name || property.owner_info.full_name || 'Owner info found but name unclear';
        }

        return 'Not found';
    }

    extractCityFromContext(context) {
        if (!context) return null;
        // Context format appears to be "City, State"
        const parts = context.split(',');
        return parts[0] ? parts[0].trim() : null;
    }

    extractStateFromContext(context) {
        if (!context) return null;
        // Context format appears to be "City, State"
        const parts = context.split(',');
        return parts[1] ? parts[1].trim() : null;
    }

    async searchMultipleProperties(addresses) {
        const results = [];
        
        for (let i = 0; i < addresses.length; i++) {
            const address = addresses[i];
            console.log(`\n--- Processing ${i + 1}/${addresses.length}: ${address} ---`);
            
            try {
                const result = await this.searchProperty(address);
                results.push(result);
                
                // Add delay between requests to avoid rate limiting (same as your working version)
                if (i < addresses.length - 1) {
                    console.log('Waiting 2 seconds before next request...');
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

module.exports = RegridScraper;