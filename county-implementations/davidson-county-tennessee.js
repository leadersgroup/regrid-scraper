/**
 * Davidson County, Tennessee (Nashville) - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Assessor: https://portal.padctn.org/OFS/WP/Home
 * - Register of Deeds (Subscription): https://davidsonportal.com/
 * - Register of Deeds (Free Mobile App): Available on iOS/Android (search "Nashville - Davidson Co. ROD")
 *
 * NOTE: Davidson County Register of Deeds requires a paid subscription ($50/month) for online access.
 * This scraper will extract property information and deed references from the Property Assessor,
 * and attempt to access deed PDFs through available public methods.
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class DavidsonCountyTennesseeScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Davidson';
    this.state = 'TN';
    this.debugLogs = []; // Collect debug logs for API response
  }

  /**
   * Override log method - just use parent implementation
   * All logs will be visible in Railway logs
   */
  log(message) {
    // Call parent log method (console.log if verbose)
    super.log(message);
  }

  /**
   * Override initialize to use puppeteer-extra with stealth plugin
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
   * Davidson County can search Property Assessor directly by address
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

      // SKIP STEP 1 (Regrid) - Davidson County doesn't need parcel ID
      // We can search Property Assessor directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Davidson County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Davidson County supports direct address search',
        county: 'Davidson',
        state: 'TN',
        originalAddress: address
      };

      // STEP 2: Search Property Assessor for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://portal.padctn.org/OFS/WP/Home`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Davidson',
          state: 'TN'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://portal.padctn.org/OFS/WP/Home',
        originalAddress: address,
        county: 'Davidson',
        state: 'TN'
      };

      if (!transactionResult.success || !transactionResult.transactions || transactionResult.transactions.length === 0) {
        result.success = false;
        result.message = 'No transactions found on Property Assessor';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        return result;
      }

      // STEP 3: Download the most recent deed
      const mostRecentDeed = transactionResult.transactions[0];
      const deedId = mostRecentDeed.instrumentNumber || `Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`;
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
   * Get deed recorder/clerk URL for Davidson County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Davidson' && state === 'TN') {
      return 'https://davidsonportal.com/';
    }
    return null;
  }

  /**
   * Get Property Assessor URL for Davidson County
   */
  getAssessorUrl(county, state) {
    if (county === 'Davidson' && state === 'TN') {
      return 'https://portal.padctn.org/OFS/WP/Home';
    }
    return null;
  }

  /**
   * Search Davidson County Property Assessor by address
   * URL: https://portal.padctn.org/OFS/WP/Home
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Davidson County TN Property Assessor`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://portal.padctn.org/OFS/WP/Home', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for Quick Search input field
      const searchInputSelectors = [
        'input[type="text"][placeholder*="search"]',
        'input[type="text"][placeholder*="address"]',
        'input[type="text"]',
        '#quickSearchInput',
        'input.search-input'
      ];

      let searchInput = null;
      for (const selector of searchInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchInput = selector;
          this.log(`✅ Found search input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchInput) {
        this.log(`⚠️ Could not find search input field`);
        return {
          success: false,
          message: 'Could not find search input'
        };
      }

      // Enter street address
      await this.page.type(searchInput, streetAddress, { delay: 100 });
      await this.randomWait(1000, 2000);

      this.log(`✅ Entered address: ${streetAddress}`);

      // Press Enter or click search button
      await this.page.keyboard.press('Enter');
      this.log(`⌨️  Pressed Enter to search`);

      // Wait for search results to load
      this.log(`⏳ Waiting for search results to load...`);
      await this.randomWait(5000, 7000);

      // Wait for property details page to load
      try {
        await this.page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('property summary') ||
                 text.includes('property record') ||
                 text.includes('parcel') ||
                 text.includes('owner');
        }, { timeout: 15000 });

        this.log(`✅ Property details page loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for property details page`);
      }

      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found') ||
                            text.includes('no matches');

        const hasPropertyInfo = text.includes('property summary') ||
                               text.includes('property record') ||
                               (text.includes('owner') && text.includes('parcel'));

        return {
          hasNoResults,
          hasPropertyInfo,
          url: window.location.href
        };
      });

      this.log(`🔍 Search result analysis:`);
      this.log(`   Current URL: ${searchStatus.url}`);
      this.log(`   Has property info: ${searchStatus.hasPropertyInfo}`);
      this.log(`   Has "no results" message: ${searchStatus.hasNoResults}`);

      if (!searchStatus.hasNoResults && searchStatus.hasPropertyInfo) {
        this.log(`✅ Property found`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found or search failed`);
        return {
          success: false,
          message: `Property not found (noResults: ${searchStatus.hasNoResults}, hasInfo: ${searchStatus.hasPropertyInfo})`
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
   * Navigate to Historical Data / Sales History and extract transaction records
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Assessor...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Historical Data tab or link
      this.log('🔍 Looking for Historical Data / Sales History...');

      const historicalClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text === 'Historical Data' || text === 'Historical' ||
              text === 'Sales History' || text === 'Sales' ||
              text === 'Transaction History' || text === 'History') {

            if (el.tagName === 'A' || el.tagName === 'BUTTON') {
              el.click();
              return { clicked: true, element: el.tagName, text: text };
            }

            const clickableParent = el.closest('a, button, [onclick]');
            if (clickableParent) {
              clickableParent.click();
              return { clicked: true, element: clickableParent.tagName, text: text };
            }
          }
        }

        return { clicked: false };
      });

      this.log(`🔍 [INFO] Historical data click result: ${JSON.stringify(historicalClicked)}`);

      if (historicalClicked && historicalClicked.clicked) {
        this.log(`✅ Clicked on Historical Data tab (${historicalClicked.text})`);
        await this.randomWait(5000, 7000);

        // Scroll to ensure content is loaded
        await this.page.evaluate(() => {
          window.scrollBy(0, 1000);
        });
        await this.randomWait(2000, 3000);
      } else {
        this.log(`ℹ️  No Historical Data tab found, checking current page for transaction data`);
      }

      // Extract transaction information from the page
      this.log('🔍 Extracting transaction data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for sales/transfer information in tables
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));

          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const rowText = cells.map(c => c.innerText?.trim() || '').join(' ');

            // Look for patterns like:
            // "Book 12345 Page 678"
            // "Instrument No: 20210012345"
            // "Sale Date: 01/15/2020"

            const bookMatch = rowText.match(/Book[:\s]+(\d+)/i);
            const pageMatch = rowText.match(/Page[:\s]+(\d+)/i);
            const instrumentMatch = rowText.match(/Instrument(?:\s+No\.?)?[:\s]+(\d+)/i);
            const saleDateMatch = rowText.match(/Sale\s+Date[:\s]+([\d\/\-]+)/i);

            if (instrumentMatch || (bookMatch && pageMatch)) {
              const transaction = {
                source: 'Davidson County Property Assessor',
                rawText: rowText.substring(0, 300)
              };

              if (instrumentMatch) {
                transaction.instrumentNumber = instrumentMatch[1];
                transaction.type = 'instrument';
              }

              if (bookMatch && pageMatch) {
                transaction.bookNumber = bookMatch[1];
                transaction.pageNumber = pageMatch[1];
                transaction.type = transaction.type || 'book_page';
              }

              if (saleDateMatch) {
                transaction.saleDate = saleDateMatch[1];
              }

              // Avoid duplicates
              const exists = results.some(r =>
                (r.instrumentNumber && r.instrumentNumber === transaction.instrumentNumber) ||
                (r.bookNumber && r.pageNumber &&
                 r.bookNumber === transaction.bookNumber &&
                 r.pageNumber === transaction.pageNumber)
              );

              if (!exists) {
                results.push(transaction);
              }
            }
          }
        }

        // Fallback: Look for patterns in all page text
        if (results.length === 0) {
          const allText = document.body.innerText;
          const lines = allText.split('\n');

          for (const line of lines) {
            const instrumentMatch = line.match(/Instrument(?:\s+No\.?)?[:\s]+(\d{8,})/i);
            if (instrumentMatch && !results.some(r => r.instrumentNumber === instrumentMatch[1])) {
              results.push({
                instrumentNumber: instrumentMatch[1],
                type: 'instrument',
                source: 'Davidson County Property Assessor (text)',
                rawText: line.trim().substring(0, 200)
              });
            }

            const bookPageMatch = line.match(/Book[:\s]+(\d+)[,\s]+Page[:\s]+(\d+)/i);
            if (bookPageMatch && !results.some(r => r.bookNumber === bookPageMatch[1] && r.pageNumber === bookPageMatch[2])) {
              results.push({
                bookNumber: bookPageMatch[1],
                pageNumber: bookPageMatch[2],
                type: 'book_page',
                source: 'Davidson County Property Assessor (text)',
                rawText: line.trim().substring(0, 200)
              });
            }
          }
        }

        return results;
      });

      this.log(`🔍 [INFO] Extracted ${transactions.length} transactions from page`);
      this.log(`🔍 [INFO] Transactions: ${JSON.stringify(transactions.map(t => ({
        type: t.type,
        instrumentNumber: t.instrumentNumber,
        book: t.bookNumber,
        page: t.pageNumber
      })))}`);

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      // Log what we found
      for (const trans of transactions) {
        if (trans.type === 'instrument') {
          this.log(`   Instrument: ${trans.instrumentNumber}`);
        } else if (trans.type === 'book_page') {
          this.log(`   Book/Page: ${trans.bookNumber}/${trans.pageNumber}`);
        }
      }

      return {
        success: transactions.length > 0,
        transactions,
        debugLogs: this.debugLogs // Include debug logs in response
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message,
        debugLogs: this.debugLogs // Include debug logs even on error
      };
    }
  }

  /**
   * Download deed PDF from Davidson County Register of Deeds
   *
   * NOTE: Davidson County requires a paid subscription ($50/month) for online access.
   * This method will attempt to access deeds through publicly available methods.
   * If subscription is required, it will return information about how to access the deed.
   */
  async downloadDeed(transaction) {
    this.log('📄 Attempting to download deed from Davidson County Register of Deeds...');

    try {
      // Check if we have required deed information
      if (!transaction.instrumentNumber && !(transaction.bookNumber && transaction.pageNumber)) {
        throw new Error('No deed reference information available (need instrument number or book/page)');
      }

      const deedRef = transaction.instrumentNumber || `Book ${transaction.bookNumber} Page ${transaction.pageNumber}`;
      this.log(`📍 Deed Reference: ${deedRef}`);

      // Davidson County Register of Deeds requires subscription
      // However, we can try to access through the mobile app endpoint or public portal

      this.log('🌐 Checking Davidson County Register of Deeds portal access...');

      // Try to access the public portal (if available)
      // Note: This is likely to require authentication
      const portalUrl = 'https://davidsonportal.com/';

      try {
        await this.page.goto(portalUrl, {
          waitUntil: 'networkidle2',
          timeout: this.timeout
        });

        await this.randomWait(3000, 5000);

        // Check if login is required
        const needsLogin = await this.page.evaluate(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('login') ||
                 text.includes('sign in') ||
                 text.includes('username') ||
                 text.includes('password') ||
                 text.includes('subscription');
        });

        if (needsLogin) {
          this.log('⚠️  Davidson County Register of Deeds requires subscription/login');

          // Return information about the deed and how to access it
          return {
            success: false,
            requiresSubscription: true,
            message: 'Davidson County Register of Deeds requires a paid subscription ($50/month)',
            deedReference: deedRef,
            instrumentNumber: transaction.instrumentNumber,
            bookNumber: transaction.bookNumber,
            pageNumber: transaction.pageNumber,
            alternativeAccess: {
              subscription: {
                url: 'https://davidsonportal.com/',
                cost: '$50/month (single user) or $25/month (additional users)',
                description: 'Online access to all deed records from 1784 to present'
              },
              mobileApp: {
                name: 'Nashville - Davidson Co. ROD',
                platforms: ['iOS (App Store)', 'Android (Google Play)'],
                cost: 'Free',
                description: 'Free mobile app with access to property documents'
              },
              inPerson: {
                location: '501 Broadway, Suite 301, Nashville, TN 37203',
                hours: 'Monday-Friday, 8:00 AM - 4:30 PM',
                phone: '(615) 862-6790',
                description: 'Free access at public counter'
              }
            },
            instructions: `To access this deed:\n` +
                         `1. Use the free mobile app "Nashville - Davidson Co. ROD" (iOS/Android)\n` +
                         `2. Subscribe to online access at davidsonportal.com ($50/month)\n` +
                         `3. Visit in person at 501 Broadway, Suite 301, Nashville, TN 37203\n` +
                         `\nDeed Reference: ${deedRef}`
          };
        }

        // If we get here, try to search for and download the deed
        // (This code would need to be implemented based on the actual portal interface)
        this.log('🔍 Portal access available, attempting to search for deed...');

        // TODO: Implement search and download logic if public access is available
        throw new Error('Public portal access not yet implemented');

      } catch (portalError) {
        this.log(`⚠️  Could not access deed portal: ${portalError.message}`);

        // Return information about alternative access methods
        return {
          success: false,
          requiresSubscription: true,
          message: 'Could not access Davidson County Register of Deeds - subscription may be required',
          deedReference: deedRef,
          instrumentNumber: transaction.instrumentNumber,
          bookNumber: transaction.bookNumber,
          pageNumber: transaction.pageNumber,
          error: portalError.message,
          alternativeAccess: {
            subscription: {
              url: 'https://davidsonportal.com/',
              cost: '$50/month (single user) or $25/month (additional users)'
            },
            mobileApp: {
              name: 'Nashville - Davidson Co. ROD',
              platforms: ['iOS', 'Android'],
              cost: 'Free'
            },
            inPerson: {
              location: '501 Broadway, Suite 301, Nashville, TN 37203',
              phone: '(615) 862-6790'
            }
          }
        };
      }

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DavidsonCountyTennesseeScraper;
