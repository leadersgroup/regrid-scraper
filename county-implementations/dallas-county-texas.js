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
      await this.page.goto('https://www.dallascad.org/PropertySearch.aspx', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(2000, 3000);

      // Find and fill address search input
      this.log('📝 Entering address...');

      // Try multiple possible selectors for address search
      const addressInputSelectors = [
        'input[name*="Address"]',
        'input[id*="Address"]',
        'input[placeholder*="Address"]',
        '#ctl00_cphContent_txtAddress',
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
          this.log(`⚠️ Selector ${selector} not found`);
        }
      }

      if (!addressInput) {
        throw new Error('Could not find address input on Dallas CAD page');
      }

      // Clean address (remove city name if present)
      const cleanAddress = address.replace(/,?\s*Dallas\s*,?\s*TX\s*/gi, '').trim();
      this.log(`🧹 Cleaned address: ${cleanAddress}`);

      await this.page.type(addressInput, cleanAddress, { delay: 100 });
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

      const accountLinkSelectors = [
        'a[href*="AcctDetailRes.aspx"]',
        'a[href*="ID="]',
        'table a',
        '.search-result a'
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

      // Wait for property detail page
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        this.log('⚠️ Navigation timeout, checking if page loaded...');
      });
      await this.randomWait(2000, 3000);

      // Extract legal description (line 4 contains instrument number or book/page)
      this.log('📄 Extracting legal description...');

      const legalDescData = await this.page.evaluate(() => {
        // Look for legal description section
        const legalDescSelectors = [
          'td:contains("Legal Description")',
          'td:contains("Legal Desc")',
          '*:contains("Legal Description")'
        ];

        let legalDescText = null;

        // Try to find by label "Legal Description"
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Legal Description') || text.includes('Legal Desc')) {
            // Get the next sibling or parent's next sibling for the value
            let valueEl = el.nextElementSibling || el.parentElement?.nextElementSibling;
            if (valueEl) {
              legalDescText = valueEl.textContent?.trim();
              break;
            }
          }
        }

        // If not found, try to get all table cells and look for patterns
        if (!legalDescText) {
          const cells = Array.from(document.querySelectorAll('td, div'));
          for (const cell of cells) {
            const text = cell.textContent || '';
            // Look for INT pattern or Vol/Page pattern
            if (text.match(/INT\d+/) || text.match(/Vol\s*\d+.*Page\s*\d+/i)) {
              legalDescText = text.trim();
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
          pageUrl: window.location.href
        };
      });

      if (!legalDescData.instrumentNumber && !legalDescData.bookNumber) {
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

        // Find search input
        const searchInputSelectors = [
          'input[name*="query"]',
          'input[id*="query"]',
          'input[type="text"]',
          '#query'
        ];

        let searchInput = null;
        for (const selector of searchInputSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            searchInput = selector;
            this.log(`✅ Found search input: ${selector}`);
            break;
          } catch (e) {
            this.log(`⚠️ Selector ${selector} not found`);
          }
        }

        if (!searchInput) {
          throw new Error('Could not find search input on public search page');
        }

        // Enter instrument number (without INT prefix)
        await this.page.type(searchInput, searchData.instrumentNumber, { delay: 100 });
        await this.randomWait(1000, 2000);

        // Submit search (press Enter)
        this.log('🔍 Submitting search...');
        await this.page.keyboard.press('Enter');

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

      // Click on deed result to view document
      this.log('📄 Looking for deed document...');

      const deedLinkSelectors = [
        'a[href*=".pdf"]',
        'a:contains("View")',
        'a:contains("Document")',
        'table a',
        '.result-row a'
      ];

      let deedLink = null;
      for (const selector of deedLinkSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          deedLink = selector;
          this.log(`✅ Found deed link: ${selector}`);
          break;
        } catch (e) {
          this.log(`⚠️ Link ${selector} not found`);
        }
      }

      if (!deedLink) {
        throw new Error('Could not find deed document link in search results');
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
