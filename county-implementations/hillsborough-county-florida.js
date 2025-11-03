/**
 * Hillsborough County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://gis.hcpafl.org/propertysearch/
 * - Clerk of Courts (Official Records): https://publicaccess.hillsclerk.com/oripublicaccess/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection on Hillsborough County website
puppeteer.use(StealthPlugin());

class HillsboroughCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Hillsborough';
    this.state = 'FL';
  }

  /**
   * Override initialize to use puppeteer-extra with stealth plugin
   * Hillsborough County has strict bot detection
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
   * Hillsborough County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Hillsborough County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Hillsborough County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Hillsborough County supports direct address search',
        county: 'Hillsborough',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://gis.hcpafl.org/propertysearch/`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Hillsborough',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://gis.hcpafl.org/propertysearch/',
        originalAddress: address,
        county: 'Hillsborough',
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
   * Get deed recorder/clerk URL for Hillsborough County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Hillsborough' && state === 'FL') {
      return 'https://publicaccess.hillsclerk.com/oripublicaccess/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Hillsborough County
   */
  getAssessorUrl(county, state) {
    if (county === 'Hillsborough' && state === 'FL') {
      return 'https://gis.hcpafl.org/propertysearch/';
    }
    return null;
  }

  /**
   * Search Hillsborough County Property Appraiser by address
   * Use address search then navigate to get folio number
   * URL: https://gis.hcpafl.org/propertysearch/#/nav/Basic%20Search
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Hillsborough County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://gis.hcpafl.org/propertysearch/#/nav/Basic%20Search', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      // Further simplify: remove street suffix (RD, ROAD, ST, STREET, etc.)
      // Just use street number + street name
      // Example: "19620 PINE TREE RD" -> "19620 PINE TREE"
      const addressParts = streetAddress.split(/\s+/);
      if (addressParts.length >= 3) {
        // Has at least: number + name + suffix
        // Remove the last word (street suffix)
        const simplifiedAddress = addressParts.slice(0, -1).join(' ');
        this.log(`🔍 Simplified search: "${streetAddress}" -> "${simplifiedAddress}"`);
        streetAddress = simplifiedAddress;
      }

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for property address input field
      // The site uses Knockout.js bindings: data-bind="value: address"
      const addressInputSelectors = [
        'input[data-bind*="value: address"]', // Knockout.js binding for address field
        'input[placeholder*="ARMENIA"]', // Example placeholder from the site
        'input[autocomplete="address"]',
        'input[name*="Address"]',
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

      // Enter street address directly via evaluate (faster and no timeout)
      await this.page.evaluate((selector, address) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
          input.value = address;
          // Trigger input event to notify Knockout.js and show autocomplete
          const inputEvent = new Event('input', { bubbles: true });
          input.dispatchEvent(inputEvent);
        }
      }, addressInput, streetAddress);

      await this.randomWait(2000, 3000);

      this.log(`✅ Entered address: ${streetAddress}`);

      // Look for autocomplete dropdown and click on the first result
      const autocompleteClicked = await this.page.evaluate((searchAddr) => {
        // Extract first two parts of address for matching (e.g., "19620 PINE TREE")
        const searchParts = searchAddr.trim().split(/\s+/);
        const firstPart = searchParts[0]; // house number
        const secondPart = searchParts[1]; // street name start

        // Look for autocomplete results
        const autocompleteItems = Array.from(document.querySelectorAll('ul li, .autocomplete-item, .dropdown-item, .ui-menu-item'));

        for (const item of autocompleteItems) {
          const text = (item.innerText || item.textContent || '').trim();
          // Look for the address parts
          if (firstPart && secondPart && text.includes(firstPart) && text.includes(secondPart)) {
            item.click();
            return { clicked: true, text: text.substring(0, 100) };
          }
        }

        // Alternative: look for any clickable element with the address
        const allElements = Array.from(document.querySelectorAll('div, span, a'));
        for (const el of allElements) {
          const text = (el.innerText || el.textContent || '').trim();
          if (firstPart && secondPart && text.includes(firstPart) && text.includes(secondPart)) {
            // Check if it's clickable
            if (el.onclick || el.tagName === 'A' || el.getAttribute('role') === 'button') {
              el.click();
              return { clicked: true, text: text.substring(0, 100) };
            }
          }
        }

        return { clicked: false };
      }, streetAddress);

      if (autocompleteClicked.clicked) {
        this.log(`✅ Clicked autocomplete item: "${autocompleteClicked.text}"`);
      } else {
        this.log(`ℹ️  No autocomplete item found, will proceed with search`);
      }

      // After entering address (with or without autocomplete), trigger search button
      await this.randomWait(1000, 2000);

      // Try using Puppeteer's native click instead of evaluate
      try {
        const searchButtonSelector = 'button[type="submit"]';
        await this.page.waitForSelector(searchButtonSelector, { timeout: 5000 });
        await this.page.click(searchButtonSelector);
        this.log(`✅ Clicked search button via Puppeteer`);
      } catch (clickError) {
        // Fallback: Press Enter key
        this.log(`⚠️  Could not click search button, trying Enter key: ${clickError.message}`);
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for search results to load - this can take 20-30+ seconds
      this.log(`⏳ Waiting for search results to load (this may take 20-30+ seconds)...`);

      // First, wait for initial response
      await this.randomWait(5000, 7000);

      // Then wait for URL to change indicating navigation to results page
      try {
        await this.page.waitForFunction(() => {
          const url = window.location.href;
          // The search MUST navigate to a new URL - either /search/ or with address= parameter
          // Don't accept page content alone, as the search form page has similar text
          return url.includes('/search/') || url.includes('address=') || url.includes('/result');
        }, { timeout: 45000 }); // 45 second timeout for slow search

        this.log(`✅ Search results loaded (URL changed to results page)`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for URL to change (waited 45s), checking page content anyway...`);
      }

      // Additional wait for any animations/transitions to complete
      await this.randomWait(3000, 5000);

      // Check if property was found by looking for results table
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found') ||
                            text.includes('no matches');

        // Look for results table headers
        const hasResultsTable = text.includes('folio') &&
                               text.includes('owner name') &&
                               text.includes('property address');

        return {
          hasNoResults,
          hasResultsTable,
          url: window.location.href
        };
      });

      this.log(`🔍 Search result analysis:`);
      this.log(`   Current URL: ${searchStatus.url}`);
      this.log(`   Has results table: ${searchStatus.hasResultsTable}`);
      this.log(`   Has "no results" message: ${searchStatus.hasNoResults}`);

      if (!searchStatus.hasNoResults && searchStatus.hasResultsTable) {
        this.log(`✅ Property found in results table`);

        // Click on the folio number in the results table
        await this.randomWait(2000, 3000);

        const resultClicked = await this.page.evaluate(() => {
          // Look for the folio number link in the results table
          // Folio format: XXXXXX-XXXX (e.g., 000034-0200)
          const allElements = Array.from(document.querySelectorAll('a, td, div, span'));

          for (const el of allElements) {
            const text = (el.innerText || el.textContent || '').trim();

            if (/^\d{6}-\d{4}$/.test(text)) {
              // Found a folio number
              if (el.tagName === 'A') {
                el.click();
                return { clicked: true, folio: text };
              } else {
                // Look for parent link or clickable element
                const closestLink = el.closest('a') || el.closest('[onclick]');
                if (closestLink) {
                  closestLink.click();
                  return { clicked: true, folio: text };
                }

                // Try clicking the element itself
                el.click();
                return { clicked: true, folio: text };
              }
            }
          }

          return { clicked: false };
        });

        if (resultClicked.clicked) {
          this.log(`✅ Clicked on folio ${resultClicked.folio} in results table`);

          // Wait for property detail page to load
          await this.randomWait(5000, 7000);

          // Wait for detail page content to load
          await this.page.waitForFunction(() => {
            const text = document.body.innerText.toLowerCase();
            // Check if we're on the detail page (not the results table anymore)
            return (text.includes('sales history') ||
                   text.includes('official record') ||
                   text.includes('book / page')) &&
                   !text.includes('search results'); // Make sure we left the results page
          }, { timeout: 15000 }).catch(() => {
            this.log(`⚠️ Timeout waiting for property detail page`);
          });

          this.log(`✅ Property detail page loaded`);
        } else {
          this.log(`⚠️ Could not click on folio number in results table`);
        }

        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found or search failed`);
        return {
          success: false,
          message: `Property not found (noResults: ${searchStatus.hasNoResults}, hasTable: ${searchStatus.hasResultsTable})`
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
   * Navigate to Sales/Transfer tab and extract document ID links
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Sales/Transfer information tabs or sections
      this.log('🔍 Looking for Sales/Transfer information...');

      const salesTabSelectors = [
        'a:contains("Sales")',
        'button:contains("Sales")',
        'li:contains("Sales")',
        'a:contains("Transfer")',
        'button:contains("Transfer")',
        '[role="tab"]:contains("Sales")',
        'a[href*="sales"]',
        'a[href*="transfer"]',
        '.tab:contains("Sales")'
      ];

      // Try to find and click Sales/Transfer tab
      const salesClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text === 'SALES' || text === 'Sales' ||
              text === 'TRANSFERS' || text === 'Transfers' ||
              text === 'TRANSFER HISTORY' || text === 'Transfer History' ||
              text === 'SALES HISTORY' || text === 'Sales History') {

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

        // Hillsborough County Property Appraiser has direct links to the Clerk's website
        // Format: https://publicaccess.hillsclerk.com/PAVDirectSearch/index.html?CQID=320&OBKey__1006_1=CFN_NUMBER
        // Or: https://publicaccess.hillsclerk.com/PAVDirectSearch/index.html?CQID=319&OBKey__1530_1=O&OBKey__573_1=BOOK&OBKey__1049_1=PAGE

        // Look for links to the Clerk's website
        const allLinks = Array.from(document.querySelectorAll('a[href*="publicaccess.hillsclerk.com"]'));

        for (const link of allLinks) {
          const href = link.href || '';
          const text = (link.innerText || '').trim();

          // Extract CFN from URL parameter OBKey__1006_1
          const cfnMatch = href.match(/OBKey__1006_1=(\d+)/);
          if (cfnMatch && cfnMatch[1].length > 5) { // CFN should be a long number
            results.push({
              documentId: cfnMatch[1],
              type: 'cfn',
              source: 'Hillsborough County Property Appraiser',
              clerkUrl: href,
              displayText: text
            });
          }

          // Extract Book/Page from URL parameters
          const bookMatch = href.match(/OBKey__573_1=(\d+)/);
          const pageMatch = href.match(/OBKey__1049_1=(\d+)/);
          if (bookMatch && pageMatch && bookMatch[1] && pageMatch[1]) {
            const bookNum = bookMatch[1];
            const pageNum = pageMatch[1];

            // Avoid duplicates
            const exists = results.some(r =>
              r.type === 'book_page' && r.bookNumber === bookNum && r.pageNumber === pageNum
            );

            if (!exists && parseInt(bookNum) > 100) { // Filter out plat books (usually low numbers like 5)
              results.push({
                bookNumber: bookNum,
                pageNumber: pageNum,
                type: 'book_page',
                source: 'Hillsborough County Property Appraiser',
                clerkUrl: href,
                displayText: text
              });
            }
          }
        }

        // Fallback: Look for CFN or Book/Page patterns in text
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        for (const line of lines) {
          // CFN format: 10 digit number that might be a CFN
          const cfnMatch = line.match(/\b(\d{10})\b/);
          if (cfnMatch && !results.some(r => r.documentId === cfnMatch[1])) {
            // Only add if it looks like a valid CFN (we already got some from links)
            if (results.length === 0) {
              results.push({
                documentId: cfnMatch[1],
                type: 'cfn',
                source: 'Hillsborough County Property Appraiser (text)',
                rawText: line.trim().substring(0, 200)
              });
            }
          }
        }

        return results;
      });

      // Merge with old pattern matching as fallback - remove this as we now have direct links
      // The oldTransactions is no longer needed since we're extracting from clerk links

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      // Log what we found
      for (const trans of transactions) {
        if (trans.type === 'cfn') {
          this.log(`   CFN: ${trans.documentId}`);
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
   * Download deed PDF from Hillsborough County Clerk
   * Navigate to clerk page, click view button, wait for iframe to load, then extract PDF URL
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Hillsborough County Clerk...');

    try {
      if (!transaction.clerkUrl) {
        throw new Error('No clerk URL available for this transaction');
      }

      this.log(`🌐 Navigating to Clerk document: ${transaction.clerkUrl}`);

      // Navigate to the clerk's document page
      await this.page.goto(transaction.clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(5000, 7000);

      // The clerk page shows search results immediately
      // We need to click on the VIEW button in the first row with the CFN
      this.log('🔍 Looking for VIEW button in document result row...');

      // Use Puppeteer's native click on the button element
      try {
        // Look for all buttons in the page
        const buttons = await this.page.$$('button');

        this.log(`📊 Found ${buttons.length} buttons on page`);

        // Click the first button (which should be the view button for the first result)
        if (buttons.length > 0) {
          await buttons[0].click();
          this.log(`✅ Clicked first VIEW button via Puppeteer`);
        } else {
          throw new Error('No buttons found on page');
        }
      } catch (buttonError) {
        this.log(`⚠️ Could not click button: ${buttonError.message}`);
      }

      // Wait for iframe to load with PDF
      this.log('⏳ Waiting for PDF iframe to load (may take 10-15 seconds)...');

      // Give it time to initialize
      await this.randomWait(5000, 7000);

      // Wait for iframe to have a valid src (not about:blank)
      try {
        await this.page.waitForFunction(() => {
          const iframe = document.querySelector('iframe.docview-frame') ||
                        document.querySelector('iframe[src*="pdf"]') ||
                        document.querySelector('iframe[src*="document"]') ||
                        document.querySelector('iframe');
          return iframe && iframe.src && iframe.src !== 'about:blank' && iframe.src.length > 20;
        }, { timeout: 30000 }); // 30 second timeout

        this.log('✅ PDF iframe loaded');
      } catch (waitError) {
        this.log('⚠️ Timeout waiting for iframe (waited 30s), attempting to extract URL anyway...');
      }

      // Additional wait for iframe content to fully load
      await this.randomWait(3000, 5000);

      // Extract the PDF URL from the iframe
      const pdfUrl = await this.page.evaluate(() => {
        // Try multiple iframe selectors
        const iframe = document.querySelector('iframe.docview-frame') ||
                      document.querySelector('iframe[src*="pdf"]') ||
                      document.querySelector('iframe[src*="document"]') ||
                      document.querySelector('iframe');

        if (iframe && iframe.src && iframe.src !== 'about:blank') {
          return iframe.src;
        }

        // Alternative: look for direct links to PDF
        const pdfLinks = Array.from(document.querySelectorAll('a[href*="pdf"], a[href*="GetView"], a[href*="document"]'));
        if (pdfLinks.length > 0) {
          return pdfLinks[0].href;
        }

        return null;
      });

      if (!pdfUrl) {
        throw new Error('Could not find PDF URL in iframe or page links');
      }

      this.log(`📥 Found PDF URL: ${pdfUrl}`);

      // Download the PDF from the extracted URL
      this.log('🌐 Downloading PDF...');

      const pdfBase64 = await this.page.evaluate(async (url) => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();

        // Verify it's a PDF
        if (blob.size === 0) {
          throw new Error('Downloaded file is empty');
        }

        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }, pdfUrl);

      this.log(`✅ PDF downloaded successfully`);

      return {
        success: true,
        pdfBase64,
        fileSize: Buffer.from(pdfBase64, 'base64').length,
        filename: `hillsborough_deed_${transaction.documentId || `${transaction.bookNumber}_${transaction.pageNumber}`}.pdf`
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

module.exports = HillsboroughCountyFloridaScraper;
