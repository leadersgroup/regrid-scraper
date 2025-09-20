// regrid-scraper-railway.js - Works with regular Puppeteer on Railway
const puppeteer = require('puppeteer');

class RegridScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cookies = null;
        this.csrfToken = null;
    }

    async initialize() {
        console.log('Initializing browser on Railway...');
        
        // Simple browser launch - Railway handles all dependencies
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
                '--disable-gpu'
            ]
        };

        try {
            this.browser = await puppeteer.launch(launchOptions);
            console.log('✓ Browser launched successfully');
        } catch (error) {
            console.error('Failed to launch browser:', error);
            throw error;
        }

        this.page = await this.browser.newPage();

        // Set generous timeouts for Railway
        this.page.setDefaultNavigationTimeout(60000);
        this.page.setDefaultTimeout(60000);

        // Set viewport and user agent
        await this.page.setViewport({ width: 1366, height: 768 });
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

        // Set headers
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
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            await new Promise(resolve => setTimeout(resolve, 3000));

            this.cookies = await this.page.cookies();
            
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

            console.log('✓ Session established successfully');
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            };

            if (this.csrfToken) {
                headers['X-CSRF-Token'] = this.csrfToken;
            }

            await this.page.setExtraHTTPHeaders(headers);

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

            const responseText = await response.text();
            let searchResults;
            
            try {
                searchResults = JSON.parse(responseText);
                console.log('✓ Search results received');
            } catch (parseError) {
                console.log('Response text:', responseText.substring(0, 200) + '...');
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
            console.log(`\n--- Processing ${i + 1}/${addresses.length}: ${address} ---`);
            
            const result = await this.searchProperty(address);
            results.push(result);
            
            // Add delay between requests
            if (i < addresses.length - 1) {
                console.log('Waiting 2 seconds before next request...');
                await new Promise(resolve => setTimeout(resolve, 2000));
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