/**
 * Brevard County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.bcpao.us/PropertySearch/
 * - Clerk of Courts (Official Records): https://vaclmweb1.brevardclerk.us/AcclaimWeb/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class BrevardCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Brevard';
    this.state = 'FL';
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
   * Brevard County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Brevard County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Brevard County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Brevard County supports direct address search',
        county: 'Brevard',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://www.bcpao.us/PropertySearch/`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Brevard',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://www.bcpao.us/PropertySearch/',
        originalAddress: address,
        county: 'Brevard',
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
   * Get deed recorder/clerk URL for Brevard County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Brevard' && state === 'FL') {
      return 'https://vaclmweb1.brevardclerk.us/AcclaimWeb/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Brevard County
   */
  getAssessorUrl(county, state) {
    if (county === 'Brevard' && state === 'FL') {
      return 'https://www.bcpao.us/PropertySearch/';
    }
    return null;
  }

  /**
   * Search Brevard County Property Appraiser by address
   * URL: https://www.bcpao.us/PropertySearch/
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Brevard County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://www.bcpao.us/PropertySearch/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for address input field
      // Based on web research, the placeholder is "Ex. 123 MAIN ST 32941"
      const addressInputSelectors = [
        'input[placeholder*="MAIN ST"]',
        'input[name*="Address"]',
        'input[placeholder*="Address"]',
        'input[id*="address"]',
        'input[id*="siteAddress"]',
        'input[type="text"]'
      ];

      let addressInput = null;
      for (const selector of addressInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          addressInput = selector;
          this.log(`✅ Found address input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!addressInput) {
        this.log(`⚠️ Could not find address input field`);
        return {
          success: false,
          message: 'Could not find address input'
        };
      }

      // Enter street address
      await this.page.click(addressInput);
      await this.randomWait(200, 400);

      // Clear existing text
      await this.page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) input.value = '';
      }, addressInput);

      // Type address with human-like delays
      for (const char of streetAddress) {
        await this.page.keyboard.type(char);
        await this.randomWait(50, 150);
      }

      this.log(`✅ Entered address: ${streetAddress}`);

      // Wait for potential autocomplete
      await this.randomWait(2000, 3000);

      // Look for and click search button
      const searchButtonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Search")',
        'button[aria-label*="Search"]',
        '.btn-search',
        '#btnSearch',
        'button.search-button'
      ];

      let searchClicked = false;
      for (const selector of searchButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            searchClicked = true;
            this.log(`✅ Clicked search button`);
            break;
          }
        } catch (e) {
          // Try next
        }
      }

      if (!searchClicked) {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for results
      await this.randomWait(5000, 7000);

      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found') ||
                            text.includes('no matches');

        // Look for indicators that we're on property detail page
        const hasPropertyInfo = text.includes('owner') ||
                               text.includes('sale') ||
                               text.includes('property') ||
                               text.includes('parcel') ||
                               text.includes('assessed value');

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
        this.log(`✅ Property found on assessor website`);
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
   * Extract transaction records from Property Appraiser
   * Look for sales history, instrument numbers, book/page references
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Sales/Transfer information sections
      this.log('🔍 Looking for Sales/Transfer information...');

      // Brevard County might have a Sales tab or section
      const salesSectionFound = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, h2, h3'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text.match(/sales?( history)?/i) ||
              text.match(/transfer/i) ||
              text.match(/conveyance/i)) {

            if (el.tagName === 'A' || el.tagName === 'BUTTON') {
              el.click();
              return { clicked: true, text: text };
            }

            const clickableParent = el.closest('a, button, [onclick]');
            if (clickableParent) {
              clickableParent.click();
              return { clicked: true, text: text };
            }
          }
        }

        return { clicked: false };
      });

      if (salesSectionFound && salesSectionFound.clicked) {
        this.log(`✅ Clicked on Sales section (${salesSectionFound.text})`);
        await this.randomWait(3000, 5000);

        // Scroll to ensure content is loaded
        await this.page.evaluate(() => {
          window.scrollBy(0, 800);
        });
        await this.randomWait(2000, 3000);
      } else {
        this.log(`ℹ️  No Sales section found, checking current page for transaction data`);
      }

      // Extract transaction information from the page
      this.log('🔍 Extracting transaction data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];
        const pageText = document.body.innerText;

        // Look for instrument numbers (typically 10-12 digits for Florida)
        // Format: CFN 2023012345, Inst# 2023012345, OR 2023012345, etc.
        const instrumentPatterns = [
          /(?:CFN|Instrument|Inst\.?|OR|Doc(?:ument)?)[:\s#]*(\d{10,12})/gi,
          /\b(\d{10,12})\b/g  // Standalone 10-12 digit numbers
        ];

        const foundInstruments = new Set();

        for (const pattern of instrumentPatterns) {
          const matches = [...pageText.matchAll(pattern)];
          for (const match of matches) {
            const instrumentNum = match[1];
            // Only add if it looks like a valid instrument number (starts with 20 for year)
            if (instrumentNum.startsWith('20') && instrumentNum.length >= 10) {
              foundInstruments.add(instrumentNum);
            }
          }
        }

        // Convert to array and create transaction objects
        for (const instrumentNum of foundInstruments) {
          results.push({
            instrumentNumber: instrumentNum,
            type: 'instrument_number',
            source: 'Brevard County Property Appraiser'
          });
        }

        // Look for Book/Page format
        // Format: "Book 9999 Page 9999" or "Bk 9999 Pg 9999" or "9999/9999"
        const bookPagePatterns = [
          /Book[:\s#]*(\d{3,5})[,\s\-]+Page[:\s#]*(\d{3,5})/gi,
          /Bk[:\s#]*(\d{3,5})[,\s\-]+Pg[:\s#]*(\d{3,5})/gi,
          /OR\s+Book[:\s#]*(\d{3,5})[,\s\-]+Page[:\s#]*(\d{3,5})/gi
        ];

        for (const pattern of bookPagePatterns) {
          const matches = [...pageText.matchAll(pattern)];
          for (const match of matches) {
            const bookNum = match[1];
            const pageNum = match[2];

            // Avoid duplicates
            const exists = results.some(r =>
              r.type === 'book_page' && r.bookNumber === bookNum && r.pageNumber === pageNum
            );

            if (!exists && parseInt(bookNum) > 100) { // Filter out low book numbers
              results.push({
                bookNumber: bookNum,
                pageNumber: pageNum,
                type: 'book_page',
                source: 'Brevard County Property Appraiser'
              });
            }
          }
        }

        // Also check for table data (more structured)
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));

          for (let i = 1; i < rows.length; i++) { // Skip header
            const row = rows[i];
            const cells = Array.from(row.querySelectorAll('td'));

            if (cells.length >= 2) {
              const rowText = row.innerText;

              // Check for instrument number in table
              const instMatch = rowText.match(/\b(20\d{8,10})\b/);
              if (instMatch && !foundInstruments.has(instMatch[1])) {
                foundInstruments.add(instMatch[1]);
                results.push({
                  instrumentNumber: instMatch[1],
                  type: 'instrument_number',
                  source: 'Brevard County Property Appraiser - Table'
                });
              }

              // Check for book/page in table
              const bookPageMatch = rowText.match(/(\d{3,5})[\/\-\s]+(\d{3,5})/);
              if (bookPageMatch) {
                const bookNum = bookPageMatch[1];
                const pageNum = bookPageMatch[2];
                const exists = results.some(r =>
                  r.type === 'book_page' && r.bookNumber === bookNum && r.pageNumber === pageNum
                );

                if (!exists && parseInt(bookNum) > 100) {
                  results.push({
                    bookNumber: bookNum,
                    pageNumber: pageNum,
                    type: 'book_page',
                    source: 'Brevard County Property Appraiser - Table'
                  });
                }
              }
            }
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      // Log what we found
      for (const trans of transactions) {
        if (trans.type === 'instrument_number') {
          this.log(`   Instrument #: ${trans.instrumentNumber}`);
        } else if (trans.type === 'book_page') {
          this.log(`   Book/Page: ${trans.bookNumber}/${trans.pageNumber}`);
        }
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
   * Download deed PDF from Brevard County Clerk
   * Navigate to clerk page, search by instrument number or book/page, download PDF
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Brevard County Clerk...');

    try {
      const clerkUrl = 'https://vaclmweb1.brevardclerk.us/AcclaimWeb/';
      this.log(`🌐 Navigating to Clerk's website: ${clerkUrl}`);

      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Check if we need to accept disclaimer or login
      const pageStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return {
          hasDisclaimer: text.includes('disclaimer') || text.includes('accept'),
          hasLogin: text.includes('login') || text.includes('username'),
          hasSearch: text.includes('search') || text.includes('name search') || text.includes('book')
        };
      });

      this.log(`📋 Page status: disclaimer=${pageStatus.hasDisclaimer}, login=${pageStatus.hasLogin}, search=${pageStatus.hasSearch}`);

      // Handle disclaimer if present
      if (pageStatus.hasDisclaimer) {
        this.log(`📋 Accepting disclaimer...`);
        const disclaimerAccepted = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
          for (const btn of buttons) {
            const text = (btn.textContent || btn.value || '').toLowerCase();
            if (text.includes('accept') || text.includes('agree') || text.includes('continue')) {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (disclaimerAccepted) {
          this.log(`✅ Accepted disclaimer`);
          await this.randomWait(3000, 5000);
        }
      }

      // If instrument number is available, use Clerk File Number search
      if (transaction.instrumentNumber) {
        return await this.searchByInstrumentNumber(transaction.instrumentNumber);
      }

      // Otherwise, use Book/Page search
      if (transaction.bookNumber && transaction.pageNumber) {
        return await this.searchByBookPage(transaction.bookNumber, transaction.pageNumber);
      }

      throw new Error('No instrument number or book/page available for search');

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search Brevard County Clerk by Instrument Number (Clerk File Number)
   */
  async searchByInstrumentNumber(instrumentNumber) {
    this.log(`🔍 Searching by Instrument Number: ${instrumentNumber}`);

    try {
      // Look for "Clerk File Number" search option
      const clerkFileSearchClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span'));
        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          if (text.match(/clerk file number/i) || text.match(/instrument number/i)) {
            el.click();
            return { clicked: true, text: text };
          }
        }
        return { clicked: false };
      });

      if (clerkFileSearchClicked.clicked) {
        this.log(`✅ Clicked on Clerk File Number search option`);
        await this.randomWait(2000, 3000);
      }

      // Look for input field for instrument/clerk file number
      const inputSelectors = [
        'input[name*="ClerkFile"]',
        'input[name*="Instrument"]',
        'input[id*="clerkfile"]',
        'input[id*="instrument"]',
        'input[placeholder*="Instrument"]',
        'input[placeholder*="Clerk"]',
        'input[type="text"]'
      ];

      let instrumentInput = null;
      for (const selector of inputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          instrumentInput = selector;
          this.log(`✅ Found instrument input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!instrumentInput) {
        throw new Error('Could not find instrument number input field');
      }

      // Enter instrument number
      await this.page.click(instrumentInput);
      await this.page.type(instrumentInput, instrumentNumber, { delay: 100 });
      this.log(`✅ Entered instrument number: ${instrumentNumber}`);

      await this.randomWait(1000, 2000);

      // Submit search
      const searchSubmitted = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (searchSubmitted) {
        this.log(`✅ Submitted search`);
      } else {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for results
      await this.randomWait(5000, 7000);

      // Look for PDF download link or view button
      return await this.findAndDownloadPDF(instrumentNumber);

    } catch (error) {
      this.log(`❌ Instrument number search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search Brevard County Clerk by Book and Page
   */
  async searchByBookPage(bookNumber, pageNumber) {
    this.log(`🔍 Searching by Book/Page: ${bookNumber}/${pageNumber}`);

    try {
      // Look for "Book/Page" search option
      const bookPageSearchClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span'));
        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          if (text.match(/book\s*\/\s*page/i) || text.match(/book.*page/i)) {
            el.click();
            return { clicked: true, text: text };
          }
        }
        return { clicked: false };
      });

      if (bookPageSearchClicked.clicked) {
        this.log(`✅ Clicked on Book/Page search option`);
        await this.randomWait(2000, 3000);
      }

      // Look for book input field
      const bookInputSelectors = [
        'input[name*="Book"]',
        'input[id*="book"]',
        'input[placeholder*="Book"]'
      ];

      let bookInput = null;
      for (const selector of bookInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          bookInput = selector;
          this.log(`✅ Found book input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      // Look for page input field
      const pageInputSelectors = [
        'input[name*="Page"]',
        'input[id*="page"]',
        'input[placeholder*="Page"]'
      ];

      let pageInput = null;
      for (const selector of pageInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          pageInput = selector;
          this.log(`✅ Found page input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!bookInput || !pageInput) {
        throw new Error('Could not find book/page input fields');
      }

      // Enter book number
      await this.page.click(bookInput);
      await this.page.type(bookInput, bookNumber, { delay: 100 });
      this.log(`✅ Entered book number: ${bookNumber}`);

      // Enter page number
      await this.page.click(pageInput);
      await this.page.type(pageInput, pageNumber, { delay: 100 });
      this.log(`✅ Entered page number: ${pageNumber}`);

      await this.randomWait(1000, 2000);

      // Submit search
      const searchSubmitted = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (searchSubmitted) {
        this.log(`✅ Submitted search`);
      } else {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for results
      await this.randomWait(5000, 7000);

      // Look for PDF download link or view button
      return await this.findAndDownloadPDF(`${bookNumber}_${pageNumber}`);

    } catch (error) {
      this.log(`❌ Book/Page search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find and download PDF from search results
   */
  async findAndDownloadPDF(identifier) {
    this.log('🔍 Looking for PDF download link...');

    try {
      // Check search results
      const searchResults = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records');
        const hasResults = text.includes('document') ||
                          text.includes('deed') ||
                          text.includes('recorded');

        return { hasNoResults, hasResults };
      });

      if (searchResults.hasNoResults) {
        throw new Error('No records found for this search');
      }

      this.log(`✅ Search results found`);

      // Look for view/download links
      const viewLinkClicked = await this.page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a, button'));
        for (const link of allLinks) {
          const text = (link.textContent || link.value || '').toLowerCase();
          if (text.includes('view') ||
              text.includes('download') ||
              text.includes('pdf') ||
              text.includes('document')) {
            link.click();
            return { clicked: true, text: link.textContent || link.value };
          }
        }
        return { clicked: false };
      });

      if (viewLinkClicked.clicked) {
        this.log(`✅ Clicked on view link: "${viewLinkClicked.text}"`);
        await this.randomWait(3000, 5000);
      }

      // Set up download handling
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      this.log(`📁 Download path set to: ${downloadPath}`);

      // Check if we're now viewing a PDF or need to download
      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      // If URL contains PDF, download it directly
      if (currentUrl.toLowerCase().includes('.pdf')) {
        this.log(`📥 Downloading PDF from URL...`);

        const pdfArrayBuffer = await this.page.evaluate(async (url) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        }, currentUrl);

        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        // Verify it's a PDF
        const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
        if (!isPDF) {
          throw new Error('Downloaded file is not a valid PDF');
        }

        this.log(`✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`);

        const filename = `brevard_deed_${identifier}.pdf`;
        const filepath = path.join(downloadPath, filename);

        fs.writeFileSync(filepath, pdfBuffer);
        this.log(`💾 Saved PDF to: ${filepath}`);

        return {
          success: true,
          filename,
          downloadPath,
          documentId: identifier,
          timestamp: new Date().toISOString(),
          fileSize: pdfBuffer.length
        };
      }

      // Otherwise, look for download button on the page
      const downloadButtonClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
        for (const el of allElements) {
          const text = (el.textContent || el.value || '').toLowerCase();
          const title = (el.title || '').toLowerCase();
          if (text.includes('download') ||
              text.includes('save') ||
              title.includes('download')) {
            el.click();
            return { clicked: true, text: el.textContent || el.value || el.title };
          }
        }
        return { clicked: false };
      });

      if (downloadButtonClicked.clicked) {
        this.log(`✅ Clicked download button: "${downloadButtonClicked.text}"`);
        await this.randomWait(5000, 8000);

        // Wait for file to download
        const files = fs.readdirSync(downloadPath);
        const pdfFiles = files.filter(f => f.endsWith('.pdf'));

        if (pdfFiles.length > 0) {
          // Get the most recent PDF
          const latestPdf = pdfFiles.sort((a, b) => {
            const statA = fs.statSync(path.join(downloadPath, a));
            const statB = fs.statSync(path.join(downloadPath, b));
            return statB.mtime - statA.mtime;
          })[0];

          const filepath = path.join(downloadPath, latestPdf);
          const stats = fs.statSync(filepath);

          this.log(`✅ PDF downloaded: ${latestPdf}`);

          return {
            success: true,
            filename: latestPdf,
            downloadPath,
            documentId: identifier,
            timestamp: new Date().toISOString(),
            fileSize: stats.size
          };
        }
      }

      throw new Error('Could not find or download PDF');

    } catch (error) {
      this.log(`❌ Failed to download PDF: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Random wait helper
   */
  async randomWait(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = BrevardCountyFloridaScraper;
