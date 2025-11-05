/**
 * Palm Beach County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://pbcpao.gov/
 * - Clerk of Courts (Official Records): https://erec.mypalmbeachclerk.com/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class PalmBeachCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Palm Beach';
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
   * Palm Beach County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Palm Beach County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Palm Beach County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Palm Beach County supports direct address search',
        county: 'Palm Beach',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://pbcpao.gov/`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Palm Beach',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://pbcpao.gov/',
        originalAddress: address,
        county: 'Palm Beach',
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
      const deedId = mostRecentDeed.documentId || mostRecentDeed.instrumentNumber || `Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`;
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
   * Get deed recorder/clerk URL for Palm Beach County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Palm Beach' && state === 'FL') {
      return 'https://erec.mypalmbeachclerk.com/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Palm Beach County
   */
  getAssessorUrl(county, state) {
    if (county === 'Palm Beach' && state === 'FL') {
      return 'https://pbcpao.gov/';
    }
    return null;
  }

  /**
   * Search Palm Beach County Property Appraiser by address
   * URL: https://pbcpao.gov/
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Palm Beach County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://pbcpao.gov/', {
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
        'input[name="address"]',
        'input[placeholder*="Address"]',
        'input[placeholder*="address"]',
        'input[id*="address"]',
        'input[type="text"]',
        'input[type="search"]'
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
      await this.page.type(addressInput, streetAddress, { delay: 100 });

      this.log(`✅ Entered address: ${streetAddress}`);

      await this.randomWait(2000, 3000);

      // Look for and click search button
      const searchButtonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Search")',
        'input[value*="Search"]',
        'button[id*="search"]'
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
        // Try pressing Enter as fallback
        this.log(`⚠️ Could not find search button, pressing Enter`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results to load
      this.log(`⏳ Waiting for search results to load...`);
      await this.randomWait(5000, 7000);

      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found') ||
                            text.includes('no matches');

        // Look for property information
        const hasPropertyInfo = text.includes('property') &&
                               (text.includes('owner') || text.includes('parcel'));

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

        // Look for and click on the property link/result
        await this.randomWait(2000, 3000);

        const resultClicked = await this.page.evaluate((searchAddr) => {
          // Look for clickable property links
          const allLinks = Array.from(document.querySelectorAll('a, [onclick], [role="button"]'));

          for (const el of allLinks) {
            const text = (el.innerText || el.textContent || '').trim();

            // Look for parcel number or address that matches
            if (text && (text.includes(searchAddr.split(' ')[0]) || /^\d{2}-\d{2}/.test(text))) {
              el.click();
              return { clicked: true, text: text.substring(0, 100) };
            }
          }

          return { clicked: false };
        }, streetAddress);

        if (resultClicked.clicked) {
          this.log(`✅ Clicked on property result: "${resultClicked.text}"`);

          // Wait for property detail page to load
          await this.randomWait(5000, 7000);

          this.log(`✅ Property detail page loaded`);
        } else {
          this.log(`ℹ️  Could not find clickable property result, proceeding anyway`);
        }

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
   * Navigate to Sales Information section and extract OR Book/Page
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Sales Information section
      this.log('🔍 Looking for Sales Information section...');

      // Scroll to find Sales Information section
      await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Sales Information') || text.includes('SALES INFORMATION')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });

      await this.randomWait(2000, 3000);

      // Extract OR Book/Page links from Sales Information section
      this.log('🔍 Extracting OR Book/Page from Sales Information section...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Find Sales Information section
        const allText = document.body.innerText;
        const allElements = Array.from(document.querySelectorAll('*'));

        // Look for elements containing "OR Book/Page" or similar
        for (const el of allElements) {
          const text = (el.textContent || '').trim();

          // Look for OR Book/Page pattern (e.g., "33358 / 1920")
          const orBookPageMatch = text.match(/^(\d{4,6})\s*\/\s*(\d{3,5})$/);
          if (orBookPageMatch) {
            const bookNumber = orBookPageMatch[1];
            const pageNumber = orBookPageMatch[2];

            // Check if this is a clickable link
            const link = el.closest('a');
            if (link) {
              results.push({
                bookNumber,
                pageNumber,
                type: 'or_book_page',
                source: 'Palm Beach County Property Appraiser - Sales Information',
                href: link.href || '',
                text: text
              });
            } else {
              results.push({
                bookNumber,
                pageNumber,
                type: 'or_book_page',
                source: 'Palm Beach County Property Appraiser - Sales Information',
                text: text
              });
            }
          }
        }

        // Also look for links with Book/Page in them
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // Check if link text contains book/page pattern
          const bookPageMatch = text.match(/(\d{4,6})\s*\/\s*(\d{3,5})/);
          if (bookPageMatch && !results.some(r => r.bookNumber === bookPageMatch[1] && r.pageNumber === bookPageMatch[2])) {
            results.push({
              bookNumber: bookPageMatch[1],
              pageNumber: bookPageMatch[2],
              type: 'or_book_page',
              source: 'Palm Beach County Property Appraiser',
              href: href,
              text: text
            });
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} OR Book/Page record(s)`);

      // Log what we found
      for (const trans of transactions) {
        this.log(`   OR Book/Page: ${trans.bookNumber}/${trans.pageNumber}`);
        if (trans.href) {
          this.log(`      Link: ${trans.href.substring(0, 100)}`);
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
   * Download deed PDF from Palm Beach County Clerk
   * Click on OR Book/Page link and download PDF using Orange County method
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Palm Beach County Clerk...');

    try {
      const bookNumber = transaction.bookNumber;
      const pageNumber = transaction.pageNumber;

      this.log(`🔍 Transaction details: OR Book/Page=${bookNumber}/${pageNumber}`);

      // Navigate to the clerk's official records search
      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(5000, 7000);

      // If we have a direct clerk URL, use it
      if (transaction.clerkUrl) {
        this.log(`📍 Using direct clerk URL: ${transaction.clerkUrl}`);
        await this.page.goto(transaction.clerkUrl, {
          waitUntil: 'networkidle2',
          timeout: this.timeout
        });
        await this.randomWait(5000, 7000);
      } else {
        // Search by instrument number or book/page
        if (transaction.instrumentNumber) {
          this.log(`🔍 Searching by instrument number: ${transaction.instrumentNumber}`);
          await this.searchClerkByInstrument(transaction.instrumentNumber);
        } else if (transaction.bookNumber && transaction.pageNumber) {
          this.log(`🔍 Searching by book/page: ${transaction.bookNumber}/${transaction.pageNumber}`);
          await this.searchClerkByBookPage(transaction.bookNumber, transaction.pageNumber);
        } else {
          throw new Error('No valid search criteria for clerk search');
        }
      }

      // Look for PDF viewer or download link
      await this.randomWait(3000, 5000);

      // Set up listener for new page/popup BEFORE clicking any view button
      this.log(`🔍 Setting up popup listener for PDF viewer...`);
      const newPagePromise = new Promise(resolve => {
        this.browser.once('targetcreated', async target => {
          if (target.type() === 'page') {
            const newPage = await target.page();
            resolve(newPage);
          }
        });
      });

      // Look for view/download buttons
      const viewButtonClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], [role="button"]'));

        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();

          if (text.includes('view') || text.includes('download') || text.includes('open') || text.includes('image')) {
            btn.click();
            return { clicked: true, buttonText: text };
          }
        }

        return { clicked: false };
      });

      if (viewButtonClicked.clicked) {
        this.log(`✅ Clicked view button: ${viewButtonClicked.buttonText}`);

        // Wait for new window with timeout
        const newPage = await Promise.race([
          newPagePromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout waiting for PDF viewer window')), 30000)
          )
        ]);

        this.log('✅ PDF viewer window opened');
        this.log(`🔍 PDF window URL: ${newPage.url()}`);

        // Wait for the PDF to load
        await this.randomWait(3000, 5000);

        // Get the PDF URL
        const pdfUrl = newPage.url();

        // Download the PDF using fetch in the new window's context
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
        this.log(`🔍 PDF validation: isPDF=${isPDF}, size=${pdfBuffer.length} bytes`);

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

        const documentId = transaction.instrumentNumber || transaction.documentId || `${transaction.bookNumber}_${transaction.pageNumber}`;
        const filename = `palm_beach_deed_${documentId}.pdf`;
        const filepath = path.join(downloadPath, filename);

        fs.writeFileSync(filepath, pdfBuffer);
        this.log(`💾 Saved PDF to: ${filepath}`);

        return {
          success: true,
          filename,
          downloadPath,
          documentId,
          timestamp: new Date().toISOString(),
          fileSize: pdfBuffer.length
        };

      } else {
        // Try alternative: look for iframe with PDF
        this.log(`ℹ️  No view button found, looking for PDF iframe...`);

        const pdfUrl = await this.page.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const iframe of iframes) {
            const src = iframe.src || '';
            if (src.includes('.pdf') || src.includes('application/pdf')) {
              return src;
            }
          }
          return null;
        });

        if (pdfUrl) {
          this.log(`✅ Found PDF iframe: ${pdfUrl}`);

          // Navigate to PDF URL
          await this.page.goto(pdfUrl, {
            waitUntil: 'networkidle2',
            timeout: this.timeout
          });

          await this.randomWait(3000, 5000);

          // Download PDF
          const cookies = await this.page.cookies();
          const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

          const https = require('https');
          const fs = require('fs');
          const path = require('path');
          const { URL } = require('url');

          const pdfUrlObj = new URL(pdfUrl);

          return new Promise((resolve, reject) => {
            const options = {
              hostname: pdfUrlObj.hostname,
              path: pdfUrlObj.pathname + pdfUrlObj.search,
              method: 'GET',
              headers: {
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            };

            https.get(options, (res) => {
              const chunks = [];

              res.on('data', (chunk) => {
                chunks.push(chunk);
              });

              res.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);

                // Verify it's a PDF
                const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';

                if (!isPDF) {
                  return reject(new Error('Downloaded file is not a valid PDF'));
                }

                // Save to disk
                const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
                const downloadPath = path.resolve(relativePath);

                if (!fs.existsSync(downloadPath)) {
                  fs.mkdirSync(downloadPath, { recursive: true });
                }

                const documentId = transaction.instrumentNumber || transaction.documentId || `${transaction.bookNumber}_${transaction.pageNumber}`;
                const filename = `palm_beach_deed_${documentId}.pdf`;
                const filepath = path.join(downloadPath, filename);

                fs.writeFileSync(filepath, pdfBuffer);
                this.log(`💾 Saved PDF to: ${filepath}`);

                resolve({
                  success: true,
                  filename,
                  downloadPath,
                  documentId,
                  timestamp: new Date().toISOString(),
                  fileSize: pdfBuffer.length
                });
              });
            }).on('error', (err) => {
              reject(err);
            });
          });
        } else {
          throw new Error('Could not find PDF viewer or download link');
        }
      }

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search clerk's office by instrument number
   */
  async searchClerkByInstrument(instrumentNumber) {
    this.log(`🔍 Searching clerk by instrument: ${instrumentNumber}`);

    // Look for instrument number search field
    const instrumentInputSelectors = [
      'input[name*="instrument"]',
      'input[name*="Instrument"]',
      'input[placeholder*="Instrument"]',
      'input[id*="instrument"]'
    ];

    let instrumentInput = null;
    for (const selector of instrumentInputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        instrumentInput = selector;
        this.log(`✅ Found instrument input: ${selector}`);
        break;
      } catch (e) {
        // Try next selector
      }
    }

    if (instrumentInput) {
      await this.page.click(instrumentInput);
      await this.page.type(instrumentInput, instrumentNumber, { delay: 100 });
      this.log(`✅ Entered instrument number: ${instrumentNumber}`);

      // Click search button
      await this.randomWait(1000, 2000);
      await this.page.keyboard.press('Enter');

      // Wait for results
      await this.randomWait(5000, 7000);
    } else {
      this.log(`⚠️ Could not find instrument number input field`);
    }
  }

  /**
   * Search clerk's office by book and page
   */
  async searchClerkByBookPage(bookNumber, pageNumber) {
    this.log(`🔍 Searching clerk by book/page: ${bookNumber}/${pageNumber}`);

    // Look for book/page search fields
    const bookInputSelectors = [
      'input[name*="book"]',
      'input[name*="Book"]',
      'input[placeholder*="Book"]',
      'input[id*="book"]'
    ];

    const pageInputSelectors = [
      'input[name*="page"]',
      'input[name*="Page"]',
      'input[placeholder*="Page"]',
      'input[id*="page"]'
    ];

    let bookInput = null;
    let pageInput = null;

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
      await this.page.click(bookInput);
      await this.page.type(bookInput, bookNumber, { delay: 100 });
      this.log(`✅ Entered book: ${bookNumber}`);

      await this.page.click(pageInput);
      await this.page.type(pageInput, pageNumber, { delay: 100 });
      this.log(`✅ Entered page: ${pageNumber}`);

      // Click search button
      await this.randomWait(1000, 2000);
      await this.page.keyboard.press('Enter');

      // Wait for results
      await this.randomWait(5000, 7000);
    } else {
      this.log(`⚠️ Could not find book/page input fields`);
    }
  }
}

module.exports = PalmBeachCountyFloridaScraper;
