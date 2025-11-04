/**
 * Lee County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.leepa.org/search/propertysearch.aspx
 * - Clerk of Courts (Official Records): https://or.leeclerk.org/LandMarkWeb
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection on Lee County website
puppeteer.use(StealthPlugin());

class LeeCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Lee';
    this.state = 'FL';
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
   * Lee County may have bot detection
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
   * Lee County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Lee County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Lee County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Lee County supports direct address search',
        county: 'Lee',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://www.leepa.org/search/propertysearch.aspx`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Lee',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://www.leepa.org/search/propertysearch.aspx',
        originalAddress: address,
        county: 'Lee',
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
   * Get deed recorder/clerk URL for Lee County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Lee' && state === 'FL') {
      return 'https://or.leeclerk.org/LandMarkWeb';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Lee County
   */
  getAssessorUrl(county, state) {
    if (county === 'Lee' && state === 'FL') {
      return 'https://www.leepa.org/search/propertysearch.aspx';
    }
    return null;
  }

  /**
   * Search Lee County Property Appraiser by address
   * URL: https://www.leepa.org/search/propertysearch.aspx
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Lee County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://www.leepa.org/search/propertysearch.aspx', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for the address input field in the Property Information tab
      // The site uses ASP.NET with Infragistics controls
      const addressInputSelectors = [
        'input[id*="txtStreetAddress"]',
        'input[name*="txtStreetAddress"]',
        'input[id*="StreetAddress"]',
        'input[placeholder*="Street"]',
        'input[name*="Address"]',
        'input[type="text"]'
      ];

      let addressInput = null;
      for (const selector of addressInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000, visible: true });
          addressInput = selector;
          this.log(`✅ Found address input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!addressInput) {
        this.log(`⚠️ Could not find address input field, trying all text inputs`);
        // Fallback: find all visible text inputs and use the first one
        addressInput = 'input[type="text"]:visible';
      }

      // Enter street address
      await this.page.click(addressInput);
      await this.randomWait(500, 1000);
      await this.page.type(addressInput, streetAddress, { delay: 100 });

      this.log(`✅ Entered address: ${streetAddress}`);
      await this.randomWait(2000, 3000);

      // Look for the search button - ASP.NET form with submit button
      const searchButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search"]',
        'button:contains("Search")',
        'input[id*="btnSearch"]',
        'input[id*="Submit"]'
      ];

      let searchButton = null;
      for (const selector of searchButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          searchButton = selector;
          this.log(`✅ Found search button: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (searchButton) {
        this.log(`🔍 Clicking search button...`);
        await this.page.click(searchButton);
      } else {
        // Fallback: Press Enter key
        this.log(`⚠️ Could not find search button, trying Enter key`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results to load
      this.log(`⏳ Waiting for search results to load (this may take 20-30+ seconds)...`);
      await this.randomWait(5000, 7000);

      // Wait for results to appear - either results table or property detail page
      try {
        await this.page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          // Check if we have results or navigated to a property page
          return text.includes('folio') ||
                 text.includes('parcel') ||
                 text.includes('owner') ||
                 text.includes('property information') ||
                 text.includes('assessment');
        }, { timeout: 30000 });

        this.log(`✅ Search results loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for results, checking page content anyway...`);
      }

      await this.randomWait(3000, 5000);

      // Check if we got results or went directly to property page
      const pageStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found');

        const hasPropertyData = text.includes('folio') &&
                               (text.includes('owner') || text.includes('sale'));

        return {
          hasNoResults,
          hasPropertyData,
          url: window.location.href
        };
      });

      this.log(`🔍 Search result analysis:`);
      this.log(`   Current URL: ${pageStatus.url}`);
      this.log(`   Has property data: ${pageStatus.hasPropertyData}`);
      this.log(`   Has "no results" message: ${pageStatus.hasNoResults}`);

      if (!pageStatus.hasNoResults && pageStatus.hasPropertyData) {
        this.log(`✅ Property found on assessor website`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found or search failed`);
        return {
          success: false,
          message: `Property not found (noResults: ${pageStatus.hasNoResults}, hasData: ${pageStatus.hasPropertyData})`
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
   * Navigate to Deed/Recording Information tab and extract instrument numbers
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Deed/Recording Information tab
      this.log('🔍 Looking for Deed/Recording Information tab...');

      const deedTabClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text === 'Deed/Recording Information' ||
              text.includes('Deed') ||
              text.includes('Recording Information') ||
              text.includes('Sales History')) {

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

      this.log(`🔍 [INFO] Deed tab click result: ${JSON.stringify(deedTabClicked)}`);

      if (deedTabClicked && deedTabClicked.clicked) {
        this.log(`✅ Clicked on Deed/Recording Information tab (${deedTabClicked.text})`);
        await this.randomWait(5000, 7000);

        // Scroll to ensure content is loaded
        await this.page.evaluate(() => {
          window.scrollBy(0, 1000);
        });
        await this.randomWait(2000, 3000);
      } else {
        this.log(`ℹ️  No Deed tab found, checking current page for transaction data`);
      }

      // Extract transaction information from the page
      this.log('🔍 Extracting transaction data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        // Look for Instrument Number pattern (typically 8-12 digits)
        // Also look for Book/Page patterns
        for (const line of lines) {
          // Instrument Number: YYYYXXXXXXXX format (year + sequence)
          const instrumentMatch = line.match(/\b(20\d{10}|19\d{10}|\d{8,12})\b/);
          if (instrumentMatch && line.toLowerCase().includes('instrument')) {
            results.push({
              instrumentNumber: instrumentMatch[1],
              type: 'instrument',
              source: 'Lee County Property Appraiser',
              rawText: line.trim().substring(0, 200)
            });
          }

          // Book/Page format: Book XXXX Page XXXX
          const bookPageMatch = line.match(/book\s+(\d+)\s+page\s+(\d+)/i);
          if (bookPageMatch) {
            const bookNum = bookPageMatch[1];
            const pageNum = bookPageMatch[2];

            // Avoid duplicates
            const exists = results.some(r =>
              r.type === 'book_page' && r.bookNumber === bookNum && r.pageNumber === pageNum
            );

            if (!exists && parseInt(bookNum) > 100) { // Filter out plat books
              results.push({
                bookNumber: bookNum,
                pageNumber: pageNum,
                type: 'book_page',
                source: 'Lee County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }
        }

        // Alternative: look in table cells for structured data
        const tableCells = Array.from(document.querySelectorAll('td, th'));
        for (const cell of tableCells) {
          const text = cell.textContent?.trim() || '';

          // Look for instrument numbers in cells
          if (/^\d{8,12}$/.test(text)) {
            // Check if this looks like an instrument number (not already added)
            const exists = results.some(r => r.instrumentNumber === text);
            if (!exists) {
              results.push({
                instrumentNumber: text,
                type: 'instrument',
                source: 'Lee County Property Appraiser (table)',
                rawText: text
              });
            }
          }

          // Look for book/page in adjacent cells
          if (text.toLowerCase().includes('book') || text.toLowerCase().includes('page')) {
            const nextCell = cell.nextElementSibling;
            if (nextCell) {
              const nextText = nextCell.textContent?.trim() || '';
              const bookMatch = text.match(/book.*?(\d+)/i);
              const pageMatch = nextText.match(/(\d+)/);

              if (bookMatch && pageMatch) {
                const bookNum = bookMatch[1];
                const pageNum = pageMatch[1];
                const exists = results.some(r =>
                  r.type === 'book_page' && r.bookNumber === bookNum && r.pageNumber === pageNum
                );

                if (!exists && parseInt(bookNum) > 100) {
                  results.push({
                    bookNumber: bookNum,
                    pageNumber: pageNum,
                    type: 'book_page',
                    source: 'Lee County Property Appraiser (table)',
                    rawText: `${text} ${nextText}`.substring(0, 200)
                  });
                }
              }
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
          this.log(`   Instrument Number: ${trans.instrumentNumber}`);
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
   * Download deed PDF from Lee County Clerk
   * Navigate to LandMarkWeb, search by instrument number or book/page, and download PDF
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Lee County Clerk...');

    try {
      // Navigate to LandMarkWeb
      const clerkUrl = 'https://or.leeclerk.org/LandMarkWeb';
      this.log(`🌐 Navigating to Lee County Clerk: ${clerkUrl}`);

      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(5000, 7000);

      // Accept disclaimer if present
      const disclaimerAccepted = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || btn.value?.toLowerCase() || '';
          if (text.includes('accept') || text.includes('agree') || text.includes('continue')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (disclaimerAccepted) {
        this.log('✅ Accepted disclaimer');
        await this.randomWait(3000, 5000);
      }

      // Search for the document by instrument number or book/page
      let searchPerformed = false;

      if (transaction.instrumentNumber) {
        this.log(`🔍 Searching by Instrument Number: ${transaction.instrumentNumber}`);

        // Look for instrument number input field
        const instrumentInputSelectors = [
          'input[id*="Instrument"]',
          'input[name*="Instrument"]',
          'input[id*="DocNumber"]',
          'input[name*="DocNumber"]'
        ];

        for (const selector of instrumentInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000, visible: true });
            await this.page.click(selector);
            await this.page.type(selector, transaction.instrumentNumber, { delay: 100 });
            this.log(`✅ Entered instrument number: ${transaction.instrumentNumber}`);
            searchPerformed = true;
            break;
          } catch (e) {
            // Try next selector
          }
        }
      } else if (transaction.bookNumber && transaction.pageNumber) {
        this.log(`🔍 Searching by Book/Page: ${transaction.bookNumber}/${transaction.pageNumber}`);

        // Look for book and page input fields
        try {
          const bookInput = await this.page.$('input[id*="Book"], input[name*="Book"]');
          const pageInput = await this.page.$('input[id*="Page"], input[name*="Page"]');

          if (bookInput && pageInput) {
            await bookInput.click();
            await bookInput.type(transaction.bookNumber, { delay: 100 });
            await pageInput.click();
            await pageInput.type(transaction.pageNumber, { delay: 100 });
            this.log(`✅ Entered book/page: ${transaction.bookNumber}/${transaction.pageNumber}`);
            searchPerformed = true;
          }
        } catch (e) {
          this.log(`⚠️ Could not enter book/page: ${e.message}`);
        }
      }

      if (!searchPerformed) {
        throw new Error('Could not perform search - no instrument number or book/page available');
      }

      await this.randomWait(2000, 3000);

      // Click search button
      const searchButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search"]',
        'button:contains("Search")',
        'input[id*="btnSearch"]'
      ];

      let searchClicked = false;
      for (const selector of searchButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          await this.page.click(selector);
          this.log(`✅ Clicked search button`);
          searchClicked = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchClicked) {
        this.log(`⚠️ Could not find search button, trying Enter key`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(5000, 7000);

      // Look for the document in results and click to view/download
      this.log('🔍 Looking for document in search results...');

      // Set up listener for new page/popup or download
      const newPagePromise = new Promise(resolve => {
        this.browser.once('targetcreated', async target => {
          if (target.type() === 'page') {
            const newPage = await target.page();
            resolve(newPage);
          }
        });
      });

      // Click on the document link
      const documentClicked = await this.page.evaluate(() => {
        // Look for PDF links or view buttons
        const links = Array.from(document.querySelectorAll('a, button, input[type="button"]'));

        for (const link of links) {
          const text = link.textContent?.toLowerCase() || link.value?.toLowerCase() || '';
          const href = link.href || '';

          if (text.includes('view') ||
              text.includes('download') ||
              text.includes('pdf') ||
              href.includes('.pdf') ||
              href.includes('document')) {
            link.click();
            return { clicked: true, text: text || href };
          }
        }

        // If no explicit button, click on the first result row
        const firstResult = document.querySelector('tr[onclick], tr.result, table tbody tr:first-child');
        if (firstResult) {
          firstResult.click();
          return { clicked: true, text: 'first result row' };
        }

        return { clicked: false };
      });

      this.log(`🔍 [INFO] Document click result: ${JSON.stringify(documentClicked)}`);

      if (!documentClicked || !documentClicked.clicked) {
        throw new Error('Could not find document to view/download');
      }

      this.log(`✅ Clicked on document: ${documentClicked.text}`);

      // Wait for PDF to load (either in new window or current page)
      await this.randomWait(3000, 5000);

      // Try to get PDF from new window if opened
      let pdfBuffer;
      try {
        const newPage = await Promise.race([
          newPagePromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('No new window opened')), 5000)
          )
        ]);

        this.log('✅ New window opened with PDF viewer');
        const pdfUrl = newPage.url();
        this.log(`📍 PDF URL: ${pdfUrl}`);

        // Download the PDF using fetch in the new window's context
        this.log('📥 Downloading PDF from new window...');

        const pdfArrayBuffer = await newPage.evaluate(async (url) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        }, pdfUrl);

        pdfBuffer = Buffer.from(pdfArrayBuffer);
        await newPage.close();

      } catch (newWindowError) {
        // No new window, try to get PDF from current page
        this.log('ℹ️  No new window opened, trying to download from current page...');

        const currentUrl = this.page.url();
        if (currentUrl.includes('.pdf') || currentUrl.endsWith('.pdf')) {
          this.log(`📍 PDF URL in current page: ${currentUrl}`);

          const pdfArrayBuffer = await this.page.evaluate(async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
          }, currentUrl);

          pdfBuffer = Buffer.from(pdfArrayBuffer);
        } else {
          throw new Error('Could not download PDF - no new window and current page is not PDF');
        }
      }

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      this.log(`🔍 [INFO] PDF validation: isPDF=${isPDF}, size=${pdfBuffer.length} bytes`);

      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`);

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

      const filename = `lee_deed_${transaction.instrumentNumber || `${transaction.bookNumber}_${transaction.pageNumber}`}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        instrumentNumber: transaction.instrumentNumber,
        bookNumber: transaction.bookNumber,
        pageNumber: transaction.pageNumber,
        timestamp: new Date().toISOString(),
        fileSize: pdfBuffer.length
      };

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LeeCountyFloridaScraper;
