/**
 * Miami-Dade County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.miamidadepa.gov/pa/home.page (Correct URL)
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
      this.log(`🌐 Navigating to assessor: https://www.miamidadepa.gov/pa/home.page`);

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
        assessorUrl: 'https://www.miamidadepa.gov/pa/home.page',
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
      return 'https://www.miamidadepa.gov/pa/home.page';
    }
    return null;
  }

  /**
   * Search Miami-Dade County Property Appraiser by address
   * URL: https://www.miamidadepa.gov/pa/home.page
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
