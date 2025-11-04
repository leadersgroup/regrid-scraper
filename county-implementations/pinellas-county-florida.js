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
   * Search Pinellas County Property Appraiser by address
   * URL: https://www.pcpao.gov/quick-search
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Pinellas County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://www.pcpao.gov/quick-search', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for address input field
      const addressInputSelectors = [
        'input[placeholder*="address"]',
        'input[placeholder*="Address"]',
        'input[name*="address"]',
        'input[id*="address"]',
        'input[type="search"]',
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

      // Clear and enter address
      await this.page.click(addressInput, { clickCount: 3 });
      await this.page.type(addressInput, streetAddress);
      await this.randomWait(2000, 3000);

      this.log(`✅ Entered address: ${streetAddress}`);

      // Press Enter or click search button
      try {
        const searchButtonSelector = 'button[type="submit"], button:contains("Search"), input[type="submit"]';
        await this.page.waitForSelector('button[type="submit"]', { timeout: 5000 });
        await this.page.click('button[type="submit"]');
        this.log(`✅ Clicked search button`);
      } catch (clickError) {
        // Fallback: Press Enter key
        this.log(`⚠️  Could not click search button, trying Enter key`);
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for search results to load
      this.log(`⏳ Waiting for search results to load...`);
      await this.randomWait(5000, 7000);

      // Wait for results table or detail page
      try {
        await this.page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('parcel') ||
                 text.includes('owner') ||
                 text.includes('deed') ||
                 text.includes('sale');
        }, { timeout: 30000 });
        this.log(`✅ Search results loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for results`);
      }

      await this.randomWait(3000, 5000);

      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records') ||
                            text.includes('no properties');

        const hasResults = text.includes('parcel') ||
                          text.includes('owner name') ||
                          text.includes('property address');

        return {
          hasNoResults,
          hasResults,
          url: window.location.href
        };
      });

      this.log(`🔍 Search result analysis:`);
      this.log(`   Current URL: ${searchStatus.url}`);
      this.log(`   Has results: ${searchStatus.hasResults}`);
      this.log(`   Has "no results" message: ${searchStatus.hasNoResults}`);

      if (!searchStatus.hasNoResults && searchStatus.hasResults) {
        this.log(`✅ Property found`);

        // If we're on a results table, click the first result
        const resultClicked = await this.page.evaluate(() => {
          // Look for clickable parcel link
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const text = (link.innerText || '').trim();
            // Pinellas parcel format: XX-XX-XX-XXXXX-XXX-XXXX
            if (/\d{2}-\d{2}-\d{2}-\d{5}-\d{3}-\d{4}/.test(text)) {
              link.click();
              return { clicked: true, parcel: text };
            }
          }

          // Alternative: look for any result row
          const rows = Array.from(document.querySelectorAll('tr'));
          for (const row of rows) {
            const link = row.querySelector('a');
            if (link && row.innerText.toLowerCase().includes('parcel')) {
              link.click();
              return { clicked: true, parcel: link.innerText };
            }
          }

          return { clicked: false };
        });

        if (resultClicked.clicked) {
          this.log(`✅ Clicked on parcel ${resultClicked.parcel}`);
          await this.randomWait(5000, 7000);

          // Wait for property detail page
          await this.page.waitForFunction(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('sales') ||
                   text.includes('deed') ||
                   text.includes('transfer');
          }, { timeout: 15000 }).catch(() => {
            this.log(`⚠️ Timeout waiting for property detail page`);
          });

          this.log(`✅ Property detail page loaded`);
        }

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
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Sales/Transfer section
      this.log('🔍 Looking for Sales/Transfer information...');

      // Scroll down to ensure all content is loaded
      await this.page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await this.randomWait(2000, 3000);

      // Extract deed information from the page
      this.log('🔍 Extracting deed data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for "Last Deed" section
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        let inDeedSection = false;
        let currentDeed = {};

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Detect deed section
          if (line.toLowerCase().includes('last deed') ||
              line.toLowerCase().includes('sale date') ||
              line.toLowerCase().includes('grantor')) {
            inDeedSection = true;
          }

          if (inDeedSection) {
            // Extract grantor
            if (line.toLowerCase().includes('grantor')) {
              const nextLine = lines[i + 1]?.trim();
              if (nextLine) currentDeed.grantor = nextLine;
            }

            // Extract grantee
            if (line.toLowerCase().includes('grantee')) {
              const nextLine = lines[i + 1]?.trim();
              if (nextLine) currentDeed.grantee = nextLine;
            }

            // Extract sale date
            if (line.toLowerCase().includes('sale date')) {
              const nextLine = lines[i + 1]?.trim();
              if (nextLine) currentDeed.saleDate = nextLine;
            }

            // Extract book/page
            const bookPageMatch = line.match(/book[:\s]+(\d+)[,\s]+page[:\s]+(\d+)/i);
            if (bookPageMatch) {
              currentDeed.bookNumber = bookPageMatch[1];
              currentDeed.pageNumber = bookPageMatch[2];
              currentDeed.bookPage = `Book ${bookPageMatch[1]}, Page ${bookPageMatch[2]}`;
            }

            // Extract document number (OR Book format)
            const docMatch = line.match(/\b(\d{10,})\b/);
            if (docMatch) {
              currentDeed.documentNumber = docMatch[1];
            }

            // If we have enough info, save and reset
            if (currentDeed.grantor && currentDeed.grantee) {
              results.push({
                ...currentDeed,
                type: currentDeed.documentNumber ? 'document_number' : 'book_page',
                source: 'Pinellas County Property Appraiser'
              });
              currentDeed = {};
              inDeedSection = false;
            }
          }
        }

        // Look for links to clerk records
        const clerkLinks = Array.from(document.querySelectorAll('a[href*="clerk"], a[href*="official"]'));
        for (const link of clerkLinks) {
          const href = link.href;
          const text = link.innerText || '';

          // Extract document identifiers from links
          const docMatch = href.match(/(?:doc|instrument|cfn)[=\/](\d+)/i);
          if (docMatch) {
            results.push({
              documentNumber: docMatch[1],
              type: 'document_number',
              source: 'Pinellas County Property Appraiser',
              clerkUrl: href,
              displayText: text
            });
          }
        }

        return results;
      });

      this.log(`🔍 Extracted ${transactions.length} transaction(s)`);

      for (const trans of transactions) {
        if (trans.type === 'document_number') {
          this.log(`   Doc #: ${trans.documentNumber}`);
        } else if (trans.type === 'book_page') {
          this.log(`   ${trans.bookPage}`);
        }
        if (trans.grantor) this.log(`   Grantor: ${trans.grantor}`);
        if (trans.grantee) this.log(`   Grantee: ${trans.grantee}`);
        if (trans.saleDate) this.log(`   Sale Date: ${trans.saleDate}`);
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
   * Download deed PDF from Pinellas County Clerk
   * Navigate to clerk website and download the document
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Pinellas County Clerk...');

    try {
      const clerkUrl = 'https://officialrecords.mypinellasclerk.org/';
      this.log(`🌐 Navigating to Clerk: ${clerkUrl}`);

      // Navigate to the clerk's website
      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Accept disclaimer if present
      const disclaimerAccepted = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        for (const button of buttons) {
          const text = (button.innerText || button.value || '').toLowerCase();
          if (text.includes('accept') || text.includes('agree') || text.includes('continue')) {
            button.click();
            return true;
          }
        }
        return false;
      });

      if (disclaimerAccepted) {
        this.log('✅ Accepted disclaimer');
        await this.randomWait(3000, 5000);
      }

      // Search for the document
      if (transaction.documentNumber) {
        this.log(`🔍 Searching by document number: ${transaction.documentNumber}`);
        await this.searchByDocumentNumber(transaction.documentNumber);
      } else if (transaction.bookNumber && transaction.pageNumber) {
        this.log(`🔍 Searching by Book/Page: ${transaction.bookNumber}/${transaction.pageNumber}`);
        await this.searchByBookPage(transaction.bookNumber, transaction.pageNumber);
      } else if (transaction.grantor && transaction.grantee) {
        this.log(`🔍 Searching by names: ${transaction.grantor} to ${transaction.grantee}`);
        await this.searchByNames(transaction.grantor, transaction.grantee);
      } else {
        throw new Error('No valid search criteria available');
      }

      // After search, click on the result to view document
      await this.randomWait(3000, 5000);

      // Look for document link in results
      const docClicked = await this.page.evaluate(() => {
        // Look for document links
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const text = (link.innerText || '').toLowerCase();
          if (text.includes('view') || text.includes('image') || text.includes('doc')) {
            link.click();
            return { clicked: true, text: link.innerText };
          }
        }

        // Alternative: click first result row
        const rows = Array.from(document.querySelectorAll('tr'));
        if (rows.length > 1) {
          const firstResult = rows[1].querySelector('a');
          if (firstResult) {
            firstResult.click();
            return { clicked: true, text: firstResult.innerText };
          }
        }

        return { clicked: false };
      });

      if (docClicked.clicked) {
        this.log(`✅ Clicked on document: ${docClicked.text}`);
      } else {
        this.log(`⚠️ Could not find document link`);
      }

      await this.randomWait(5000, 7000);

      // Set up listener for PDF download or new window
      this.log('📥 Looking for PDF download option...');

      // Try to find and download the PDF
      const pdfInfo = await this.page.evaluate(() => {
        // Look for PDF links
        const links = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="PDF"]'));
        if (links.length > 0) {
          return { pdfUrl: links[0].href, method: 'direct_link' };
        }

        // Look for download buttons
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
        for (const button of buttons) {
          const text = (button.innerText || button.value || '').toLowerCase();
          if (text.includes('download') || text.includes('pdf') || text.includes('print')) {
            return { buttonText: text, method: 'button_click' };
          }
        }

        // Check if current page is already a PDF
        if (window.location.href.includes('.pdf')) {
          return { pdfUrl: window.location.href, method: 'current_page' };
        }

        return { method: 'not_found' };
      });

      this.log(`🔍 PDF method: ${pdfInfo.method}`);

      let pdfBuffer;

      if (pdfInfo.method === 'direct_link' || pdfInfo.method === 'current_page') {
        // Download PDF directly
        this.log(`📥 Downloading PDF from: ${pdfInfo.pdfUrl}`);

        const pdfArrayBuffer = await this.page.evaluate(async (url) => {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        }, pdfInfo.pdfUrl);

        pdfBuffer = Buffer.from(pdfArrayBuffer);
      } else {
        throw new Error('Could not find PDF download option');
      }

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      this.log(`🔍 PDF validation: isPDF=${isPDF}, size=${pdfBuffer.length} bytes`);

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

      const filename = `pinellas_deed_${transaction.documentNumber || `${transaction.bookNumber}_${transaction.pageNumber}` || Date.now()}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        documentNumber: transaction.documentNumber,
        bookPage: transaction.bookPage,
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

  /**
   * Search Pinellas Clerk by document/instrument number
   */
  async searchByDocumentNumber(docNumber) {
    this.log(`🔍 Searching by document number: ${docNumber}`);

    // Look for Instrument Number search option
    const searchClicked = await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.innerText || '').toLowerCase();
        if (text.includes('instrument') || text.includes('document number')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (searchClicked) {
      this.log('✅ Clicked on Instrument Number search');
      await this.randomWait(2000, 3000);
    }

    // Enter document number
    await this.page.type('input[type="text"]', docNumber);
    await this.randomWait(1000, 2000);

    // Submit search
    await this.page.keyboard.press('Enter');
    await this.randomWait(3000, 5000);
  }

  /**
   * Search Pinellas Clerk by Book/Page
   */
  async searchByBookPage(book, page) {
    this.log(`🔍 Searching by Book/Page: ${book}/${page}`);

    // Look for Book/Page search option
    const searchClicked = await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.innerText || '').toLowerCase();
        if (text.includes('book') && text.includes('page')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (searchClicked) {
      this.log('✅ Clicked on Book/Page search');
      await this.randomWait(2000, 3000);
    }

    // Enter book and page numbers
    const inputs = await this.page.$$('input[type="text"]');
    if (inputs.length >= 2) {
      await inputs[0].type(book);
      await inputs[1].type(page);
      await this.randomWait(1000, 2000);
    }

    // Submit search
    await this.page.keyboard.press('Enter');
    await this.randomWait(3000, 5000);
  }

  /**
   * Search Pinellas Clerk by grantor/grantee names
   */
  async searchByNames(grantor, grantee) {
    this.log(`🔍 Searching by names: ${grantor} -> ${grantee}`);

    // Look for Name search option
    const searchClicked = await this.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = (link.innerText || '').toLowerCase();
        if (text.includes('name search')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (searchClicked) {
      this.log('✅ Clicked on Name search');
      await this.randomWait(2000, 3000);
    }

    // Enter grantee name (last name first)
    const nameInput = await this.page.$('input[type="text"]');
    if (nameInput) {
      // Split name and reverse (Last, First)
      const nameParts = grantee.split(' ');
      const lastName = nameParts[nameParts.length - 1];
      await nameInput.type(lastName);
      await this.randomWait(1000, 2000);
    }

    // Submit search
    await this.page.keyboard.press('Enter');
    await this.randomWait(3000, 5000);
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
