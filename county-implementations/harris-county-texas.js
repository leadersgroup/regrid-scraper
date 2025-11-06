/**
 * Harris County, Texas - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Search: https://hcad.org/property-search/property-search
 * - Clerk Records: https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx
 *
 * Workflow:
 * 1. Search property by address on HCAD
 * 2. Extract owner name and effective date from ownership history
 * 3. Search clerk records using owner name and date
 * 4. Download deed PDF using film code
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// Use reCAPTCHA plugin to solve Cloudflare challenges
// Set your 2captcha API key in environment variable: CAPTCHA_API_KEY
if (process.env.CAPTCHA_API_KEY) {
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.CAPTCHA_API_KEY
      },
      visualFeedback: true
    })
  );
}

class HarrisCountyTexasScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Harris';
    this.state = 'TX';
  }

  /**
   * Override log method to use info level for Railway visibility
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
   * Harris County can search HCAD directly by address
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

      // SKIP STEP 1 (Regrid) - Harris County doesn't need parcel ID
      // We can search HCAD directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Harris County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Harris County supports direct address search',
        county: 'Harris',
        state: 'TX',
        originalAddress: address
      };

      // STEP 2: Search HCAD for property and get ownership history
      this.log(`📋 Step 2: Searching HCAD property search for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to HCAD: https://hcad.org/property-search/property-search`);

      const hcadResult = await this.searchHCAD(address);

      if (!hcadResult.success) {
        result.success = false;
        result.message = 'Could not find property on HCAD';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on HCAD',
          originalAddress: address,
          county: 'Harris',
          state: 'TX'
        };
        return result;
      }

      result.steps.step2 = {
        success: true,
        accountNumber: hcadResult.accountNumber,
        owner: hcadResult.owner,
        effectiveDate: hcadResult.effectiveDate,
        hcadUrl: 'https://hcad.org/property-search/property-search',
        originalAddress: address,
        county: 'Harris',
        state: 'TX'
      };

      // STEP 3: Search Clerk Records for deed
      this.log(`📄 Step 3: Searching Clerk Records for deed`);
      this.log(`   Owner: ${hcadResult.owner}`);
      this.log(`   Date: ${hcadResult.effectiveDate}`);

      const clerkResult = await this.searchClerkRecords(hcadResult.owner, hcadResult.effectiveDate);

      if (!clerkResult.success) {
        result.success = false;
        result.message = 'Could not find deed in Clerk Records';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step3 = {
          success: false,
          message: 'Could not find deed in Clerk Records',
          owner: hcadResult.owner,
          effectiveDate: hcadResult.effectiveDate
        };
        return result;
      }

      result.steps.step3 = {
        success: true,
        filmCode: clerkResult.filmCode,
        clerkUrl: clerkResult.clerkUrl
      };

      // STEP 4: Download the deed PDF
      this.log(`📥 Step 4: Downloading deed PDF: ${clerkResult.filmCode}`);

      const downloadResult = await this.downloadDeed(clerkResult.filmCode, clerkResult.clerkUrl);

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
   * Search HCAD for property by address
   * Extract owner name and effective date from ownership history
   */
  async searchHCAD(address) {
    this.log(`🔍 Searching HCAD for: ${address}`);

    try {
      // Navigate to HCAD property search
      await this.page.goto('https://hcad.org/property-search/property-search', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      this.log(`⏳ Waiting for page to fully load (Cloudflare check)...`);
      await this.randomWait(5000, 7000);

      // Check for Cloudflare challenge
      const hasCloudflare = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const title = document.title.toLowerCase();
        return text.includes('just a moment') ||
               text.includes('checking your browser') ||
               title.includes('just a moment') ||
               document.querySelector('[id*="challenge"]') !== null;
      });

      if (hasCloudflare) {
        this.log(`🔒 Cloudflare challenge detected, waiting for completion...`);

        // Wait for Cloudflare to complete (up to 30 seconds)
        try {
          await this.page.waitForFunction(() => {
            const text = document.body.innerText.toLowerCase();
            const title = document.title.toLowerCase();
            return !text.includes('just a moment') &&
                   !text.includes('checking your browser') &&
                   !title.includes('just a moment');
          }, { timeout: 30000 });
          this.log(`✅ Cloudflare challenge completed`);
        } catch (e) {
          this.log(`⚠️ Cloudflare challenge timeout - trying to proceed anyway`);
        }

        // If we have reCAPTCHA solver configured, try to solve any challenges
        if (process.env.CAPTCHA_API_KEY && this.page.solveRecaptchas) {
          try {
            this.log(`🔐 Attempting to solve any reCAPTCHA challenges...`);
            await this.page.solveRecaptchas();
            this.log(`✅ reCAPTCHA solved (if present)`);
          } catch (e) {
            this.log(`⚠️ reCAPTCHA solver warning: ${e.message}`);
          }
        }

        await this.randomWait(3000, 5000);
      }

      // Wait for the iframe containing the property search interface
      this.log(`⏳ Waiting for property search iframe...`);
      let searchFrame;
      try {
        await this.page.waitForSelector('iframe#parentIframe', { timeout: 30000 });
        this.log(`✅ Property search iframe found`);

        // Get the iframe
        const frameHandle = await this.page.$('iframe#parentIframe');
        searchFrame = await frameHandle.contentFrame();

        if (!searchFrame) {
          throw new Error('Could not access iframe content');
        }

        // Wait for radio buttons to load inside iframe
        await searchFrame.waitForSelector('input[type="radio"]', { timeout: 20000 });
        this.log(`✅ Property search interface loaded inside iframe`);

      } catch (e) {
        this.log(`⚠️ Timeout waiting for search interface: ${e.message}`);

        // Take a screenshot for debugging
        try {
          const screenshotPath = `./debug-hcad-${Date.now()}.png`;
          await this.page.screenshot({ path: screenshotPath, fullPage: true });
          this.log(`📸 Debug screenshot saved: ${screenshotPath}`);
        } catch (screenshotError) {
          this.log(`⚠️ Could not save screenshot: ${screenshotError.message}`);
        }

        return {
          success: false,
          message: 'Could not load property search interface'
        };
      }

      await this.randomWait(2000, 3000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = address;
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Make sure "Property Address" radio button is selected
      const propertyAddressRadio = await searchFrame.evaluate(() => {
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        for (const radio of radios) {
          const label = radio.parentElement?.textContent || '';
          if (label.includes('Property Address')) {
            if (!radio.checked) {
              radio.click();
            }
            return { found: true, checked: true };
          }
        }
        return { found: false };
      });

      if (propertyAddressRadio.found) {
        this.log(`✅ Property Address radio button selected`);
      } else {
        this.log(`⚠️ Could not find Property Address radio button`);
      }

      await this.randomWait(1000, 2000);

      // Wait for the search input field (type="search", not "text")
      this.log(`⏳ Waiting for address input field...`);
      await searchFrame.waitForSelector('input[type="search"]', { timeout: 10000 });

      // Find the search input field
      const addressInput = await searchFrame.$('input[type="search"]');

      if (!addressInput) {
        this.log(`❌ Could not find address input field`);
        return {
          success: false,
          message: 'Could not find address input'
        };
      }

      this.log(`✅ Found address input field`);

      // Clear any existing text and enter the address
      await addressInput.click({ clickCount: 3 }); // Select all existing text
      await this.randomWait(500, 1000);
      await addressInput.type(streetAddress, { delay: 100 });  // Slower typing

      // Trigger input/change events for Blazor
      await searchFrame.evaluate(() => {
        const input = document.querySelector('input[type="search"]');
        if (input) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      await this.randomWait(2000, 3000);  // Longer wait for validation

      this.log(`✅ Entered address: ${streetAddress}`);

      // Click the search button (magnifying glass icon)
      // Look for button with search icon or submit button
      const searchClicked = await searchFrame.evaluate(() => {
        // Try to find search button - could be a button or link with icon
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));

        for (const btn of buttons) {
          const text = btn.textContent?.trim() || '';
          const ariaLabel = btn.getAttribute('aria-label') || '';
          const title = btn.getAttribute('title') || '';

          // Look for search-related text or icons
          if (text.includes('🔍') ||
              ariaLabel.toLowerCase().includes('search') ||
              title.toLowerCase().includes('search') ||
              btn.innerHTML.includes('search')) {
            btn.click();
            return { clicked: true, type: 'icon' };
          }
        }

        // Fallback: look for submit button
        const submitBtn = document.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
          submitBtn.click();
          return { clicked: true, type: 'submit' };
        }

        return { clicked: false };
      });

      if (searchClicked.clicked) {
        this.log(`✅ Clicked search button (${searchClicked.type})`);
      } else {
        // Try pressing Enter as fallback
        this.log(`⚠️ Could not find search button, trying Enter key`);
        await addressInput.press('Enter');
      }

      // Wait for search results to load (inside iframe)
      this.log(`⏳ Waiting for search results to load...`);
      await this.randomWait(5000, 7000);

      // Wait for results - specifically wait for table with data rows (inside iframe)
      try {
        await searchFrame.waitForFunction(() => {
          // Look for table rows with data (not just headers)
          const rows = document.querySelectorAll('tbody tr');
          if (rows.length > 0) {
            // Check if any row has a 13-digit account number
            for (const row of rows) {
              const text = row.textContent || '';
              if (/\d{13}/.test(text)) {
                return true;
              }
            }
          }
          return false;
        }, { timeout: 30000 });

        this.log(`✅ Search results loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for data rows, checking page content anyway...`);
      }

      // Additional wait for table to fully render
      await this.randomWait(2000, 3000);

      // Click on first search result (account number) inside iframe
      const accountClicked = await searchFrame.evaluate(() => {
        // Look for tbody rows (data rows, not headers)
        const rows = Array.from(document.querySelectorAll('tbody tr'));

        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            // First cell typically contains the account number
            const firstCell = cells[0];
            const cellText = firstCell.textContent?.trim() || '';

            // HCAD account numbers are 13 digits
            if (/\d{13}/.test(cellText)) {
              // Extract the 13-digit number
              const accountNumber = cellText.match(/\d{13}/)[0];

              // Try to click on a link if it exists
              const link = firstCell.querySelector('a') || firstCell.querySelector('b') || firstCell;

              // Click the element
              if (link.click) {
                link.click();
              } else if (link.onclick) {
                link.onclick();
              }

              return { clicked: true, accountNumber: accountNumber, method: 'table-cell' };
            }
          }
        }

        // Fallback: Look for account number links anywhere
        const links = Array.from(document.querySelectorAll('a'));
        const allLinks = links.map(l => l.textContent?.trim()).filter(t => t && t.length > 0);

        for (const link of links) {
          const text = link.textContent?.trim() || '';
          if (/\d{13}/.test(text)) {
            const accountNumber = text.match(/\d{13}/)[0];
            link.click();
            return { clicked: true, accountNumber: accountNumber, method: 'link' };
          }
        }

        // Return diagnostic info if no account number found
        return {
          clicked: false,
          allLinks: allLinks.slice(0, 10),
          pageText: document.body.innerText.substring(0, 500)
        };
      });

      if (!accountClicked.clicked) {
        this.log(`⚠️ Could not find account number link`);
        if (this.verbose) {
          this.log(`   Found ${accountClicked.allLinks?.length || 0} links:`);
          accountClicked.allLinks?.forEach(link => this.log(`     - "${link}"`));
          this.log(`   Page content: ${accountClicked.pageText?.substring(0, 200)}`);
        }
        return {
          success: false,
          message: 'Could not find account number link',
          debug: {
            linksFound: accountClicked.allLinks,
            pagePreview: accountClicked.pageText
          }
        };
      }

      this.log(`✅ Clicked on account number: ${accountClicked.accountNumber} (found in ${accountClicked.method})`);

      // Wait for property detail page to load (inside iframe)
      await this.randomWait(3000, 5000);

      await searchFrame.waitForFunction(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('ownership history') ||
               text.includes('owner') ||
               text.includes('property details');
      }, { timeout: 30000 });

      this.log(`✅ Property detail page loaded`);

      // Extract owner name and effective date from Ownership History (inside iframe)
      this.log(`🔍 Looking for Ownership History...`);

      const ownershipData = await searchFrame.evaluate(() => {
        // Look for "Ownership history" section
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        let inOwnershipSection = false;
        let owner = null;
        let effectiveDate = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          // Find "Ownership history" section
          if (line.toLowerCase().includes('ownership history')) {
            inOwnershipSection = true;
            continue;
          }

          // If we're in the ownership section, look for first entry
          if (inOwnershipSection) {
            // Skip the header row
            if (line.includes('Owner') && line.includes('Effective Date')) {
              continue;
            }

            // Check if line contains both name and date (tab-separated or space-separated)
            // Format: "XU HUIPING	07/25/2023" or "XU HUIPING 07/25/2023"
            const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (dateMatch) {
              effectiveDate = dateMatch[1];

              // Extract owner name (everything before the date)
              const ownerPart = line.substring(0, line.indexOf(dateMatch[0])).trim();
              if (ownerPart.length > 0 && /[A-Za-z]{2,}/.test(ownerPart)) {
                owner = ownerPart;
              }
            }

            // If we have both, we're done
            if (owner && effectiveDate) {
              break;
            }

            // Stop if we hit another section
            if (line.toLowerCase().includes('building summary') ||
                line.toLowerCase().includes('legal disclaimer') ||
                (line.toLowerCase().includes('building') && i > 0 && !inOwnershipSection)) {
              break;
            }
          }
        }

        return { owner, effectiveDate };
      });

      if (!ownershipData.owner || !ownershipData.effectiveDate) {
        this.log(`⚠️ Could not extract ownership data`);
        return {
          success: false,
          message: 'Could not extract ownership data from property page'
        };
      }

      this.log(`✅ Found ownership data:`);
      this.log(`   Owner: ${ownershipData.owner}`);
      this.log(`   Effective Date: ${ownershipData.effectiveDate}`);

      return {
        success: true,
        accountNumber: accountClicked.accountNumber,
        owner: ownershipData.owner,
        effectiveDate: ownershipData.effectiveDate
      };

    } catch (error) {
      this.log(`❌ HCAD search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search Harris County Clerk Records
   * URL: https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx
   */
  async searchClerkRecords(owner, effectiveDate) {
    this.log(`🔍 Searching Clerk Records`);
    this.log(`   Owner (Grantee): ${owner}`);
    this.log(`   Date: ${effectiveDate}`);

    try {
      // Navigate to Clerk Records search
      await this.page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 4000);

      this.log(`✅ Loaded Clerk Records search page`);

      // Find and fill Grantee field (owner name)
      const granteeInputSelectors = [
        'input[name*="Grantee"]',
        'input[name*="grantee"]',
        'input[id*="Grantee"]',
        'input[id*="grantee"]'
      ];

      let granteeInput = null;
      for (const selector of granteeInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          granteeInput = selector;
          this.log(`✅ Found Grantee input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (granteeInput) {
        await this.page.click(granteeInput);
        await this.page.type(granteeInput, owner, { delay: 50 });
        this.log(`✅ Entered Grantee: ${owner}`);
      } else {
        this.log(`⚠️ Could not find Grantee input field`);
      }

      // Find and fill Date From field
      const dateFromSelectors = [
        'input[name*="DateFrom"]',
        'input[name*="dateFrom"]',
        'input[id*="DateFrom"]',
        'input[id*="dateFrom"]',
        'input[name*="From"]'
      ];

      let dateFromInput = null;
      for (const selector of dateFromSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          dateFromInput = selector;
          this.log(`✅ Found Date From input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (dateFromInput) {
        await this.page.click(dateFromInput);
        // Clear existing value first
        await this.page.evaluate((sel) => {
          const input = document.querySelector(sel);
          if (input) input.value = '';
        }, dateFromInput);
        await this.page.type(dateFromInput, effectiveDate, { delay: 50 });
        this.log(`✅ Entered Date From: ${effectiveDate}`);
      } else {
        this.log(`⚠️ Could not find Date From input field`);
      }

      // Find and fill Date To field (same as From date)
      const dateToSelectors = [
        'input[name*="DateTo"]',
        'input[name*="dateTo"]',
        'input[id*="DateTo"]',
        'input[id*="dateTo"]',
        'input[name*="To"]'
      ];

      let dateToInput = null;
      for (const selector of dateToSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          dateToInput = selector;
          this.log(`✅ Found Date To input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (dateToInput) {
        await this.page.click(dateToInput);
        // Clear existing value first
        await this.page.evaluate((sel) => {
          const input = document.querySelector(sel);
          if (input) input.value = '';
        }, dateToInput);
        await this.page.type(dateToInput, effectiveDate, { delay: 50 });
        this.log(`✅ Entered Date To: ${effectiveDate}`);
      } else {
        this.log(`⚠️ Could not find Date To input field`);
      }

      await this.randomWait(1000, 2000);

      // Click search button
      const searchButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value*="Search"]',
        'input[value*="search"]',
        'button:has-text("Search")'
      ];

      let searchButtonFound = false;
      for (const selector of searchButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            this.log(`✅ Clicked search button`);
            searchButtonFound = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchButtonFound) {
        this.log(`⚠️ Could not find search button`);
        return {
          success: false,
          message: 'Could not find search button'
        };
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(3000, 5000);

      await this.page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('RP-') || text.includes('Film') || text.includes('film code');
      }, { timeout: 30000 });

      this.log(`✅ Search results loaded`);

      // Extract film code from first result
      const filmCodeData = await this.page.evaluate(() => {
        // Look for film code pattern: RP-YYYY-XXXXXX
        const allText = document.body.innerText;
        const filmCodeMatch = allText.match(/RP-\d{4}-\d{6}/);

        if (filmCodeMatch) {
          const filmCode = filmCodeMatch[0];

          // Try to find the link for this film code
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            if (link.textContent.includes(filmCode)) {
              return {
                filmCode: filmCode,
                linkFound: true,
                href: link.href
              };
            }
          }

          return {
            filmCode: filmCode,
            linkFound: false
          };
        }

        return null;
      });

      if (!filmCodeData || !filmCodeData.filmCode) {
        this.log(`⚠️ Could not find film code in search results`);
        return {
          success: false,
          message: 'Could not find film code in search results'
        };
      }

      this.log(`✅ Found film code: ${filmCodeData.filmCode}`);

      return {
        success: true,
        filmCode: filmCodeData.filmCode,
        clerkUrl: filmCodeData.href || this.page.url()
      };

    } catch (error) {
      this.log(`❌ Clerk Records search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download deed PDF from Clerk Records
   */
  async downloadDeed(filmCode, clerkUrl) {
    this.log(`📄 Downloading deed PDF: ${filmCode}`);

    try {
      // Click on the film code link to download PDF
      const clicked = await this.page.evaluate((code) => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent.includes(code)) {
            link.click();
            return true;
          }
        }
        return false;
      }, filmCode);

      if (!clicked) {
        this.log(`⚠️ Could not find film code link to click`);
        return {
          success: false,
          message: 'Could not find film code link'
        };
      }

      this.log(`✅ Clicked on film code link`);

      // Wait for PDF to start downloading or new page to open
      await this.randomWait(3000, 5000);

      // Check if PDF opened in new tab or same page
      const pages = await this.browser.pages();
      let pdfPage = this.page;

      if (pages.length > 1) {
        pdfPage = pages[pages.length - 1];
        this.log(`✅ PDF opened in new tab`);
      } else {
        this.log(`✅ PDF loaded in current page`);
      }

      await this.randomWait(2000, 3000);

      const pdfUrl = pdfPage.url();
      this.log(`📍 PDF URL: ${pdfUrl}`);

      // Check if we're on a login page
      if (pdfUrl.includes('Login.aspx') || pdfUrl.includes('login')) {
        this.log(`⚠️  PDF requires authentication - redirected to login page`);

        // Check if credentials are available
        const username = process.env.HARRIS_COUNTY_CLERK_USERNAME;
        const password = process.env.HARRIS_COUNTY_CLERK_PASSWORD;

        if (username && password) {
          this.log(`🔐 Attempting to log in with provided credentials...`);

          try {
            // Fill in login form
            const usernameField = 'input[name*="UserName"], input[id*="UserName"]';
            const passwordField = 'input[type="password"], input[name*="Password"]';
            const loginButton = 'input[type="submit"], input[name*="LoginButton"]';

            await pdfPage.waitForSelector(usernameField, { timeout: 5000 });
            await pdfPage.type(usernameField, username);
            this.log(`✅ Entered username`);

            await pdfPage.waitForSelector(passwordField, { timeout: 5000 });
            await pdfPage.type(passwordField, password);
            this.log(`✅ Entered password`);

            await this.randomWait(1000, 2000);

            await pdfPage.click(loginButton);
            this.log(`✅ Clicked login button`);

            // Wait for login to complete and redirect to PDF
            await this.randomWait(3000, 5000);

            // Check if login was successful
            const currentUrl = pdfPage.url();
            this.log(`📍 After login URL: ${currentUrl}`);

            if (currentUrl.includes('Login.aspx')) {
              this.log(`❌ Login failed - still on login page`);
              throw new Error('Login failed - please check credentials');
            }

            this.log(`✅ Login successful!`);

            // Wait for PDF viewer to load
            await this.randomWait(3000, 5000);

            // Get the PDF viewer URL
            const pdfViewerUrl = pdfPage.url();
            this.log(`📄 PDF Viewer URL: ${pdfViewerUrl}`);

            // Download PDF using external HTTPS request with session cookies
            // This is necessary because Chrome's PDF viewer intercepts the response
            // before Puppeteer can capture it
            this.log(`📥 Downloading PDF using authenticated session...`);

            try {
              const https = require('https');
              const {URL} = require('url');

              // Get cookies from the logged-in session
              const cookies = await pdfPage.cookies();
              const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

              const pdfUrl = new URL(pdfViewerUrl);

              const options = {
                hostname: pdfUrl.hostname,
                port: 443,
                path: pdfUrl.pathname + pdfUrl.search,
                method: 'POST',  // Use POST as server expects it
                headers: {
                  'Cookie': cookieHeader,
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
                  'Accept': 'application/pdf,*/*',
                  'Referer': pdfViewerUrl,
                  'Cache-Control': 'no-cache'
                }
              };

              const pdfBuffer = await new Promise((resolve, reject) => {
                const chunks = [];

                const req = https.request(options, (res) => {
                  this.log(`   Response status: ${res.statusCode}`);
                  this.log(`   Content-Type: ${res.headers['content-type']}`);
                  this.log(`   Content-Length: ${res.headers['content-length']}`);

                  res.on('data', (chunk) => {
                    chunks.push(chunk);
                  });

                  res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    this.log(`   Downloaded: ${buffer.length} bytes`);
                    resolve(buffer);
                  });
                });

                req.on('error', (e) => {
                  reject(new Error(`HTTPS request failed: ${e.message}`));
                });

                req.end();
              });

              // Verify it's a PDF
              const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
              this.log(`🔍 PDF validation: isPDF=${isPDF}, size=${pdfBuffer.length} bytes`);

              if (!isPDF) {
                this.log(`⚠️ Direct download returned HTML instead of PDF, trying alternative method...`);
                // Fall back to returning the PDF viewer URL
                throw new Error('Server returned HTML instead of PDF');
              }

              if (pdfBuffer.length < 10000) {
                this.log(`⚠️ PDF is suspiciously small (${pdfBuffer.length} bytes), may be incomplete`);
              }

              // Close the PDF viewer tab
              if (pdfPage !== this.page) {
                await pdfPage.close();
              }

              this.log(`✅ PDF downloaded successfully`);

              return {
                success: true,
                filmCode: filmCode,
                pdfData: pdfBuffer,
                fileSize: pdfBuffer.length,
                message: 'PDF downloaded successfully after authentication',
                timestamp: new Date().toISOString()
              };

            } catch (downloadError) {
              this.log(`❌ PDF download failed: ${downloadError.message}`);
              this.log(`📝 Returning PDF viewer URL for manual access`);

              // Close the PDF viewer tab
              if (pdfPage !== this.page) {
                await pdfPage.close();
              }

              // Return PDF viewer URL as fallback
              return {
                success: true,
                requiresManualDownload: true,
                filmCode: filmCode,
                pdfViewerUrl: pdfViewerUrl,
                message: 'Successfully logged in. PDF viewer URL provided (automatic download not available).',
                timestamp: new Date().toISOString(),
                instructions: [
                  'The PDF is accessible at the provided pdfViewerUrl',
                  'You are now logged in and can download the PDF manually if needed',
                  `Film code: ${filmCode}`
                ]
              };
            }

          } catch (loginError) {
            this.log(`❌ Login error: ${loginError.message}`);

            // Close the new tab if it was opened
            if (pdfPage !== this.page) {
              await pdfPage.close();
            }

            return {
              success: false,
              requiresAuth: true,
              filmCode: filmCode,
              error: `Login failed: ${loginError.message}`,
              message: 'Could not log in to Harris County Clerk website'
            };
          }
        } else {
          this.log(`📝 Harris County Clerk requires a free registered account to download PDFs`);
          this.log(`🔗 Create account at: https://www.cclerk.hctx.net/Applications/WebSearch/Registration/NewUser.aspx`);

          // Close the new tab if it was opened
          if (pdfPage !== this.page) {
            await pdfPage.close();
          }

          // Extract the document URL from the ReturnUrl parameter
          const urlObj = new URL(pdfUrl);
          const returnUrl = urlObj.searchParams.get('ReturnUrl');
          const documentId = urlObj.searchParams.get('ID');

          return {
            success: true,
            requiresAuth: true,
            filmCode: filmCode,
            message: 'PDF requires authentication. Harris County Clerk requires a free registered account.',
            loginUrl: pdfUrl,
            documentUrl: returnUrl ? `https://www.cclerk.hctx.net${returnUrl}` : null,
            documentId: documentId,
            registrationUrl: 'https://www.cclerk.hctx.net/Applications/WebSearch/Registration/NewUser.aspx',
            instructions: [
              '1. Create a free account at Harris County Clerk website',
              '2. Log in to your account',
              '3. Use the film code to search and download the PDF'
            ]
          };
        }
      }

      // Download the PDF
      this.log('📥 Downloading PDF...');

      const pdfArrayBuffer = await pdfPage.evaluate(async (url) => {
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

      // Close the new tab if it was opened
      if (pdfPage !== this.page) {
        await pdfPage.close();
      }

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

      const filename = `harris_deed_${filmCode.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        filmCode: filmCode,
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
   * Random wait helper
   */
  async randomWait(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = HarrisCountyTexasScraper;
