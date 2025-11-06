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

      // STEP 2: Search Property Assessor and click "View Deed"
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://portal.padctn.org/OFS/WP/Home`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = assessorResult.error || 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: assessorResult.error || 'Could not find property',
          originalAddress: address,
          county: 'Davidson',
          state: 'TN'
        };
        return result;
      }

      // STEP 3: Download the deed PDF
      this.log(`📥 Step 3: Attempting to download deed PDF...`);

      const downloadResult = await this.downloadDeedPDF();

      result.steps.step2 = {
        success: downloadResult.success,
        assessorUrl: 'https://portal.padctn.org/OFS/WP/Home',
        originalAddress: address,
        county: 'Davidson',
        state: 'TN'
      };

      result.download = downloadResult;
      result.success = downloadResult.success;
      result.message = downloadResult.success ? 'Deed downloaded successfully' : (downloadResult.error || 'Failed to download deed');
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

      // Step 1: Select "Address" from the dropdown
      this.log(`🔍 Step 1: Looking for search type dropdown...`);

      const dropdownSelected = await this.page.evaluate(() => {
        // Look for the dropdown with id="inputGroupSelect01" or name="SelectedSearch"
        const select = document.querySelector('#inputGroupSelect01') ||
                      document.querySelector('select[name="SelectedSearch"]') ||
                      document.querySelector('select');

        if (!select) {
          return { success: false, error: 'No dropdown found' };
        }

        // Find the "Address" option (value="2")
        const options = Array.from(select.options);
        const addressOption = options.find(opt =>
          opt.text?.toLowerCase() === 'address' || opt.value === '2'
        );

        if (!addressOption) {
          return { success: false, error: 'No Address option found', options: options.map(o => ({ value: o.value, text: o.text })) };
        }

        // Select it
        select.value = addressOption.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true, value: addressOption.value, text: addressOption.text };
      });

      if (dropdownSelected.success) {
        this.log(`✅ Selected "Address" option (value: ${dropdownSelected.value})`);
        // Wait for form fields to update after dropdown selection
        await this.randomWait(2000, 3000);
      } else {
        this.log(`⚠️  Could not select Address option: ${dropdownSelected.error}`);
        if (dropdownSelected.options) {
          this.log(`   Available options: ${JSON.stringify(dropdownSelected.options)}`);
        }
        return {
          success: false,
          error: 'Could not select Address search mode'
        };
      }

      // Step 2: Parse address into number and street name
      const { number, street } = this.parseAddress(this.currentAddress);
      this.log(`🔍 Step 2: Parsed address - Number: ${number}, Street: ${street}`);

      // Step 3: Find and fill the address number field (first field)
      this.log(`🔍 Step 3: Looking for address number field...`);

      const numberEntered = await this.page.evaluate((num) => {
        // After selecting "Address", there should be multiple input fields
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));

        // Look for the first visible text input
        const numberInput = inputs.find(input => {
          const isVisible = input.offsetParent !== null;
          return isVisible;
        });

        if (!numberInput) {
          return { success: false, error: 'No visible text input found for number' };
        }

        numberInput.value = num;
        numberInput.dispatchEvent(new Event('input', { bubbles: true }));
        numberInput.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true };
      }, number);

      if (!numberEntered.success) {
        this.log(`❌ Could not enter number: ${numberEntered.error}`);
        return {
          success: false,
          error: 'Could not enter address number'
        };
      }

      this.log(`✅ Entered number: ${number}`);
      await this.randomWait(1000, 1500);

      // Step 4: Find and fill the street name field (second field)
      this.log(`🔍 Step 4: Looking for street name field...`);

      const streetEntered = await this.page.evaluate((streetName) => {
        // Find all visible text inputs
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        const visibleInputs = inputs.filter(input => input.offsetParent !== null);

        // The street field should be the second visible input
        const streetInput = visibleInputs[1] || visibleInputs[0];

        if (!streetInput) {
          return { success: false, error: 'No visible text input found for street' };
        }

        streetInput.value = streetName;
        streetInput.dispatchEvent(new Event('input', { bubbles: true }));
        streetInput.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true };
      }, street);

      if (!streetEntered.success) {
        this.log(`❌ Could not enter street: ${streetEntered.error}`);
        return {
          success: false,
          error: 'Could not enter street name'
        };
      }

      this.log(`✅ Entered street: ${street}`);
      await this.randomWait(1000, 2000);

      // Step 5: Submit the form
      this.log(`🔍 Step 5: Submitting search form...`);

      const formSubmitted = await this.page.evaluate(() => {
        // Find the form by ID or by checking for the form with our inputs
        const form = document.querySelector('#frmQuick') ||
                    document.querySelector('form[action*="QuickPropertySearchAsync"]') ||
                    document.querySelector('form');

        if (form) {
          form.submit();
          return { success: true, method: 'form.submit()' };
        }

        return { success: false, error: 'No form found' };
      });

      if (formSubmitted.success) {
        this.log(`✅ Form submitted: ${formSubmitted.method}`);
      } else {
        this.log(`⚠️  Could not submit form: ${formSubmitted.error}`);
        this.log(`   Trying Enter key as fallback...`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(5000, 7000);

      // Step 6: Find and click on parcel number card (e.g., "049 14 0a 023.00")
      // NOTE: This appears on the SAME PAGE as the search results, not a new page
      this.log(`🔍 Step 6: Looking for parcel number card...`);

      const parcelCardClicked = await this.page.evaluate(() => {
        // Look for parcel number with pattern like "049 14 0A 023.00"
        const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;

        // Check all elements that might be clickable
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));
        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          // Match ONLY the parcel number, not text containing it
          const firstLine = text.split('\n')[0].trim();
          if (pattern.test(firstLine)) {
            console.log(`Found parcel card: ${firstLine}`);
            el.click();
            return { clicked: true, parcel: firstLine };
          }
        }
        return { clicked: false };
      });

      if (!parcelCardClicked.clicked) {
        this.log(`⚠️  Could not find parcel card`);
        return {
          success: false,
          error: 'No parcel card found in search results'
        };
      }

      this.log(`✅ Clicked parcel card: ${parcelCardClicked.parcel}`);

      // Wait for the card to expand or show more details
      await this.randomWait(2000, 3000);

      // Step 7: Find and click "View Deed" button
      this.log(`🔍 Step 7: Looking for "View Deed" button...`);

      const viewDeedResult = await this.page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, div[onclick], span[onclick]'));

        // Log all visible buttons for debugging
        const visibleButtons = allButtons
          .filter(btn => {
            const style = window.getComputedStyle(btn);
            return style.display !== 'none' && style.visibility !== 'hidden';
          })
          .map(btn => ({
            tag: btn.tagName,
            text: (btn.textContent || btn.value || '').trim().substring(0, 50),
            onclick: btn.getAttribute('onclick')
          }))
          .filter(b => b.text.length > 0);

        // Try to find "View Deed" button
        for (const btn of allButtons) {
          const text = (btn.textContent || btn.value || '').trim().toLowerCase();
          const onclick = (btn.getAttribute('onclick') || '').toLowerCase();

          if (text.includes('deed') || onclick.includes('deed')) {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              btn.click();
              return { clicked: true, text: btn.textContent || btn.value || btn.getAttribute('onclick'), allButtons: visibleButtons };
            }
          }
        }

        return { clicked: false, allButtons: visibleButtons };
      });

      if (viewDeedResult.allButtons) {
        this.log(`📋 Visible buttons/links found: ${viewDeedResult.allButtons.length}`);
        viewDeedResult.allButtons.forEach((btn, i) => {
          if (i < 10) { // Log first 10
            this.log(`   ${i + 1}. [${btn.tag}] "${btn.text}"`);
          }
        });
      }

      const viewDeedClicked = { clicked: viewDeedResult.clicked, text: viewDeedResult.text };

      if (!viewDeedClicked.clicked) {
        this.log('⚠️  Could not find "View Deed" button');
        return {
          success: false,
          error: 'Could not find "View Deed" button after clicking parcel card'
        };
      }

      this.log(`✅ Clicked "View Deed" button: ${viewDeedClicked.text}`);

      // Wait for deed viewer/download to appear
      await this.randomWait(3000, 5000);

      return {
        success: true,
        message: 'Found property and clicked View Deed button'
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
   * Download deed PDF after "View Deed" button has been clicked
   */
  async downloadDeedPDF() {
    this.log('📥 Downloading deed PDF...');

    try {
      // Wait for PDF to load
      await this.randomWait(3000, 5000);

      // Check if PDF is displayed in browser or needs to be downloaded
      const pdfInfo = await this.page.evaluate(() => {
        // Check if PDF is embedded in page
        const pdfEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], iframe[src*="pdf"]');
        if (pdfEmbed) {
          return {
            type: 'embedded',
            src: pdfEmbed.getAttribute('src') || pdfEmbed.getAttribute('data')
          };
        }

        // Check current URL
        if (window.location.href.includes('.pdf') || document.contentType === 'application/pdf') {
          return {
            type: 'direct',
            url: window.location.href
          };
        }

        // Check for PDF links
        const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"], a[href*="pdf"]'));
        if (pdfLinks.length > 0) {
          return {
            type: 'link',
            href: pdfLinks[0].href
          };
        }

        return { type: 'unknown' };
      });

      this.log(`📄 PDF Info: ${JSON.stringify(pdfInfo)}`);

      let pdfUrl = null;

      if (pdfInfo.type === 'embedded' && pdfInfo.src) {
        pdfUrl = pdfInfo.src;
      } else if (pdfInfo.type === 'direct') {
        pdfUrl = pdfInfo.url;
      } else if (pdfInfo.type === 'link') {
        pdfUrl = pdfInfo.href;
      }

      if (!pdfUrl) {
        this.log('⚠️  Could not find PDF URL');
        return {
          success: false,
          error: 'Could not find PDF URL'
        };
      }

      this.log(`📍 PDF URL: ${pdfUrl}`);

      // Download the PDF using CDP or navigate to it
      const fs = require('fs');
      const path = require('path');
      const axios = require('axios');

      const downloadPath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const timestamp = Date.now();
      const filename = `davidson_deed_${timestamp}.pdf`;
      const filepath = path.join(downloadPath, filename);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      // Try to get PDF content
      try {
        // If it's a relative URL, make it absolute
        if (pdfUrl.startsWith('/')) {
          const baseUrl = await this.page.evaluate(() => window.location.origin);
          pdfUrl = baseUrl + pdfUrl;
        }

        // Get cookies for the request
        const cookies = await this.page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const response = await axios.get(pdfUrl, {
          responseType: 'arraybuffer',
          headers: {
            'Cookie': cookieString,
            'User-Agent': await this.page.evaluate(() => navigator.userAgent)
          }
        });

        fs.writeFileSync(filepath, Buffer.from(response.data));

        this.log(`✅ PDF saved: ${filepath} (${response.data.byteLength} bytes)`);

        return {
          success: true,
          filename: filename,
          filepath: filepath,
          size: response.data.byteLength,
          base64: Buffer.from(response.data).toString('base64')
        };

      } catch (downloadError) {
        this.log(`⚠️  Failed to download via axios: ${downloadError.message}`);
        this.log(`   Trying page.pdf() fallback...`);

        // Fallback: use page.pdf()
        const pdfBuffer = await this.page.pdf({
          format: 'A4',
          printBackground: true
        });

        fs.writeFileSync(filepath, pdfBuffer);

        this.log(`✅ PDF saved via fallback: ${filepath} (${pdfBuffer.length} bytes)`);

        return {
          success: true,
          filename: filename,
          filepath: filepath,
          size: pdfBuffer.length,
          base64: pdfBuffer.toString('base64')
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

  /**
   * Download deed PDF by clicking "View Deed" button (DEPRECATED - kept for compatibility)
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
