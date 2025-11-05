/**
 * Miami-Dade County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.miamidadepa.gov/pa/real-estate/property-search.page
 * - Workflow: Search address → Click folio → Sales Information tab → Click ORB-Page → Document Image → Download PDF
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
      this.log(`🌐 Navigating to assessor: https://www.miamidadepa.gov/pa/real-estate/property-search.page`);

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
        assessorUrl: 'https://www.miamidadepa.gov/pa/real-estate/property-search.page',
        folio: assessorResult.folio,
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
      return 'https://www.miamidadepa.gov/pa/real-estate/property-search.page';
    }
    return null;
  }

  /**
   * Search Miami-Dade County Property Appraiser by address
   * URL: https://www.miamidadepa.gov/pa/real-estate/property-search.page
   *
   * Workflow:
   * 1. Search by address
   * 2. Click on folio number (e.g., 01-3114-035-2520)
   * 3. Navigate to property details page
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Miami-Dade County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to correct property search page
      // Use the apps subdomain property search application
      const assessorUrl = 'https://apps.miamidadepa.gov/propertysearch/#/';
      this.log(`🌐 Navigating to: ${assessorUrl}`);

      await this.page.goto(assessorUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      // This is a JavaScript SPA - wait longer for it to fully load
      this.log('⏳ Waiting for SPA to load...');
      await this.randomWait(5000, 7000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Debug: Check what's on the page
      const pageStructure = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input')).map(inp => {
          // Get label or nearby text
          let label = '';
          const labelEl = inp.closest('label') || document.querySelector(`label[for="${inp.id}"]`);
          if (labelEl) {
            label = labelEl.textContent?.trim() || '';
          } else {
            // Try to find nearby text
            const parent = inp.parentElement;
            if (parent) {
              const prevText = parent.previousElementSibling?.textContent?.trim() || '';
              const parentText = parent.textContent?.trim() || '';
              label = prevText || parentText.substring(0, 50);
            }
          }

          return {
            type: inp.type,
            id: inp.id,
            name: inp.name,
            placeholder: inp.placeholder,
            visible: inp.offsetParent !== null,
            label: label.substring(0, 50),
            className: inp.className
          };
        });
        const buttons = Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim().substring(0, 30),
          type: btn.type,
          className: btn.className
        }));
        return { inputs, buttons, title: document.title };
      });

      this.log(`📋 Page has ${pageStructure.inputs.length} inputs, ${pageStructure.buttons.length} buttons`);
      this.log(`📄 Page title: ${pageStructure.title}`);

      // Log visible inputs with their labels
      const visibleInputs = pageStructure.inputs.filter(inp => inp.visible);
      if (visibleInputs.length > 0) {
        this.log(`📋 Visible inputs:`);
        visibleInputs.forEach((inp, i) => {
          this.log(`   ${i + 1}. ${inp.label || '(no label)'} [${inp.type}] id="${inp.id}" class="${inp.className}"`);
        });
      }

      // Look for property address input field with improved selectors
      // The SPA uses Kendo UI components with dynamic IDs
      const addressInputSelectors = [
        'input.k-input-inner[type="text"]:visible', // Kendo UI input (SPA)
        'input#PropertyAddressSearch',
        'input#propertyAddressInput',
        'input[name="PropertyAddress"]',
        'input[name*="address" i]',
        'input[placeholder*="Address" i]',
        'input[placeholder*="address" i]',
        'input[id*="address" i]',
        'input[id*="Address"]',
        'input.form-control[type="text"]',
        'input[type="text"]'
      ];

      let addressInput = null;

      // For Kendo UI SPA, find the first visible k-input-inner
      const kendoInputFound = await this.page.evaluate(() => {
        // Try different selectors
        let inputs = Array.from(document.querySelectorAll('input.k-input-inner'));
        if (inputs.length === 0) {
          inputs = Array.from(document.querySelectorAll('input[class*="k-input"]'));
        }

        for (let i = 0; i < inputs.length; i++) {
          const input = inputs[i];
          // Only consider text inputs that are visible
          if (input.type === 'text' && input.offsetParent !== null) {
            // Add a temporary attribute to identify it
            input.setAttribute('data-address-input', 'true');
            return { found: true, index: i, id: input.id, className: input.className };
          }
        }
        return { found: false, inputCount: inputs.length };
      });

      this.log(`🔍 Kendo UI search result: ${JSON.stringify(kendoInputFound)}`);

      if (kendoInputFound.found) {
        addressInput = 'input[data-address-input="true"]';
        this.log(`✅ Found Kendo UI address input (index ${kendoInputFound.index})`);
      } else {
        // Fallback to other selectors
        for (const selector of addressInputSelectors) {
          try {
            const elements = await this.page.$$(selector);
            if (elements.length > 0) {
              // Check if visible
              const isVisible = await this.page.evaluate((sel) => {
                const elem = document.querySelector(sel);
                return elem && elem.offsetParent !== null;
              }, selector);

              if (isVisible) {
                addressInput = selector;
                this.log(`✅ Found visible address input: ${selector}`);
                break;
              }
            }
          } catch (e) {
            // Try next selector
          }
        }
      }

      if (!addressInput) {
        this.log(`⚠️ Could not find address input field`);
        this.log(`   Available inputs: ${JSON.stringify(pageStructure.inputs.slice(0, 5))}`);
        return {
          success: false,
          message: 'Could not find address input field on Miami-Dade property search page'
        };
      }

      // Enter street address
      // First click to focus
      await this.page.click(addressInput);
      await this.randomWait(500, 1000);

      // Clear any existing placeholder/default text (triple-click to select all, then type)
      await this.page.click(addressInput, { clickCount: 3 });
      await this.randomWait(200, 500);

      // Type the address
      await this.page.type(addressInput, streetAddress, { delay: 100 });
      this.log(`✅ Entered address: ${streetAddress}`);

      // Wait longer for autocomplete to appear
      await this.randomWait(3000, 5000);

      // Look for autocomplete dropdown and click on the first result
      this.log('🔍 Looking for autocomplete suggestions...');

      const autocompleteClicked = await this.page.evaluate((streetAddress) => {
        // Look for autocomplete results with multiple selector strategies
        const selectors = [
          'ul.ui-autocomplete li',
          'ul.autocomplete-results li',
          '.dropdown-menu .dropdown-item',
          '.autocomplete-item',
          '.ui-menu-item',
          'div[role="option"]',
          '[role="listbox"] [role="option"]'
        ];

        const foundItems = [];

        for (const selector of selectors) {
          const items = Array.from(document.querySelectorAll(selector));
          if (items.length > 0) {
            for (const item of items) {
              // Check if visible and has text
              if (item.offsetParent !== null) {
                const text = (item.innerText || item.textContent || '').trim();

                // Log what we find for debugging
                if (text.length > 0) {
                  foundItems.push({ selector, text: text.substring(0, 100) });
                }

                // Filter for actual property addresses:
                // 1. Must contain street address parts
                // 2. Should look like an address (has street number + street name pattern)
                // 3. Should NOT be navigation/UI elements
                const containsSearchAddress = text.toLowerCase().includes(streetAddress.toLowerCase());
                const looksLikeAddress = /^\d+\s+\w+/.test(text); // Starts with number followed by street name
                const hasCommonStreetSuffixes = /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|pl|place|ter|terrace|pkwy|parkway|cir|circle)\b/i.test(text);
                const isNotUIElement = !text.toLowerCase().match(/^(go to|slide|online|property search|sales?|home|help|about|contact|menu|nav)/i);

                // Best match: contains our search address AND looks like an address
                if (containsSearchAddress && looksLikeAddress && text.length > 10) {
                  item.click();
                  return { clicked: true, text: text.substring(0, 100), selector, matched: 'exact', foundItems };
                }

                // Good match: looks like an address with common street patterns
                if (looksLikeAddress && hasCommonStreetSuffixes && isNotUIElement && text.length > 10) {
                  item.click();
                  return { clicked: true, text: text.substring(0, 100), selector, matched: 'address-pattern', foundItems };
                }
              }
            }
          }
        }

        return { clicked: false, foundItems };
      }, streetAddress);

      // Log what was found for debugging
      if (autocompleteClicked.foundItems && autocompleteClicked.foundItems.length > 0) {
        this.log(`📋 Found ${autocompleteClicked.foundItems.length} autocomplete item(s):`);
        autocompleteClicked.foundItems.slice(0, 5).forEach((item, i) => {
          this.log(`   ${i + 1}. "${item.text}" (${item.selector})`);
        });
      }

      if (autocompleteClicked.clicked) {
        this.log(`✅ Clicked autocomplete item (${autocompleteClicked.matched} match): "${autocompleteClicked.text}"`);
        await this.randomWait(3000, 5000);
      } else {
        // No autocomplete, try submitting search
        this.log(`ℹ️  No valid autocomplete address found, will try search button`);

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

      // Look for folio number link in search results and click it
      this.log('🔍 Looking for folio number link in search results...');

      const folioClicked = await this.page.evaluate(() => {
        // Look for folio number links - they typically look like: 01-3114-035-2520
        const allLinks = Array.from(document.querySelectorAll('a'));
        const linkInfo = [];

        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // Collect all links with numbers for debugging
          if (/\d/.test(text) && text.length > 0 && text.length < 100) {
            linkInfo.push({ text, href: href.substring(0, 80) });
          }

          // Match folio pattern: XX-XXXX-XXX-XXXX (Miami-Dade folio format)
          if (text.match(/^\d{2}-\d{4}-\d{3}-\d{4}$/) ||
              href.includes('propertyrecord') ||
              href.includes('Property_ID')) {
            link.click();
            return { clicked: true, folio: text, href: href.substring(0, 100), linkInfo };
          }
        }

        return { clicked: false, linkInfo };
      });

      if (!folioClicked.clicked) {
        this.log(`⚠️ Could not find folio number link in search results`);

        // Log what links we did find for debugging
        if (folioClicked.linkInfo && folioClicked.linkInfo.length > 0) {
          this.log(`📋 Found ${folioClicked.linkInfo.length} links with numbers:`);
          folioClicked.linkInfo.slice(0, 10).forEach((link, i) => {
            this.log(`   ${i + 1}. "${link.text}" -> ${link.href}`);
          });
        } else {
          this.log(`   No links with numbers found on page`);
        }

        return {
          success: false,
          message: 'Property found but could not navigate to details (no folio link)'
        };
      }

      this.log(`✅ Clicked folio number: ${folioClicked.folio}`);
      await this.randomWait(5000, 7000);

      // Check if we're on the property detail page
      const propertyCheckResult = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const url = window.location.href;

        // Check for property detail indicators
        const hasPropertyInfo = text.includes('folio') ||
                               text.includes('property information') ||
                               text.includes('owner name') ||
                               text.includes('owner:') ||
                               text.includes('sales information') ||
                               text.includes('sale date') ||
                               text.includes('assessed value') ||
                               text.includes('property details');

        return {
          hasPropertyInfo,
          url,
          textSample: text.substring(0, 300)
        };
      });

      this.log(`🔍 Property detail page check:`);
      this.log(`   Has property info: ${propertyCheckResult.hasPropertyInfo}`);
      this.log(`   Current URL: ${propertyCheckResult.url}`);

      if (propertyCheckResult.hasPropertyInfo) {
        this.log(`✅ Property details page loaded successfully`);
        return {
          success: true,
          message: 'Property found on assessor website',
          url: propertyCheckResult.url,
          folio: folioClicked.folio
        };
      } else {
        this.log(`⚠️ Property details not found after clicking folio`);
        this.log(`   Text sample: ${propertyCheckResult.textSample}`);
        return {
          success: false,
          message: 'Could not verify property details loaded after clicking folio'
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

      // Extract transaction information from the page - look for clickable ORB-Page links
      this.log('🔍 Extracting transaction data and ORB-Page links...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // First, look for clickable links with ORB-Page format (e.g., "30585-4762")
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // Pattern: XXXXX-XXXX (ORB-Page format like 30585-4762)
          const orbPageMatch = text.match(/^(\d{5})-(\d{4})$/);
          if (orbPageMatch) {
            const book = orbPageMatch[1];
            const page = orbPageMatch[2];

            const exists = results.some(r => r.officialRecordBook === book && r.pageNumber === page);
            if (!exists) {
              results.push({
                officialRecordBook: book,
                pageNumber: page,
                type: 'orb_link',
                clickable: true,
                linkText: text,
                linkHref: href,
                source: 'Miami-Dade County Property Appraiser (clickable link)',
                rawText: text
              });
            }
          }
        }

        // Also look for ORB references in text
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        for (const line of lines) {
          // Pattern 1: ORB: XXXXX PG: XXXX or ORB XXXXX-XXXX
          const orbMatch = line.match(/ORB:?\s*(\d+)[-\s]+(?:PG:?\s*)?(\d+)/i);
          if (orbMatch) {
            const book = orbMatch[1];
            const page = orbMatch[2];

            const exists = results.some(r => r.officialRecordBook === book && r.pageNumber === page);
            if (!exists) {
              results.push({
                officialRecordBook: book,
                pageNumber: page,
                type: 'orb_text',
                clickable: false,
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
   * Download deed PDF from Miami-Dade County Property Appraiser
   *
   * New Workflow (from Property Appraiser page):
   * 1. Click on ORB-Page link (e.g., "30585-4762")
   * 2. Click on first entry in results
   * 3. Click on "Document Image" button
   * 4. Download the PDF
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Miami-Dade County Property Appraiser...');

    try {
      // If transaction has a clickable link, click it directly
      if (transaction.clickable && transaction.linkText) {
        this.log(`🔗 Clicking on ORB-Page link: ${transaction.linkText}`);

        const orbLinkClicked = await this.page.evaluate((linkText) => {
          const allLinks = Array.from(document.querySelectorAll('a'));
          for (const link of allLinks) {
            if (link.textContent?.trim() === linkText) {
              link.click();
              return true;
            }
          }
          return false;
        }, transaction.linkText);

        if (!orbLinkClicked) {
          throw new Error(`Could not find clickable ORB-Page link: ${transaction.linkText}`);
        }

        this.log(`✅ Clicked ORB-Page link`);
        await this.randomWait(5000, 7000);

        // Check if a new tab/window was opened
        const pages = await this.browser.pages();
        this.log(`📋 Browser has ${pages.length} page(s) open`);

        // If a new page was opened, switch to it
        let clerkPage = null;
        if (pages.length > 1) {
          // Find the clerk's website page
          for (const page of pages) {
            const url = page.url();
            if (url.includes('miamidadeclerk.gov')) {
              clerkPage = page;
              this.log(`🌐 Found Clerk's website in new tab: ${url}`);
              break;
            }
          }
        }

        // If we found the clerk page in a new tab, use it
        if (clerkPage) {
          const oldPage = this.page;
          this.page = clerkPage; // Switch to clerk page
          const result = await this.downloadDeedFromClerkPage(transaction);
          await clerkPage.close(); // Close the clerk tab
          this.page = oldPage; // Switch back to original page
          return result;
        }

        // Check if current page navigated to clerk's website
        const currentUrl = this.page.url();
        this.log(`📍 Current URL: ${currentUrl}`);

        // If the ORB link took us to the clerk's website, handle it there
        if (currentUrl.includes('miamidadeclerk.gov')) {
          this.log('🌐 Navigated to Clerk\'s website, using clerk download workflow...');
          return await this.downloadDeedFromClerkPage(transaction);
        }
      } else {
        // If not clickable, navigate to clerk's website the old way
        this.log('⚠️ Transaction not directly clickable, using clerk website search...');
        return await this.downloadDeedFromClerk(transaction);
      }

      // After clicking ORB-Page link, we should be on a document list page
      // Now click on the first entry
      this.log('🔍 Looking for first document entry...');

      const firstEntryClicked = await this.page.evaluate(() => {
        // Look for clickable document entries - could be links or buttons
        const candidates = [
          ...Array.from(document.querySelectorAll('a')),
          ...Array.from(document.querySelectorAll('tr')),
          ...Array.from(document.querySelectorAll('[onclick]'))
        ];

        for (const elem of candidates) {
          const text = (elem.textContent || '').toLowerCase();
          const onclick = elem.getAttribute('onclick') || '';

          // Look for entries that might be document records
          if (text.includes('deed') ||
              text.includes('warranty') ||
              text.includes('doc') ||
              onclick.includes('document') ||
              onclick.includes('record')) {
            elem.click();
            return { clicked: true, text: text.substring(0, 100) };
          }
        }

        // If no specific deed entry found, try clicking first table row link
        const tableLinks = Array.from(document.querySelectorAll('table tr a'));
        if (tableLinks.length > 0) {
          tableLinks[0].click();
          return { clicked: true, text: 'First table link' };
        }

        return { clicked: false };
      });

      if (!firstEntryClicked.clicked) {
        this.log('⚠️ Could not find document entry to click, trying Document Image button directly...');
      } else {
        this.log(`✅ Clicked document entry: ${firstEntryClicked.text}`);
        await this.randomWait(3000, 5000);
      }

      // Now look for "Document Image" button and click it
      this.log('🔍 Looking for Document Image button...');

      const documentImageClicked = await this.page.evaluate(() => {
        const allElements = [
          ...Array.from(document.querySelectorAll('button')),
          ...Array.from(document.querySelectorAll('a')),
          ...Array.from(document.querySelectorAll('input[type="button"]')),
          ...Array.from(document.querySelectorAll('[onclick]'))
        ];

        for (const elem of allElements) {
          const text = (elem.textContent || elem.value || '').toLowerCase();

          if (text.includes('document image') ||
              text.includes('view document') ||
              text.includes('view image') ||
              text.includes('show document')) {
            elem.click();
            return { clicked: true, text: text.substring(0, 100) };
          }
        }

        return { clicked: false };
      });

      if (!documentImageClicked.clicked) {
        throw new Error('Could not find Document Image button');
      }

      this.log(`✅ Clicked Document Image button`);
      await this.randomWait(5000, 7000);

      // The document should now open in a new window or navigate to PDF
      // Check for new window/tab
      this.log('⏳ Waiting for PDF to load...');

      const pages = await this.browser.pages();
      let pdfPage = null;

      // Check if a new page/tab was opened
      if (pages.length > 1) {
        pdfPage = pages[pages.length - 1];
        this.log('✅ Found new window/tab with PDF');
      } else {
        // PDF might have loaded in the same page
        pdfPage = this.page;
        this.log('ℹ️  PDF loaded in same page');
      }

      await this.randomWait(3000, 5000);

      // Get PDF URL
      const pdfUrl = pdfPage.url();
      this.log(`📍 PDF URL: ${pdfUrl}`);

      // Check if it's actually a PDF
      if (!pdfUrl.toLowerCase().includes('.pdf') && !pdfUrl.includes('/pdf')) {
        // Try to find PDF link or iframe
        const pdfFound = await pdfPage.evaluate(() => {
          // Look for iframe with PDF
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const iframe of iframes) {
            const src = iframe.src || '';
            if (src.includes('.pdf') || src.includes('/pdf')) {
              return { found: true, url: src };
            }
          }

          // Look for PDF links
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const href = link.href || '';
            if (href.includes('.pdf') || href.includes('/pdf')) {
              return { found: true, url: href };
            }
          }

          return { found: false };
        });

        if (pdfFound.found) {
          this.log(`✅ Found PDF URL: ${pdfFound.url}`);
          // Navigate to the PDF
          await pdfPage.goto(pdfFound.url, { waitUntil: 'networkidle2', timeout: 30000 });
          await this.randomWait(3000, 5000);
        } else {
          throw new Error('Could not locate PDF document');
        }
      }

      // Download the PDF
      this.log('📥 Downloading PDF...');

      const pdfBuffer = await pdfPage.evaluate(async () => {
        const response = await fetch(window.location.href);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      });

      const buffer = Buffer.from(pdfBuffer);

      // Verify it's a PDF
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${buffer.length} bytes)`);

      // Close the PDF page if it's a new window
      if (pages.length > 1 && pdfPage !== this.page) {
        await pdfPage.close();
      }

      // Save PDF to disk
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      const filename = `miami-dade_deed_${transaction.officialRecordBook}_${transaction.pageNumber}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, buffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        filepath,
        downloadPath,
        officialRecordBook: transaction.officialRecordBook,
        pageNumber: transaction.pageNumber,
        timestamp: new Date().toISOString(),
        fileSize: buffer.length,
        fileSizeKB: (buffer.length / 1024).toFixed(2)
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
   * Download deed when already on the Clerk's search results page
   * This is called after clicking an ORB link from the Property Appraiser
   */
  async downloadDeedFromClerkPage(transaction) {
    this.log('📄 Downloading deed from Clerk\'s search results page...');

    try {
      // Wait longer for clerk's page to fully load (it may use AJAX)
      this.log('⏳ Waiting for clerk page to load completely...');
      await this.randomWait(8000, 10000);

      // Check what's on the page
      const pageInfo = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
        const images = Array.from(document.querySelectorAll('img'));

        return {
          url: window.location.href,
          title: document.title,
          linkCount: links.length,
          buttonCount: buttons.length,
          imageCount: images.length,
          bodyText: document.body.innerText.substring(0, 500),
          allLinks: links.map(link => ({
            text: (link.textContent || '').trim().substring(0, 60),
            href: (link.href || '').substring(0, 120),
            hasImage: link.querySelector('img') !== null,
            imageAlt: link.querySelector('img')?.alt || ''
          })),
          allButtons: buttons.map(btn => ({
            text: (btn.textContent || btn.value || '').trim().substring(0, 60),
            type: btn.type,
            value: btn.value || ''
          }))
        };
      });

      this.log(`📋 Clerk page info: ${pageInfo.title}`);
      this.log(`   ${pageInfo.linkCount} links, ${pageInfo.buttonCount} buttons`);
      this.log(`📋 ALL LINKS on clerk page:`);
      pageInfo.allLinks.forEach((link, i) => {
        this.log(`   ${i + 1}. "${link.text}" hasImg=${link.hasImage} imgAlt="${link.imageAlt}" -> ${link.href}`);
      });
      this.log(`📋 ALL BUTTONS on clerk page:`);
      pageInfo.allButtons.forEach((btn, i) => {
        this.log(`   ${i + 1}. "${btn.text}" type=${btn.type} value="${btn.value}"`);
      });

      // IMPORTANT: Look for "Document Image" button (it's OUTSIDE the table, below it)
      const documentImageSearch = await this.page.evaluate(() => {
        // Search for clickable elements with "document", "image", "view" etc
        const allClickable = [
          ...Array.from(document.querySelectorAll('a')),
          ...Array.from(document.querySelectorAll('button')),
          ...Array.from(document.querySelectorAll('input[type="button"]')),
          ...Array.from(document.querySelectorAll('input[type="submit"]')),
          ...Array.from(document.querySelectorAll('[onclick]')),
          ...Array.from(document.querySelectorAll('[role="button"]'))
        ];

        const matches = [];

        for (const elem of allClickable) {
          const text = (elem.textContent || elem.innerText || elem.value || '').trim();
          const lowerText = text.toLowerCase();

          // Look for elements with "document", "image", "view" keywords
          if ((lowerText.includes('document') || lowerText.includes('image') ||
               lowerText.includes('view') || lowerText.includes('pdf')) &&
              text.length > 0 && text.length < 200) {

            // Get more details about positioning
            const rect = elem.getBoundingClientRect();
            const isVisible = elem.offsetParent !== null;

            matches.push({
              tag: elem.tagName,
              type: elem.type || '',
              text: text.substring(0, 100),
              className: elem.className,
              id: elem.id,
              isLink: elem.tagName === 'A',
              href: elem.href || '',
              isButton: elem.tagName === 'BUTTON' || elem.type === 'button' || elem.type === 'submit',
              onclick: (elem.getAttribute('onclick') || '').substring(0, 100),
              ariaLabel: elem.getAttribute('aria-label') || '',
              isVisible,
              top: Math.round(rect.top),
              left: Math.round(rect.left)
            });
          }
        }

        return { matches };
      });

      this.log(`🔍 Document/Image/View button search: found ${documentImageSearch.matches.length} clickable elements`);
      if (documentImageSearch.matches.length > 0) {
        this.log(`📋 Clickable elements with document/image/view keywords:`);
        documentImageSearch.matches.forEach((elem, i) => {
          this.log(`   ${i + 1}. <${elem.tag}${elem.type ? ` type="${elem.type}"` : ''}> "${elem.text}"`);
          this.log(`      visible=${elem.isVisible} isLink=${elem.isLink} isButton=${elem.isButton}`);
          this.log(`      class="${elem.className}" id="${elem.id}"`);
          this.log(`      href="${elem.href}" onclick="${elem.onclick}"`);
        });
      }

      // Log page structure for debugging
      const pageStructureInfo = await this.page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        const tables = Array.from(document.querySelectorAll('table'));
        const divs = Array.from(document.querySelectorAll('div[class*="result"], div[class*="search"], div[class*="document"]'));
        const imgs = Array.from(document.querySelectorAll('img'));

        return {
          links: allLinks.slice(0, 10).map(link => ({
            text: (link.textContent || '').trim().substring(0, 50),
            href: (link.href || '').substring(0, 100),
            hasImage: link.querySelector('img') !== null,
            imageAlt: link.querySelector('img')?.alt || '',
            imageSrc: (link.querySelector('img')?.src || '').substring(0, 80)
          })),
          tableCount: tables.length,
          resultDivCount: divs.length,
          imageCount: imgs.length,
          images: imgs.map(img => ({
            alt: img.alt,
            src: (img.src || '').substring(0, 80),
            parentTag: img.parentElement?.tagName,
            parentHref: img.parentElement?.href || '',
            inTable: img.closest('table') !== null
          }))
        };
      });

      this.log(`📋 Page structure:`);
      this.log(`   Tables: ${pageStructureInfo.tableCount}, Result divs: ${pageStructureInfo.resultDivCount}, Images: ${pageStructureInfo.imageCount}`);

      if (pageStructureInfo.images.length > 0) {
        this.log(`📋 All images on page:`);
        pageStructureInfo.images.forEach((img, i) => {
          this.log(`   ${i + 1}. alt="${img.alt}" parent=${img.parentTag} inTable=${img.inTable} href="${img.parentHref.substring(0, 60)}"`);
        });
      }

      if (pageStructureInfo.links.length > 0) {
        this.log(`📋 Links with images:`);
        pageStructureInfo.links.filter(link => link.hasImage).forEach((link, i) => {
          this.log(`   ${i + 1}. text="${link.text}" img-alt="${link.imageAlt}"`);
        });
      }

      // Check table contents if table exists
      if (pageStructureInfo.tableCount > 0) {
        const tableInfo = await this.page.evaluate(() => {
          const table = document.querySelector('table');
          if (!table) return null;

          const rows = Array.from(table.querySelectorAll('tr'));
          const links = Array.from(table.querySelectorAll('a'));
          const images = Array.from(table.querySelectorAll('img'));

          // Check each row for clickable elements
          const rowInfo = rows.slice(0, 3).map((row, idx) => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            return {
              rowIndex: idx,
              cellCount: cells.length,
              cells: cells.map((cell, cellIdx) => ({
                cellIndex: cellIdx,
                text: (cell.innerText || '').trim().substring(0, 50),
                hasLink: cell.querySelector('a') !== null,
                hasImage: cell.querySelector('img') !== null,
                hasCheckbox: cell.querySelector('input[type="checkbox"]') !== null,
                hasRadio: cell.querySelector('input[type="radio"]') !== null,
                hasButton: cell.querySelector('button, input[type="button"]') !== null,
                linkHref: cell.querySelector('a')?.href || '',
                imageAlt: cell.querySelector('img')?.alt || '',
                onclick: cell.getAttribute('onclick') || '',
                innerHTML: cell.innerHTML.substring(0, 150)
              }))
            };
          });

          return {
            rowCount: rows.length,
            linkCount: links.length,
            imageCount: images.length,
            tableText: table.innerText.substring(0, 500),
            links: links.map(link => ({
              text: (link.textContent || '').trim().substring(0, 50),
              href: (link.href || '').substring(0, 100),
              hasImage: link.querySelector('img') !== null,
              imageAlt: link.querySelector('img')?.alt || ''
            })),
            images: images.map(img => ({
              alt: img.alt,
              src: (img.src || '').substring(0, 80),
              parentTag: img.parentElement?.tagName,
              parentHref: img.parentElement?.href || ''
            })),
            rowInfo
          };
        });

        if (tableInfo) {
          this.log(`📋 Table details:`);
          this.log(`   Rows: ${tableInfo.rowCount}, Links: ${tableInfo.linkCount}, Images: ${tableInfo.imageCount}`);
          this.log(`   Table text: ${tableInfo.tableText}`);
          if (tableInfo.links.length > 0) {
            this.log(`   Table links (ALL):`);
            tableInfo.links.forEach((link, i) => {
              this.log(`     ${i + 1}. "${link.text}" hasImage=${link.hasImage} imgAlt="${link.imageAlt}" -> ${link.href}`);
            });
          }
          if (tableInfo.images.length > 0) {
            this.log(`   Table images (ALL):`);
            tableInfo.images.forEach((img, i) => {
              this.log(`     ${i + 1}. alt="${img.alt}" parent=${img.parentTag} href="${img.parentHref.substring(0, 60)}"`);
            });
          }
          if (tableInfo.rowInfo.length > 0) {
            this.log(`   First 3 rows detail (ALL CELLS):`);
            tableInfo.rowInfo.forEach(row => {
              this.log(`     Row ${row.rowIndex}: ${row.cellCount} cells`);
              row.cells.forEach(cell => {
                this.log(`       Cell ${cell.cellIndex}: "${cell.text}"`);
                this.log(`         link=${cell.hasLink} image=${cell.hasImage} checkbox=${cell.hasCheckbox} radio=${cell.hasRadio} button=${cell.hasButton}`);
                this.log(`         onclick="${cell.onclick.substring(0, 40)}" html="${cell.innerHTML.substring(0, 80)}"`);
              });
            });
          }
        }
      }

      // Check main body text for useful info
      const bodyText = pageInfo.bodyText;
      this.log(`📋 Body text sample: ${bodyText.substring(0, 200)}`);

      // Check if there's an error or "no results" message
      if (bodyText.toLowerCase().includes('no records') ||
          bodyText.toLowerCase().includes('no results') ||
          bodyText.toLowerCase().includes('not found')) {
        this.log('⚠️ Clerk page shows "no results" message');
        throw new Error('Clerk search returned no results');
      }

      // BEFORE clicking table: Check if Document Image button already exists
      const beforeClickCheck = await this.page.evaluate(() => {
        const allText = document.body.innerText;
        return {
          hasDocumentImage: allText.toLowerCase().includes('document image'),
          bodyPreview: allText.substring(0, 1000)
        };
      });

      this.log(`📋 Before clicking table - page contains "document image": ${beforeClickCheck.hasDocumentImage}`);

      // Look for clickable elements in the table (clerk's file number, etc.)
      this.log('🔍 Looking for clickable document entries...');

      const tableEntryClicked = await this.page.evaluate(() => {
        // Look for clickable elements in table cells (td, th, span, div)
        const table = document.querySelector('table');
        if (!table) return { clicked: false, reason: 'No table found' };

        // Try clicking on first table row (excluding header)
        const rows = Array.from(table.querySelectorAll('tr'));
        for (let i = 1; i < rows.length; i++) { // Start from 1 to skip header
          const row = rows[i];
          const cells = Array.from(row.querySelectorAll('td'));

          // STRATEGY 1: Try clicking on Clerk's File Number FIRST (Cell 0)
          // This should navigate to/expand the detail card where "Document Image" button appears
          if (cells.length >= 1) {
            const clerkFileCell = cells[0]; // Cell 0 is Clerk's File Number
            const cellText = clerkFileCell.innerText?.trim() || '';

            // Check if this looks like a clerk's file number (format: YYYY R XXXXXX)
            if (cellText.match(/^\d{4}\s+R\s+\d+$/)) {
              // Try different click methods
              // First, try clicking any link or button inside the cell
              const linkOrButton = clerkFileCell.querySelector('a, button, [role="button"]');
              if (linkOrButton) {
                linkOrButton.click();
                return { clicked: true, method: 'clerk-file-number-link', text: cellText };
              }

              // Try clicking the entire row (some tables have row click handlers)
              const row = clerkFileCell.closest('tr');
              if (row) {
                row.click();
                return { clicked: true, method: 'clerk-file-number-row', text: cellText };
              }

              // Fallback: Try clicking the cell directly
              clerkFileCell.click();
              return { clicked: true, method: 'clerk-file-number-cell', text: cellText };
            }
          }

          // STRATEGY 2: Try clicking on Rec Book/Page (Cell 3) as fallback
          if (cells.length >= 4) {
            const bookPageCell = cells[3]; // Cell 3 is Rec Book/Page
            const bookPageText = bookPageCell.innerText?.trim() || '';

            // Check if this looks like a book/page number (format: XXXXX/XXXX)
            if (bookPageText.match(/^\d+\/\d+$/)) {
              // Try clicking the cell directly
              bookPageCell.click();
              return { clicked: true, method: 'rec-book-page-cell', text: bookPageText };
            }
          }

          // STRATEGY 3: General search for clickable elements
          for (let j = 0; j < cells.length; j++) {
            const cell = cells[j];
            const cellText = cell.innerText?.trim() || '';

            // Check if this looks like a clerk's file number
            if (cellText.match(/^\d{4}\s+R\s+\d+$/)) {
              // Try clicking the cell directly
              cell.click();
              return { clicked: true, method: 'clerk-file-number-cell-fallback', text: cellText };
            }

            // Check if cell itself is clickable
            if (cell.onclick || cell.getAttribute('onclick')) {
              cell.click();
              return { clicked: true, method: 'cell-onclick', text: cellText.substring(0, 50) };
            }

            // Check for links within cell
            const link = cell.querySelector('a');
            if (link) {
              link.click();
              return { clicked: true, method: 'cell-link', text: link.innerText.substring(0, 50) };
            }

            // Check for clickable spans/divs
            const clickableElement = cell.querySelector('[onclick], [role="button"], button');
            if (clickableElement) {
              clickableElement.click();
              return { clicked: true, method: 'clickable-element', text: clickableElement.innerText.substring(0, 50) };
            }
          }

          // If first row, try clicking it even without explicit onclick handler
          // (JavaScript event listeners might be attached)
          if (i === 1) {
            const firstCell = cells[0];
            if (firstCell) {
              firstCell.click();
              return { clicked: true, method: 'first-cell-click', text: firstCell.innerText.substring(0, 50) };
            }
          }

          // Try clicking the row itself
          if (row.onclick || row.getAttribute('onclick')) {
            row.click();
            return { clicked: true, method: 'row-onclick', text: row.innerText.substring(0, 100) };
          }
        }

        return { clicked: false, reason: 'No clickable elements in table' };
      });

      if (tableEntryClicked.clicked) {
        this.log(`✅ Clicked table entry (${tableEntryClicked.method}): ${tableEntryClicked.text}`);

        // IMPORTANT: Clicking on CFN (Clerk's File Number) opens a NEW PAGE
        // We need to wait for navigation to complete
        this.log('⏳ Waiting for navigation to new page...');

        try {
          // Wait for navigation with a reasonable timeout
          await this.page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 15000
          });
          this.log('✅ Navigation completed');
        } catch (navError) {
          this.log(`⚠️ Navigation wait timed out (page might have updated without URL change): ${navError.message}`);
        }

        // Give extra time for page to fully render
        await this.randomWait(3000, 5000);

        // Check the new URL
        const newUrl = this.page.url();
        this.log(`📍 Current URL after click: ${newUrl}`);

        // Scroll down to make sure all content is visible (the button might be below the fold)
        this.log('📜 Scrolling down to reveal all content...');
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.randomWait(2000, 3000);

        // Also try scrolling to the middle
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await this.randomWait(1000, 2000);

        // Now look for "Document Image" button on the detail page
        this.log('🔍 Looking for "Document Image" button on detail page...');

        // FIRST: Dump ALL page HTML to understand structure
        const pageStructure = await this.page.evaluate(() => {
          // Get main content area (likely contains the results)
          const mainContent = document.querySelector('main') || document.querySelector('#main') || document.body;

          // Get full HTML of main content (first 5000 chars)
          const mainHTML = mainContent.innerHTML.substring(0, 5000);

          // Look for ALL divs that might contain the clerk's file number
          const allDivs = Array.from(document.querySelectorAll('div'));
          const divsWithCFN = allDivs.filter(div => {
            const text = div.innerText || '';
            // Look specifically for the div that has ONLY the clerk file number info (not the whole page)
            return (text.includes('2017 R 358201') || text.includes('Clerk\'s File Number:')) &&
                   text.length < 2000; // Exclude huge divs (root, body, etc.)
          }).slice(0, 8).map(div => ({
            className: div.className,
            id: div.id,
            innerHTML: div.innerHTML.substring(0, 3000),
            text: div.innerText.substring(0, 500),
            hasClickables: div.querySelectorAll('a, button, [onclick], img').length
          }));

          return { mainHTML, divsWithCFN };
        });

        this.log(`\n📋 Main content HTML (first 1000 chars):`);
        this.log(pageStructure.mainHTML.substring(0, 1000));

        this.log(`\n📋 Found ${pageStructure.divsWithCFN.length} divs containing clerk's file number (text < 2000 chars)`);
        pageStructure.divsWithCFN.forEach((div, i) => {
          this.log(`\n   Div ${i + 1}:`);
          this.log(`   Class: "${div.className}" ID: "${div.id}" Clickables: ${div.hasClickables}`);
          this.log(`   Text: ${div.text.substring(0, 300)}`);
          this.log(`   HTML: ${div.innerHTML.substring(0, 1500)}`);
        });

        // IMPORTANT: After clicking table row, page switches to Card View
        // We need to click ON the card itself to open the detail page with "Document Image" button
        this.log('\n🔍 Checking if we need to click on a card to open detail view...');

        const cardClicked = await this.page.evaluate(() => {
          // Look for card divs (class "TitleSearchTab" based on diagnostic output)
          const cardDivs = document.querySelectorAll('.TitleSearchTab');

          if (cardDivs.length > 0) {
            // Found cards! Let's examine the first card structure
            const firstCard = cardDivs[0];

            // Log the card HTML to see what's inside
            const cardHTML = firstCard.innerHTML;

            // Look for ANY links within the card
            const links = firstCard.querySelectorAll('a');
            const linkInfo = Array.from(links).map(link => ({
              text: (link.textContent || '').trim().substring(0, 50),
              href: link.href || '',
              className: link.className
            }));

            // STRATEGY 1: Try to click on the CFN text itself (might navigate to detail page)
            // Look for text containing "Clerk's File Number: 2017 R 358201, Group:"
            const cfnParagraphs = firstCard.querySelectorAll('p');
            for (const p of cfnParagraphs) {
              const text = p.innerText || '';
              if (text.includes('Clerk\'s File Number:') && text.includes('Group:')) {
                p.click();
                return {
                  clicked: true,
                  method: 'cfn-text-click',
                  count: cardDivs.length,
                  text: text.substring(0, 100),
                  cardHTML: cardHTML.substring(0, 4000),
                  linkCount: links.length,
                  linkInfo
                };
              }
            }

            // STRATEGY 2: Try the expand button
            const expandButton = firstCard.querySelector('.TitleSearchTabExpand') ||
                                 firstCard.querySelector('[title="View Details"]') ||
                                 firstCard.querySelector('svg');

            if (expandButton) {
              expandButton.click();
              return {
                clicked: true,
                method: 'expand-button',
                count: cardDivs.length,
                text: firstCard.innerText.substring(0, 100),
                cardHTML: cardHTML.substring(0, 4000),
                linkCount: links.length,
                linkInfo
              };
            }

            // STRATEGY 3: Fallback - click the card itself
            firstCard.click();
            return {
              clicked: true,
              method: 'card-div',
              count: cardDivs.length,
              text: firstCard.innerText.substring(0, 100),
              cardHTML: cardHTML.substring(0, 4000),
              linkCount: links.length,
              linkInfo
            };
          }

          return { clicked: false, count: 0 };
        });

        if (cardClicked.clicked) {
          this.log(`✅ Clicked on card (1 of ${cardClicked.count}) using method: ${cardClicked.method}`);
          this.log(`   Card text: ${cardClicked.text}`);

          // IMPORTANT: Clicking card opens a NEW WINDOW/TAB with URL pattern: /recordpage?qs=...
          this.log('⏳ Waiting for new window to open...');
          await this.randomWait(2000, 3000);

          // Check if new page opened
          const pages = await this.browser.pages();
          this.log(`📋 Browser has ${pages.length} page(s) open`);

          // Find the recordpage tab (should be the newest one)
          let recordPage = null;
          for (const p of pages) {
            const url = p.url();
            if (url.includes('/recordpage')) {
              recordPage = p;
              this.log(`🌐 Found record detail page: ${url}`);
              break;
            }
          }

          if (!recordPage) {
            // Maybe it loaded in the same tab
            const currentUrl = this.page.url();
            this.log(`📍 Current URL: ${currentUrl}`);
            if (currentUrl.includes('/recordpage')) {
              recordPage = this.page;
              this.log(`✅ Record page loaded in same tab`);
            } else {
              throw new Error('Record detail page did not open after clicking card');
            }
          }

          // Switch to the record page
          await recordPage.bringToFront();
          this.page = recordPage;

          // Wait for page to fully load
          this.log('⏳ Waiting for record page to fully load...');
          await this.randomWait(3000, 5000);
        } else {
          this.log(`⚠️ No cards found (found ${cardClicked.count} cards)`);
        }

        const documentImageButton = await this.page.evaluate(() => {
          // Search for ANY element containing "Document Image" (case insensitive)
          const allClickable = [
            ...Array.from(document.querySelectorAll('a')),
            ...Array.from(document.querySelectorAll('button')),
            ...Array.from(document.querySelectorAll('input[type="button"]')),
            ...Array.from(document.querySelectorAll('input[type="submit"]')),
            ...Array.from(document.querySelectorAll('[onclick]')),
            ...Array.from(document.querySelectorAll('[role="button"]')),
            ...Array.from(document.querySelectorAll('div')),
            ...Array.from(document.querySelectorAll('span'))
          ];

          for (const elem of allClickable) {
            const text = (elem.textContent || elem.innerText || elem.value || '').trim();
            const lowerText = text.toLowerCase();

            // Look for "Document Image" text specifically
            if (lowerText.includes('document image') || lowerText === 'document image') {
              const isVisible = elem.offsetParent !== null;
              return {
                found: true,
                tag: elem.tagName,
                text: text.substring(0, 100),
                className: elem.className,
                id: elem.id,
                isLink: elem.tagName === 'A',
                href: elem.href || '',
                isButton: elem.tagName === 'BUTTON' || elem.type === 'button',
                onclick: (elem.getAttribute('onclick') || '').substring(0, 100),
                isVisible
              };
            }
          }

          // Also check for variations
          for (const elem of allClickable) {
            const text = (elem.textContent || elem.innerText || elem.value || '').trim();
            const lowerText = text.toLowerCase();

            if ((lowerText.includes('document') && lowerText.includes('image')) ||
                lowerText.includes('view document') ||
                lowerText.includes('view image')) {
              const isVisible = elem.offsetParent !== null;
              return {
                found: true,
                tag: elem.tagName,
                text: text.substring(0, 100),
                className: elem.className,
                id: elem.id,
                isLink: elem.tagName === 'A',
                href: elem.href || '',
                isButton: elem.tagName === 'BUTTON' || elem.type === 'button',
                onclick: (elem.getAttribute('onclick') || '').substring(0, 100),
                isVisible
              };
            }
          }

          return { found: false };
        });

        if (documentImageButton.found) {
          this.log(`✅ Found "Document Image" button!`);
          this.log(`   Tag: <${documentImageButton.tag}> Text: "${documentImageButton.text}"`);
          this.log(`   Visible: ${documentImageButton.isVisible}, Link: ${documentImageButton.isLink}, Button: ${documentImageButton.isButton}`);
          this.log(`   Class: "${documentImageButton.className}" ID: "${documentImageButton.id}"`);
          this.log(`   Onclick: "${documentImageButton.onclick}"`);

          // Set up network request monitoring BEFORE clicking
          this.log('📡 Setting up network monitoring to capture PDF requests...');
          const pdfRequests = [];

          const requestHandler = (request) => {
            const url = request.url();
            const resourceType = request.resourceType();

            // Capture any requests that might be PDF-related
            if (url.includes('.pdf') || url.includes('/pdf') || url.includes('document') ||
                url.includes('Image') || url.includes('blob') || resourceType === 'document') {
              pdfRequests.push({
                url,
                resourceType,
                method: request.method()
              });
              this.log(`📥 Captured request: ${resourceType} - ${url.substring(0, 150)}`);
            }
          };

          this.page.on('request', requestHandler);

          // Click the "Document Image" button
          this.log('🖱️  Clicking "Document Image" button...');

          // Try to find and click using Puppeteer's click (which handles visibility better)
          let clicked = false;
          try {
            // Look for link with "Document Image" text
            const docImageLink = await this.page.$x("//a[contains(text(), 'Document Image')]");
            if (docImageLink.length > 0) {
              // Scroll into view and click
              await docImageLink[0].evaluate(el => el.scrollIntoView());
              await this.randomWait(500, 1000);
              await docImageLink[0].click();
              clicked = true;
              this.log('✅ Clicked using XPath selector');
            }
          } catch (err) {
            this.log(`⚠️ XPath click failed: ${err.message}, trying JavaScript click...`);
          }

          // Fallback to JavaScript click
          if (!clicked) {
            clicked = await this.page.evaluate((btnText) => {
              const allClickable = [
                ...Array.from(document.querySelectorAll('a')),
                ...Array.from(document.querySelectorAll('button')),
                ...Array.from(document.querySelectorAll('input[type="button"]')),
                ...Array.from(document.querySelectorAll('[onclick]')),
                ...Array.from(document.querySelectorAll('div')),
                ...Array.from(document.querySelectorAll('span'))
              ];

              for (const elem of allClickable) {
                const text = (elem.textContent || elem.innerText || elem.value || '').trim();
                const lowerText = text.toLowerCase();

                if (lowerText.includes('document image') || lowerText === 'document image') {
                  elem.click();
                  return true;
                }
              }
              return false;
            }, documentImageButton.text);
          }

          if (clicked) {
            this.log('✅ Clicked "Document Image" button successfully');

            // Wait for PDF to load (clicking Document Image should display PDF in iframe or new view)
            this.log('⏳ Waiting for PDF to load after clicking Document Image...');

            // Check if a new tab opened after clicking Document Image
            await this.randomWait(2000, 3000);
            const pagesAfterClick = await this.browser.pages();
            this.log(`📋 Browser now has ${pagesAfterClick.length} page(s) open after clicking Document Image`);

            // Check for new PDF tab
            let pdfTab = null;
            for (const p of pagesAfterClick) {
              const url = p.url();
              this.log(`   Page: ${url}`);
              if (url.includes('.pdf') || url.includes('/pdf') || url.includes('blob:')) {
                pdfTab = p;
                this.log(`🌐 Found PDF in new tab: ${url}`);
                break;
              }
            }

            if (pdfTab) {
              // Switch to PDF tab and download
              await pdfTab.bringToFront();
              this.page = pdfTab;
              this.log('✅ Switched to PDF tab');
              return await this.findAndDownloadPDF(transaction);
            }

            // Wait for PDF viewer to appear on the right side
            // The PDF loads in a dynamic React component, not a traditional iframe
            let pdfFound = false;
            let pdfSrc = null;

            for (let attempt = 0; attempt < 15; attempt++) {
              await this.randomWait(1000, 2000);

              const checkResult = await this.page.evaluate(() => {
                // Check for iframe with PDF or blob
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                  const src = iframe.src || '';
                  if (src && (src.includes('.pdf') || src.includes('blob:') || src.includes('/pdf') || src.includes('document') || src.includes('Image'))) {
                    return { found: true, type: 'iframe', src: src.substring(0, 300), iframeCount: iframes.length };
                  }
                }

                // Check for object/embed tags (PDF.js viewer)
                const objects = document.querySelectorAll('object, embed');
                for (const obj of objects) {
                  const data = obj.data || obj.src || '';
                  if (data && (data.includes('.pdf') || data.includes('blob:') || data.includes('/pdf'))) {
                    return { found: true, type: 'object', src: data.substring(0, 300) };
                  }
                }

                // Check for canvas elements (PDF.js renders PDFs to canvas)
                const canvases = document.querySelectorAll('canvas');
                if (canvases.length > 0) {
                  return { found: true, type: 'canvas', src: 'PDF rendered in canvas', canvasCount: canvases.length };
                }

                // Check for PDF viewer containers
                const pdfContainers = document.querySelectorAll('[class*="pdf"], [id*="pdf"], [class*="document"], [id*="document"], [class*="viewer"], [id*="viewer"]');
                if (pdfContainers.length > 0) {
                  const container = pdfContainers[0];
                  const hasContent = container.children.length > 0 || container.innerHTML.length > 100;
                  if (hasContent) {
                    return {
                      found: true,
                      type: 'pdf-container',
                      src: `Container: ${container.className || container.id}`,
                      containerCount: pdfContainers.length
                    };
                  }
                }

                return { found: false, iframeCount: iframes.length, canvasCount: canvases.length };
              });

              if (checkResult.found) {
                pdfFound = true;
                pdfSrc = checkResult.src;
                this.log(`✅ PDF appeared as ${checkResult.type} after ${attempt + 1} attempts`);
                this.log(`   Source: ${pdfSrc}`);
                if (checkResult.canvasCount) this.log(`   Canvas count: ${checkResult.canvasCount}`);
                if (checkResult.iframeCount) this.log(`   Iframe count: ${checkResult.iframeCount}`);
                break;
              }

              this.log(`   Attempt ${attempt + 1}/15: No PDF found yet (iframes: ${checkResult.iframeCount || 0}, canvas: ${checkResult.canvasCount || 0})`);
            }

            if (!pdfFound) {
              this.log(`⚠️ No PDF viewer appeared after 15 attempts`);
              this.log(`   The PDF might load in a different way - will check captured network requests`);
            }

            // Stop listening to network requests
            this.page.off('request', requestHandler);

            // Check if we captured any PDF requests
            if (pdfRequests.length > 0) {
              this.log(`📋 Found ${pdfRequests.length} PDF-related network request(s):`);
              pdfRequests.forEach((req, i) => {
                this.log(`   ${i + 1}. [${req.method}] ${req.resourceType}: ${req.url.substring(0, 120)}`);
              });

              // Try to use the first PDF request URL
              const pdfRequest = pdfRequests.find(r => r.url.includes('.pdf') || r.url.includes('/pdf/')) || pdfRequests[0];
              this.log(`✅ Will try to download from captured request: ${pdfRequest.url.substring(0, 150)}`);

              // Try to download the PDF from the captured URL
              transaction.pdfUrl = pdfRequest.url;
            } else {
              this.log(`⚠️ No PDF requests were captured during network monitoring`);
            }

            // Now look for and download the PDF
            return await this.findAndDownloadPDF(transaction);
          } else {
            throw new Error('Failed to click "Document Image" button');
          }
        } else {
          this.log('⚠️ "Document Image" button not found with initial search');
          this.log('   Searching ALL clickable elements on page...');

          const allClickableElements = await this.page.evaluate(() => {
            const allClickable = [
              ...Array.from(document.querySelectorAll('a')),
              ...Array.from(document.querySelectorAll('button')),
              ...Array.from(document.querySelectorAll('input[type="button"]')),
              ...Array.from(document.querySelectorAll('input[type="submit"]')),
              ...Array.from(document.querySelectorAll('[onclick]'))
            ];

            return {
              url: window.location.href,
              title: document.title,
              bodyText: document.body.innerText.substring(0, 1500),
              clickableCount: allClickable.length,
              clickable: allClickable.slice(0, 30).map(elem => ({
                tag: elem.tagName,
                type: elem.type || '',
                text: (elem.textContent || elem.innerText || elem.value || '').trim().substring(0, 80),
                className: elem.className.substring(0, 50),
                id: elem.id,
                href: (elem.href || '').substring(0, 100),
                isVisible: elem.offsetParent !== null
              }))
            };
          });

          this.log(`   Page title: ${allClickableElements.title}`);
          this.log(`   Total clickable elements: ${allClickableElements.clickableCount}`);
          this.log(`   First 30 clickable elements:`);
          allClickableElements.clickable.forEach((elem, i) => {
            this.log(`     ${i + 1}. <${elem.tag}${elem.type ? ` type="${elem.type}"` : ''}> "${elem.text}" visible=${elem.isVisible}`);
            if (elem.href) this.log(`        href="${elem.href}"`);
          });

          this.log(`\n   Page content (first 800 chars):`);
          this.log(`   ${allClickableElements.bodyText.substring(0, 800)}`);

          throw new Error('Could not find "Document Image" button on clerk detail page');
        }
      }

      this.log(`⚠️ Could not click table entry: ${tableEntryClicked.reason}`);

      // Fallback: Look for PDF link or view button directly
      const pdfLinkFound = await this.page.evaluate(() => {
        // Look for direct PDF links first
        const allLinks = Array.from(document.querySelectorAll('a'));
        const foundLinks = [];

        for (const link of allLinks) {
          const href = link.href || '';
          const text = (link.textContent || '').toLowerCase().trim();

          // Collect info about all interesting links
          if (text.length > 0 && text.length < 100) {
            foundLinks.push({ text: text.substring(0, 50), href: href.substring(0, 100) });
          }

          // Direct PDF link
          if (href.includes('.pdf') || href.includes('/pdf')) {
            return { found: true, type: 'pdf-link', url: href, foundLinks };
          }

          // View/Image buttons that might open PDF
          if (text.includes('view') || text.includes('image') || text.includes('document')) {
            return { found: true, type: 'view-link', url: href, text: text.substring(0, 50), foundLinks };
          }

          // Check for thumbnail images or clickable icons
          if (href.includes('ViewDocument') || href.includes('GetDocument')) {
            return { found: true, type: 'document-link', url: href, foundLinks };
          }
        }

        // Look for image thumbnails or icons that might be clickable
        const images = Array.from(document.querySelectorAll('img'));
        for (const img of images) {
          const parent = img.parentElement;
          const alt = (img.alt || '').toLowerCase();

          // Check if image itself or parent is clickable
          if (parent && parent.tagName === 'A') {
            const href = parent.href || '';
            // Look for view/document links or thumbnail images
            if (href && (href.includes('view') || href.includes('document') || href.includes('image') ||
                        alt.includes('view') || alt.includes('thumbnail') || alt.includes('document'))) {
              return { found: true, type: 'image-link', url: href, alt, foundLinks };
            }
          }

          // Also check for any image with "thumbnail" or "document" in alt
          if (alt.includes('thumbnail') || alt.includes('document') || alt.includes('image')) {
            // Try clicking the image itself
            if (parent && parent.tagName === 'A') {
              return { found: true, type: 'thumbnail-link', url: parent.href, alt, foundLinks };
            }
          }
        }

        // Look for any clickable elements in tables (common for search results)
        const tableLinks = Array.from(document.querySelectorAll('table a'));
        if (tableLinks.length > 0) {
          // Get first table link
          const firstLink = tableLinks[0];
          const href = firstLink.href || '';
          const text = (firstLink.textContent || '').trim();
          if (href && text) {
            return { found: true, type: 'table-link', url: href, text: text.substring(0, 50), foundLinks };
          }
        }

        return { found: false, foundLinks };
      });

      if (!pdfLinkFound.found) {
        this.log('⚠️ No PDF or view link found on clerk\'s search results');
        throw new Error('Could not find PDF link on clerk search results page');
      }

      this.log(`✅ Found ${pdfLinkFound.type}: ${pdfLinkFound.url || pdfLinkFound.text}`);

      // Navigate to the PDF or view page
      if (pdfLinkFound.url) {
        await this.page.goto(pdfLinkFound.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomWait(3000, 5000);
      }

      // Now try to download the PDF
      const pdfUrl = this.page.url();
      this.log(`📍 PDF URL: ${pdfUrl}`);

      // If we're not directly at a PDF, look for one
      if (!pdfUrl.includes('.pdf')) {
        const pdfFound = await this.page.evaluate(() => {
          // Look for iframe with PDF
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const iframe of iframes) {
            const src = iframe.src || '';
            if (src.includes('.pdf') || src.includes('/pdf')) {
              return { found: true, url: src };
            }
          }

          // Look for PDF links
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const href = link.href || '';
            if (href.includes('.pdf')) {
              return { found: true, url: href };
            }
          }

          return { found: false };
        });

        if (!pdfFound.found) {
          throw new Error('Could not locate PDF on clerk page');
        }

        this.log(`✅ Found PDF: ${pdfFound.url}`);
        await this.page.goto(pdfFound.url, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomWait(2000, 3000);
      }

      // Download the PDF
      this.log('📥 Downloading PDF...');
      const pdfBuffer = await this.page.evaluate(async () => {
        const response = await fetch(window.location.href);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      });

      const buffer = Buffer.from(pdfBuffer);

      // Verify it's a PDF
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${buffer.length} bytes)`);

      // Save PDF to disk
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      const filename = `miami-dade_deed_${transaction.officialRecordBook}_${transaction.pageNumber}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, buffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        filepath,
        downloadPath,
        officialRecordBook: transaction.officialRecordBook,
        pageNumber: transaction.pageNumber,
        timestamp: new Date().toISOString(),
        fileSize: buffer.length,
        fileSizeKB: (buffer.length / 1024).toFixed(2)
      };

    } catch (error) {
      this.log(`❌ Failed to download from clerk page: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper method to find and download PDF from current page
   */
  async findAndDownloadPDF(transaction) {
    this.log('🔍 Looking for PDF or document view button...');

    try {
      await this.randomWait(3000, 5000);

      // PRIORITY 1: If we captured a PDF URL from network monitoring, use it directly
      if (transaction.pdfUrl) {
        this.log(`🎯 Using PDF URL from network capture: ${transaction.pdfUrl.substring(0, 150)}`);

        // Download using the Orange County method (HTTPS with cookies)
        const path = require('path');
        const fs = require('fs');
        const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
        const downloadPath = path.resolve(relativePath);

        if (!fs.existsSync(downloadPath)) {
          fs.mkdirSync(downloadPath, { recursive: true });
          this.log(`📁 Created download directory: ${downloadPath}`);
        }

        const filename = `miami-dade_deed_${transaction.officialRecordBook}_${transaction.pageNumber}_${Date.now()}.pdf`;
        const filepath = path.join(downloadPath, filename);

        const cookies = await this.page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const https = require('https');
        const url = require('url');
        const parsedUrl = url.parse(transaction.pdfUrl);

        this.log(`🔄 Downloading PDF from captured URL...`);

        return await new Promise((resolve, reject) => {
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
              'Cookie': cookieString,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'application/pdf,image/*,*/*',
              'Referer': this.page.url(),
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 60000
          };

          const req = https.request(options, (res) => {
            this.log(`📥 Response: ${res.statusCode} ${res.statusMessage}`);
            this.log(`   Content-Type: ${res.headers['content-type']}`);

            if (res.statusCode === 200) {
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => {
                const buffer = Buffer.concat(chunks);

                // Check if it's a PDF or image
                const header = buffer.slice(0, 5).toString();
                const isPDF = header === '%PDF-';
                const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50;
                const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;

                if (isPDF) {
                  fs.writeFileSync(filepath, buffer);
                  this.log(`✅ PDF downloaded: ${filepath} (${(buffer.length / 1024).toFixed(2)} KB)`);

                  resolve({
                    success: true,
                    filename,
                    downloadPath,
                    filepath,
                    officialRecordBook: transaction.officialRecordBook,
                    pageNumber: transaction.pageNumber,
                    fileSize: buffer.length,
                    pdfBase64: buffer.toString('base64')
                  });
                } else if (isPNG || isJPEG) {
                  const imageExt = isPNG ? 'png' : 'jpg';
                  const imageFilename = filename.replace('.pdf', `.${imageExt}`);
                  const imageFilepath = path.join(downloadPath, imageFilename);
                  fs.writeFileSync(imageFilepath, buffer);
                  this.log(`✅ Image downloaded: ${imageFilepath} (${(buffer.length / 1024).toFixed(2)} KB)`);
                  this.log(`ℹ️  Note: Downloaded image file, not PDF. May need conversion.`);

                  resolve({
                    success: true,
                    filename: imageFilename,
                    downloadPath,
                    filepath: imageFilepath,
                    isImage: true,
                    imageType: imageExt,
                    fileSize: buffer.length,
                    message: 'Downloaded as image file (not PDF)'
                  });
                } else {
                  this.log(`❌ Response is not a PDF or image (header: ${header}, first bytes: ${buffer.slice(0, 20).toString('hex')})`);
                  reject(new Error('Downloaded content is not a PDF or image'));
                }
              });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          });

          req.on('error', (err) => reject(err));
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });

          req.end();
        });
      }

      // STRATEGY 2: Like Orange County, look for iframe with embedded PDF first
      this.log('🔍 Checking for PDF in iframe (Orange County method)...');

      const iframeDownload = await this.page.evaluate(() => {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          if (iframe.src && (iframe.src.includes('pdf') || iframe.src.includes('document') || iframe.src.includes('.pdf'))) {
            // Found PDF iframe, return the src
            return { found: true, src: iframe.src };
          }
        }
        return { found: false };
      });

      if (iframeDownload.found) {
        this.log(`📄 Found PDF in iframe: ${iframeDownload.src}`);

        // Download PDF using Orange County's method: Node.js https with cookies
        const path = require('path');
        const fs = require('fs');
        const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
        const downloadPath = path.resolve(relativePath);

        // Ensure download directory exists
        if (!fs.existsSync(downloadPath)) {
          fs.mkdirSync(downloadPath, { recursive: true });
          this.log(`📁 Created download directory: ${downloadPath}`);
        }

        const filename = `miami-dade_deed_${transaction.officialRecordBook}_${transaction.pageNumber}_${Date.now()}.pdf`;
        const filepath = path.join(downloadPath, filename);

        // Get cookies from current page session
        const cookies = await this.page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        this.log(`📋 Using ${cookies.length} cookies from session`);

        // Download PDF using Node.js https module (Orange County method)
        const https = require('https');
        const url = require('url');
        const pdfUrl = iframeDownload.src;
        const parsedUrl = url.parse(pdfUrl);

        this.log(`🔄 Downloading PDF using https module with session cookies...`);

        return await new Promise((resolve, reject) => {
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
              'Cookie': cookieString,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/pdf,*/*',
              'Referer': this.page.url(),
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 60000
          };

          this.log(`🌐 GET ${pdfUrl}`);

          const req = https.request(options, (res) => {
            this.log(`📥 Response: ${res.statusCode} ${res.statusMessage}`);
            this.log(`   Content-Type: ${res.headers['content-type']}`);
            this.log(`   Content-Length: ${res.headers['content-length']}`);

            if (res.statusCode === 200) {
              const chunks = [];

              res.on('data', (chunk) => {
                chunks.push(chunk);
              });

              res.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);

                // Verify it's actually a PDF
                const header = pdfBuffer.slice(0, 5).toString();
                if (header !== '%PDF-') {
                  this.log(`❌ Response is not a PDF (header: ${header})`);
                  this.log(`   First 100 bytes: ${pdfBuffer.slice(0, 100).toString()}`);
                  reject(new Error('Downloaded content is not a PDF file'));
                  return;
                }

                // Save the PDF
                fs.writeFileSync(filepath, pdfBuffer);

                this.log(`✅ PDF downloaded and saved to: ${filepath}`);
                this.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

                // Convert to base64 for API response
                const pdfBase64 = pdfBuffer.toString('base64');

                resolve({
                  success: true,
                  filename,
                  downloadPath: downloadPath,
                  filepath,
                  officialRecordBook: transaction.officialRecordBook,
                  pageNumber: transaction.pageNumber,
                  timestamp: new Date().toISOString(),
                  fileSize: pdfBuffer.length,
                  fileSizeKB: (pdfBuffer.length / 1024).toFixed(2),
                  pdfBase64: pdfBase64
                });
              });
            } else if (res.statusCode === 302 || res.statusCode === 301) {
              reject(new Error(`Redirect to: ${res.headers.location}`));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          });

          req.on('error', (err) => {
            this.log(`❌ Request error: ${err.message}`);
            reject(err);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout after 60 seconds'));
          });

          req.end();
        });
      }

      // FALLBACK: If no iframe, look for download button or PDF source after Document Image is clicked
      this.log('🔍 No iframe found, looking for download button or PDF source...');

      // Wait a bit more for PDF viewer to fully render
      await this.randomWait(2000, 3000);

      const pdfLinkFound = await this.page.evaluate(() => {
        const allElements = [
          ...Array.from(document.querySelectorAll('a')),
          ...Array.from(document.querySelectorAll('button')),
          ...Array.from(document.querySelectorAll('input[type="button"]')),
          ...Array.from(document.querySelectorAll('[onclick]')),
          ...Array.from(document.querySelectorAll('img')),
          ...Array.from(document.querySelectorAll('[class*="download"]')),
          ...Array.from(document.querySelectorAll('[id*="download"]')),
          ...Array.from(document.querySelectorAll('[title*="download"]'))
        ];

        for (const elem of allElements) {
          const href = elem.href || elem.src || '';
          const text = (elem.textContent || elem.alt || elem.value || elem.title || '').toLowerCase();
          const onclick = elem.getAttribute('onclick') || '';
          const className = elem.className || '';
          const id = elem.id || '';

          // Direct PDF link
          if (href.includes('.pdf') || href.includes('/pdf/') || href.includes('documentimage')) {
            elem.click();
            return { found: true, type: 'pdf-link', url: href, clicked: true };
          }

          // Download button patterns
          if (text.includes('download') || text.includes('save') ||
              className.includes('download') || id.includes('download') ||
              onclick.includes('download')) {
            elem.click();
            return { found: true, type: 'download-button', text: text.substring(0, 50), clicked: true };
          }

          // Print button (can use to get PDF)
          if (text.includes('print') && !text.includes('record info')) {
            return { found: true, type: 'print-button', element: elem, text: text.substring(0, 50), clicked: false };
          }
        }

        // Check for PDF.js viewer
        const pdfJsViewer = document.querySelector('[class*="pdfViewer"], [id*="viewer"], [data-pdf-url]');
        if (pdfJsViewer) {
          const pdfUrl = pdfJsViewer.getAttribute('data-pdf-url') || pdfJsViewer.getAttribute('src');
          if (pdfUrl) {
            return { found: true, type: 'pdfjs-viewer', url: pdfUrl };
          }
        }

        return { found: false };
      });

      if (!pdfLinkFound.found) {
        // Try looking for network requests that fetched PDF data
        this.log('⚠️ No download button found, checking page source for PDF URLs...');

        const pageSource = await this.page.evaluate(() => {
          // Look in page HTML for any URLs containing PDF or document image endpoints
          const html = document.documentElement.innerHTML;
          const pdfUrls = [];

          // Common PDF URL patterns
          const patterns = [
            /https?:\/\/[^\s"']+\.pdf/gi,
            /https?:\/\/[^\s"']+\/pdf\/[^\s"']*/gi,
            /https?:\/\/[^\s"']+documentimage[^\s"']*/gi,
            /https?:\/\/[^\s"']+document\/[^\s"']*/gi,
            /blob:[^\s"']+/gi
          ];

          patterns.forEach(pattern => {
            const matches = html.match(pattern);
            if (matches) {
              pdfUrls.push(...matches);
            }
          });

          return {
            found: pdfUrls.length > 0,
            urls: pdfUrls.slice(0, 5),  // Return first 5 URLs
            pageHasContent: html.length
          };
        });

        if (pageSource.found && pageSource.urls.length > 0) {
          this.log(`✅ Found ${pageSource.urls.length} potential PDF URL(s) in page source:`);
          pageSource.urls.forEach((url, i) => {
            this.log(`   ${i + 1}. ${url.substring(0, 100)}`);
          });
          pdfLinkFound.found = true;
          pdfLinkFound.type = 'source-url';
          pdfLinkFound.url = pageSource.urls[0];  // Try first URL
        } else {
          // Miami-Dade County Clerk appears to require registration/login or uses client-side rendering
          this.log('⚠️ IMPORTANT: Could not find PDF download button or source URL');
          this.log('   The PDF viewer may use client-side rendering or require authentication');
          this.log(`   Current page URL: ${this.page.url()}`);
          throw new Error('Miami-Dade Clerk: Cannot find PDF download method. The PDF viewer may be using client-side rendering.');
        }
      }

      this.log(`✅ Found ${pdfLinkFound.type}`);

      // If we clicked something, wait for response
      if (pdfLinkFound.clicked) {
        this.log(`✅ Clicked ${pdfLinkFound.type}, waiting for download/navigation...`);
        await this.randomWait(3000, 5000);
      }

      // Check for new window/tab
      const pages = await this.browser.pages();
      let pdfPage = this.page;

      if (pages.length > this.browser.pages().length) {
        pdfPage = pages[pages.length - 1];
        this.log('✅ Found new window with PDF');
      }

      // Get PDF URL
      const pdfUrl = pdfPage.url();
      this.log(`📍 PDF URL: ${pdfUrl}`);

      // Download PDF
      this.log('📥 Downloading PDF...');
      const pdfBuffer = await pdfPage.evaluate(async () => {
        const response = await fetch(window.location.href);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer));
      });

      const buffer = Buffer.from(pdfBuffer);

      // Verify it's a PDF
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${buffer.length} bytes)`);

      // Save PDF
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      const filename = `miami-dade_deed_${transaction.officialRecordBook}_${transaction.pageNumber}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, buffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      // Close PDF page if it's different
      if (pdfPage !== this.page) {
        await pdfPage.close();
      }

      return {
        success: true,
        filename,
        filepath,
        downloadPath,
        officialRecordBook: transaction.officialRecordBook,
        pageNumber: transaction.pageNumber,
        timestamp: new Date().toISOString(),
        fileSize: buffer.length,
        fileSizeKB: (buffer.length / 1024).toFixed(2)
      };

    } catch (error) {
      this.log(`❌ Failed to find/download PDF: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fallback method: Download deed from Miami-Dade Clerk website
   * Used when Property Appraiser link is not clickable
   */
  async downloadDeedFromClerk(transaction) {
    this.log('📄 Downloading deed from Miami-Dade County Clerk website...');

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
