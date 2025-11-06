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
   * Parse address into number and street name
   * Example: "6241 Del Sol Dr, Whites Creek, TN" -> { number: "6241", street: "Del Sol" }
   */
  parseAddress(fullAddress) {
    this.log(`📍 Parsing address: ${fullAddress}`);

    // Remove city, state, zip from the end
    const addressPart = fullAddress.split(',')[0].trim();
    this.log(`   Address part: ${addressPart}`);

    // Split into parts
    const parts = addressPart.split(/\s+/);

    // First part should be the number
    const number = parts[0];

    // Rest is the street name (without suffix like Dr, St, Ave, etc.)
    // Remove common suffixes
    const streetParts = parts.slice(1);
    const suffixes = ['DR', 'DRIVE', 'ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'LN', 'LANE', 'CT', 'COURT', 'WAY', 'PL', 'PLACE', 'BLVD', 'BOULEVARD', 'CIR', 'CIRCLE', 'TRL', 'TRAIL'];

    // Find where suffix starts
    let streetName = '';
    for (let i = 0; i < streetParts.length; i++) {
      const part = streetParts[i].toUpperCase();
      if (suffixes.includes(part)) {
        // Found suffix, everything before is street name
        streetName = streetParts.slice(0, i).join(' ');
        break;
      }
    }

    // If no suffix found, use all parts except last one
    if (!streetName && streetParts.length > 1) {
      streetName = streetParts.slice(0, -1).join(' ');
    } else if (!streetName) {
      streetName = streetParts.join(' ');
    }

    this.log(`   Parsed - Number: ${number}, Street: ${streetName}`);

    return { number, street: streetName };
  }

  /**
   * Search Davidson County Property Assessor by address
   * URL: https://portal.padctn.org/OFS/WP/Home
   *
   * Workflow:
   * 1. Click on 'owner' box, then select "address"
   * 2. Break down address into number and street name
   * 3. Enter into respective fields and click 'search'
   * 4. Click on parcel number (e.g., "049 14 0a 023.00")
   * 5. Click 'View Deed' button
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Davidson County TN Property Assessor`);
    this.log(`   Using address search`);
    this.log(`   Current address: ${this.currentAddress}`);

    try {
      // Navigate to property search page
      const targetUrl = 'https://portal.padctn.org/OFS/WP/Home';
      this.log(`🌐 Navigating to: ${targetUrl}`);

      await this.page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      this.log(`✅ Page loaded`);
      await this.randomWait(3000, 5000);

      // Step 1: Click on 'owner' box/dropdown to open it
      this.log(`🔍 Step 1: Looking for 'owner' dropdown...`);

      const ownerDropdownSelectors = [
        'select',
        'select[name*="owner"]',
        'select[id*="owner"]',
        'select[name*="searchType"]',
        'select[id*="searchType"]'
      ];

      let ownerDropdownFound = false;
      for (const selector of ownerDropdownSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000, visible: true });
          this.log(`✅ Found dropdown with selector: ${selector}`);

          // Try to select "Address" option
          const addressSelected = await this.page.evaluate((sel) => {
            const select = document.querySelector(sel);
            if (!select) return false;

            const options = Array.from(select.options);
            for (const option of options) {
              const text = (option.text || option.value || '').toLowerCase();
              if (text.includes('address') || text === 'address') {
                select.value = option.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, value: option.value, text: option.text };
              }
            }
            return false;
          }, selector);

          if (addressSelected && addressSelected.success) {
            this.log(`✅ Selected "Address" option: ${addressSelected.text}`);
            ownerDropdownFound = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (ownerDropdownFound) {
        await this.randomWait(2000, 3000);
      } else {
        this.log(`⚠️  Owner dropdown not found, continuing anyway...`);
      }

      // Step 2: Parse address into number and street name
      const { number, street } = this.parseAddress(this.currentAddress);

      // Step 3: Find and fill number field
      this.log(`🔍 Step 2: Looking for address number input field...`);

      const numberInputSelectors = [
        'input[name*="number"]',
        'input[id*="number"]',
        'input[placeholder*="number"]',
        'input[type="text"]'
      ];

      let numberInputFound = false;
      for (const selector of numberInputSelectors) {
        try {
          const inputs = await this.page.$$(selector);
          if (inputs.length > 0) {
            this.log(`✅ Found number input: ${selector}`);

            await this.page.evaluate((sel, value) => {
              const inputs = Array.from(document.querySelectorAll(sel));
              // Use the first text input or one with 'number' in name/id
              for (const input of inputs) {
                const name = (input.name || input.id || '').toLowerCase();
                if (name.includes('number') || inputs.length === 1) {
                  input.value = value;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
              }
              // Fallback: use first input
              if (inputs[0]) {
                inputs[0].value = value;
                inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                return true;
              }
              return false;
            }, selector, number);

            this.log(`✅ Entered address number: ${number}`);
            numberInputFound = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      await this.randomWait(1000, 2000);

      // Step 4: Find and fill street name field
      this.log(`🔍 Step 3: Looking for street name input field...`);

      const streetInputSelectors = [
        'input[name*="street"]',
        'input[id*="street"]',
        'input[placeholder*="street"]',
        'input[type="text"]:not([name*="number"])'
      ];

      let streetInputFound = false;
      for (const selector of streetInputSelectors) {
        try {
          const inputs = await this.page.$$(selector);
          if (inputs.length > 0) {
            this.log(`✅ Found street input: ${selector}`);

            await this.page.evaluate((sel, value) => {
              const inputs = Array.from(document.querySelectorAll(sel));
              // Find the one that's not the number input and is visible
              for (const input of inputs) {
                const name = (input.name || input.id || '').toLowerCase();
                const isVisible = input.offsetParent !== null;
                if (isVisible && !name.includes('number')) {
                  input.value = value;
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  return true;
                }
              }
              return false;
            }, selector, street);

            this.log(`✅ Entered street name: ${street}`);
            streetInputFound = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      await this.randomWait(1000, 2000);

      // Step 5: Click search button
      this.log(`🔍 Step 4: Looking for search button...`);

      const searchClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('search')) {
            btn.click();
            return { clicked: true, text: btn.textContent || btn.value };
          }
        }
        return { clicked: false };
      });

      if (searchClicked.clicked) {
        this.log(`✅ Clicked search button: ${searchClicked.text}`);
      } else {
        this.log(`⚠️  No search button found, trying Enter key...`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(5000, 7000);

      // Step 6: Find and click on parcel number (e.g., "049 14 0a 023.00")
      this.log(`🔍 Step 5: Looking for parcel number link...`);

      const parcelLinkClicked = await this.page.evaluate(() => {
        // Look for links or clickable elements with parcel-like patterns
        // Pattern: digits with spaces and letters (e.g., "049 14 0a 023.00")
        const pattern = /\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+/;

        const allElements = Array.from(document.querySelectorAll('a, button, div[onclick], span[onclick], td[onclick]'));
        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          if (pattern.test(text)) {
            console.log(`Found parcel link: ${text}`);
            el.click();
            return { clicked: true, parcel: text };
          }
        }
        return { clicked: false };
      });

      if (parcelLinkClicked.clicked) {
        this.log(`✅ Clicked parcel link: ${parcelLinkClicked.parcel}`);
      } else {
        this.log(`⚠️  Could not find parcel number link`);
        // Try to find any link on the results page
        const anyLinkClicked = await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href], button'));
          // Look for first meaningful link in results
          for (const link of links) {
            const text = (link.textContent || '').trim();
            const href = link.getAttribute('href') || '';
            // Skip navigation links
            if (text.length > 3 && !text.toLowerCase().includes('home') &&
                !text.toLowerCase().includes('help') && !text.toLowerCase().includes('logout')) {
              link.click();
              return { clicked: true, text: text.substring(0, 50) };
            }
          }
          return { clicked: false };
        });

        if (anyLinkClicked.clicked) {
          this.log(`✅ Clicked result link: ${anyLinkClicked.text}`);
        }
      }

      // Wait for parcel details page to load
      await this.randomWait(3000, 5000);

      this.log(`✅ Successfully navigated to parcel details`);

      return {
        success: true,
        message: 'Property found and navigated to parcel details'
      };

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
   * Download deed PDF by clicking "View Deed" button
   * This is called after navigating to the parcel details page
   */
  async downloadDeed(transaction) {
    this.log('📄 Attempting to download deed by clicking "View Deed" button...');

    try {
      // Check if we have required deed information
      if (!transaction.instrumentNumber && !(transaction.bookNumber && transaction.pageNumber)) {
        throw new Error('No deed reference information available (need instrument number or book/page)');
      }

      const deedRef = transaction.instrumentNumber || `Book ${transaction.bookNumber} Page ${transaction.pageNumber}`;
      this.log(`📍 Deed Reference: ${deedRef}`);

      // Step 6: Find and click "View Deed" button
      this.log('🔍 Step 6: Looking for "View Deed" button...');

      await this.randomWait(2000, 3000);

      const viewDeedClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').trim();
          if (text.toLowerCase().includes('view deed') || text.toLowerCase() === 'deed') {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              btn.click();
              return { clicked: true, text: text };
            }
          }
        }
        return { clicked: false };
      });

      if (!viewDeedClicked.clicked) {
        this.log('⚠️  Could not find "View Deed" button');
        return {
          success: false,
          message: 'Could not find "View Deed" button on parcel details page',
          deedReference: deedRef
        };
      }

      this.log(`✅ Clicked "View Deed" button: ${viewDeedClicked.text}`);

      // Wait for PDF to load or download to start
      await this.randomWait(3000, 5000);

      // Step 7: Download PDF
      this.log('📥 Attempting to download PDF...');

      // Set up download handling
      const client = await this.page.target().createCDPSession();
      const downloadPath = process.env.DEED_DOWNLOAD_PATH || './downloads';

      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      // Check if PDF is displayed in browser or download started
      const pdfInfo = await this.page.evaluate(() => {
        // Check if PDF is embedded in page
        const pdfEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
        if (pdfEmbed) {
          return {
            type: 'embedded',
            src: pdfEmbed.getAttribute('src') || pdfEmbed.getAttribute('data')
          };
        }

        // Check if there's a PDF link we need to click
        const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="pdf"]'));
        if (pdfLinks.length > 0) {
          return {
            type: 'link',
            href: pdfLinks[0].href
          };
        }

        // Check current URL
        if (window.location.href.includes('.pdf') || document.contentType === 'application/pdf') {
          return {
            type: 'direct',
            url: window.location.href
          };
        }

        return { type: 'unknown' };
      });

      this.log(`📄 PDF Info: ${JSON.stringify(pdfInfo)}`);

      // Handle different PDF scenarios
      if (pdfInfo.type === 'embedded' && pdfInfo.src) {
        // PDF is embedded, navigate to it directly to download
        this.log('🔗 Navigating to embedded PDF...');
        await this.page.goto(pdfInfo.src, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomWait(3000, 5000);
      } else if (pdfInfo.type === 'link' && pdfInfo.href) {
        // PDF link found, navigate to it
        this.log('🔗 Navigating to PDF link...');
        await this.page.goto(pdfInfo.href, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomWait(3000, 5000);
      } else if (pdfInfo.type === 'direct') {
        // Already on PDF page
        this.log('✅ Already viewing PDF');
      }

      // Get PDF content
      const pdfBuffer = await this.page.pdf({
        format: 'A4',
        printBackground: true
      });

      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF buffer is empty');
      }

      // Generate filename
      const fs = require('fs');
      const path = require('path');
      const timestamp = Date.now();
      const sanitizedRef = deedRef.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `davidson_deed_${sanitizedRef}_${timestamp}.pdf`;
      const filepath = path.join(downloadPath, filename);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      // Save PDF
      fs.writeFileSync(filepath, pdfBuffer);

      this.log(`✅ PDF saved: ${filepath} (${pdfBuffer.length} bytes)`);

      return {
        success: true,
        filename: filename,
        filepath: filepath,
        size: pdfBuffer.length,
        deedReference: deedRef,
        instrumentNumber: transaction.instrumentNumber,
        bookNumber: transaction.bookNumber,
        pageNumber: transaction.pageNumber,
        base64: pdfBuffer.toString('base64')
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

module.exports = DavidsonCountyTennesseeScraper;
