/**
 * Dallas County, Texas - Deed Scraper Implementation
 *
 * County Resources:
 * - Appraisal District: https://www.dallascad.org/AcctDetailRes.aspx?ID={account_id}
 * - Deed Search: https://dallas.tx.publicsearch.us/
 *
 * Workflow:
 * 1. Search property by address on Dallas CAD (Dallas Central Appraisal District)
 * 2. Extract legal description (line 4) - find INT202400152203 number or Vol/book/page number
 * 3. Go to deed search page: https://dallas.tx.publicsearch.us/
 * 4. Search by instrument number (without "INT" prefix) or advanced search with Vol/book/page
 * 5. Download deed PDF
 *
 * Example:
 * - Address: 123 Main St, Dallas, TX
 * - Legal Desc: INT202400152203 or Vol 12345 Page 678
 * - Search: 202400152203 (without INT) or advanced search with book/page
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class DallasCountyTexasScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Dallas';
    this.state = 'TX';
  }

  /**
   * Override log method for visibility
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
      protocolTimeout: 300000,
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

    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });

    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    this.log('✅ Browser initialized');
  }

  /**
   * Search Dallas CAD for property by address
   * Returns legal description with instrument number or book/page
   */
  async searchDallasCAD(address) {
    this.log(`🔍 Searching Dallas CAD for: ${address}`);

    try {
      // Navigate to Dallas CAD property search
      this.log('📍 Loading Dallas CAD property search...');
      await this.page.goto('https://www.dallascad.org/SearchAddr.aspx', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(2000, 3000);

      // Find and fill address search inputs
      this.log('📝 Parsing and entering address...');

      // Debug: Log all input elements on the page
      const allInputs = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className
        }));
      });
      this.log(`🔍 Found ${allInputs.length} input fields on page:`);
      this.log(JSON.stringify(allInputs, null, 2));

      // Parse address into components
      // Example: "7012 Duffield Ct, Dallas, TX 75248" -> number: 7012, street: Duffield (without Ct)
      // Remove city, state, ZIP, and country
      let cleanAddress = address
        .replace(/,?\s*Dallas\s*,?\s*TX\s*\d{5}?\s*/gi, '') // Remove "Dallas, TX 75248"
        .replace(/,?\s*Dallas\s*,?\s*TX\s*/gi, '')          // Remove "Dallas, TX"
        .replace(/,?\s*USA\s*/gi, '')                        // Remove "USA"
        .replace(/,\s*$/g, '')                               // Remove trailing comma
        .trim();
      this.log(`🧹 Cleaned address: ${cleanAddress}`);

      // List of common street type suffixes to remove
      const streetTypes = ['St', 'Street', 'Ave', 'Avenue', 'Blvd', 'Boulevard', 'Dr', 'Drive',
                          'Ct', 'Court', 'Ln', 'Lane', 'Rd', 'Road', 'Way', 'Pl', 'Place',
                          'Cir', 'Circle', 'Ter', 'Terrace', 'Pkwy', 'Parkway', 'Trl', 'Trail'];

      // Parse components
      const addressMatch = cleanAddress.match(/^(\d+)\s+(.+?)(?:\s+(?:Apt|Suite|Unit|#)\s*(.+))?$/i);

      let addressNumber = '';
      let streetName = '';
      let suite = '';

      if (addressMatch) {
        addressNumber = addressMatch[1];
        let fullStreetName = addressMatch[2];
        suite = addressMatch[3] || '';

        // Remove street type suffix from street name
        const streetNameParts = fullStreetName.split(/\s+/);
        const lastPart = streetNameParts[streetNameParts.length - 1];

        // Check if last part is a street type suffix
        if (streetTypes.some(type => type.toLowerCase() === lastPart.toLowerCase())) {
          // Remove the suffix
          streetName = streetNameParts.slice(0, -1).join(' ');
          this.log(`🧹 Removed street type suffix "${lastPart}" from street name`);
        } else {
          streetName = fullStreetName;
        }

        this.log(`📍 Parsed - Number: ${addressNumber}, Street: ${streetName}, Suite: ${suite || 'N/A'}`);
      } else {
        // Fallback: just split on first space and remove street type
        const parts = cleanAddress.split(/\s+/);
        addressNumber = parts[0] || '';

        const streetParts = parts.slice(1);
        const lastPart = streetParts[streetParts.length - 1];

        if (streetTypes.some(type => type.toLowerCase() === lastPart?.toLowerCase())) {
          streetName = streetParts.slice(0, -1).join(' ');
        } else {
          streetName = streetParts.join(' ');
        }

        this.log(`📍 Fallback parse - Number: ${addressNumber}, Street: ${streetName}`);
      }

      // Try to find address number input
      const numberInputSelectors = [
        '#txtAddrNum',           // Exact ID from Dallas CAD
        'input[name="txtAddrNum"]',
        'input[name*="AddrNum"]',
        'input[id*="AddrNum"]',
        'input[name*="Number"]',
        'input[name*="number"]',
        'input[id*="Number"]',
        'input[id*="number"]',
        'input[name*="Num"]',
        'input[id*="Num"]',
        'input[placeholder*="Number"]'
      ];

      let numberInput = null;
      for (const selector of numberInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          numberInput = selector;
          this.log(`✅ Found number input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (numberInput) {
        await this.page.type(numberInput, addressNumber, { delay: 100 });
        this.log(`✅ Entered address number: ${addressNumber}`);
      } else {
        this.log('⚠️ Could not find address number input');
      }

      // Try to find street name input
      const streetInputSelectors = [
        '#txtStName',            // Exact ID from Dallas CAD
        'input[name="txtStName"]',
        'input[name*="StName"]',
        'input[id*="StName"]',
        'input[name*="Street"]',
        'input[name*="street"]',
        'input[id*="Street"]',
        'input[id*="street"]',
        'input[name*="Name"]',
        'input[placeholder*="Street"]',
        'input[placeholder*="street"]'
      ];

      let streetInput = null;
      for (const selector of streetInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          streetInput = selector;
          this.log(`✅ Found street input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (streetInput) {
        await this.page.type(streetInput, streetName, { delay: 100 });
        this.log(`✅ Entered street name: ${streetName}`);
      } else {
        this.log('⚠️ Could not find street name input');
      }

      // Try to find suite/unit input (optional)
      if (suite) {
        const suiteInputSelectors = [
          '#txtUnitID',            // Exact ID from Dallas CAD
          'input[name="txtUnitID"]',
          'input[name*="UnitID"]',
          'input[id*="UnitID"]',
          'input[name*="Suite"]',
          'input[name*="suite"]',
          'input[id*="Suite"]',
          'input[id*="suite"]',
          'input[name*="Unit"]',
          'input[id*="Unit"]',
          'input[placeholder*="Suite"]',
          'input[placeholder*="Unit"]'
        ];

        let suiteInput = null;
        for (const selector of suiteInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            suiteInput = selector;
            this.log(`✅ Found suite input: ${selector}`);
            break;
          } catch (e) {
            // Try next
          }
        }

        if (suiteInput) {
          await this.page.type(suiteInput, suite, { delay: 100 });
          this.log(`✅ Entered suite: ${suite}`);
        } else {
          this.log('⚠️ Suite/Unit input not found (might be optional)');
        }
      }

      // Verify at least one input was filled
      if (!numberInput && !streetInput) {
        throw new Error('Could not find address number or street name inputs on Dallas CAD page');
      }

      await this.randomWait(1000, 2000);

      // Submit search
      this.log('🔍 Submitting search...');
      const searchButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search"]',
        '#ctl00_cphContent_btnSearch'
      ];

      let searchButton = null;
      for (const selector of searchButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchButton = selector;
          this.log(`✅ Found search button: ${selector}`);
          break;
        } catch (e) {
          this.log(`⚠️ Button ${selector} not found`);
        }
      }

      if (!searchButton) {
        // Try pressing Enter as fallback
        this.log('⚠️ No search button found, trying Enter key');
        await this.page.keyboard.press('Enter');
      } else {
        await this.page.click(searchButton);
      }

      // Wait for results
      this.log('⏳ Waiting for search results...');
      await this.randomWait(3000, 5000);
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        this.log('⚠️ Navigation timeout, checking if results loaded...');
      });

      // Click on first result or extract account ID from results
      this.log('📋 Looking for property account...');

      // Debug: check what's on the results page
      const resultsDebug = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          bodySnippet: document.body.innerText.substring(0, 300),
          links: Array.from(document.querySelectorAll('a[href*="AcctDetail"]')).map(a => ({
            href: a.href,
            text: a.textContent?.trim()
          })).slice(0, 5)
        };
      });
      this.log(`📍 Results page URL: ${resultsDebug.url}`);
      this.log(`📄 Results snippet: ${resultsDebug.bodySnippet}`);
      this.log(`🔗 Account links found: ${JSON.stringify(resultsDebug.links, null, 2)}`);

      // Try to find account number in the first row of results
      const accountInfo = await this.page.evaluate(() => {
        // Look for table rows with account information
        const rows = Array.from(document.querySelectorAll('table tr, .result-row'));

        for (const row of rows) {
          const text = row.textContent || '';

          // Look for account number pattern (usually starts with specific digits for Dallas)
          const accountMatch = text.match(/\b(\d{17,23})\b/); // Dallas account numbers are typically long
          if (accountMatch) {
            return {
              accountNumber: accountMatch[1],
              rowText: text.substring(0, 200)
            };
          }

          // Also check for links to account detail pages
          const link = row.querySelector('a[href*="AcctDetailRes.aspx"], a[href*="ID="]');
          if (link) {
            const href = link.getAttribute('href');
            const idMatch = href?.match(/ID=([^&]+)/);
            if (idMatch) {
              return {
                accountNumber: idMatch[1],
                linkHref: href
              };
            }
          }
        }

        return null;
      });

      if (accountInfo) {
        this.log(`✅ Found account: ${accountInfo.accountNumber}`);
        if (accountInfo.linkHref) {
          this.log(`🔗 Account link: ${accountInfo.linkHref}`);
        }

        // Navigate directly to the account detail page
        const accountUrl = `https://www.dallascad.org/AcctDetailRes.aspx?ID=${accountInfo.accountNumber}`;
        this.log(`📍 Navigating to: ${accountUrl}`);
        await this.page.goto(accountUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        // Fallback: try clicking on first link
        this.log('⚠️ Could not extract account number, trying link click...');

        const accountLinkSelectors = [
          'a[href*="AcctDetailRes.aspx"]',
          'a[href*="ID="]',
          'table a',
          '.result-row a'
        ];

        let accountLink = null;
        for (const selector of accountLinkSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            accountLink = selector;
            this.log(`✅ Found account link: ${selector}`);
            break;
          } catch (e) {
            this.log(`⚠️ Link ${selector} not found`);
          }
        }

        if (!accountLink) {
          throw new Error('Could not find property account link in search results');
        }

        // Click on account link to view property details
        await this.page.click(accountLink);
        this.log('✅ Clicked on account link');
      }

      // Wait for property detail page
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        this.log('⚠️ Navigation timeout, checking if page loaded...');
      });
      await this.randomWait(2000, 3000);

      // Extract legal description (line 4 contains instrument number or book/page)
      this.log('📄 Extracting legal description...');

      // First, debug: log the current page URL and title
      const pageInfo = await this.page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodySnippet: document.body.innerText.substring(0, 500)
      }));
      this.log(`📍 Page URL: ${pageInfo.url}`);
      this.log(`📄 Page title: ${pageInfo.title}`);
      this.log(`📝 Page snippet: ${pageInfo.bodySnippet}`);

      const legalDescData = await this.page.evaluate(() => {
        let legalDescText = null;
        let debugInfo = [];

        // Filter out script tags, style tags, and navigation elements
        const excludeSelectors = 'script, style, noscript, #header, #nav, .navigation, [class*="nav"]';

        // Strategy 1: Direct search for INT or book/page patterns in table cells only
        debugInfo.push('Strategy 1: Searching table cells for deed patterns...');
        const tableCells = Array.from(document.querySelectorAll('table td')).filter(td => {
          return !td.closest(excludeSelectors);
        });

        for (const cell of tableCells) {
          const text = (cell.textContent || '').trim();
          // Skip very short or very long texts (likely not legal desc)
          if (text.length < 10 || text.length > 1000) continue;

          // Look for INT pattern or Vol/Page pattern
          if (text.match(/INT\d{12,}/i) || text.match(/Vol\s*\d+.*?Page\s*\d+/i) ||
              text.match(/Book\s*\d+.*?Page\s*\d+/i)) {
            legalDescText = text;
            debugInfo.push(`Found deed reference in table cell: "${text.substring(0, 150)}"`);
            break;
          }
        }

        // Strategy 2: Look for specific label + value pattern in table rows
        if (!legalDescText) {
          debugInfo.push('Strategy 2: Looking for Legal Description label in tables...');
          const tables = Array.from(document.querySelectorAll('table')).filter(t => {
            return !t.closest(excludeSelectors);
          });

          for (const table of tables) {
            const rows = Array.from(table.querySelectorAll('tr'));

            for (let i = 0; i < rows.length; i++) {
              const cells = Array.from(rows[i].querySelectorAll('td, th'));

              // Look for a cell containing "Legal"
              for (let j = 0; j < cells.length; j++) {
                const cellText = (cells[j].textContent || '').trim();

                if (cellText.match(/Legal\s*(Description|Desc)/i) && cellText.length < 50) {
                  debugInfo.push(`Found label in cell: "${cellText}"`);

                  // Try next cell in same row
                  if (j + 1 < cells.length) {
                    const valueText = (cells[j + 1].textContent || '').trim();
                    if (valueText && valueText.length > 10) {
                      legalDescText = valueText;
                      debugInfo.push(`Found value in next cell: "${valueText.substring(0, 150)}"`);
                      break;
                    }
                  }

                  // Try cells in next row
                  if (i + 1 < rows.length) {
                    const nextRowCells = Array.from(rows[i + 1].querySelectorAll('td'));
                    if (nextRowCells.length > 0) {
                      const nextRowText = nextRowCells.map(c => c.textContent?.trim()).join(' ');
                      if (nextRowText && nextRowText.length > 10) {
                        legalDescText = nextRowText;
                        debugInfo.push(`Found value in next row: "${nextRowText.substring(0, 150)}"`);
                        break;
                      }
                    }
                  }
                }
              }

              if (legalDescText) break;
            }

            if (legalDescText) break;
          }
        }

        // Strategy 3: Search all visible text content for deed patterns (last resort)
        if (!legalDescText) {
          debugInfo.push('Strategy 3: Searching all page content...');
          const bodyText = document.body.innerText;
          const lines = bodyText.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length < 20 || trimmed.length > 500) continue;

            if (trimmed.match(/INT\d{12,}/i) || trimmed.match(/Vol\s*\d+.*?Page\s*\d+/i)) {
              legalDescText = trimmed;
              debugInfo.push(`Found in page text: "${trimmed.substring(0, 150)}"`);
              break;
            }
          }
        }

        // Extract instrument number (INT prefix + numbers) or book/page
        let instrumentNumber = null;
        let bookNumber = null;
        let pageNumber = null;

        if (legalDescText) {
          // Try to extract INT number
          const intMatch = legalDescText.match(/INT(\d+)/);
          if (intMatch) {
            instrumentNumber = intMatch[1]; // without "INT" prefix
          }

          // Try to extract Book/Page
          const bookPageMatch = legalDescText.match(/Vol(?:ume)?\s*(\d+).*?Page\s*(\d+)/i);
          if (bookPageMatch) {
            bookNumber = bookPageMatch[1];
            pageNumber = bookPageMatch[2];
          }
        }

        return {
          legalDescription: legalDescText,
          instrumentNumber,
          bookNumber,
          pageNumber,
          pageUrl: window.location.href,
          debugInfo
        };
      });

      // Log debug information
      if (legalDescData.debugInfo && legalDescData.debugInfo.length > 0) {
        this.log(`🔍 Debug info:\n  ${legalDescData.debugInfo.join('\n  ')}`);
      }

      if (!legalDescData.instrumentNumber && !legalDescData.bookNumber) {
        this.log(`⚠️ Legal description found: ${legalDescData.legalDescription ? 'YES' : 'NO'}`);
        if (legalDescData.legalDescription) {
          this.log(`📄 Legal description text: ${legalDescData.legalDescription.substring(0, 200)}`);
        }
        throw new Error('Could not extract instrument number or book/page from legal description');
      }

      this.log(`✅ Legal Description: ${legalDescData.legalDescription}`);
      if (legalDescData.instrumentNumber) {
        this.log(`✅ Instrument Number: ${legalDescData.instrumentNumber}`);
      }
      if (legalDescData.bookNumber && legalDescData.pageNumber) {
        this.log(`✅ Book/Page: ${legalDescData.bookNumber}/${legalDescData.pageNumber}`);
      }

      return {
        success: true,
        ...legalDescData
      };

    } catch (error) {
      this.log(`❌ Error searching Dallas CAD: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download deed from Dallas County Public Search
   * Uses instrument number or book/page from legal description
   */
  async downloadDeed(searchData) {
    this.log(`📥 Downloading deed from Dallas County Public Search...`);

    try {
      // Navigate to public search page
      this.log('📍 Loading Dallas County Public Search...');
      await this.page.goto('https://dallas.tx.publicsearch.us/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(2000, 3000);

      // Determine search method: instrument number or advanced search (book/page)
      if (searchData.instrumentNumber) {
        this.log(`🔍 Searching by instrument number: ${searchData.instrumentNumber}`);

        // Take a screenshot of the search page to understand the interface
        const searchPageScreenshot = `/tmp/dallas-search-page-${Date.now()}.png`;
        await this.page.screenshot({ path: searchPageScreenshot, fullPage: true });
        this.log(`📸 Search page screenshot: ${searchPageScreenshot}`);

        // Log all input fields on the page
        const allInputs = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('input, select, textarea')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            value: input.value,
            tagName: input.tagName
          }));
        });
        this.log(`📝 All form inputs on page: ${JSON.stringify(allInputs, null, 2)}`);

        // Find search input - be more specific about instrument/document number fields
        const searchInputSelectors = [
          'input[name*="instrumentNumber"]',
          'input[id*="instrumentNumber"]',
          'input[name*="instrument"]',
          'input[id*="instrument"]',
          'input[name*="docNumber"]',
          'input[id*="docNumber"]',
          'input[name*="documentNumber"]',
          'input[id*="documentNumber"]',
          'input[placeholder*="instrument"]',
          'input[placeholder*="document"]',
          'input[name*="query"]',
          'input[id*="query"]',
          'input[type="search"]',
          'input[type="text"]'  // Fallback - least specific
        ];

        let searchInput = null;
        let searchInputInfo = null;

        for (const selector of searchInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 3000 });

            // Get info about this input
            searchInputInfo = await this.page.evaluate((sel) => {
              const input = document.querySelector(sel);
              if (!input) return null;
              return {
                selector: sel,
                name: input.name,
                id: input.id,
                placeholder: input.placeholder,
                type: input.type
              };
            }, selector);

            if (searchInputInfo) {
              searchInput = selector;
              this.log(`✅ Found search input: ${selector}`);
              this.log(`   Input details: ${JSON.stringify(searchInputInfo)}`);
              break;
            }
          } catch (e) {
            this.log(`⚠️ Selector ${selector} not found`);
          }
        }

        if (!searchInput) {
          throw new Error('Could not find search input on public search page');
        }

        // Clear any existing value first
        await this.page.evaluate((sel) => {
          const input = document.querySelector(sel);
          if (input) input.value = '';
        }, searchInput);

        // Enter instrument number (without INT prefix)
        await this.page.type(searchInput, searchData.instrumentNumber, { delay: 100 });
        this.log(`✅ Entered instrument number: ${searchData.instrumentNumber}`);

        // Verify the value was entered
        const enteredValue = await this.page.evaluate((sel) => {
          const input = document.querySelector(sel);
          return input ? input.value : null;
        }, searchInput);
        this.log(`✅ Verified input value: ${enteredValue}`);

        await this.randomWait(1000, 2000);

        // Submit search - look for submit button or press Enter
        this.log('🔍 Submitting search...');

        // Try to find and click submit button first
        const submitButtonSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:has-text("Search")',
          'button:has-text("Submit")',
          'button[onclick*="search"]'
        ];

        let submitButtonClicked = false;
        for (const selector of submitButtonSelectors) {
          try {
            const button = await this.page.$(selector);
            if (button) {
              this.log(`✅ Found submit button: ${selector}`);
              await button.click();
              submitButtonClicked = true;
              break;
            }
          } catch (e) {
            // Continue trying
          }
        }

        if (!submitButtonClicked) {
          this.log('⚠️ No submit button found, pressing Enter');
          await this.page.keyboard.press('Enter');
        }

      } else if (searchData.bookNumber && searchData.pageNumber) {
        this.log(`🔍 Using advanced search with Book: ${searchData.bookNumber}, Page: ${searchData.pageNumber}`);

        // Click on Advanced Search link
        const advancedSearchSelectors = [
          'a:contains("Advanced")',
          'a[href*="advanced"]',
          'button:contains("Advanced")'
        ];

        let advancedLink = null;
        for (const selector of advancedSearchSelectors) {
          try {
            const element = await this.page.$(selector);
            if (element) {
              advancedLink = element;
              break;
            }
          } catch (e) {
            this.log(`⚠️ Advanced search ${selector} not found`);
          }
        }

        if (advancedLink) {
          await advancedLink.click();
          await this.randomWait(1000, 2000);
        }

        // Fill in book and page numbers
        const bookInputSelectors = ['input[name*="book"]', 'input[id*="book"]'];
        const pageInputSelectors = ['input[name*="page"]', 'input[id*="page"]'];

        for (const selector of bookInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 3000 });
            await this.page.type(selector, searchData.bookNumber, { delay: 100 });
            this.log(`✅ Entered book number`);
            break;
          } catch (e) {
            this.log(`⚠️ Book input ${selector} not found`);
          }
        }

        for (const selector of pageInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 3000 });
            await this.page.type(selector, searchData.pageNumber, { delay: 100 });
            this.log(`✅ Entered page number`);
            break;
          } catch (e) {
            this.log(`⚠️ Page input ${selector} not found`);
          }
        }

        // Submit search
        const submitButtonSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:contains("Search")'
        ];

        for (const selector of submitButtonSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 3000 });
            await this.page.click(selector);
            this.log(`✅ Submitted advanced search`);
            break;
          } catch (e) {
            this.log(`⚠️ Submit button ${selector} not found`);
          }
        }
      } else {
        throw new Error('No instrument number or book/page available for search');
      }

      // Wait for results
      this.log('⏳ Waiting for deed search results...');
      await this.randomWait(3000, 5000);
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        this.log('⚠️ Navigation timeout, checking if results loaded...');
      });

      // Log current page info for debugging
      const pageInfo = await this.page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500)
      }));
      this.log(`📍 Current page: ${pageInfo.url}`);
      this.log(`📄 Page title: ${pageInfo.title}`);
      this.log(`📝 Page preview: ${pageInfo.bodyText.substring(0, 200)}`);

      // Verify the search was actually performed with our instrument number
      if (searchData.instrumentNumber && !pageInfo.url.includes(searchData.instrumentNumber)) {
        this.log(`⚠️ WARNING: Results URL does not contain instrument number ${searchData.instrumentNumber}`);
        this.log(`   This suggests the search may not have filtered by instrument number`);
      }

      // Check if we got exactly 1 result (as expected for instrument number search)
      const resultCount = await this.page.evaluate(() => {
        const resultText = document.body.innerText;
        const match = resultText.match(/(\d+)-(\d+)\s+of\s+(\d+)\s+results?/i);
        return match ? parseInt(match[3]) : null;
      });

      if (resultCount !== null) {
        this.log(`📊 Search returned ${resultCount} result(s)`);
        if (resultCount !== 1) {
          this.log(`⚠️ WARNING: Expected 1 result for instrument number ${searchData.instrumentNumber}, got ${resultCount}`);
          this.log(`   The search may not have been submitted correctly`);
        }
      }

      // Wait for results to load (may require additional JavaScript execution)
      this.log('⏳ Waiting for results table to appear...');
      await this.randomWait(2000, 4000);

      // Take screenshot for debugging
      const screenshotPath = `/tmp/dallas-deed-search-${Date.now()}.png`;
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Try to wait for specific result elements
      const resultSelectors = [
        'table.results',
        '.search-results',
        '.result-row',
        'table tbody tr',
        '[class*="result"]',
        '[id*="result"]'
      ];

      let resultsAppeared = false;
      for (const selector of resultSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          this.log(`✅ Found results container: ${selector}`);
          resultsAppeared = true;
          break;
        } catch (e) {
          // Continue trying
        }
      }

      if (!resultsAppeared) {
        this.log('⚠️ No results container found, checking page content...');
      }

      // Click on deed result to view document
      this.log('📄 Looking for deed document...');

      // First, try to find and click on the result row/link
      const resultFound = await this.page.evaluate(() => {
        // Look for result rows that might contain the document
        const links = Array.from(document.querySelectorAll('a'));
        const tables = Array.from(document.querySelectorAll('table'));
        const rows = Array.from(document.querySelectorAll('tr'));

        // Get full HTML of main content area for debugging
        const mainContent = document.querySelector('main, #main, #content, .content, [role="main"]');
        const mainHTML = mainContent ? mainContent.innerHTML.substring(0, 2000) : '';

        return {
          totalLinks: links.length,
          linkHrefs: links.map(a => a.href).slice(0, 10),
          linkTexts: links.map(a => a.textContent.trim()).slice(0, 10),
          tableCount: tables.length,
          rowCount: rows.length,
          // Look for any elements with "result" in class or id
          resultElements: Array.from(document.querySelectorAll('[class*="result"], [id*="result"]')).length,
          // Check for specific text that might indicate results or errors
          pageHasResults: document.body.innerText.includes('result') ||
                         document.body.innerText.includes('Result') ||
                         document.body.innerText.includes('document') ||
                         document.body.innerText.includes('Document'),
          pageHasError: document.body.innerText.includes('No results') ||
                       document.body.innerText.includes('no results') ||
                       document.body.innerText.includes('not found'),
          mainHTML: mainHTML,
          // Get all div classes and ids
          divClasses: Array.from(document.querySelectorAll('div[class]')).slice(0, 20).map(d => d.className),
          divIds: Array.from(document.querySelectorAll('div[id]')).slice(0, 20).map(d => d.id)
        };
      });

      this.log(`🔍 Found ${resultFound.totalLinks} links on page`);
      this.log(`📊 Tables: ${resultFound.tableCount}, Rows: ${resultFound.rowCount}, Result elements: ${resultFound.resultElements}`);
      this.log(`📝 Page has results: ${resultFound.pageHasResults}, Has error: ${resultFound.pageHasError}`);
      this.log(`🔗 Sample hrefs: ${resultFound.linkHrefs.join(', ')}`);
      this.log(`📝 Sample texts: ${resultFound.linkTexts.join(', ')}`);
      this.log(`🏷️ Div classes: ${resultFound.divClasses.slice(0, 10).join(', ')}`);
      this.log(`🆔 Div IDs: ${resultFound.divIds.slice(0, 10).join(', ')}`);
      if (resultFound.mainHTML) {
        this.log(`📄 Main content HTML (first 500 chars): ${resultFound.mainHTML.substring(0, 500)}`);
      }

      // For Dallas County, click on the DOC NUMBER in the results table
      // The document number is clickable and leads to the document detail/view page
      this.log(`🔍 Looking for clickable document number: ${searchData.instrumentNumber}`);

      const deedLinkSelectors = [
        `a:has-text("${searchData.instrumentNumber}")`,  // Link containing the exact instrument number
        'a[href*=".pdf"]',                               // Direct PDF link
        'table tbody tr a',                              // Any link in table row
        'table a',
        'tbody a'
      ];

      let deedLink = null;
      let deedLinkHref = null;

      for (const selector of deedLinkSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });

          // Get the actual href before committing to this link
          deedLinkHref = await this.page.evaluate((sel) => {
            const link = document.querySelector(sel);
            return link ? link.href : null;
          }, selector);

          if (deedLinkHref) {
            deedLink = selector;
            this.log(`✅ Found deed link: ${selector}`);
            this.log(`🔗 Link href: ${deedLinkHref}`);
            break;
          }
        } catch (e) {
          this.log(`⚠️ Link ${selector} not found`);
        }
      }

      // Check if the link we found is actually a PDF or a detail page
      if (deedLink && deedLinkHref && !deedLinkHref.includes('.pdf')) {
        this.log('⚠️ Link found is not a direct PDF, it may be a detail page link');
        this.log('🔗 Navigating to detail page first...');

        // Navigate to the detail page
        await this.page.goto(deedLinkHref, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomWait(2000, 3000);

        // Now search for PDF link on this page
        const detailPagePDF = await this.page.evaluate(() => {
          const pdfLinks = Array.from(document.querySelectorAll('a'))
            .filter(a => a.href.includes('.pdf') || a.textContent?.toLowerCase().includes('view document') || a.textContent?.toLowerCase().includes('download'));

          if (pdfLinks.length > 0) {
            return {
              found: true,
              href: pdfLinks[0].href,
              text: pdfLinks[0].textContent?.trim()
            };
          }
          return { found: false };
        });

        if (detailPagePDF.found) {
          this.log(`✅ Found PDF on detail page: ${detailPagePDF.text}`);
          deedLinkHref = detailPagePDF.href;
          deedLink = `a[href="${detailPagePDF.href}"]`;
        } else {
          this.log('⚠️ No PDF found on detail page, trying alternative approach...');
          deedLink = null; // Reset to trigger the fallback logic below
        }
      }

      if (!deedLink) {
        // Alternative: Look for result table rows that might need to be clicked first
        this.log('⚠️ No direct PDF link found, trying to find result rows...');

        // First, get count of rows for logging
        const rowCount = await this.page.evaluate(() => {
          return document.querySelectorAll('table tbody tr').length;
        });
        this.log(`📊 Examining ${rowCount} table rows for clickable results...`);

        const resultRowClick = await this.page.evaluate(() => {
          // Look for table rows in results (skip header rows)
          const rows = Array.from(document.querySelectorAll('table tbody tr'));

          const debugRows = [];

          // Find the first data row (not header) that contains a clickable link
          for (let i = 0; i < rows.length && i < 10; i++) { // Check first 10 rows max
            const row = rows[i];
            const text = row.textContent || '';

            debugRows.push({
              index: i,
              textLength: text.trim().length,
              textPreview: text.trim().substring(0, 100),
              hasLinks: row.querySelectorAll('a').length,
              hasButtons: row.querySelectorAll('button').length,
              hasOnclick: row.hasAttribute('onclick') || row.querySelector('[onclick]') !== null
            });

            // Skip empty or very short rows (likely headers)
            if (text.trim().length < 20) continue;

            // Look for a clickable element in this row
            const links = Array.from(row.querySelectorAll('a, button[onclick], tr[onclick], td[onclick]'));

            for (const clickable of links) {
              const href = clickable.href || clickable.getAttribute('onclick');
              if (href && !href.includes('javascript:void') && !href.includes('#')) {
                return {
                  found: true,
                  href: clickable.href || href,
                  text: text.substring(0, 200),
                  type: clickable.tagName,
                  debugRows
                };
              }
            }

            // Also check if the row itself is clickable
            const rowOnclick = row.getAttribute('onclick');
            if (rowOnclick && !rowOnclick.includes('void')) {
              return {
                found: true,
                href: rowOnclick,
                text: text.substring(0, 200),
                type: 'TR',
                isOnclick: true,
                debugRows
              };
            }
          }

          return { found: false, debugRows };
        });

        // Log debug information about first few rows
        if (resultRowClick.debugRows && resultRowClick.debugRows.length > 0) {
          this.log(`🔍 First 10 rows analysis:`);
          resultRowClick.debugRows.forEach(row => {
            this.log(`  Row ${row.index}: len=${row.textLength}, links=${row.hasLinks}, buttons=${row.hasButtons}, onclick=${row.hasOnclick}`);
            if (row.textPreview) {
              this.log(`    Preview: ${row.textPreview}`);
            }
          });
        }

        if (resultRowClick.found) {
          this.log(`✅ Found result row with link: ${resultRowClick.text}`);
          this.log(`🔗 Clicking: ${resultRowClick.href}`);

          // Navigate to the detail page
          await this.page.goto(resultRowClick.href, { waitUntil: 'networkidle2', timeout: 30000 });
          await this.randomWait(2000, 3000);

          // Now try to find the PDF link on the detail page
          const detailPageInfo = await this.page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            links: Array.from(document.querySelectorAll('a')).map(a => ({
              href: a.href,
              text: a.textContent?.trim()
            })).filter(l => l.href.includes('.pdf') || l.text?.toLowerCase().includes('view') || l.text?.toLowerCase().includes('download'))
          }));

          this.log(`📍 Detail page: ${detailPageInfo.url}`);
          this.log(`📄 PDF links found: ${JSON.stringify(detailPageInfo.links, null, 2)}`);

          if (detailPageInfo.links.length > 0) {
            // Found PDF link on detail page
            deedLink = `a[href="${detailPageInfo.links[0].href}"]`;
            this.log(`✅ Found PDF link on detail page: ${deedLink}`);
          } else {
            throw new Error('Could not find PDF link on detail page');
          }
        } else {
          throw new Error('Could not find deed document link or result rows in search results');
        }
      }

      // Set up CDP Fetch domain to intercept PDF
      this.log('🔧 Setting up PDF interception...');
      const client = await this.page.target().createCDPSession();

      await client.send('Fetch.enable', {
        patterns: [{ urlPattern: '*', requestStage: 'Response' }]
      });

      let pdfBuffer = null;
      let pdfIntercepted = false;

      client.on('Fetch.requestPaused', async (event) => {
        const { requestId, responseHeaders, responseStatusCode } = event;

        // Check if this is a PDF response
        const contentType = responseHeaders?.find(h => h.name.toLowerCase() === 'content-type');

        if (contentType && contentType.value.includes('pdf') && !pdfIntercepted) {
          this.log('📥 PDF detected, capturing...');
          pdfIntercepted = true;

          try {
            const response = await client.send('Fetch.getResponseBody', { requestId });
            pdfBuffer = Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
            this.log(`✅ PDF captured: ${pdfBuffer.length} bytes`);
          } catch (error) {
            this.log(`⚠️ Error capturing PDF: ${error.message}`);
          }
        }

        // Continue request
        await client.send('Fetch.continueRequest', { requestId }).catch(() => {});
      });

      // Click on deed link
      await this.page.click(deedLink);
      this.log('✅ Clicked on deed link');

      // Wait for PDF to load/download
      await this.randomWait(5000, 8000);

      if (!pdfBuffer) {
        this.log('⚠️ PDF not intercepted, trying alternative download method...');

        // Try to get PDF URL from current page
        const pdfUrl = await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const pdfLink = links.find(a => a.href.includes('.pdf'));
          return pdfLink?.href || null;
        });

        if (pdfUrl) {
          this.log(`🔗 Found PDF URL: ${pdfUrl}`);
          // Download PDF directly
          const response = await this.page.goto(pdfUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          pdfBuffer = await response.buffer();
        }
      }

      await client.detach();

      if (!pdfBuffer) {
        throw new Error('Could not download deed PDF');
      }

      this.log(`✅ Successfully downloaded deed PDF: ${pdfBuffer.length} bytes`);

      return {
        success: true,
        instrumentNumber: searchData.instrumentNumber,
        bookNumber: searchData.bookNumber,
        pageNumber: searchData.pageNumber,
        pdfData: pdfBuffer.toString('base64'),
        fileSize: pdfBuffer.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log(`❌ Error downloading deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Main workflow: Search Dallas CAD and download deed
   */
  async scrape(address) {
    this.log(`🏠 Starting Dallas County deed scrape for: ${address}`);

    const result = {
      address,
      county: this.county,
      state: this.state,
      timestamp: new Date().toISOString(),
      steps: {}
    };

    try {
      if (!this.browser) {
        await this.initialize();
      }

      // Step 1: Skip Regrid (Dallas CAD supports direct address search)
      result.steps.step1 = {
        name: 'Regrid search',
        success: true,
        skipped: true,
        message: 'Dallas County supports direct address search'
      };

      // Step 2: Search Dallas CAD for property
      this.log('📍 Step 2: Searching Dallas CAD...');
      const cadResult = await this.searchDallasCAD(address);
      result.steps.step2 = {
        name: 'Dallas CAD property search',
        success: cadResult.success,
        data: cadResult
      };

      if (!cadResult.success) {
        result.success = false;
        result.error = 'Failed to search Dallas CAD';
        return result;
      }

      // Step 3: Download deed from public search
      this.log('📥 Step 3: Downloading deed...');
      const downloadResult = await this.downloadDeed(cadResult);
      result.steps.step3 = {
        name: 'Deed download',
        success: downloadResult.success,
        data: downloadResult
      };

      if (!downloadResult.success) {
        result.success = false;
        result.error = 'Failed to download deed';
        return result;
      }

      result.success = true;
      result.download = downloadResult;

      this.log('✅ Dallas County deed scrape completed successfully');
      return result;

    } catch (error) {
      this.log(`❌ Error in Dallas County scrape: ${error.message}`);
      result.success = false;
      result.error = error.message;
      return result;
    }
  }

  /**
   * Alias for scrape() to match API interface
   */
  async getPriorDeed(address) {
    return this.scrape(address);
  }

  /**
   * Random wait helper
   */
  async randomWait(min, max) {
    const wait = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

module.exports = DallasCountyTexasScraper;
