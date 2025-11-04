/**
 * Duval County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://paopropertysearch.coj.net
 * - Clerk of Courts (Official Records): https://or.duvalclerk.com/
 * - Online Core System: https://oncore.duvalclerk.com
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class DuvalCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Duval';
    this.state = 'FL';
  }

  /**
   * Override log method to use parent implementation
   */
  log(message) {
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
      protocolTimeout: 300000, // 5 minute timeout
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
   * Duval County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Duval County supports direct address search
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Duval County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Duval County supports direct address search',
        county: 'Duval',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://paopropertysearch.coj.net`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Duval',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://paopropertysearch.coj.net',
        originalAddress: address,
        county: 'Duval',
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
      const deedId = mostRecentDeed.instrumentNumber || mostRecentDeed.documentId || `Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`;
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
   * Get deed recorder/clerk URL for Duval County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Duval' && state === 'FL') {
      return 'https://or.duvalclerk.com/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Duval County
   */
  getAssessorUrl(county, state) {
    if (county === 'Duval' && state === 'FL') {
      return 'https://paopropertysearch.coj.net';
    }
    return null;
  }

  /**
   * Search Duval County Property Appraiser by address
   * URL: https://paopropertysearch.coj.net
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Duval County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://paopropertysearch.coj.net', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Parse the address into components
      const addressParts = streetAddress.match(/^(\d+)\s+(.+?)(?:\s+(Ave|Avenue|Blvd|Boulevard|Ct|Court|Dr|Drive|Ln|Lane|Rd|Road|St|Street|Way|Cir|Circle|Pl|Place))?$/i);

      let streetNumber = '';
      let streetName = '';
      let streetType = '';

      if (addressParts) {
        streetNumber = addressParts[1];
        streetName = addressParts[2];
        streetType = addressParts[3] || '';
      } else {
        // Fallback: split by space
        const parts = streetAddress.split(/\s+/);
        streetNumber = parts[0] || '';
        streetName = parts.slice(1, -1).join(' ') || parts.slice(1).join(' ');
        streetType = parts.length > 2 ? parts[parts.length - 1] : '';
      }

      this.log(`   Street Number: ${streetNumber}`);
      this.log(`   Street Name: ${streetName}`);
      this.log(`   Street Type: ${streetType}`);

      // Fill in the street number field
      const streetNumberInput = await this.page.$('input[name="streetNumber"]');
      if (streetNumberInput) {
        await streetNumberInput.click({ clickCount: 3 });
        await streetNumberInput.type(streetNumber);
        this.log(`✅ Entered street number: ${streetNumber}`);
      }

      await this.randomWait(500, 1000);

      // Fill in the street name field
      const streetNameInput = await this.page.$('input[name="streetName"]');
      if (streetNameInput) {
        await streetNameInput.click({ clickCount: 3 });
        await streetNameInput.type(streetName);
        this.log(`✅ Entered street name: ${streetName}`);
      }

      await this.randomWait(500, 1000);

      // Select street type from dropdown if available
      if (streetType) {
        try {
          const streetTypeSelect = await this.page.$('select[name="streetType"]');
          if (streetTypeSelect) {
            // Normalize street type
            const normalizedType = this.normalizeStreetType(streetType);
            await this.page.select('select[name="streetType"]', normalizedType);
            this.log(`✅ Selected street type: ${normalizedType}`);
          }
        } catch (e) {
          this.log(`⚠️  Could not select street type: ${e.message}`);
        }
      }

      await this.randomWait(1000, 2000);

      // Click the search button
      this.log(`🔍 Clicking search button...`);
      const searchClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        for (const btn of buttons) {
          const text = (btn.innerText || btn.value || '').toLowerCase();
          if (text.includes('search') || text.includes('find')) {
            btn.click();
            return { clicked: true, text };
          }
        }
        return { clicked: false };
      });

      if (searchClicked.clicked) {
        this.log(`✅ Clicked search button`);
      } else {
        this.log(`⚠️  Could not find search button, trying Enter key`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(5000, 7000);

      // Check if we got results
      const hasResults = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const hasTable = !!document.querySelector('table');
        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records');

        return {
          hasTable,
          hasNoResults,
          hasRealEstateNum: text.includes('real estate') || text.includes('re#') || text.includes('folio')
        };
      });

      if (hasResults.hasNoResults) {
        this.log(`⚠️  No results found for address`);
        return {
          success: false,
          message: 'No results found'
        };
      }

      if (hasResults.hasTable && hasResults.hasRealEstateNum) {
        this.log(`✅ Property found in search results`);

        // Click on the first result (RE# link)
        await this.randomWait(2000, 3000);

        const resultClicked = await this.page.evaluate(() => {
          // Look for RE# or real estate number link
          const allLinks = Array.from(document.querySelectorAll('a'));

          for (const link of allLinks) {
            const text = (link.innerText || link.textContent || '').trim();
            // RE# format: usually numbers with dashes, e.g., "123456-0000"
            if (/^\d{6}-\d{4}$/.test(text) || /^\d{6,}$/.test(text)) {
              link.click();
              return { clicked: true, reNum: text };
            }
          }

          // Alternative: click on first row in results table
          const firstRow = document.querySelector('table tbody tr');
          if (firstRow) {
            const firstLink = firstRow.querySelector('a');
            if (firstLink) {
              firstLink.click();
              return { clicked: true, reNum: firstLink.innerText };
            }
          }

          return { clicked: false };
        });

        if (resultClicked.clicked) {
          this.log(`✅ Clicked on property: ${resultClicked.reNum}`);

          // Wait for property detail page to load
          await this.randomWait(5000, 7000);

          this.log(`✅ Property detail page loaded`);
        } else {
          this.log(`⚠️  Could not click on property result`);
        }

        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️  Unexpected search results page format`);
        return {
          success: false,
          message: 'Unexpected results page format'
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
   * Normalize street type abbreviations
   */
  normalizeStreetType(type) {
    const typeMap = {
      'ave': 'Avenue',
      'avenue': 'Avenue',
      'blvd': 'Boulevard',
      'boulevard': 'Boulevard',
      'cir': 'Circle',
      'circle': 'Circle',
      'ct': 'Court',
      'court': 'Court',
      'dr': 'Drive',
      'drive': 'Drive',
      'ln': 'Lane',
      'lane': 'Lane',
      'pl': 'Place',
      'place': 'Place',
      'rd': 'Road',
      'road': 'Road',
      'st': 'Street',
      'street': 'Street',
      'way': 'Way'
    };

    const normalized = typeMap[type.toLowerCase()];
    return normalized || type;
  }

  /**
   * Extract transaction records from property detail page
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for sales/deed information on the page
      this.log('🔍 Looking for deed/sales information...');

      // Scroll down to ensure all content is loaded
      await this.page.evaluate(() => {
        window.scrollBy(0, 1000);
      });
      await this.randomWait(1000, 2000);

      // Extract transaction data from the page
      const transactions = await this.page.evaluate(() => {
        const results = [];
        const text = document.body.innerText;

        // Look for instrument numbers (format: multiple digits)
        // Duval County uses instrument numbers like "2020123456"
        const instrumentMatches = text.matchAll(/(?:Instrument|Inst|Doc|Document|OR Book)[\s#:]*(\d{8,})/gi);
        for (const match of instrumentMatches) {
          if (match[1] && match[1].length >= 8) {
            results.push({
              instrumentNumber: match[1],
              type: 'instrument',
              source: 'Duval County Property Appraiser'
            });
          }
        }

        // Look for book/page references
        const bookPageMatches = text.matchAll(/Book[\s:]*(\d+)[\s,]*Page[\s:]*(\d+)/gi);
        for (const match of bookPageMatches) {
          if (match[1] && match[2] && parseInt(match[1]) > 100) {
            results.push({
              bookNumber: match[1],
              pageNumber: match[2],
              type: 'book_page',
              source: 'Duval County Property Appraiser'
            });
          }
        }

        // Look for deed information in table format
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));

          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            const rowText = cells.map(c => c.innerText || '').join(' ');

            // Check for instrument number in table
            const instMatch = rowText.match(/(\d{8,})/);
            if (instMatch && rowText.toLowerCase().includes('deed')) {
              results.push({
                instrumentNumber: instMatch[1],
                type: 'instrument',
                source: 'Duval County Property Appraiser (table)'
              });
            }

            // Check for book/page in table
            const bookPageMatch = rowText.match(/(\d{3,})\s*[\/\-]\s*(\d+)/);
            if (bookPageMatch && rowText.toLowerCase().includes('book')) {
              results.push({
                bookNumber: bookPageMatch[1],
                pageNumber: bookPageMatch[2],
                type: 'book_page',
                source: 'Duval County Property Appraiser (table)'
              });
            }
          }
        }

        // Remove duplicates
        const uniqueResults = [];
        const seen = new Set();

        for (const result of results) {
          const key = result.instrumentNumber || `${result.bookNumber}-${result.pageNumber}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueResults.push(result);
          }
        }

        return uniqueResults;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      // Log what we found
      for (const trans of transactions) {
        if (trans.instrumentNumber) {
          this.log(`   Instrument: ${trans.instrumentNumber}`);
        } else if (trans.bookNumber && trans.pageNumber) {
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
   * Download deed PDF from Duval County Clerk
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Duval County Clerk...');

    try {
      // Build the search URL based on transaction type
      let clerkUrl = 'https://or.duvalclerk.com/';

      this.log(`🌐 Navigating to Clerk website: ${clerkUrl}`);

      // Navigate to the clerk's website
      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Accept disclaimer if present
      const disclaimerAccepted = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
        for (const btn of buttons) {
          const text = (btn.innerText || btn.value || '').toLowerCase();
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

      // Search by instrument number or book/page
      if (transaction.instrumentNumber) {
        this.log(`🔍 Searching by Instrument Number: ${transaction.instrumentNumber}`);

        // Click on Instrument Number search option
        await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button'));
          for (const link of links) {
            const text = (link.innerText || '').toLowerCase();
            if (text.includes('instrument') && (text.includes('number') || text.includes('#'))) {
              link.click();
              return;
            }
          }
        });

        await this.randomWait(2000, 3000);

        // Enter instrument number
        const instrumentInput = await this.page.$('input[name*="instrument"], input[name*="Instrument"], input[id*="instrument"]');
        if (instrumentInput) {
          await instrumentInput.click({ clickCount: 3 });
          await instrumentInput.type(transaction.instrumentNumber);
          this.log(`✅ Entered instrument number: ${transaction.instrumentNumber}`);
        }

      } else if (transaction.bookNumber && transaction.pageNumber) {
        this.log(`🔍 Searching by Book/Page: ${transaction.bookNumber}/${transaction.pageNumber}`);

        // Click on Book/Page search option
        await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button'));
          for (const link of links) {
            const text = (link.innerText || '').toLowerCase();
            if (text.includes('book') && text.includes('page')) {
              link.click();
              return;
            }
          }
        });

        await this.randomWait(2000, 3000);

        // Enter book number
        const bookInput = await this.page.$('input[name*="book"], input[name*="Book"], input[id*="book"]');
        if (bookInput) {
          await bookInput.click({ clickCount: 3 });
          await bookInput.type(transaction.bookNumber);
          this.log(`✅ Entered book number: ${transaction.bookNumber}`);
        }

        await this.randomWait(500, 1000);

        // Enter page number
        const pageInput = await this.page.$('input[name*="page"], input[name*="Page"], input[id*="page"]');
        if (pageInput) {
          await pageInput.click({ clickCount: 3 });
          await pageInput.type(transaction.pageNumber);
          this.log(`✅ Entered page number: ${transaction.pageNumber}`);
        }
      } else {
        throw new Error('No instrument number or book/page available');
      }

      await this.randomWait(1000, 2000);

      // Click search button
      this.log(`🔍 Clicking search button...`);
      await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.innerText || btn.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit')) {
            btn.click();
            return;
          }
        }
      });

      await this.randomWait(5000, 7000);

      // Look for view/download button or PDF link
      this.log(`🔍 Looking for PDF viewer/download link...`);

      // Set up listener for new page/popup
      const newPagePromise = new Promise(resolve => {
        const timeout = setTimeout(() => resolve(null), 30000);
        this.browser.once('targetcreated', async target => {
          clearTimeout(timeout);
          if (target.type() === 'page') {
            const newPage = await target.page();
            resolve(newPage);
          }
        });
      });

      // Try to find and click view button
      const viewClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
        for (const btn of buttons) {
          const text = (btn.innerText || btn.value || '').toLowerCase();
          if (text.includes('view') || text.includes('download') || text.includes('pdf')) {
            btn.click();
            return { clicked: true, text };
          }
        }

        // Look for direct PDF links
        const links = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="document"]'));
        if (links.length > 0) {
          links[0].click();
          return { clicked: true, text: 'PDF link', href: links[0].href };
        }

        return { clicked: false };
      });

      if (viewClicked.clicked) {
        this.log(`✅ Clicked view/download button`);
      } else {
        throw new Error('Could not find view/download button');
      }

      // Wait for new window or PDF to load
      const newPage = await newPagePromise;

      let pdfBuffer;

      if (newPage) {
        this.log(`✅ New window opened`);
        this.log(`   URL: ${newPage.url()}`);

        await this.randomWait(3000, 5000);

        // Download PDF from new window
        const pdfUrl = newPage.url();
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

      } else {
        // PDF might have loaded in same page
        this.log(`ℹ️  No new window detected, checking current page for PDF...`);

        await this.randomWait(3000, 5000);

        // Try to get PDF from current page URL
        const currentUrl = this.page.url();
        if (currentUrl.includes('.pdf') || currentUrl.includes('document')) {
          const pdfArrayBuffer = await this.page.evaluate(async () => {
            const response = await fetch(window.location.href);
            const arrayBuffer = await response.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
          });
          pdfBuffer = Buffer.from(pdfArrayBuffer);
        } else {
          throw new Error('Could not find PDF in new window or current page');
        }
      }

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
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

      const filename = `duval_deed_${transaction.instrumentNumber || `${transaction.bookNumber}_${transaction.pageNumber}`}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        instrumentNumber: transaction.instrumentNumber,
        documentId: transaction.instrumentNumber,
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

module.exports = DuvalCountyFloridaScraper;
