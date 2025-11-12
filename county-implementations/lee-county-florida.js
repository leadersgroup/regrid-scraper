/**
 * Lee County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.leepa.org/search/propertysearch.aspx
 * - Clerk of Courts (Official Records): https://or.leeclerk.org/LandMarkWeb
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

// Use stealth plugin to avoid bot detection on Lee County website
puppeteer.use(StealthPlugin());

class LeeCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Lee';
    this.state = 'FL';
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
   * Lee County may have bot detection
   */
  async initialize() {
    this.log('🚀 Initializing browser with stealth mode...');
    this.log(`   Platform: ${process.platform}`);
    this.log(`   Node version: ${process.version}`);
    this.log(`   Headless mode: ${this.headless}`);
    this.log(`   Timeout: ${this.timeout}ms`);

    const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
    const isLinux = process.platform === 'linux';

    this.log(`   Railway environment: ${isRailway ? 'YES' : 'NO'}`);
    this.log(`   Linux platform: ${isLinux ? 'YES' : 'NO'}`);

    const executablePath = isRailway || isLinux
      ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
      : undefined;

    if (executablePath) {
      this.log(`   Using Chrome executable: ${executablePath}`);
    } else {
      this.log(`   Using default Chrome executable`);
    }

    this.log('   Launching browser...');

    // For Lee County, use Chrome's new headless mode if headless is requested
    // The new headless mode has better JavaScript/AJAX compatibility
    const headlessMode = this.headless === true ? 'new' : this.headless;
    this.log(`   Headless setting: ${headlessMode}`);

    this.browser = await puppeteer.launch({
      headless: headlessMode,
      ...(executablePath && { executablePath }),
      protocolTimeout: 600000, // 10 minute timeout for protocol operations (increased from 5 min)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--enable-features=NetworkService,NetworkServiceInProcess'
      ]
    });
    this.log('   ✅ Browser launched');

    this.log('   Creating new page...');
    this.page = await this.browser.newPage();
    this.log('   ✅ New page created');

    // Set realistic user agent
    this.log('   Setting user agent...');
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    this.log('   ✅ User agent set');

    // Set realistic viewport
    this.log('   Setting viewport...');
    await this.page.setViewport({ width: 1920, height: 1080 });
    this.log('   ✅ Viewport set');

    // Add realistic headers
    this.log('   Setting HTTP headers...');
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
    this.log('   ✅ HTTP headers set');

    // Set up global dialog handler to auto-dismiss all alerts/confirms/prompts
    // This prevents Railway errors when switching between leepa.org and leeclerk.org
    this.log('   Setting up event handlers...');
    this.page.on('dialog', async (dialog) => {
      this.log(`🔔 Dialog auto-dismissed: ${dialog.type()} - "${dialog.message()}"`);
      try {
        await dialog.accept();
      } catch (err) {
        this.log(`⚠️  Failed to dismiss dialog: ${err.message}`);
      }
    });

    // Set up console error logging to capture JavaScript errors from the page
    this.page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        this.log(`🖥️  Browser ${type}: ${msg.text()}`);
      }
    });

    // Set up page error logging
    this.page.on('pageerror', (error) => {
      this.log(`❌ Page error: ${error.message}`);
    });

    // Log failed requests
    this.page.on('requestfailed', (request) => {
      this.log(`⚠️  Request failed: ${request.url()} - ${request.failure().errorText}`);
    });
    this.log('   ✅ Event handlers configured');

    this.log('✅ Browser initialized with stealth mode and popup handling');
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Lee County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Lee County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Lee County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Lee County supports direct address search',
        county: 'Lee',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://www.leepa.org/search/propertysearch.aspx`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Lee',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://www.leepa.org/search/propertysearch.aspx',
        originalAddress: address,
        county: 'Lee',
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
   * Get deed recorder/clerk URL for Lee County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Lee' && state === 'FL') {
      return 'https://or.leeclerk.org/LandMarkWeb';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Lee County
   */
  getAssessorUrl(county, state) {
    if (county === 'Lee' && state === 'FL') {
      return 'https://www.leepa.org/search/propertysearch.aspx';
    }
    return null;
  }

  /**
   * Search Lee County Property Appraiser by address
   * URL: https://www.leepa.org/Search/PropertySearch.aspx
   * Workflow:
   * 1. Find 'street address' search box
   * 2. Type in address without city and state (e.g., "503 NORIDGE DR")
   * 3. Click on search button
   * 4. After match table is shown, find 'parcel details' button and click it
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Lee County FL Property Appraiser`);
    this.log(`   Using street address search (without city/state)`);
    this.log(`   Current address: ${this.currentAddress}`);

    try {
      // Navigate to property search page
      const targetUrl = 'https://www.leepa.org/Search/PropertySearch.aspx';
      this.log(`🌐 Navigating to: ${targetUrl}`);
      this.log(`   Wait until: networkidle2, Timeout: ${this.timeout}ms`);

      const startTime = Date.now();
      await this.page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });
      const loadTime = Date.now() - startTime;

      const pageTitle = await this.page.title();
      const pageUrl = this.page.url();
      this.log(`✅ Page loaded in ${loadTime}ms`);
      this.log(`   URL: ${pageUrl}`);
      this.log(`   Title: ${pageTitle}`);

      // Check if we got a CAPTCHA, error, or blocked page
      const pageCheck = await this.page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return {
          hasCaptcha: bodyText.includes('captcha') || bodyText.includes('robot') || bodyText.includes('recaptcha'),
          hasError: bodyText.includes('error') || bodyText.includes('not found') || bodyText.includes('unavailable'),
          hasAccessDenied: bodyText.includes('access denied') || bodyText.includes('forbidden'),
          bodySnippet: document.body.innerText.substring(0, 300)
        };
      });

      this.log(`🔍 Page check results:`);
      this.log(`   CAPTCHA: ${pageCheck.hasCaptcha ? 'YES' : 'NO'}`);
      this.log(`   Error: ${pageCheck.hasError ? 'YES' : 'NO'}`);
      this.log(`   Access Denied: ${pageCheck.hasAccessDenied ? 'YES' : 'NO'}`);

      if (pageCheck.hasCaptcha) {
        this.log(`⚠️  WARNING: CAPTCHA detected!`);
        this.log(`   Body snippet: ${pageCheck.bodySnippet}`);
      }
      if (pageCheck.hasError) {
        this.log(`⚠️  WARNING: Error message detected!`);
        this.log(`   Body snippet: ${pageCheck.bodySnippet}`);
      }
      if (pageCheck.hasAccessDenied) {
        this.log(`⚠️  WARNING: Access denied!`);
        this.log(`   Body snippet: ${pageCheck.bodySnippet}`);
      }

      const waitTime = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
      this.log(`⏳ Waiting ${waitTime}ms before proceeding...`);
      await this.randomWait(3000, 5000);

      // Check for and dismiss the privacy policy popup
      this.log(`🔍 Checking for privacy policy popup...`);
      const privacyPopupHandled = await this.page.evaluate(() => {
        // Look for "Continue" button in privacy policy popup
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase().trim();
          if (text === 'continue') {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              console.log('Found Continue button, clicking...');
              btn.click();
              return true;
            }
          }
        }
        return false;
      });

      if (privacyPopupHandled) {
        this.log(`✅ Clicked "Continue" on privacy policy popup`);
        await this.randomWait(2000, 3000);
      } else {
        this.log(`   No privacy policy popup found`);
      }

      // Check for and dismiss any other popups or overlays
      const popupDismissed = await this.page.evaluate(() => {
        // Look for close buttons on modals/dialogs
        const closeButtons = Array.from(document.querySelectorAll('button, a, [class*="close"], [class*="dismiss"]'));
        for (const btn of closeButtons) {
          const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
          if (text.includes('close') || text.includes('dismiss') || text.includes('×')) {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });

      if (popupDismissed) {
        this.log(`✅ Dismissed other popup`);
        await this.randomWait(1000, 2000);
      }

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      // Handle unit numbers: convert "#156" to "156" (remove # symbol)
      // Example: "16381 Kelly Woods Dr #156" becomes "16381 Kelly Woods Dr 156"
      streetAddress = streetAddress.replace(/#\s*/g, '');

      this.log(`🏠 Processing address:`);
      this.log(`   Full address: ${fullAddress}`);
      this.log(`   Street only: ${streetAddress}`);

      // Look for the 'street address' search box
      this.log(`🔍 Looking for street address input field...`);
      const addressInputSelectors = [
        'input[id*="txtStreetAddress"]',
        'input[name*="txtStreetAddress"]',
        'input[id*="StreetAddress"]',
        'input[placeholder*="Street"]',
        'input[name*="Address"]',
        'input[type="text"]'
      ];

      this.log(`   Trying ${addressInputSelectors.length} selectors...`);
      let addressInput = null;
      let selectorIndex = 0;
      for (const selector of addressInputSelectors) {
        selectorIndex++;
        try {
          this.log(`   [${selectorIndex}/${addressInputSelectors.length}] Trying: ${selector}`);
          await this.page.waitForSelector(selector, { timeout: 3000, visible: true });
          addressInput = selector;
          this.log(`   ✅ Found! Using selector: ${selector}`);
          break;
        } catch (e) {
          this.log(`   ⚠️  Not found: ${selector}`);
          // Try next selector
        }
      }

      if (!addressInput) {
        // Log all input fields on the page for debugging
        const allInputs = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
          return inputs.map(input => ({
            id: input.id,
            name: input.name,
            placeholder: input.placeholder,
            className: input.className,
            visible: window.getComputedStyle(input).display !== 'none'
          }));
        });

        this.log(`⚠️  All text inputs found on page:`);
        this.log(JSON.stringify(allInputs, null, 2));

        // Capture screenshot for debugging
        try {
          const downloadPath = path.resolve(process.env.DEED_DOWNLOAD_PATH || './downloads');
          if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
          }
          const screenshotPath = path.join(downloadPath, 'lee_error_no_input.png');
          await this.page.screenshot({ path: screenshotPath, fullPage: true });
          this.log(`📸 Screenshot saved to: ${screenshotPath}`);

          // Log HTML content for debugging
          const htmlContent = await this.page.content();
          const htmlPath = path.join(downloadPath, 'lee_error_no_input.html');
          await fs.promises.writeFile(htmlPath, htmlContent);
          this.log(`📄 HTML saved to: ${htmlPath}`);
        } catch (err) {
          this.log(`⚠️  Failed to save debug files: ${err.message}`);
        }

        throw new Error('Could not find street address input field');
      }

      // Enter street address using DOM manipulation (page.type() times out on this site)
      this.log(`📝 Entering address via DOM manipulation...`);
      this.log(`   Selector: ${addressInput}`);
      this.log(`   Value: ${streetAddress}`);

      const entryResult = await this.page.evaluate((selector, address) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = address;
          // Trigger input events to ensure the form recognizes the change
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, actualValue: input.value };
        }
        return { success: false, error: 'Input element not found' };
      }, addressInput, streetAddress);

      if (entryResult.success) {
        this.log(`✅ Address entered successfully`);
        this.log(`   Verified value: ${entryResult.actualValue}`);
      } else {
        this.log(`❌ Failed to enter address: ${entryResult.error}`);
      }

      const waitTime2 = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
      this.log(`⏳ Waiting ${waitTime2}ms before submitting...`);
      await this.randomWait(1000, 2000);

      // Try to submit the form by clicking the search button
      // ASP.NET forms often require clicking the actual submit button
      this.log(`🔍 Looking for search/submit button...`);

      const submitButtonClicked = await this.page.evaluate(() => {
        // Look for submit button with various patterns
        const buttonSelectors = [
          'input[type="submit"]',
          'input[type="button"]',
          'button[type="submit"]',
          'button'
        ];

        for (const selector of buttonSelectors) {
          const buttons = Array.from(document.querySelectorAll(selector));
          for (const btn of buttons) {
            const value = (btn.value || '').toLowerCase();
            const text = (btn.textContent || '').toLowerCase();
            const id = (btn.id || '').toLowerCase();

            // Look for search-related buttons
            if (value.includes('search') || text.includes('search') ||
                id.includes('search') || id.includes('submit')) {
              const style = window.getComputedStyle(btn);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                console.log(`Found submit button: ${btn.id || btn.value || btn.textContent}`);
                btn.click();
                return { clicked: true, button: btn.id || btn.value || btn.textContent || 'unknown' };
              }
            }
          }
        }
        return { clicked: false };
      });

      if (submitButtonClicked && submitButtonClicked.clicked) {
        this.log(`✅ Clicked search button: ${submitButtonClicked.button}`);
      } else {
        this.log(`⚠️  No search button found, trying Enter key...`);
        await this.page.keyboard.press('Enter');
        this.log(`✅ Enter key pressed`);
      }

      const urlAfterSubmit = this.page.url();
      this.log(`📍 Current URL after submit: ${urlAfterSubmit}`);

      // Wait extra time for the search to process (ASP.NET postback can be slow)
      this.log(`⏳ Waiting for search to process...`);
      await this.randomWait(5000, 7000);

      // Handle privacy policy popup that might appear after clicking search
      this.log(`🔍 Checking for privacy policy popup after search submit...`);
      await this.randomWait(2000, 3000);

      const privacyPopupAfterSearch = await this.page.evaluate(() => {
        // Look for "Continue" button in privacy policy popup
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase().trim();
          if (text === 'continue') {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              console.log('Found Continue button after search, clicking...');
              btn.click();
              return true;
            }
          }
        }
        return false;
      });

      if (privacyPopupAfterSearch) {
        this.log(`✅ Clicked "Continue" on privacy policy popup after search`);
        await this.randomWait(2000, 3000);
      } else {
        this.log(`   No privacy policy popup found after search`);
      }

      // Wait for search results to load (match table)
      this.log(`⏳ Waiting for search results to load...`);

      // Check if there's a postback happening (ASP.NET specific)
      const postbackCheck = await this.page.evaluate(() => {
        // Check if there's an __EVENTTARGET hidden field (ASP.NET)
        const eventTarget = document.querySelector('input[name="__EVENTTARGET"]');
        const viewState = document.querySelector('input[name="__VIEWSTATE"]');
        return {
          hasEventTarget: !!eventTarget,
          hasViewState: !!viewState,
          eventTargetValue: eventTarget ? eventTarget.value : null,
          pageRequestManagerExists: typeof window.Sys !== 'undefined' && typeof window.Sys.WebForms !== 'undefined'
        };
      });

      this.log(`📋 ASP.NET postback check:`);
      this.log(`   Has __EVENTTARGET: ${postbackCheck.hasEventTarget}`);
      this.log(`   Has __VIEWSTATE: ${postbackCheck.hasViewState}`);
      this.log(`   __EVENTTARGET value: ${postbackCheck.eventTargetValue}`);
      this.log(`   Page has AJAX UpdatePanel: ${postbackCheck.pageRequestManagerExists}`);

      // Wait for match table to appear or navigation to occur
      try {
        await Promise.race([
          // Wait for navigation to results page
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).then(() => 'navigation'),
          // OR wait for results to appear on same page
          this.page.waitForFunction(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('match') ||
                   text.includes('results') ||
                   text.includes('folio') ||
                   text.includes('parcel') ||
                   text.includes('search results');
          }, { timeout: 30000 }).then(() => 'results_on_page')
        ]).then((result) => {
          this.log(`✅ Search completed via: ${result}`);
        });
      } catch (waitError) {
        this.log(`⚠️  Timeout waiting for results: ${waitError.message}`);
        this.log(`   Current URL: ${this.page.url()}`);
        this.log(`   Continuing to check page content...`);
      }

      await this.randomWait(2000, 3000);

      // Debug: Check page content
      const pageContent = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          hasMatch: bodyText.toLowerCase().includes('match'),
          hasResults: bodyText.toLowerCase().includes('results'),
          hasProperty: bodyText.toLowerCase().includes('property'),
          hasNoMatch: bodyText.toLowerCase().includes('no match') || bodyText.toLowerCase().includes('no results'),
          snippet: bodyText.substring(0, 500)
        };
      });

      this.log(`⚠️  Debug: Page content check:`);
      this.log(`   Has "match": ${pageContent.hasMatch}`);
      this.log(`   Has "results": ${pageContent.hasResults}`);
      this.log(`   Has "no match": ${pageContent.hasNoMatch}`);
      this.log(`   Content snippet: ${pageContent.snippet.substring(0, 200)}...`);

      // Look for 'parcel details' button and click it
      this.log(`🔍 Looking for "Parcel Details" button or link...`);

      // Find the link selector (not clicking yet, just finding)
      const linkInfo = await this.page.evaluate(() => {
        const debugInfo = {
          allLinks: [],
          displayParcelLinks: [],
          foundSelector: null
        };

        // First, collect all links for debugging
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        debugInfo.allLinks = allLinks.slice(0, 20).map(a => ({
          text: a.textContent?.trim().substring(0, 50),
          href: a.href
        }));

        // Check for links with DisplayParcel.aspx
        const displayParcelLinks = Array.from(document.querySelectorAll('a[href*="DisplayParcel"]'));
        debugInfo.displayParcelLinks = displayParcelLinks.map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        }));

        if (displayParcelLinks.length > 0) {
          // Return selector instead of clicking
          const link = displayParcelLinks[0];
          if (link.id) {
            debugInfo.foundSelector = `#${link.id}`;
          } else {
            debugInfo.foundSelector = `a[href*="DisplayParcel"]`;
          }
          return { found: true, text: link.textContent?.trim() || 'DisplayParcel link', debugInfo };
        }

        // Look for buttons/links with "details" text
        const allElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

        for (const el of allElements) {
          const text = (el.textContent || el.value || '').toLowerCase();
          const title = (el.title || '').toLowerCase();

          if (text.includes('parcel details') ||
              title.includes('parcel details') ||
              text.includes('view details') ||
              text.includes('details')) {
            if (el.id) {
              debugInfo.foundSelector = `#${el.id}`;
            } else if (el.tagName === 'A') {
              debugInfo.foundSelector = `a:has-text("${el.textContent?.trim()}")`;
            }
            return { found: true, text: el.textContent || el.value || el.title, debugInfo };
          }
        }

        // Try first visible link in a table row
        const tableLinks = Array.from(document.querySelectorAll('table a[href]'));
        if (tableLinks.length > 0) {
          const link = tableLinks[0];
          debugInfo.foundSelector = 'table a[href]';
          return { found: true, text: `First table link: ${link.textContent?.trim()}`, debugInfo };
        }

        return { found: false, debugInfo };
      });

      if (!linkInfo || !linkInfo.found) {
        this.log(`⚠️  Debug: Found ${linkInfo.debugInfo.allLinks.length} links on page:`);
        linkInfo.debugInfo.allLinks.forEach((link, i) => {
          this.log(`   [${i+1}] "${link.text}" -> ${link.href}`);
        });

        this.log(`⚠️  Debug: Found ${linkInfo.debugInfo.displayParcelLinks.length} DisplayParcel links`);

        // Capture screenshot for debugging
        try {
          const downloadPath = path.resolve(process.env.DEED_DOWNLOAD_PATH || './downloads');
          if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
          }
          const screenshotPath = path.join(downloadPath, 'lee_error_no_results.png');
          await this.page.screenshot({ path: screenshotPath, fullPage: true });
          this.log(`📸 Screenshot saved to: ${screenshotPath}`);

          // Log HTML content for debugging
          const htmlContent = await this.page.content();
          const htmlPath = path.join(downloadPath, 'lee_error_no_results.html');
          await fs.promises.writeFile(htmlPath, htmlContent);
          this.log(`📄 HTML saved to: ${htmlPath}`);
        } catch (err) {
          this.log(`⚠️  Failed to save debug files: ${err.message}`);
        }

        throw new Error('Could not find "Parcel Details" button or link');
      }

      this.log(`✅ Found link: ${linkInfo.text}, selector: ${linkInfo.debugInfo.foundSelector}`);

      // Check if link opens in new tab/window
      const linkTarget = await this.page.evaluate((selector) => {
        const link = document.querySelector(selector);
        return link ? { target: link.target, href: link.href } : null;
      }, linkInfo.debugInfo.foundSelector);

      this.log(`🔗 Link target: ${linkTarget.target || 'same window'}, href: ${linkTarget.href}`);

      // If there's a DisplayParcel link, navigate directly to it
      if (linkTarget && linkTarget.href && linkTarget.href.includes('DisplayParcel.aspx')) {
        this.log(`🌐 Navigating directly to: ${linkTarget.href}`);
        await this.page.goto(linkTarget.href, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        this.log(`✅ Navigated to parcel details page`);
      } else {
        // Try clicking and waiting for navigation
        try {
          await Promise.all([
            this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            this.page.click(linkInfo.debugInfo.foundSelector)
          ]);
          this.log(`✅ Clicked link and navigated successfully`);
        } catch (navError) {
          this.log(`⚠️  No navigation occurred after clicking: ${navError.message}`);
        }
      }

      // Wait for parcel details content to load
      await this.randomWait(3000, 5000);

      // Verify we're on the parcel details page
      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      if (currentUrl.includes('DisplayParcel.aspx')) {
        this.log(`✅ Successfully navigated to parcel details page`);

        // Handle privacy policy popup that appears on parcel details page
        this.log(`🔍 Checking for privacy policy popup on parcel details page...`);
        await this.randomWait(2000, 3000);

        const privacyPopupHandled = await this.page.evaluate(() => {
          // Look for "Continue" button in privacy policy popup
          const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
          for (const btn of buttons) {
            const text = (btn.textContent || btn.value || '').toLowerCase().trim();
            if (text === 'continue') {
              const style = window.getComputedStyle(btn);
              if (style.display !== 'none' && style.visibility !== 'hidden') {
                console.log('Found Continue button on parcel page, clicking...');
                btn.click();
                return true;
              }
            }
          }
          return false;
        });

        if (privacyPopupHandled) {
          this.log(`✅ Clicked "Continue" on privacy policy popup`);
          // Wait longer for any page reloads/navigation after clicking Continue
          await this.randomWait(3000, 5000);

          // Wait for the page to fully stabilize
          try {
            await this.page.waitForFunction(() => {
              return document.readyState === 'complete';
            }, { timeout: 10000 });
            this.log(`   Page stabilized after Continue click`);
          } catch (err) {
            this.log(`   Warning: Page stabilization wait timed out: ${err.message}`);
          }
        } else {
          this.log(`   No privacy policy popup found on parcel details page`);
        }

        return {
          success: true,
          message: 'Property found and navigated to parcel details'
        };
      } else {
        throw new Error('Did not navigate to parcel details page');
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
   * Navigate to Sales/Transactions tab and extract Clerk file number
   * Workflow:
   * 1. First try to find clerk file numbers in the page HTML (may be pre-loaded)
   * 2. If not found, click on 'Sales/Transactions' tab to load via AJAX
   * 3. Extract clerk file numbers from the loaded content
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      // STRATEGY 1: Try to find clerk file numbers in the page source first
      // Many sites pre-load this data and just hide it with CSS
      this.log('🔍 Strategy 1: Searching entire page HTML for clerk file numbers...');

      const clerkNumbersInHTML = await this.page.evaluate(() => {
        const html = document.documentElement.innerHTML;
        const text = document.body.innerText;
        const results = [];

        // Pattern for 13-digit clerk file numbers (year + sequence)
        // Example: 2022000220622
        const patterns = [
          /\b(20\d{11})\b/g,  // 13 digits starting with 20
          /\b(\d{13})\b/g,     // Any 13 digits
          /CFN[:\s=]*(\d{13})/gi,  // CFN: or CFN= prefix
          /clerk[\s]*file[\s]*(?:number|#)[:\s]*(\d{13})/gi  // Clerk file number: prefix
        ];

        for (const pattern of patterns) {
          const htmlMatches = [...html.matchAll(pattern)];
          const textMatches = [...text.matchAll(pattern)];
          const allMatches = [...htmlMatches, ...textMatches];

          for (const match of allMatches) {
            const number = match[1];
            if (number && number.length === 13 && !results.includes(number)) {
              // Verify it starts with a reasonable year (2000-2099)
              const year = parseInt(number.substring(0, 4));
              if (year >= 2000 && year <= 2099) {
                results.push(number);
              }
            }
          }
        }

        return results;
      });

      if (clerkNumbersInHTML.length > 0) {
        this.log(`✅ Found ${clerkNumbersInHTML.length} clerk file number(s) in page HTML!`);
        clerkNumbersInHTML.forEach((cfn, i) => {
          this.log(`   📄 Clerk File #${i+1}: ${cfn}`);
        });

        return {
          success: true,
          transactions: clerkNumbersInHTML.map(cfn => ({
            instrumentNumber: cfn,
            clerkFileNumber: cfn,
            type: 'clerk_file',
            source: 'Lee County Property Appraiser - Page HTML'
          }))
        };
      }

      this.log('⚠️  No clerk file numbers found in page HTML');
      this.log('🔍 Strategy 2: Trying to load Sales/Transactions via AJAX...');

      // STRATEGY 2: Click the Sales/Transactions tab to load via AJAX
      // Wait longer for JavaScript to fully load
      this.log('⏳ Waiting for page JavaScript to fully initialize...');
      await this.randomWait(5000, 7000);

      // Try to expand 'Sales/Transactions' section using Puppeteer's click method
      // which handles events more realistically than page.evaluate().click()
      this.log('🔍 Looking for "Sales/Transactions" expand button...');

      // First, check if the expand button exists
      const expandButtonExists = await this.page.evaluate(() => {
        const expandButton = document.querySelector('#SalesHyperLink');
        return expandButton ? true : false;
      });

      if (!expandButtonExists) {
        throw new Error('SalesHyperLink expand button not found');
      }

      this.log('✅ Found expand button #SalesHyperLink');

      // Try clicking using multiple methods to ensure it works
      this.log('🖱️  Attempting to click expand button...');

      // Method 1: Try Puppeteer's native click first
      let clicked = false;
      try {
        // Check if element is visible and clickable
        const isVisible = await this.page.evaluate(() => {
          const el = document.querySelector('#SalesHyperLink');
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 rect.width > 0 &&
                 rect.height > 0;
        });

        if (!isVisible) {
          this.log('⚠️  Element not visible, scrolling into view...');
          await this.page.evaluate(() => {
            const el = document.querySelector('#SalesHyperLink');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          });
          await this.randomWait(1000, 2000);
        }

        // Try clicking with Puppeteer
        await this.page.click('#SalesHyperLink');
        clicked = true;
        this.log('✅ Clicked with Puppeteer click()');
      } catch (clickError) {
        this.log(`⚠️  Puppeteer click failed: ${clickError.message}`);
      }

      // Method 2: If Puppeteer click failed, try JavaScript click
      if (!clicked) {
        this.log('🖱️  Trying JavaScript click...');
        clicked = await this.page.evaluate(() => {
          const el = document.querySelector('#SalesHyperLink');
          if (el) {
            el.click();
            return true;
          }
          return false;
        });

        if (clicked) {
          this.log('✅ Clicked with JavaScript click()');
        } else {
          throw new Error('Could not click Sales/Transactions button with any method');
        }
      }

      this.log('✅ Sales/Transactions expand button clicked successfully');

      // Wait for AJAX content to load into the page
      this.log(`⏳ Waiting for Sales/Transactions content to load via AJAX...`);

      // Check if we got redirected (shouldn't happen with expand button)
      const currentUrl = this.page.url();
      if (currentUrl.includes('InvalidStrap') || currentUrl.includes('Error')) {
        this.log(`❌ ERROR: Redirected to error page: ${currentUrl}`);
        throw new Error('Page redirected to error page after clicking expand button');
      }

      this.log(`📍 Still on correct page: ${currentUrl}`);

      // Wait for the content to be loaded - specifically wait for table or content to appear
      try {
        await this.page.waitForFunction(() => {
          const salesSection = document.querySelector('#SalesDetails');
          if (!salesSection) return false;

          // Check if there's a table with content
          const tables = salesSection.querySelectorAll('table');
          if (tables.length === 0) return false;

          // Check if the table has rows with data (not just header)
          for (const table of tables) {
            const rows = table.querySelectorAll('tr');
            if (rows.length > 1) { // More than just header row
              return true;
            }
          }

          return false;
        }, { timeout: 30000 });

        this.log(`✅ Sales/Transactions table loaded with data`);
      } catch (waitError) {
        this.log(`⚠️  Timeout waiting for table data: ${waitError.message}`);
        this.log(`   Continuing anyway to check what content is available...`);
      }

      // Scroll to ensure content is loaded
      await this.page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await this.randomWait(2000, 3000);

      // Debug: Check what's in the SalesDetails section now
      const salesDebugInfo = await this.page.evaluate(() => {
        const salesSection = document.querySelector('#SalesDetails');
        if (!salesSection) {
          return { found: false };
        }

        const overFlowDiv = salesSection.querySelector('.overFlowDiv');
        const tables = salesSection.querySelectorAll('table');

        // Get more detailed table info
        const tableInfo = Array.from(tables).map(table => {
          const rows = table.querySelectorAll('tr');
          const cells = table.querySelectorAll('td, th');
          return {
            rowCount: rows.length,
            cellCount: cells.length,
            firstRowText: rows[0] ? rows[0].innerText.substring(0, 100) : '',
            hasClerkFileText: table.innerText.toLowerCase().includes('clerk file')
          };
        });

        return {
          found: true,
          sectionHTML: salesSection.innerHTML.substring(0, 1000),
          overFlowDivHTML: overFlowDiv ? overFlowDiv.innerHTML.substring(0, 500) : 'no overFlowDiv',
          overFlowDivText: overFlowDiv ? overFlowDiv.innerText.substring(0, 300) : 'no overFlowDiv',
          hasTable: tables.length > 0,
          tableCount: tables.length,
          tableInfo: tableInfo,
          sectionClasses: salesSection.className,
          sectionStyle: salesSection.style.cssText
        };
      });

      this.log(`📋 SalesDetails debug info:`);
      this.log(`   Has section: ${salesDebugInfo.found}`);
      this.log(`   Has table: ${salesDebugInfo.hasTable}`);
      this.log(`   Table count: ${salesDebugInfo.tableCount}`);
      this.log(`   Section classes: ${salesDebugInfo.sectionClasses}`);
      this.log(`   Section style: ${salesDebugInfo.sectionStyle}`);
      if (salesDebugInfo.tableInfo && salesDebugInfo.tableInfo.length > 0) {
        salesDebugInfo.tableInfo.forEach((info, i) => {
          this.log(`   Table ${i+1}: ${info.rowCount} rows, ${info.cellCount} cells, has 'clerk file': ${info.hasClerkFileText}`);
          this.log(`      First row: ${info.firstRowText}`);
        });
      }
      this.log(`   overFlowDiv text: ${salesDebugInfo.overFlowDivText?.substring(0, 200)}`);

      // Extract Clerk file numbers AND Book/Page references from the table
      this.log('🔍 Extracting deed references from Sales/Transactions table...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for table with deed reference columns
        const tables = Array.from(document.querySelectorAll('table'));
        console.log(`Found ${tables.length} tables on page`);

        for (const table of tables) {
          const tableText = (table.innerText || table.textContent || '').toLowerCase();
          console.log(`Table text includes: clerk=${tableText.includes('clerk file')}, instrument=${tableText.includes('instrument')}, sale=${tableText.includes('sale')}, file number=${tableText.includes('file number')}`);

          // Check if this table contains deed-related information
          if (tableText.includes('clerk file') ||
              tableText.includes('clerk') ||
              tableText.includes('instrument') ||
              tableText.includes('sale') ||
              tableText.includes('deed') ||
              tableText.includes('file number') ||
              tableText.includes('book')) {

            console.log('Found relevant table, checking rows...');

            // Find all rows
            const rows = table.querySelectorAll('tr');
            console.log(`Found ${rows.length} rows in table`);

            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td'));
              const rowText = cells.map(c => (c.textContent || '').trim()).join(' ');

              // Look for clerk file numbers in cells (typically 13 digits like 2022000220622)
              for (const cell of cells) {
                const text = (cell.textContent || '').trim();

                // Pattern 1: Clerk file number format: YYYYXXXXXXXXX (year + sequence)
                // Example: 2022000220622 (13 digits starting with year)
                const clerkFilePatterns = [
                  /^(20\d{11})$/,           // Exact 13 digits starting with 20
                  /(20\d{11})/,             // 13 digits starting with 20 anywhere in text
                  /^\d{13}$/,               // Any 13 digits
                  /(\d{13})/                // 13 digits anywhere in text
                ];

                for (const pattern of clerkFilePatterns) {
                  const match = text.match(pattern);
                  if (match) {
                    const clerkFileNumber = match[1] || match[0];
                    const exists = results.some(r => r.clerkFileNumber === clerkFileNumber);
                    if (!exists) {
                      console.log(`Found clerk file number: ${clerkFileNumber}`);
                      results.push({
                        clerkFileNumber: clerkFileNumber,
                        type: 'clerk_file',
                        source: 'Lee County Property Appraiser - Sales/Transactions',
                        rawText: text
                      });
                      break; // Found a match, no need to try other patterns
                    }
                  }
                }

                // Pattern 2: Book/Page format: XXX/XXX or XXXX/XXXX
                // Example: 595/615, 1234/5678
                const bookPageMatch = text.match(/^(\d{2,5})\/(\d{2,5})$/);
                if (bookPageMatch) {
                  const book = bookPageMatch[1];
                  const page = bookPageMatch[2];
                  const exists = results.some(r => r.bookNumber === book && r.pageNumber === page);
                  if (!exists) {
                    console.log(`Found Book/Page: ${book}/${page}`);
                    results.push({
                      bookNumber: book,
                      pageNumber: page,
                      type: 'book_page',
                      source: 'Lee County Property Appraiser - Sales/Transactions',
                      rawText: text
                    });
                  }
                }

                // Also look for links with CFN parameter
                const links = cell.querySelectorAll('a[href*="CFN"], a[href*="cfn"]');
                for (const link of links) {
                  const href = link.href || '';
                  const cfnMatch = href.match(/cfn=(\d+)/i);

                  if (cfnMatch) {
                    const exists = results.some(r => r.clerkFileNumber === cfnMatch[1]);
                    if (!exists) {
                      console.log(`Found clerk file number from link: ${cfnMatch[1]}`);
                      results.push({
                        clerkFileNumber: cfnMatch[1],
                        type: 'clerk_file',
                        source: 'Lee County Property Appraiser - Sales/Transactions (link)',
                        rawText: link.textContent?.trim() || cfnMatch[1]
                      });
                    }
                  }
                }
              }
            }
          }
        }

        console.log(`Total results found: ${results.length}`);
        return results;
      });

      if (transactions.length > 0) {
        this.log(`🔍 Extracted ${transactions.length} deed reference(s)`);
        transactions.forEach((t, i) => {
          if (t.type === 'clerk_file') {
            this.log(`   📄 #${i+1}: Clerk File Number ${t.clerkFileNumber}`);
          } else if (t.type === 'book_page') {
            this.log(`   📄 #${i+1}: Book ${t.bookNumber} Page ${t.pageNumber}`);
          }
        });

        return {
          success: true,
          transactions: transactions.map(t => {
            if (t.type === 'clerk_file') {
              return {
                instrumentNumber: t.clerkFileNumber,
                clerkFileNumber: t.clerkFileNumber,
                type: 'clerk_file',
                source: t.source
              };
            } else if (t.type === 'book_page') {
              return {
                bookNumber: t.bookNumber,
                pageNumber: t.pageNumber,
                type: 'book_page',
                source: t.source
              };
            }
          })
        };
      }

      this.log(`⚠️ No deed references found in Sales/Transactions table`);

      // Debug: Save screenshot and HTML
      try {
        const downloadPath = path.resolve(process.env.DEED_DOWNLOAD_PATH || './downloads');
        if (!fs.existsSync(downloadPath)) {
          fs.mkdirSync(downloadPath, { recursive: true });
        }
        const screenshotPath = path.join(downloadPath, 'lee_error_no_transactions.png');
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        this.log(`📸 Screenshot saved to: ${screenshotPath}`);

        const htmlContent = await this.page.content();
        const htmlPath = path.join(downloadPath, 'lee_error_no_transactions.html');
        await fs.promises.writeFile(htmlPath, htmlContent);
        this.log(`📄 HTML saved to: ${htmlPath}`);
      } catch (err) {
        this.log(`⚠️  Failed to save debug files: ${err.message}`);
      }

      return {
        success: false,
        message: 'No clerk file numbers found',
        transactions: []
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }

  /**
   * Download deed PDF from Lee County Clerk
   * Workflow:
   * 1. Directly navigate to PDF URL: https://or.leeclerk.org/LandMarkWeb/Document/GetDocumentByCFN/?cfn=2022000220622
   * 2. Download using Brevard County method (iframe + Save Document button)
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Lee County Clerk...');

    try {
      // Determine which type of reference we have
      let pdfUrl;
      let deedReference;

      if (transaction.clerkFileNumber || transaction.instrumentNumber) {
        // Modern Clerk File Number format
        const clerkFileNumber = transaction.clerkFileNumber || transaction.instrumentNumber;
        pdfUrl = `https://or.leeclerk.org/LandMarkWeb/Document/GetDocumentByCFN/?cfn=${clerkFileNumber}`;
        deedReference = `CFN ${clerkFileNumber}`;
        this.log(`📋 Using Clerk File Number: ${clerkFileNumber}`);
      } else if (transaction.bookNumber && transaction.pageNumber) {
        // Old Book/Page format
        const book = transaction.bookNumber;
        const page = transaction.pageNumber;
        pdfUrl = `https://or.leeclerk.org/LandmarkWeb/Document/GetDocumentByBookPage/?booktype=OR&Booknumber=${book}&Pagenumber=${page}`;
        deedReference = `Book ${book} Page ${page}`;
        this.log(`📋 Using Book/Page: ${book}/${page}`);
      } else {
        throw new Error('No deed reference found in transaction record (need CFN or Book/Page)');
      }

      this.log(`🌐 Navigating to PDF page: ${pdfUrl}`);

      // Set up download handling BEFORE navigating
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      // Set download behavior
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      this.log(`📁 Download path set to: ${downloadPath}`);

      // Set up popup/new page listener BEFORE navigating
      // This handles cases where the clerk site opens in a new tab
      let newPage = null;
      const newPagePromise = new Promise((resolve) => {
        this.browser.once('targetcreated', async (target) => {
          if (target.type() === 'page') {
            const page = await target.page();
            this.log(`🔔 New page detected: ${page.url()}`);
            resolve(page);
          }
        });
        // Timeout after 5 seconds if no new page
        setTimeout(() => resolve(null), 5000);
      });

      // Navigate to the PDF page
      try {
        await this.page.goto(pdfUrl, {
          waitUntil: 'networkidle0',
          timeout: 60000
        });
        this.log(`✅ PDF page loaded in current tab`);
      } catch (navError) {
        this.log(`⚠️  Navigation warning: ${navError.message}`);
        // Check if a new page was opened instead
        newPage = await newPagePromise;
        if (newPage) {
          this.log(`✅ PDF page loaded in new tab`);
          // Switch to the new page
          this.page = newPage;
          await this.randomWait(2000, 3000);
        } else {
          throw navError;
        }
      }

      // If no new page yet, check one more time
      if (!newPage) {
        newPage = await newPagePromise;
        if (newPage) {
          this.log(`✅ Switching to new page: ${newPage.url()}`);
          this.page = newPage;

          // Set up dialog handler for the new page
          this.page.on('dialog', async (dialog) => {
            this.log(`🔔 Dialog auto-dismissed on new page: ${dialog.type()} - "${dialog.message()}"`);
            try {
              await dialog.accept();
            } catch (err) {
              this.log(`⚠️  Failed to dismiss dialog: ${err.message}`);
            }
          });

          // Set up download behavior for the new page
          const newClient = await this.page.target().createCDPSession();
          await newClient.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
          });
          this.log(`📁 Download path configured for new page`);

          await this.randomWait(2000, 3000);
        }
      }

      this.log(`✅ PDF page loaded`);

      // Wait for the page to load
      await this.randomWait(3000, 5000);

      // Check if there's an iframe with PDF viewer (like Brevard)
      const iframeElement = await this.page.$('iframe');

      if (iframeElement) {
        this.log(`✅ Found PDF iframe`);

        // Get the iframe's content frame
        const frame = await iframeElement.contentFrame();

        if (frame) {
          this.log(`✅ Accessed iframe content`);

          // Wait for PDF viewer to load in iframe
          await this.randomWait(2000, 3000);

          // Look for "Save Document" button (like Brevard)
          this.log(`🔍 Looking for "Save Document" button...`);

          try {
            await frame.waitForSelector('#SaveDoc', { timeout: 10000 });

            this.log(`🔘 Found "Save Document" button (id=SaveDoc)`);

            // Click the button using evaluate
            await frame.evaluate(() => {
              const btn = document.querySelector('#SaveDoc');
              if (btn) {
                btn.click();
                return true;
              }
              return false;
            });

            this.log(`✅ Clicked "Save Document" button`);

            // Wait for download to complete
            this.log(`⏳ Waiting for PDF download to complete...`);
            await this.randomWait(5000, 8000);

            // Find the downloaded PDF
            const files = fs.readdirSync(downloadPath);
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

            if (pdfFiles.length === 0) {
              throw new Error('No PDF file found in download directory after clicking Save');
            }

            // Get the most recent PDF
            const latestPdf = pdfFiles.sort((a, b) => {
              const statA = fs.statSync(path.join(downloadPath, a));
              const statB = fs.statSync(path.join(downloadPath, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            })[0];

            const filepath = path.join(downloadPath, latestPdf);
            const stats = fs.statSync(filepath);

            // Read the PDF to get base64
            const pdfBuffer = fs.readFileSync(filepath);
            const pdfBase64 = pdfBuffer.toString('base64');

            this.log(`✅ PDF downloaded successfully: ${latestPdf}`);
            this.log(`💾 File size: ${(stats.size / 1024).toFixed(2)} KB`);

            // Rename to standard format
            const sanitizedRef = deedReference.replace(/[^a-zA-Z0-9]/g, '_');
            const filename = `lee_deed_${sanitizedRef}.pdf`;
            const newFilepath = path.join(downloadPath, filename);

            if (filepath !== newFilepath) {
              fs.renameSync(filepath, newFilepath);
              this.log(`📝 Renamed to: ${filename}`);
            }

            return {
              success: true,
              filename,
              downloadPath,
              filepath: newFilepath,
              deedReference,
              clerkFileNumber: transaction.clerkFileNumber,
              bookNumber: transaction.bookNumber,
              pageNumber: transaction.pageNumber,
              instrumentNumber: clerkFileNumber,
              pdfUrl,
              timestamp: new Date().toISOString(),
              fileSize: stats.size,
              pdfBase64
            };

          } catch (saveButtonError) {
            this.log(`⚠️ Could not find Save Document button: ${saveButtonError.message}`);
            // Fall through to alternative download method
          }
        }
      }

      // Alternative: Try to download PDF directly from current page
      this.log('ℹ️  Trying to download PDF directly from page...');

      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      // Try to download PDF using fetch
      const pdfArrayBuffer = await this.page.evaluate(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        } catch (err) {
          return null;
        }
      }, currentUrl);

      if (!pdfArrayBuffer) {
        throw new Error('Could not download PDF - iframe Save button not found and direct download failed');
      }

      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`);

      const sanitizedRef = deedReference.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `lee_deed_${sanitizedRef}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        filepath,
        deedReference,
        clerkFileNumber: transaction.clerkFileNumber,
        bookNumber: transaction.bookNumber,
        pageNumber: transaction.pageNumber,
        instrumentNumber: transaction.clerkFileNumber || transaction.instrumentNumber,
        pdfUrl,
        timestamp: new Date().toISOString(),
        fileSize: pdfBuffer.length,
        pdfBase64: pdfBuffer.toString('base64')
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

module.exports = LeeCountyFloridaScraper;
