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

        // Detect if we're on Railway/Linux or local development
        const isLinux = process.platform === 'linux';
        const executablePath = isLinux
            ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
            : undefined; // Let puppeteer find Chrome on Mac/Windows

        // Simple browser launch - Railway handles all dependencies
        const launchOptions = {
            headless: true,
            ...(executablePath && { executablePath }),
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

            // Generate multiple search query combinations
            // Regrid often fails with direction suffixes (NE, NW, SE, SW, N, S, E, W)
            const searchQueries = this.generateSearchQueries(address);
            console.log(`Will try ${searchQueries.length} search combinations`);

            // Try each query until we get results
            for (const searchQuery of searchQueries) {
                console.log(`  Trying: "${searchQuery}"`);

                const encodedAddress = encodeURIComponent(searchQuery);
                const searchUrl = `https://app.regrid.com/search.json?query=${encodedAddress}&autocomplete=1&context=false&strict=false`;

                try {
                    const searchResults = await this.page.evaluate(async (url, token) => {
                        const headers = {
                            'Accept': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest'
                        };

                        if (token) {
                            headers['X-CSRF-Token'] = token;
                        }

                        const response = await fetch(url, {
                            method: 'GET',
                            headers: headers,
                            credentials: 'include'
                        });

                        if (!response.ok) {
                            const text = await response.text();
                            throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
                        }

                        return await response.json();
                    }, searchUrl, this.csrfToken);

                    // Check if we got valid results
                    if (Array.isArray(searchResults) && searchResults.length > 0) {
                        console.log(`✓ Found ${searchResults.length} results with query: "${searchQuery}"`);
                        return this.parseSearchResults(searchResults, address);
                    }

                    // Small delay between retries
                    await new Promise(resolve => setTimeout(resolve, 500));

                } catch (queryError) {
                    console.log(`  Query failed: ${queryError.message}`);
                    // Continue to next query
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            // All queries failed
            console.log('✗ No results found with any query combination');
            return {
                originalAddress: address,
                error: 'No results found'
            };

        } catch (error) {
            console.error('Error searching property:', error);
            return {
                originalAddress: address,
                error: error.message
            };
        }
    }

    generateSearchQueries(address) {
        const queries = [];

        // Parse address components
        // Format: "3131 Lanier Dr NE, Atlanta, GA 30319, USA"
        const parts = address.split(',').map(p => p.trim());
        const streetPart = parts[0] || '';
        const cityPart = parts[1] || '';
        const stateZipPart = parts[2] || '';

        // Extract state from "GA 30319"
        const stateMatch = stateZipPart.match(/^([A-Z]{2})/);
        const state = stateMatch ? stateMatch[1] : '';

        // Parse street address: "3131 Lanier Dr NE"
        // Extract: street number, street name, optional direction
        const streetMatch = streetPart.match(/^(\d+)\s+(.+?)(?:\s+(N|S|E|W|NE|NW|SE|SW|North|South|East|West|Northeast|Northwest|Southeast|Southwest))?$/i);

        if (streetMatch) {
            const streetNumber = streetMatch[1];
            const streetName = streetMatch[2];
            const direction = streetMatch[3] || '';

            // Priority 1: Street number + street name WITHOUT direction (highest success rate)
            queries.push(`${streetNumber} ${streetName}`);

            // Priority 2: Street number + street name + city (without direction)
            if (cityPart) {
                queries.push(`${streetNumber} ${streetName} ${cityPart}`);
            }

            // Priority 3: Street number + street name + city + state (without direction)
            if (cityPart && state) {
                queries.push(`${streetNumber} ${streetName} ${cityPart} ${state}`);
            }

            // Priority 4: Include direction (as fallback)
            if (direction) {
                queries.push(`${streetNumber} ${streetName} ${direction}`);

                if (cityPart) {
                    queries.push(`${streetNumber} ${streetName} ${direction} ${cityPart}`);
                }

                if (cityPart && state) {
                    queries.push(`${streetNumber} ${streetName} ${direction} ${cityPart} ${state}`);
                }
            }
        } else {
            // Fallback: just use the original street part
            queries.push(streetPart);

            if (cityPart) {
                queries.push(`${streetPart} ${cityPart}`);
            }

            if (cityPart && state) {
                queries.push(`${streetPart} ${cityPart} ${state}`);
            }
        }

        // Remove duplicates
        return [...new Set(queries)];
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