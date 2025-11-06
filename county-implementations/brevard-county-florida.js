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
        assessorUrl: 'https://www.bcpao.us/PropertySearch/#/nav/Search',
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
      return 'https://www.bcpao.us/PropertySearch/#/nav/Search';
    }
    return null;
  }

  /**
   * Search Brevard County Property Appraiser by address
   * URL: https://www.bcpao.us/PropertySearch/#/nav/Search
   * Workflow:
   * 1. Type address without city and state
   * 2. Wait for autocomplete popup
   * 3. Verify popup matches search address
   * 4. Click on popup address
   * 5. Press Enter
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Brevard County FL Property Appraiser`);
    this.log(`   Using address search (without city/state)`);

    try {
      // Navigate to property search page
      await this.page.goto('https://www.bcpao.us/PropertySearch/#/nav/Search', {
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
  /**
   * Extract transaction records from the property detail page
   * Workflow:
   * 1. Find the "Sale/Transfers" table
   * 2. Extract the first entry in the "Instrument" column (e.g., "6790/1266")
   * 3. Extract the link behind it (e.g., https://vaclmweb1.brevardclerk.us/AcclaimWeb/Details/GetDocumentbyBookPage/OR/6790/1266)
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for "Sale/Transfers" table
      this.log('🔍 Looking for "Sale/Transfers" table...');

      // Extract transaction information from the page
      // Look specifically for links to brevardclerk.us with book/page format
      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Find all tables on the page
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          // Check if this table contains "Sale" or "Transfer" text
          const tableText = table.innerText || table.textContent || '';

          if (tableText.toLowerCase().includes('sale') ||
              tableText.toLowerCase().includes('transfer') ||
              tableText.toLowerCase().includes('instrument')) {

            // Look for links to brevardclerk.us in this table
            const links = table.querySelectorAll('a[href*="brevardclerk"]');

            for (const link of links) {
              const href = link.href;
              const text = (link.textContent || '').trim();

              // Extract book/page from the link text (e.g., "6790/1266")
              const bookPageMatch = text.match(/(\d+)\/(\d+)/);

              if (bookPageMatch) {
                results.push({
                  bookNumber: bookPageMatch[1],
                  pageNumber: bookPageMatch[2],
                  bookPage: text,
                  href: href,
                  source: 'Brevard County Property Appraiser - Sale/Transfers Table'
                });
              } else {
                // Try to extract from URL
                // URL format: /GetDocumentbyBookPage/OR/6790/1266
                const urlMatch = href.match(/\/OR\/(\d+)\/(\d+)/);
                if (urlMatch) {
                  results.push({
                    bookNumber: urlMatch[1],
                    pageNumber: urlMatch[2],
                    bookPage: text || `${urlMatch[1]}/${urlMatch[2]}`,
                    href: href,
                    source: 'Brevard County Property Appraiser - Sale/Transfers Table'
                  });
                }
              }
            }
          }
        }

        // If we didn't find anything in tables, search all links on the page
        if (results.length === 0) {
          const allLinks = document.querySelectorAll('a[href*="brevardclerk"]');

          for (const link of allLinks) {
            const href = link.href;
            const text = (link.textContent || '').trim();

            // Extract book/page from URL
            const urlMatch = href.match(/\/OR\/(\d+)\/(\d+)/);
            if (urlMatch) {
              const bookPageMatch = text.match(/(\d+)\/(\d+)/);
              results.push({
                bookNumber: urlMatch[1],
                pageNumber: urlMatch[2],
                bookPage: bookPageMatch ? text : `${urlMatch[1]}/${urlMatch[2]}`,
                href: href,
                source: 'Brevard County Clerk Website'
              });
            }
          }
        }

        return results;
      });

      if (transactions.length > 0) {
        this.log(`🔍 Extracted ${transactions.length} deed record(s)`);
        transactions.forEach((t, i) => {
          this.log(`   📄 Book/Page: ${t.bookPage} (Book: ${t.bookNumber}, Page: ${t.pageNumber})`);
          this.log(`      Link: ${t.href}`);
        });

        return {
          success: true,
          transactions
        };
      }

      this.log(`⚠️ No transactions found on page`);
      return {
        success: false,
        message: 'No transactions found on Property Appraiser page',
        transactions: []
      };

    } catch (error) {
      this.log(`❌ Error extracting transactions: ${error.message}`);
      return {
        success: false,
        message: error.message,
        transactions: []
      };
    }
  }

  /**
   * Download deed PDF from Brevard County Clerk website
   * URL pattern: https://vaclmweb1.brevardclerk.us/AcclaimWeb/Details/GetDocumentbyBookPage/OR/6790/1266
   *
   * The detail page contains an iframe with a PDF viewer that has a download button in the upper right corner
   * <iframe src="https://vaclmweb1.brevardclerk.us/AcclaimWeb/Image/DocumentImage1/8876398" id="imgFrame1" class="docFrame">
   *
   * We need to:
   * 1. Navigate to the detail page
   * 2. Wait for iframe to load
   * 3. Switch to iframe context
   * 4. Click the download button in the upper right corner
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Brevard County Clerk...');

    try {
      if (!transaction.href) {
        throw new Error('No PDF URL found in transaction record');
      }

      const detailPageUrl = transaction.href;
      this.log(`🌐 Navigating to detail page: ${detailPageUrl}`);

      // Set up download handling BEFORE navigating
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      // Set download behavior
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      this.log(`📁 Download path set to: ${downloadPath}`);

      // Navigate to the detail page
      await this.page.goto(detailPageUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      this.log(`✅ Detail page loaded`);

      // Wait for the iframe to load
      await this.randomWait(3000, 5000);

      // Find the iframe
      const iframeElement = await this.page.$('iframe[id*="imgFrame"], iframe[class*="docFrame"], iframe');

      if (!iframeElement) {
        throw new Error('Could not find PDF iframe on detail page');
      }

      this.log(`✅ Found PDF iframe`);

      // Get the iframe's content frame
      const frame = await iframeElement.contentFrame();

      if (!frame) {
        throw new Error('Could not access iframe content');
      }

      this.log(`✅ Accessed iframe content`);

      // Wait for PDF viewer to load in iframe
      await this.randomWait(2000, 3000);

      // Look for "Save Document" button in the iframe (upper right corner)
      // Based on inspection, the button has id="SaveDoc" and title="Save Document"
      this.log(`🔍 Looking for "Save Document" button...`);

      // Wait for the button to be available
      await frame.waitForSelector('#SaveDoc', { timeout: 10000 });

      this.log(`🔘 Found "Save Document" button (id=SaveDoc)`);

      // Use evaluate to click the button directly in the iframe context
      // This avoids "not clickable" errors
      await frame.evaluate(() => {
        const btn = document.querySelector('#SaveDoc');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      });

      this.log(`✅ Clicked "Save Document" button`)

      // Wait for download to complete
      this.log(`⏳ Waiting for PDF download to complete...`);
      await this.randomWait(5000, 8000);

      // Find the downloaded PDF
      const files = fs.readdirSync(downloadPath);
      const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        throw new Error('No PDF file found in download directory');
      }

      // Get the most recent PDF
      const latestPdf = pdfFiles.sort((a, b) => {
        const statA = fs.statSync(path.join(downloadPath, a));
        const statB = fs.statSync(path.join(downloadPath, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      })[0];

      const filepath = path.join(downloadPath, latestPdf);
      const stats = fs.statSync(filepath);

      // Read the PDF to get base64
      const pdfBuffer = fs.readFileSync(filepath);
      const pdfBase64 = pdfBuffer.toString('base64');

      this.log(`✅ PDF downloaded successfully: ${latestPdf}`);
      this.log(`💾 File size: ${(stats.size / 1024).toFixed(2)} KB`);

      // Rename to standard format
      const filename = `brevard_deed_${transaction.bookNumber}_${transaction.pageNumber}.pdf`;
      const newFilepath = path.join(downloadPath, filename);

      if (filepath !== newFilepath) {
        fs.renameSync(filepath, newFilepath);
        this.log(`📝 Renamed to: ${filename}`);
      }

      return {
        success: true,
        filename,
        downloadPath,
        filepath: newFilepath,
        bookNumber: transaction.bookNumber,
        pageNumber: transaction.pageNumber,
        bookPage: transaction.bookPage,
        pdfUrl: detailPageUrl,
        timestamp: new Date().toISOString(),
        fileSize: stats.size,
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
