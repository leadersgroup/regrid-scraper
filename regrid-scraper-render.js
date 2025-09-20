// regrid-scraper-render.js - Optimized for Docker deployment with better error handling
const puppeteer = require('puppeteer');

class RegridScraper {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cookies = null;
        this.csrfToken = null;
    }

   
    async initialize() {
    console.log('Initializing browser in Docker...');
    
    // Minimal browser launch for Docker environment
    const launchOptions = {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote'
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

    // Set very generous timeouts
    this.page.setDefaultNavigationTimeout(120000); // 2 minutes
    this.page.setDefaultTimeout(120000);

    // Minimal setup
    await this.page.setViewport({ width: 1280, height: 720 });
    await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    console.log('Browser initialized successfully');
}



async establishSession() {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            attempt++;
            console.log(`Establishing session (attempt ${attempt}/${maxRetries})...`);
            
            // Navigate to the main page with more generous timeout
            console.log('Navigating to Regrid...');
            
            // Start with a simple request to test connectivity
            const response = await this.page.goto('https://app.regrid.com/us', {
                waitUntil: 'domcontentloaded', // Most lenient wait condition
                timeout: 90000 // 90 seconds - very generous
            });

            console.log(`Page response status: ${response.status()}`);
            
            if (!response.ok()) {
                throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
            }

            console.log('Page loaded successfully, waiting for stability...');
            
            // Wait for page to be ready - with timeout
            try {
                await this.page.waitForSelector('body', { timeout: 15000 });
                console.log('Body element found');
            } catch (error) {
                console.log('Body selector timeout, but continuing...');
            }
            
            // Shorter wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract cookies and CSRF token from the page
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

            console.log('✓ Session established successfully');
            console.log(`Found ${this.cookies.length} cookies`);
            if (this.csrfToken) {
                console.log('CSRF token extracted');
            }

            return; // Success, exit retry loop

        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                throw new Error(`Failed to establish session after ${maxRetries} attempts. Last error: ${error.message}`);
            }
            
            // Wait before retry
            console.log('Waiting 10 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
}

    async searchProperty(address) {
        const maxRetries = 2;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                attempt++;
                console.log(`Searching for property: ${address} (attempt ${attempt}/${maxRetries})`);

                // Prepare the search URL
                const encodedAddress = encodeURIComponent(address);
                const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

                console.log('Making API request to:', searchUrl);

                // Set extra headers for the request
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

                // Navigate to the search URL with timeout
                const response = await this.page.goto(searchUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000
                });

                if (!response) {
                    throw new Error('No response received from server');
                }

                if (!response.ok()) {
                    throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
                }

                // Get the response text and parse as JSON
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
                console.error(`Search attempt ${attempt} failed:`, error.message);
                
                if (attempt === maxRetries) {
                    console.error('All search attempts failed');
                    return {
                        originalAddress: address,
                        error: `Search failed after ${maxRetries} attempts: ${error.message}`
                    };
                }
                
                // Wait before retry
                console.log('Waiting 3 seconds before retry...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

    parseSearchResults(results, originalAddress) {
        try {
            // Handle both array and object response formats
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

            // Extract parcel ID and owner information
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
        // Try different possible fields for owner name
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
                
                // Add delay between requests to avoid rate limiting
                if (i < addresses.length - 1) {
                    console.log('Waiting 3 seconds before next request...');
                    await new Promise(resolve => setTimeout(resolve, 3000));
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