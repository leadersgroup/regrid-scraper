/**
 * Miami-Dade County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://apps.miamidadepa.gov/propertysearch/ (Updated URL as of 2025)
 * - Old URL (redirects): https://www.miamidade.gov/Apps/PA/propertysearch/
 * - Clerk of Courts (Official Records): https://onlineservices.miamidadeclerk.gov/officialrecords/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class MiamiDadeCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Miami-Dade';
    this.state = 'FL';
    this.debugLogs = []; // Collect debug logs for API response
  }

  /**
   * Override log method - use parent implementation
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
   * Miami-Dade County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Miami-Dade County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Miami-Dade County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Miami-Dade County supports direct address search',
        county: 'Miami-Dade',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://apps.miamidadepa.gov/propertysearch/`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Miami-Dade',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://apps.miamidadepa.gov/propertysearch/',
        originalAddress: address,
        county: 'Miami-Dade',
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
      const deedId = mostRecentDeed.documentId || mostRecentDeed.officialRecordBook;
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
   * Get deed recorder/clerk URL for Miami-Dade County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Miami-Dade' && state === 'FL') {
      return 'https://onlineservices.miamidadeclerk.gov/officialrecords/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Miami-Dade County
   */
  getAssessorUrl(county, state) {
    if (county === 'Miami-Dade' && state === 'FL') {
      return 'https://apps.miamidadepa.gov/propertysearch/';
    }
    return null;
  }

  /**
   * Search Miami-Dade County Property Appraiser by address
   * URL: https://apps.miamidadepa.gov/propertysearch/ (Updated 2025)
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Miami-Dade County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page (updated URL)
      const assessorUrl = 'https://apps.miamidadepa.gov/propertysearch/';
      this.log(`🌐 Navigating to: ${assessorUrl}`);

      await this.page.goto(assessorUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for property address input field
      const addressInputSelectors = [
        'input#propertyAddressInput',
        'input[name*="address"]',
        'input[placeholder*="Address"]',
        'input[id*="address"]',
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
      await this.page.type(addressInput, streetAddress, { delay: 100 });
      this.log(`✅ Entered address: ${streetAddress}`);

      await this.randomWait(2000, 3000);

      // Look for autocomplete dropdown and click on the first result
      const autocompleteClicked = await this.page.evaluate(() => {
        // Look for autocomplete results
        const autocompleteItems = Array.from(document.querySelectorAll('ul li, .autocomplete-item, .dropdown-item, .ui-menu-item, div[role="option"]'));

        for (const item of autocompleteItems) {
          const text = (item.innerText || item.textContent || '').trim();
          if (text.length > 5) { // Must have some content
            item.click();
            return { clicked: true, text: text.substring(0, 100) };
          }
        }

        return { clicked: false };
      });

      if (autocompleteClicked.clicked) {
        this.log(`✅ Clicked autocomplete item: "${autocompleteClicked.text}"`);
        await this.randomWait(3000, 5000);
      } else {
        // No autocomplete, try submitting search
        this.log(`ℹ️  No autocomplete item found, will try search button`);

        // Look for search button
        const searchButtonSelectors = [
          'button[type="submit"]',
          'button:contains("Search")',
          'input[type="submit"]',
          'button.btn-primary'
        ];

        let searchClicked = false;
        for (const selector of searchButtonSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            await this.page.click(selector);
            this.log(`✅ Clicked search button: ${selector}`);
            searchClicked = true;
            break;
          } catch (e) {
            // Try next selector
          }
        }

        if (!searchClicked) {
          // Try pressing Enter
          await this.page.keyboard.press('Enter');
          this.log(`⌨️  Pressed Enter to search`);
        }

        await this.randomWait(3000, 5000);
      }

      // Wait for property details to load
      this.log(`⏳ Waiting for property details to load...`);
      await this.randomWait(5000, 7000);

      // Check if we're on a property detail page
      const hasPropertyDetails = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('folio') ||
               text.includes('property information') ||
               text.includes('owner name') ||
               text.includes('sales information');
      });

      if (hasPropertyDetails) {
        this.log(`✅ Property details page loaded`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found or search failed`);
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
   * Look for sales/transfer information and deed references
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for sales/transfer information tabs or sections
      this.log('🔍 Looking for Sales/Transfer information...');

      // Try to find and click Sales/Transfer tab
      const salesClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li, tab'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text.match(/sales?/i) ||
              text.match(/transfer/i) ||
              text.match(/deed/i) ||
              text.match(/transaction/i)) {

            if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab') {
              el.click();
              return { clicked: true, element: el.tagName, text: text };
            }

            const clickableParent = el.closest('a, button, [onclick], [role="tab"]');
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
        await this.randomWait(5000, 7000);

        // Scroll to ensure content is loaded
        await this.page.evaluate(() => {
          window.scrollBy(0, 1000);
        });
        await this.randomWait(2000, 3000);
      } else {
        this.log(`ℹ️  No Sales tab found, checking current page for transaction data`);
      }

      // Extract transaction information from the page
      this.log('🔍 Extracting transaction data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for ORB (Official Record Book) references
        // Miami-Dade uses format: ORB: XXXXX PG: XXXX
        // or Book/Page format
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        for (const line of lines) {
          // Pattern 1: ORB: XXXXX PG: XXXX
          const orbMatch = line.match(/ORB:?\s*(\d+)\s+PG:?\s*(\d+)/i);
          if (orbMatch) {
            const book = orbMatch[1];
            const page = orbMatch[2];

            // Check if not already added
            const exists = results.some(r => r.bookNumber === book && r.pageNumber === page);
            if (!exists) {
              results.push({
                officialRecordBook: book,
                pageNumber: page,
                type: 'orb',
                source: 'Miami-Dade County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }

          // Pattern 2: Book XXXXX Page XXXX
          const bookPageMatch = line.match(/Book:?\s*(\d+)\s+Page:?\s*(\d+)/i);
          if (bookPageMatch) {
            const book = bookPageMatch[1];
            const page = bookPageMatch[2];

            const exists = results.some(r => r.officialRecordBook === book && r.pageNumber === page);
            if (!exists) {
              results.push({
                officialRecordBook: book,
                pageNumber: page,
                type: 'book_page',
                source: 'Miami-Dade County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }

          // Pattern 3: Instrument Number (CFN)
          const cfnMatch = line.match(/(?:Instrument|CFN|Doc(?:ument)?)\s*(?:Number|#)?:?\s*(\d{8,})/i);
          if (cfnMatch) {
            const cfn = cfnMatch[1];

            const exists = results.some(r => r.documentId === cfn);
            if (!exists) {
              results.push({
                documentId: cfn,
                type: 'cfn',
                source: 'Miami-Dade County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }
        }

        // Also look in tables
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const rowText = cells.map(c => c.textContent?.trim() || '').join(' ');

            // Look for ORB/Page in table rows
            const orbMatch = rowText.match(/(\d{5,})\s+(\d{3,})/);
            if (orbMatch && rowText.toLowerCase().includes('sale')) {
              const book = orbMatch[1];
              const page = orbMatch[2];

              const exists = results.some(r => r.officialRecordBook === book && r.pageNumber === page);
              if (!exists) {
                results.push({
                  officialRecordBook: book,
                  pageNumber: page,
                  type: 'table',
                  source: 'Miami-Dade County Property Appraiser (table)',
                  rawText: rowText.substring(0, 200)
                });
              }
            }
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      // Log what we found
      for (const trans of transactions) {
        if (trans.documentId) {
          this.log(`   CFN/Instrument: ${trans.documentId}`);
        } else if (trans.officialRecordBook) {
          this.log(`   ORB/Book: ${trans.officialRecordBook} Page: ${trans.pageNumber}`);
        }
      }

      return {
        success: transactions.length > 0,
        transactions,
        debugLogs: this.debugLogs
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message,
        debugLogs: this.debugLogs
      };
    }
  }

  /**
   * Download deed PDF from Miami-Dade County Clerk
   * Search by ORB/Page or Document ID and download the PDF
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Miami-Dade County Clerk...');

    try {
      const clerkUrl = 'https://onlineservices.miamidadeclerk.gov/officialrecords/StandardSearch.aspx';
      this.log(`🌐 Navigating to Clerk Official Records: ${clerkUrl}`);

      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Determine search method based on available transaction data
      let searchPerformed = false;

      if (transaction.officialRecordBook && transaction.pageNumber) {
        // Search by ORB and Page
        this.log(`🔍 Searching by ORB ${transaction.officialRecordBook} Page ${transaction.pageNumber}`);

        // Look for Book/Page input fields
        const bookInputSelectors = ['input[name*="Book"]', 'input[id*="Book"]', 'input[placeholder*="Book"]'];
        const pageInputSelectors = ['input[name*="Page"]', 'input[id*="Page"]', 'input[placeholder*="Page"]'];

        let bookInput = null;
        let pageInput = null;

        // Find book input
        for (const selector of bookInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            bookInput = selector;
            break;
          } catch (e) {
            // Try next
          }
        }

        // Find page input
        for (const selector of pageInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            pageInput = selector;
            break;
          } catch (e) {
            // Try next
          }
        }

        if (bookInput && pageInput) {
          await this.page.type(bookInput, transaction.officialRecordBook);
          await this.page.type(pageInput, transaction.pageNumber);
          this.log(`✅ Entered ORB: ${transaction.officialRecordBook}, Page: ${transaction.pageNumber}`);
          searchPerformed = true;
        }
      } else if (transaction.documentId) {
        // Search by Document/Instrument Number
        this.log(`🔍 Searching by Document ID ${transaction.documentId}`);

        const docInputSelectors = [
          'input[name*="Instrument"]',
          'input[id*="Instrument"]',
          'input[name*="Document"]',
          'input[id*="Document"]',
          'input[placeholder*="Instrument"]',
          'input[placeholder*="Document"]'
        ];

        let docInput = null;
        for (const selector of docInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            docInput = selector;
            break;
          } catch (e) {
            // Try next
          }
        }

        if (docInput) {
          await this.page.type(docInput, transaction.documentId);
          this.log(`✅ Entered Document ID: ${transaction.documentId}`);
          searchPerformed = true;
        }
      }

      if (!searchPerformed) {
        throw new Error('Could not find appropriate search fields for transaction data');
      }

      // Click search button
      await this.randomWait(1000, 2000);

      const searchButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search"]',
        'button:contains("Search")'
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
          // Try next
        }
      }

      if (!searchClicked) {
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(5000, 7000);

      // Look for PDF link or view button in results
      this.log('🔍 Looking for PDF download link...');

      // Set up popup listener for PDF
      const newPagePromise = new Promise(resolve => {
        this.browser.once('targetcreated', async target => {
          if (target.type() === 'page') {
            const newPage = await target.page();
            resolve(newPage);
          }
        });
      });

      // Click on view/PDF link
      const pdfClicked = await this.page.evaluate(() => {
        // Look for links/buttons with PDF, View, Document, etc.
        const allElements = Array.from(document.querySelectorAll('a, button, img'));

        for (const el of allElements) {
          const text = (el.innerText || el.alt || el.title || '').toLowerCase();
          const href = el.href || '';

          if (text.includes('view') ||
              text.includes('pdf') ||
              text.includes('document') ||
              text.includes('image') ||
              href.includes('pdf') ||
              href.includes('ViewDocument')) {
            el.click();
            return { clicked: true, text: text.substring(0, 50), href: href.substring(0, 100) };
          }
        }

        return { clicked: false };
      });

      if (!pdfClicked.clicked) {
        throw new Error('Could not find PDF view link in search results');
      }

      this.log(`✅ Clicked PDF view link`);

      // Wait for new window with PDF
      this.log('⏳ Waiting for PDF window to open...');
      const newPage = await Promise.race([
        newPagePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for PDF window')), 30000)
        )
      ]);

      this.log('✅ PDF window opened');
      await this.randomWait(3000, 5000);

      // Get PDF URL and download
      const pdfUrl = newPage.url();
      this.log(`📍 PDF URL: ${pdfUrl}`);

      // Download the PDF
      this.log('📥 Downloading PDF...');
      const pdfArrayBuffer = await newPage.evaluate(async (url) => {
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
      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`);

      // Close the new window
      await newPage.close();

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

      const filename = `miami-dade_deed_${transaction.documentId || `${transaction.officialRecordBook}_${transaction.pageNumber}`}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        documentId: transaction.documentId,
        officialRecordBook: transaction.officialRecordBook,
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

module.exports = MiamiDadeCountyFloridaScraper;
