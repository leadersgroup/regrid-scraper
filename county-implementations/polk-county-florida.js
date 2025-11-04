/**
 * Polk County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.polkpa.org/
 * - Property Search: https://www.polkpa.org/camadisplay.aspx
 * - Clerk of Courts (Official Records): https://pro.polkcountyclerk.net/PRO/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection on Polk County website
puppeteer.use(StealthPlugin());

class PolkCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Polk';
    this.state = 'FL';
  }

  /**
   * Override log method to use info level for Railway visibility
   */
  log(message) {
    // Call parent log method (console.log if verbose)
    super.log(message);
  }

  /**
   * Override initialize to use puppeteer-extra with stealth plugin
   * Polk County has bot detection
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
   * Polk County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Polk County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Polk County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Polk County supports direct address search',
        county: 'Polk',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://www.polkpa.org/camadisplay.aspx`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Polk',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://www.polkpa.org/camadisplay.aspx',
        originalAddress: address,
        county: 'Polk',
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
      const deedId = mostRecentDeed.documentId || `Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`;
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
   * Get deed recorder/clerk URL for Polk County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Polk' && state === 'FL') {
      return 'https://pro.polkcountyclerk.net/PRO/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Polk County
   */
  getAssessorUrl(county, state) {
    if (county === 'Polk' && state === 'FL') {
      return 'https://www.polkpa.org/camadisplay.aspx';
    }
    return null;
  }

  /**
   * Search Polk County Property Appraiser by address
   * URL: https://www.polkpa.org/camadisplay.aspx
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Polk County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://www.polkpa.org/camadisplay.aspx', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for the address input field
      // The site uses a search form with various search types
      const addressInputSelectors = [
        'input[name*="address"]',
        'input[name*="Address"]',
        'input[id*="address"]',
        'input[id*="Address"]',
        'input[placeholder*="Address"]',
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
      await this.page.type(addressInput, streetAddress, { delay: 50 });

      await this.randomWait(1000, 2000);

      this.log(`✅ Entered address: ${streetAddress}`);

      // Submit the search form
      const searchButtonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Search")',
        'input[value*="Search"]'
      ];

      let searchButtonFound = false;
      for (const selector of searchButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          await this.page.click(selector);
          this.log(`✅ Clicked search button: ${selector}`);
          searchButtonFound = true;
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchButtonFound) {
        // Try pressing Enter
        this.log(`⚠️ Could not find search button, trying Enter key`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results to load
      this.log(`⏳ Waiting for search results to load...`);
      await this.randomWait(5000, 7000);

      // Wait for results page or property detail page
      try {
        await this.page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('parcel') ||
                 text.includes('owner') ||
                 text.includes('sale') ||
                 text.includes('deed') ||
                 text.includes('property information');
        }, { timeout: 30000 });

        this.log(`✅ Search results or property page loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for results, checking page content anyway...`);
      }

      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found');

        const hasPropertyInfo = text.includes('parcel') ||
                               text.includes('owner name') ||
                               text.includes('property address');

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
          message: `Property not found (noResults: ${searchStatus.hasNoResults}, hasProperty: ${searchStatus.hasPropertyInfo})`
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
   * Look for sales history, deed book/page, or document IDs
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Sales/Transfer information
      this.log('🔍 Looking for Sales/Transfer information...');

      // Try to find and click Sales tab if it exists
      const salesClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li, td'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text === 'SALES' || text === 'Sales' ||
              text === 'TRANSFERS' || text === 'Transfers' ||
              text === 'SALES HISTORY' || text === 'Sales History' ||
              text.includes('Sales Information')) {

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

      if (salesClicked && salesClicked.clicked) {
        this.log(`✅ Clicked on Sales/Transfer tab (${salesClicked.text})`);
        await this.randomWait(3000, 5000);
      } else {
        this.log(`ℹ️  No Sales tab found, checking current page for transaction data`);
      }

      // Extract transaction information from the page
      this.log('🔍 Extracting transaction data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Pattern 1: Look for Official Records (OR) book and page numbers
        // Format: Book XXXXX Page XXXX or OR Book/Page
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        for (const line of lines) {
          // Match patterns like "Book 12345 Page 678" or "OR Book: 12345 Page: 678"
          const bookPageMatch = line.match(/(?:OR\s+)?Book[:\s]+(\d{4,})\s+Page[:\s]+(\d{1,})/i);
          if (bookPageMatch) {
            const bookNum = bookPageMatch[1];
            const pageNum = bookPageMatch[2];

            // Avoid duplicates
            const exists = results.some(r =>
              r.type === 'book_page' && r.bookNumber === bookNum && r.pageNumber === pageNum
            );

            if (!exists) {
              results.push({
                bookNumber: bookNum,
                pageNumber: pageNum,
                type: 'book_page',
                source: 'Polk County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }

          // Pattern 2: Look for CFN (Case File Number) or Document ID
          // Format: various, typically 10-12 digit numbers
          const cfnMatch = line.match(/(?:CFN|Document\s+(?:ID|Number))[:\s]+(\d{8,})/i);
          if (cfnMatch) {
            const cfn = cfnMatch[1];

            // Avoid duplicates
            const exists = results.some(r => r.documentId === cfn);

            if (!exists) {
              results.push({
                documentId: cfn,
                type: 'cfn',
                source: 'Polk County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }
        }

        // Pattern 3: Look for links to the Clerk's website
        const allLinks = Array.from(document.querySelectorAll('a[href*="polkcountyclerk"]'));

        for (const link of allLinks) {
          const href = link.href || '';
          const text = (link.innerText || '').trim();

          // Extract any document identifiers from the URL
          const docIdMatch = href.match(/(?:docid|document)[=\/](\d+)/i);
          if (docIdMatch) {
            results.push({
              documentId: docIdMatch[1],
              type: 'link',
              source: 'Polk County Property Appraiser',
              clerkUrl: href,
              displayText: text
            });
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      // Log what we found
      for (const trans of transactions) {
        if (trans.type === 'cfn') {
          this.log(`   CFN: ${trans.documentId}`);
        } else if (trans.type === 'book_page') {
          this.log(`   Book/Page: ${trans.bookNumber}/${trans.pageNumber}`);
        } else if (trans.type === 'link') {
          this.log(`   Link: ${trans.documentId} (${trans.displayText})`);
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
   * Download deed PDF from Polk County Clerk
   * Navigate to clerk's official records search and download the deed
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Polk County Clerk...');

    try {
      const clerkUrl = 'https://pro.polkcountyclerk.net/PRO/';
      this.log(`🌐 Navigating to Polk County Clerk: ${clerkUrl}`);

      // Navigate to the clerk's official records search
      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Look for Official Records search option
      this.log('🔍 Looking for Official Records search...');

      const officialRecordsClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text.includes('Official Records') ||
              text.includes('OFFICIAL RECORDS') ||
              text.includes('OR Search')) {

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

      if (officialRecordsClicked && officialRecordsClicked.clicked) {
        this.log(`✅ Clicked on Official Records (${officialRecordsClicked.text})`);
        await this.randomWait(3000, 5000);
      }

      // If we have a direct clerk URL from the property appraiser, use it
      if (transaction.clerkUrl) {
        this.log(`🌐 Using direct clerk URL: ${transaction.clerkUrl}`);
        await this.page.goto(transaction.clerkUrl, {
          waitUntil: 'networkidle2',
          timeout: this.timeout
        });

        await this.randomWait(3000, 5000);
      } else {
        // Search by Book/Page or Document ID
        if (transaction.bookNumber && transaction.pageNumber) {
          this.log(`🔍 Searching by Book/Page: ${transaction.bookNumber}/${transaction.pageNumber}`);

          // Look for Book/Page search fields
          const bookInputSelectors = [
            'input[name*="book"]',
            'input[name*="Book"]',
            'input[id*="book"]',
            'input[id*="Book"]'
          ];

          const pageInputSelectors = [
            'input[name*="page"]',
            'input[name*="Page"]',
            'input[id*="page"]',
            'input[id*="Page"]'
          ];

          let bookInput = null;
          for (const selector of bookInputSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000 });
              bookInput = selector;
              this.log(`✅ Found book input: ${selector}`);
              break;
            } catch (e) {
              // Try next selector
            }
          }

          let pageInput = null;
          for (const selector of pageInputSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000 });
              pageInput = selector;
              this.log(`✅ Found page input: ${selector}`);
              break;
            } catch (e) {
              // Try next selector
            }
          }

          if (bookInput && pageInput) {
            // Enter book and page numbers
            await this.page.click(bookInput);
            await this.page.type(bookInput, transaction.bookNumber, { delay: 50 });
            await this.page.click(pageInput);
            await this.page.type(pageInput, transaction.pageNumber, { delay: 50 });

            this.log(`✅ Entered Book: ${transaction.bookNumber}, Page: ${transaction.pageNumber}`);

            // Click search button
            const searchButtonSelectors = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button:contains("Search")',
              'input[value*="Search"]'
            ];

            for (const selector of searchButtonSelectors) {
              try {
                await this.page.waitForSelector(selector, { timeout: 3000 });
                await this.page.click(selector);
                this.log(`✅ Clicked search button`);
                break;
              } catch (e) {
                // Try next selector
              }
            }

            await this.randomWait(5000, 7000);
          }
        } else if (transaction.documentId) {
          this.log(`🔍 Searching by Document ID: ${transaction.documentId}`);

          // Look for Document ID search field
          const docIdInputSelectors = [
            'input[name*="document"]',
            'input[name*="Document"]',
            'input[id*="document"]',
            'input[id*="Document"]',
            'input[name*="cfn"]',
            'input[name*="CFN"]'
          ];

          let docIdInput = null;
          for (const selector of docIdInputSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000 });
              docIdInput = selector;
              this.log(`✅ Found document ID input: ${selector}`);
              break;
            } catch (e) {
              // Try next selector
            }
          }

          if (docIdInput) {
            // Enter document ID
            await this.page.click(docIdInput);
            await this.page.type(docIdInput, transaction.documentId, { delay: 50 });

            this.log(`✅ Entered Document ID: ${transaction.documentId}`);

            // Click search button
            const searchButtonSelectors = [
              'button[type="submit"]',
              'input[type="submit"]',
              'button:contains("Search")',
              'input[value*="Search"]'
            ];

            for (const selector of searchButtonSelectors) {
              try {
                await this.page.waitForSelector(selector, { timeout: 3000 });
                await this.page.click(selector);
                this.log(`✅ Clicked search button`);
                break;
              } catch (e) {
                // Try next selector
              }
            }

            await this.randomWait(5000, 7000);
          }
        }
      }

      // Look for PDF link or view button
      this.log('🔍 Looking for PDF document...');

      // Set up listener for new page/popup BEFORE clicking the button
      const newPagePromise = new Promise(resolve => {
        this.browser.once('targetcreated', async target => {
          if (target.type() === 'page') {
            const newPage = await target.page();
            resolve(newPage);
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => resolve(null), 30000);
      });

      // Look for view/download buttons or PDF links
      const viewButtonClicked = await this.page.evaluate(() => {
        // Look for view/download buttons
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));

        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();

          if (text.includes('view') ||
              text.includes('pdf') ||
              text.includes('document') ||
              text.includes('download')) {
            btn.click();
            return { clicked: true, text: btn.textContent || btn.value };
          }
        }

        // Look for PDF links
        const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"]'));
        if (pdfLinks.length > 0) {
          pdfLinks[0].click();
          return { clicked: true, text: 'PDF link', href: pdfLinks[0].href };
        }

        return { clicked: false };
      });

      if (!viewButtonClicked || !viewButtonClicked.clicked) {
        throw new Error('Could not find PDF view/download button');
      }

      this.log(`✅ Clicked view button: ${viewButtonClicked.text}`);

      // Wait for new window or PDF to load
      const newPage = await newPagePromise;

      let pdfUrl = null;
      let pdfPage = null;

      if (newPage) {
        this.log('✅ New window opened with PDF viewer');
        pdfUrl = newPage.url();
        pdfPage = newPage;
      } else {
        // PDF might have loaded in same window
        this.log('ℹ️  No new window, checking current page for PDF...');
        await this.randomWait(3000, 5000);
        pdfUrl = this.page.url();
        pdfPage = this.page;
      }

      this.log(`📍 PDF URL: ${pdfUrl}`);

      // Download the PDF
      this.log('📥 Downloading PDF...');

      const pdfArrayBuffer = await pdfPage.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      }, pdfUrl);

      // Convert array to Buffer
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      this.log(`🔍 PDF validation: isPDF=${isPDF}, size=${pdfBuffer.length} bytes`);

      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`);

      // Close the new window if it was opened
      if (newPage && newPage !== this.page) {
        await newPage.close();
      }

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

      const filename = `polk_deed_${transaction.documentId || `${transaction.bookNumber}_${transaction.pageNumber}`}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        documentId: transaction.documentId,
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

module.exports = PolkCountyFloridaScraper;
