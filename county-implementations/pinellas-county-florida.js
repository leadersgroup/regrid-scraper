/**
 * Pinellas County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.pcpao.gov/
 * - Clerk of Courts (Official Records): https://officialrecords.mypinellasclerk.org/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection on Pinellas County website
puppeteer.use(StealthPlugin());

class PinellasCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Pinellas';
    this.state = 'FL';
    this.debugLogs = []; // Collect debug logs for API response
  }

  /**
   * Override log method to collect logs for debugging
   */
  log(message) {
    // Call parent log method (console.log if verbose)
    super.log(message);
  }

  /**
   * Override initialize to use puppeteer-extra with stealth plugin
   * Pinellas County has strict bot detection
   */
  async initialize() {
    this.log('🚀 Initializing browser with stealth mode...');

    const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
    const isLinux = process.platform === 'linux';

    const executablePath = isRailway || isLinux
      ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
      : undefined;

    this.browser = await puppeteer.launch({
      headless: this.headless,
      ...(executablePath && { executablePath }),
      protocolTimeout: 300000, // 5 minute timeout for protocol operations
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    this.page = await this.browser.newPage();

    // Set realistic user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set realistic viewport
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Add realistic headers
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });

    this.log('✅ Browser initialized with stealth mode');
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Pinellas County can search Property Appraiser directly by address
   */
  async getPriorDeed(address) {
    this.log(`🏁 Starting prior deed download for: ${address}`);
    this.currentAddress = address;

    const startTime = Date.now();
    const result = {
      address,
      timestamp: new Date().toISOString(),
      steps: {}
    };

    try {
      // Initialize browser if not already initialized
      if (!this.browser) {
        await this.initialize();
      }

      // SKIP STEP 1 (Regrid) - Pinellas County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Pinellas County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Pinellas County supports direct address search',
        county: 'Pinellas',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://www.pcpao.gov/quick-search`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Pinellas',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://www.pcpao.gov/quick-search',
        originalAddress: address,
        county: 'Pinellas',
        state: 'FL'
      };

      if (!transactionResult.success || !transactionResult.transactions || transactionResult.transactions.length === 0) {
        result.success = false;
        result.message = 'No transactions found on Property Appraiser';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        return result;
      }

      // STEP 3: Download the most recent deed
      const mostRecentDeed = transactionResult.transactions[0];
      const deedId = mostRecentDeed.documentNumber || mostRecentDeed.bookPage || 'Unknown';
      this.log(`📥 Attempting to download most recent deed: ${deedId}`);

      const downloadResult = await this.downloadDeed(mostRecentDeed);

      result.download = downloadResult;
      result.success = downloadResult.success;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

      return result;

    } catch (error) {
      this.log(`❌ Error in getPriorDeed: ${error.message}`);
      result.success = false;
      result.error = error.message;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      return result;
    }
  }

  /**
   * Get deed recorder/clerk URL for Pinellas County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Pinellas' && state === 'FL') {
      return 'https://officialrecords.mypinellasclerk.org/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Pinellas County
   */
  getAssessorUrl(county, state) {
    if (county === 'Pinellas' && state === 'FL') {
      return 'https://www.pcpao.gov/quick-search';
    }
    return null;
  }

  /**
   * Extract search address (remove city and state)
   * User workflow: search by address without city name and state name
   * Example: "11074 110TH WAY, Largo, FL" -> "11074 110TH WAY"
   */
  extractSearchAddress(fullAddress) {
    // Remove city, state, zip - just keep street address
    const streetAddress = fullAddress.split(',')[0].trim();
    this.log(`🏠 Extracted search address: "${streetAddress}" from "${fullAddress}"`);
    return streetAddress;
  }

  /**
   * Search Pinellas County Property Appraiser by address
   * URL: https://www.pcpao.gov/
   *
   * User workflow:
   * 1. Navigate to https://www.pcpao.gov/
   * 2. Search by address WITHOUT city/state (e.g., "11074 110TH WAY")
   * 3. Autocomplete popup appears - verify same as search, click on it
   * 4. Wait for results to load
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Pinellas County FL Property Appraiser`);
    this.log(`   Using address search (without city/state)`);

    try {
      // Navigate to main property search page
      await this.page.goto('https://www.pcpao.gov/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      const streetAddress = this.extractSearchAddress(fullAddress);

      this.log(`🔍 Searching for: ${streetAddress}`);

      // Look for the PROPERTY search input field (NOT the website search box!)
      // The property search has placeholder: "Address or Street Name (Ex: 255 Capri Cir N 23)"
      const searchInputSelectors = [
        '#txtSearchProperty-selectized',
        '#txtSearchProperty',
        'input[placeholder*="Address or Street"]',
        'input[placeholder*="Capri"]'
      ];

      let searchInput = null;
      for (const selector of searchInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchInput = selector;
          this.log(`✅ Found property search input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchInput) {
        this.log(`⚠️ Could not find property search input field`);
        this.log(`   Make sure you're not using the website search box!`);
        return {
          success: false,
          message: 'Could not find property search input'
        };
      }

      // Clear and type address to trigger autocomplete
      await this.page.click(searchInput, { clickCount: 3 });
      await this.page.type(searchInput, streetAddress, { delay: 100 });

      this.log(`✅ Entered address: ${streetAddress}`);
      this.log(`⏳ Waiting for autocomplete suggestions...`);

      await this.randomWait(2000, 3000);

      // Wait for autocomplete dropdown to appear
      const autocompleteSelectors = [
        '.autocomplete-suggestion',
        '.ui-menu-item',
        '.suggestion',
        '[role="option"]',
        '.search-result'
      ];

      let autocompleteVisible = false;
      for (const selector of autocompleteSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000, visible: true });
          autocompleteVisible = true;
          this.log(`✅ Found autocomplete dropdown: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!autocompleteVisible) {
        this.log(`⚠️ No autocomplete dropdown found, trying Enter key...`);
        await this.page.keyboard.press('Enter');
        await this.randomWait(3000, 5000);
      } else {
        // Click on the first autocomplete suggestion that matches our search
        this.log(`🔍 Looking for matching autocomplete suggestion...`);

        const suggestionClicked = await this.page.evaluate((searchAddr) => {
          // Try different autocomplete selectors
          const selectors = [
            '.autocomplete-suggestion',
            '.ui-menu-item',
            '.suggestion',
            '[role="option"]',
            '.search-result'
          ];

          for (const selector of selectors) {
            const suggestions = Array.from(document.querySelectorAll(selector));

            for (const suggestion of suggestions) {
              const text = (suggestion.innerText || suggestion.textContent || '').trim().toUpperCase();
              const searchUpper = searchAddr.toUpperCase();

              // Verify it matches our search address
              if (text.includes(searchUpper) || searchUpper.includes(text.substring(0, 20))) {
                suggestion.click();
                return { clicked: true, text: text.substring(0, 100) };
              }
            }
          }

          return { clicked: false };
        }, streetAddress);

        if (suggestionClicked.clicked) {
          this.log(`✅ Clicked autocomplete suggestion: ${suggestionClicked.text}`);
          await this.randomWait(3000, 5000);
        } else {
          this.log(`⚠️ Could not find matching suggestion, trying Enter key...`);
          await this.page.keyboard.press('Enter');
          await this.randomWait(3000, 5000);
        }
      }

      // Wait for property detail page to load
      this.log(`⏳ Waiting for property detail page...`);

      try {
        await this.page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('parcel') ||
                 text.includes('miscellaneous') ||
                 text.includes('deed') ||
                 text.includes('owner');
        }, { timeout: 30000 });
        this.log(`✅ Property detail page loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for property detail page`);
      }

      await this.randomWait(3000, 5000);

      // Check if property was found
      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      const pageContent = await this.page.evaluate(() => {
        return {
          text: document.body.innerText,
          hasParcelInfo: document.body.innerText.toLowerCase().includes('parcel'),
          hasMiscellaneous: document.body.innerText.toLowerCase().includes('miscellaneous'),
          hasDeed: document.body.innerText.toLowerCase().includes('deed')
        };
      });

      if (pageContent.hasParcelInfo || pageContent.hasMiscellaneous || pageContent.hasDeed) {
        this.log(`✅ Property found`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found`);
        return {
          success: false,
          message: 'Property not found'
        };
      }

    } catch (error) {
      this.log(`❌ Assessor search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract transaction records from Property Appraiser page
   *
   * User workflow:
   * 5. Locate "Miscellaneous Parcel Info" table
   * 6. Click on first entry in "last recorded deed" (e.g., 22450/0430)
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for "Miscellaneous Parcel Info" table
      this.log('🔍 Looking for "Miscellaneous Parcel Info" table...');

      // Scroll down to ensure all content is loaded
      await this.page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await this.randomWait(2000, 3000);

      // Extract deed information from "Miscellaneous Parcel Info" section
      this.log('🔍 Extracting "last recorded deed" from table...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Method 1: Look for "Miscellaneous Parcel Info" table
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        let inMiscSection = false;
        let foundDeed = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Detect "Miscellaneous Parcel Info" section
          if (line.toLowerCase().includes('miscellaneous') && line.toLowerCase().includes('parcel')) {
            inMiscSection = true;
          }

          if (inMiscSection) {
            // Look for "last recorded deed" label
            if (line.toLowerCase().includes('last recorded deed') || line.toLowerCase().includes('last deed')) {
              // Next line should contain book/page in format: 22450/0430
              const nextLine = lines[i + 1]?.trim();
              if (nextLine) {
                // Match pattern: XXXXX/XXXX (book/page format)
                const bookPageMatch = nextLine.match(/(\d{5})\/(\d{4})/);
                if (bookPageMatch) {
                  foundDeed = {
                    bookNumber: bookPageMatch[1],
                    pageNumber: bookPageMatch[2],
                    bookPage: `${bookPageMatch[1]}/${bookPageMatch[2]}`,
                    source: 'Pinellas County Property Appraiser - Miscellaneous Parcel Info'
                  };
                  break;
                }
              }
            }

            // Alternative: look for any book/page pattern in this section
            const bookPageMatch = line.match(/(\d{5})\/(\d{4})/);
            if (bookPageMatch) {
              foundDeed = {
                bookNumber: bookPageMatch[1],
                pageNumber: bookPageMatch[2],
                bookPage: `${bookPageMatch[1]}/${bookPageMatch[2]}`,
                source: 'Pinellas County Property Appraiser - Miscellaneous Parcel Info'
              };
              break;
            }
          }
        }

        if (foundDeed) {
          results.push(foundDeed);
        }

        // Method 2: Look for clickable link with book/page pattern
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const text = (link.innerText || '').trim();
          const href = link.href || '';

          // Match pattern: XXXXX/XXXX (book/page format)
          const bookPageMatch = text.match(/(\d{5})\/(\d{4})/);
          if (bookPageMatch) {
            const existing = results.find(r => r.bookNumber === bookPageMatch[1] && r.pageNumber === bookPageMatch[2]);
            if (!existing) {
              results.push({
                bookNumber: bookPageMatch[1],
                pageNumber: bookPageMatch[2],
                bookPage: `${bookPageMatch[1]}/${bookPageMatch[2]}`,
                href: href,
                source: 'Pinellas County Property Appraiser'
              });
            }
          }
        }

        // Method 3: Look for any table with deed information
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
          const tableText = table.innerText;

          if (tableText.toLowerCase().includes('deed') || tableText.toLowerCase().includes('miscellaneous')) {
            const rows = Array.from(table.querySelectorAll('tr'));

            for (const row of rows) {
              const rowText = row.innerText;

              // Look for book/page pattern
              const bookPageMatch = rowText.match(/(\d{5})\/(\d{4})/);
              if (bookPageMatch) {
                const existing = results.find(r => r.bookNumber === bookPageMatch[1] && r.pageNumber === bookPageMatch[2]);
                if (!existing) {
                  results.push({
                    bookNumber: bookPageMatch[1],
                    pageNumber: bookPageMatch[2],
                    bookPage: `${bookPageMatch[1]}/${bookPageMatch[2]}`,
                    source: 'Pinellas County Property Appraiser - Table'
                  });
                }
              }
            }
          }
        }

        return results;
      });

      this.log(`🔍 Extracted ${transactions.length} deed record(s)`);

      for (const trans of transactions) {
        this.log(`   📄 Book/Page: ${trans.bookPage} (Book: ${trans.bookNumber}, Page: ${trans.pageNumber})`);
        if (trans.href) this.log(`      Link: ${trans.href}`);
      }

      return {
        success: transactions.length > 0,
        transactions
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download deed PDF from Pinellas County using direct API URL
   *
   * User workflow:
   * 7. PDF loads at: https://www.pcpao.gov/dal/dalapi/getCocDeedBkPg?bk=22450&pg=430
   * Note: Can construct URL directly with book/page numbers
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Pinellas County...');

    try {
      if (!transaction.bookNumber || !transaction.pageNumber) {
        throw new Error('Missing book number or page number for PDF download');
      }

      // Construct direct PDF URL using book and page numbers
      // Format: https://www.pcpao.gov/dal/dalapi/getCocDeedBkPg?bk={book}&pg={page}
      // Note: Page number should NOT have leading zeros (e.g., 430 not 0430)
      const pageNumber = parseInt(transaction.pageNumber, 10);
      const pdfUrl = `https://www.pcpao.gov/dal/dalapi/getCocDeedBkPg?bk=${transaction.bookNumber}&pg=${pageNumber}`;

      this.log(`🔗 Constructed PDF URL: ${pdfUrl}`);
      this.log(`   Book: ${transaction.bookNumber}, Page: ${pageNumber} (original: ${transaction.pageNumber})`);

      // Download PDF using HTTPS with cookies (same method as Orange County)
      this.log(`📥 Downloading PDF from direct API...`);

      const https = require('https');
      const url = require('url');

      // Get cookies from current page
      const cookies = await this.page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const parsedUrl = url.parse(pdfUrl);

      const pdfBuffer = await new Promise((resolve, reject) => {
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.path,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,*/*',
            'Referer': 'https://www.pcpao.gov/',
            'Cookie': cookieString
          }
        };

        https.get(options, (response) => {
          if (response.statusCode === 302 || response.statusCode === 301) {
            // Handle redirect
            const redirectUrl = response.headers.location;
            this.log(`↪️  Redirected to: ${redirectUrl}`);
            reject(new Error(`Redirect to: ${redirectUrl}`));
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }

          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          });
        }).on('error', (error) => {
          reject(error);
        });
      });

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      this.log(`🔍 PDF validation: isPDF=${isPDF}, size=${pdfBuffer.length} bytes`);

      if (!isPDF) {
        // Log first 200 bytes for debugging
        const preview = pdfBuffer.slice(0, 200).toString();
        this.log(`⚠️ File content preview: ${preview.substring(0, 100)}`);
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

      // Save PDF to disk
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      const filename = `pinellas_deed_${transaction.bookNumber}_${transaction.pageNumber}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      // Encode PDF to base64 for API response
      const pdfBase64 = pdfBuffer.toString('base64');

      return {
        success: true,
        filename,
        downloadPath,
        filepath,
        bookNumber: transaction.bookNumber,
        pageNumber: transaction.pageNumber,
        bookPage: transaction.bookPage,
        pdfUrl,
        timestamp: new Date().toISOString(),
        fileSize: pdfBuffer.length,
        pdfBase64
      };

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }


  /**
   * Random wait to avoid detection
   */
  async randomWait(min, max) {
    const wait = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

module.exports = PinellasCountyFloridaScraper;
