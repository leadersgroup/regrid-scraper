/**
 * Bexar County, Texas - Deed Scraper Implementation
 *
 * County Resources:
 * - Appraisal District: https://esearch.bcad.org/ (3505 Pleasanton Rd., San Antonio, TX 7822)
 * - Deed Records: https://bexar.tx.publicsearch.us/
 *
 * Workflow:
 * 1. Navigate to BCAD (Bexar County Appraisal District) property search
 * 2. Switch to "By Address" search type
 * 3. Enter street number, street name, and condo (optional)
 * 4. Search and click on 1st entry of search result
 * 5. Locate Property Deed History table and extract Doc number
 * 6. Navigate to deed record page (bexar.tx.publicsearch.us)
 * 7. Search for Doc number
 * 8. Click on the result entry
 * 9. Download deed image and convert to PDF
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class BexarCountyTexasScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Bexar';
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
      protocolTimeout: 600000, // Increased to 10 minutes for slower operations
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
   * Parse address into components for BCAD search
   * Example: "123 Main St, San Antonio, TX 78201" -> { streetNumber: "123", streetName: "Main St" }
   */
  parseAddress(address) {
    // Remove everything after first comma (city, state, zip)
    const streetPart = address.split(',')[0].trim();

    // Match street number (first group of digits)
    const numberMatch = streetPart.match(/^(\d+)/);
    const streetNumber = numberMatch ? numberMatch[1] : '';

    // Street name is everything after the number
    let streetName = streetPart.replace(/^\d+\s*/, '').trim();

    // Remove common street suffixes that might interfere with search
    const suffixesToRemove = [
      '\\bDr\\.?$',
      '\\bDrive$',
      '\\bSt\\.?$',
      '\\bStreet$',
      '\\bAve\\.?$',
      '\\bAvenue$',
      '\\bRd\\.?$',
      '\\bRoad$',
      '\\bLn\\.?$',
      '\\bLane$',
      '\\bCt\\.?$',
      '\\bCourt$',
      '\\bBlvd\\.?$',
      '\\bBoulevard$',
      '\\bPl\\.?$',
      '\\bPlace$',
      '\\bWay$',
      '\\bCir\\.?$',
      '\\bCircle$',
      '\\bPkwy\\.?$',
      '\\bParkway$',
      '\\bTer\\.?$',
      '\\bTerrace$'
    ];

    for (const suffix of suffixesToRemove) {
      const regex = new RegExp(suffix, 'i');
      streetName = streetName.replace(regex, '').trim();
    }

    return { streetNumber, streetName };
  }

  /**
   * Search BCAD for property by address
   * Returns property information and doc number from deed history
   */
  async searchBCAD(address) {
    this.log(`🔍 Searching BCAD for: ${address}`);

    try {
      // Set up dialog/alert handler before navigating
      this.page.on('dialog', async dialog => {
        this.log(`⚠️ Dialog detected: ${dialog.type()} - "${dialog.message()}"`);
        await dialog.accept();
        this.log('✅ Dialog dismissed');
      });

      // Navigate to BCAD property search
      this.log('📍 Loading BCAD property search...');
      await this.page.goto('https://esearch.bcad.org/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(3000, 5000);

      // Check for reCAPTCHA and solve if present
      this.log('🔍 Checking for reCAPTCHA...');
      const hasCaptcha = await this.page.evaluate(() => {
        // Check for reCAPTCHA iframe or challenge
        const recaptchaIframe = document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
        const accessDenied = document.body.innerText.includes('Access denied') ||
                            document.body.innerText.includes('reCAPTCHA validation failed');
        return !!(recaptchaIframe || accessDenied);
      });

      if (hasCaptcha) {
        this.log('⚠️ reCAPTCHA detected, attempting to solve...');

        // Get site key
        const siteKey = await this.page.evaluate(() => {
          // Try to find site key in various places
          const iframe = document.querySelector('iframe[src*="recaptcha"]');
          if (iframe) {
            const src = iframe.getAttribute('src');
            const match = src.match(/[?&]k=([^&]+)/);
            if (match) return match[1];
          }

          // Look in scripts
          const scripts = Array.from(document.querySelectorAll('script'));
          for (const script of scripts) {
            const text = script.textContent || '';
            const match = text.match(/sitekey['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
            if (match) return match[1];
          }

          return null;
        });

        if (siteKey) {
          this.log(`🔑 Found site key: ${siteKey.substring(0, 20)}...`);

          // Use parent class's CAPTCHA solver
          try {
            const captchaToken = await this.solveCaptchaManually(siteKey, this.page.url());

            // Inject the CAPTCHA solution
            await this.page.evaluate((token) => {
              const responseElement = document.getElementById('g-recaptcha-response');
              if (responseElement) {
                responseElement.innerHTML = token;
              }

              // Also set in hidden textarea if exists
              const textareas = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
              textareas.forEach(ta => ta.value = token);

              // Trigger callback if available
              if (typeof ___grecaptcha_cfg !== 'undefined') {
                const clientIds = Object.keys(___grecaptcha_cfg.clients || {});
                if (clientIds.length > 0) {
                  const recaptchaId = clientIds[0];
                  const callback = ___grecaptcha_cfg.clients[recaptchaId]?.callback;
                  if (callback) {
                    callback(token);
                  }
                }
              }
            }, captchaToken);

            this.log('✅ CAPTCHA solution injected');
            await this.randomWait(2000, 3000);

            // Reload the page or submit to verify CAPTCHA
            this.log('🔄 Reloading page to apply CAPTCHA solution...');
            await this.page.reload({ waitUntil: 'networkidle2' });
            await this.randomWait(3000, 5000);
          } catch (captchaError) {
            this.log(`❌ CAPTCHA solving failed: ${captchaError.message}`);
            throw new Error('CAPTCHA solving failed. Please check TWOCAPTCHA_TOKEN environment variable.');
          }
        } else {
          this.log('⚠️ Could not find reCAPTCHA site key');
        }
      } else {
        this.log('✅ No CAPTCHA detected');
      }

      await this.randomWait(2000, 3000);

      // Check for and close any popups/modals
      const popupClosed = await this.page.evaluate(() => {
        // Look for common popup close buttons
        const closeButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        for (const btn of closeButtons) {
          const text = (btn.textContent || '').toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

          if (text.includes('close') || text.includes('×') || text === 'x' ||
              ariaLabel.includes('close') || btn.className.includes('close')) {
            btn.click();
            return { closed: true, method: 'close-button' };
          }
        }

        // Look for modal overlays to click away
        const modals = document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="overlay"]');
        for (const modal of modals) {
          if (modal.style.display !== 'none') {
            // Try to find close button within modal
            const modalClose = modal.querySelector('[class*="close"], button');
            if (modalClose) {
              modalClose.click();
              return { closed: true, method: 'modal-close' };
            }
          }
        }

        return { closed: false };
      });

      if (popupClosed.closed) {
        this.log(`✅ Closed popup (${popupClosed.method})`);
        await this.randomWait(1000, 2000);
      }

      // Add user interaction to avoid "Please interact with the page" alert
      this.log('🖱️ Adding user interaction...');
      await this.page.mouse.move(100, 100);
      await this.randomWait(500, 1000);
      await this.page.mouse.move(200, 200);
      await this.randomWait(500, 1000);
      await this.page.click('body');
      await this.randomWait(1000, 2000);

      // Step 1: Switch to "By Address" search type
      this.log('📝 Switching to "By Address" search...');

      const searchTypeSwitched = await this.page.evaluate(() => {
        // Look for radio button or dropdown to switch to address search
        // Common patterns: radio buttons, tabs, or dropdowns

        // Strategy 1: Look for radio buttons
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        for (const radio of radios) {
          const label = radio.parentElement?.textContent || '';
          if (label.toLowerCase().includes('address')) {
            radio.click();
            return { success: true, method: 'radio' };
          }
        }

        // Strategy 2: Look for tabs or links
        const links = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        for (const link of links) {
          const text = link.textContent?.trim().toLowerCase() || '';
          if (text.includes('by address') || text === 'address') {
            link.click();
            return { success: true, method: 'tab/link' };
          }
        }

        // Strategy 3: Look for dropdown
        const selects = Array.from(document.querySelectorAll('select'));
        for (const select of selects) {
          const options = Array.from(select.options);
          for (const option of options) {
            if (option.textContent.toLowerCase().includes('address')) {
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true, method: 'dropdown' };
            }
          }
        }

        return { success: false };
      });

      if (searchTypeSwitched.success) {
        this.log(`✅ Switched to Address search (${searchTypeSwitched.method})`);
        await this.randomWait(1000, 2000);
      } else {
        this.log('⚠️ Could not find address search option, assuming already selected');
      }

      // Step 2: Parse and enter address components
      const { streetNumber, streetName } = this.parseAddress(address);
      this.log(`📝 Street Number: "${streetNumber}", Street Name: "${streetName}"`);

      // Find and fill street number field
      const streetNumberFilled = await this.page.evaluate((num) => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));

        // Look for input with label/placeholder containing "number"
        for (const input of inputs) {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';
          const name = input.name?.toLowerCase() || '';
          const id = input.id?.toLowerCase() || '';

          if (label.includes('street number') || label.includes('number') ||
              placeholder.includes('street number') || placeholder.includes('number') ||
              name.includes('number') || id.includes('number')) {
            input.value = num;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, field: 'street number' };
          }
        }

        return { success: false };
      }, streetNumber);

      if (streetNumberFilled.success) {
        this.log('✅ Entered street number');
      } else {
        this.log('⚠️ Could not find street number field');
      }

      await this.randomWait(500, 1000);

      // Find and fill street name field
      const streetNameFilled = await this.page.evaluate((name) => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));

        // Look for input with label/placeholder containing "street name" or "name"
        for (const input of inputs) {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';
          const inputName = input.name?.toLowerCase() || '';
          const id = input.id?.toLowerCase() || '';

          if (label.includes('street name') || label.includes('street') ||
              placeholder.includes('street name') || placeholder.includes('street') ||
              inputName.includes('street') || id.includes('street')) {
            // Make sure it's not the number field
            if (!label.includes('number') && !placeholder.includes('number') &&
                !inputName.includes('number') && !id.includes('number')) {
              input.value = name;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              return { success: true, field: 'street name' };
            }
          }
        }

        return { success: false };
      }, streetName);

      if (streetNameFilled.success) {
        this.log('✅ Entered street name');
      } else {
        this.log('⚠️ Could not find street name field');
      }

      await this.randomWait(1000, 2000);

      // Step 3: Get reCAPTCHA token before submitting (for invisible reCAPTCHA v3)
      this.log('🔍 Getting reCAPTCHA token for form submission...');

      const siteKey = await this.page.evaluate(() => {
        // Look for reCAPTCHA v3 site key
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';
          const match = text.match(/sitekey['"]?\s*[:=]\s*['"]([^'"]+)['"]/i);
          if (match) return match[1];
        }

        // Also check for grecaptcha.execute calls
        for (const script of scripts) {
          const text = script.textContent || '';
          const match = text.match(/grecaptcha\.execute\(['"]([^'"]+)['"]/);
          if (match) return match[1];
        }

        return null;
      });

      if (siteKey) {
        this.log(`🔑 Found reCAPTCHA v3 site key: ${siteKey.substring(0, 20)}...`);

        try {
          // Get reCAPTCHA v3 token using 2Captcha
          const captchaToken = await this.solveCaptchaManually(siteKey, this.page.url());

          // Inject the token into the page
          await this.page.evaluate((token) => {
            // Store token in a global variable that the form can use
            window.__recaptchaToken = token;

            // Also try to inject into any hidden inputs
            const inputs = document.querySelectorAll('input[name="recaptchaToken"], input[name="g-recaptcha-response"]');
            inputs.forEach(input => input.value = token);
          }, captchaToken);

          this.log('✅ reCAPTCHA v3 token injected');
        } catch (captchaError) {
          this.log(`⚠️ Could not solve reCAPTCHA: ${captchaError.message}`);
          this.log('⚠️ Continuing without reCAPTCHA token - may fail');
        }
      } else {
        this.log('⚠️ Could not find reCAPTCHA v3 site key');
      }

      await this.randomWait(1000, 2000);

      // Add realistic user interactions before search button click
      this.log('🖱️ Simulating realistic user behavior...');

      // Move mouse naturally across the page
      await this.page.mouse.move(150, 150);
      await this.randomWait(300, 600);
      await this.page.mouse.move(250, 200);
      await this.randomWait(300, 600);

      // Click on the street number input to simulate focus
      await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));
        for (const input of inputs) {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';
          if (label.includes('number') || placeholder.includes('number')) {
            input.focus();
            input.click();
            return;
          }
        }
      });

      await this.randomWait(500, 800);

      // Click on the street name input
      await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
        for (const input of inputs) {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';
          if ((label.includes('street') || placeholder.includes('street')) &&
              !label.includes('number') && !placeholder.includes('number')) {
            input.focus();
            input.click();
            return;
          }
        }
      });

      await this.randomWait(500, 800);

      // Move mouse to where search button likely is
      await this.page.mouse.move(300, 350);
      await this.randomWait(400, 700);

      // Step 4: Submit search
      this.log('🔍 Submitting search...');

      const searchSubmitted = await this.page.evaluate(() => {
        // Look for search/submit button
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));

        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit') || text.includes('find')) {
            button.click();
            return { success: true, buttonText: text };
          }
        }

        // Try submitting the form directly
        const form = document.querySelector('form');
        if (form) {
          form.submit();
          return { success: true, buttonText: 'form-submit' };
        }

        return { success: false };
      });

      if (!searchSubmitted.success) {
        throw new Error('Could not find or click search button');
      }

      this.log(`✅ Search submitted (${searchSubmitted.buttonText})`);

      // Wait for search results
      this.log('⏳ Waiting for search results...');
      await this.randomWait(3000, 5000);

      // Wait for navigation or results to appear
      await this.page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('result') || text.includes('property') ||
               document.querySelectorAll('table tr').length > 5;
      }, { timeout: 30000 }).catch(() => {
        this.log('⚠️ Results detection timeout, continuing anyway...');
      });

      // Step 4: Click on 1st entry of search result
      this.log('🖱️ Clicking on first search result...');

      const firstResultClicked = await this.page.evaluate(() => {
        // Look for results in a table
        const tables = document.querySelectorAll('table');

        for (const table of tables) {
          const rows = table.querySelectorAll('tbody tr');
          if (rows.length > 0) {
            // Click first row or first link in first row
            const firstRow = rows[0];
            const link = firstRow.querySelector('a');

            if (link) {
              link.click();
              return { success: true, method: 'link' };
            } else if (firstRow.onclick || firstRow.style.cursor === 'pointer') {
              firstRow.click();
              return { success: true, method: 'row' };
            }
          }
        }

        // Alternative: look for any clickable result item
        const resultLinks = Array.from(document.querySelectorAll('a'));
        for (const link of resultLinks) {
          const text = link.textContent?.toLowerCase() || '';
          const href = link.href?.toLowerCase() || '';

          if (href.includes('property') || href.includes('detail') ||
              text.match(/\d{5,}/)) { // Property ID pattern
            link.click();
            return { success: true, method: 'result-link' };
          }
        }

        return { success: false };
      });

      if (!firstResultClicked.success) {
        throw new Error('Could not find or click first search result');
      }

      this.log(`✅ Clicked first result (${firstResultClicked.method})`);

      // Wait for property detail page to load
      this.log('⏳ Waiting for property detail page...');
      await this.randomWait(3000, 5000);

      await this.page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('deed') || text.includes('property') ||
               text.includes('owner') || text.includes('parcel');
      }, { timeout: 30000 }).catch(() => {
        this.log('⚠️ Property detail page detection timeout, continuing...');
      });

      // Step 5: Locate Property Deed History table and extract Doc number
      this.log('🔍 Looking for Property Deed History table...');

      const deedInfo = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Strategy 1: Find table with "Deed History" or similar header
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const tableText = table.innerText || '';

          // Check if this table contains deed history
          if (tableText.toLowerCase().includes('deed') &&
              (tableText.toLowerCase().includes('history') ||
               tableText.toLowerCase().includes('doc') ||
               tableText.toLowerCase().includes('document'))) {

            // Look for document number in this table
            // Pattern: D + digits (like D2023012345)
            const docMatch = tableText.match(/\b(D\d{9,})\b/);
            if (docMatch) {
              return {
                success: true,
                docNumber: docMatch[1],
                method: 'table-pattern'
              };
            }

            // Alternative: look for any document number pattern
            const altDocMatch = tableText.match(/(?:doc|document)[\s#:]+(\d{8,})/i);
            if (altDocMatch) {
              return {
                success: true,
                docNumber: altDocMatch[1],
                method: 'table-doc-pattern'
              };
            }
          }
        }

        // Strategy 2: Search entire page for doc number if table not found
        const docMatch = bodyText.match(/\b(D\d{9,})\b/);
        if (docMatch) {
          return {
            success: true,
            docNumber: docMatch[1],
            method: 'page-pattern'
          };
        }

        // Strategy 3: Look for "Doc Number" or "Document Number" label
        const elements = Array.from(document.querySelectorAll('td, div, span, label'));
        for (let i = 0; i < elements.length; i++) {
          const elem = elements[i];
          const text = elem.textContent?.trim().toLowerCase() || '';

          if (text.includes('doc number') || text.includes('document number') ||
              text === 'doc' || text === 'document') {
            // Look at next sibling or next element
            const nextElem = elements[i + 1];
            if (nextElem) {
              const nextText = nextElem.textContent?.trim() || '';
              const match = nextText.match(/\b([A-Z]?\d{8,})\b/);
              if (match) {
                return {
                  success: true,
                  docNumber: match[1],
                  method: 'label-adjacent'
                };
              }
            }
          }
        }

        return { success: false };
      });

      if (!deedInfo.success) {
        throw new Error('Could not find Doc number in Property Deed History');
      }

      this.log(`✅ Found Doc number: ${deedInfo.docNumber} (${deedInfo.method})`);

      return {
        success: true,
        docNumber: deedInfo.docNumber
      };

    } catch (error) {
      this.log(`❌ BCAD search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search and download deed from bexar.tx.publicsearch.us
   */
  async downloadDeedFromPublicSearch(docNumber) {
    this.log(`📄 Downloading deed from Public Search: ${docNumber}`);

    try {
      // Step 1: Navigate to deed record page
      this.log('📍 Loading Bexar County Public Search...');
      await this.page.goto('https://bexar.tx.publicsearch.us/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(3000, 5000);

      // Step 2: Search for Doc number
      this.log(`🔍 Searching for Doc number: ${docNumber}`);

      // Find search input field
      const searchInputFilled = await this.page.evaluate((doc) => {
        // Look for input fields
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])'));

        for (const input of inputs) {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = input.placeholder?.toLowerCase() || '';
          const name = input.name?.toLowerCase() || '';
          const id = input.id?.toLowerCase() || '';

          // Look for document number field
          if (label.includes('document') || label.includes('doc') ||
              placeholder.includes('document') || placeholder.includes('doc') ||
              name.includes('document') || name.includes('doc') ||
              id.includes('document') || id.includes('doc') ||
              placeholder.includes('search') || label.includes('search')) {

            input.value = doc;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, field: 'document' };
          }
        }

        // Fallback: use first visible text input
        for (const input of inputs) {
          if (input.offsetParent !== null) { // visible
            input.value = doc;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            return { success: true, field: 'first-visible-input' };
          }
        }

        return { success: false };
      }, docNumber);

      if (!searchInputFilled.success) {
        throw new Error('Could not find search input field');
      }

      this.log(`✅ Entered doc number in ${searchInputFilled.field} field`);
      await this.randomWait(1000, 2000);

      // Submit search
      this.log('🔍 Submitting search...');

      const searchSubmitted = await this.page.evaluate(() => {
        // Look for search button
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));

        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit') || text.includes('find')) {
            button.click();
            return { success: true, buttonText: text };
          }
        }

        return { success: false };
      });

      if (searchSubmitted.success) {
        this.log(`✅ Search submitted (${searchSubmitted.buttonText})`);
      } else {
        // Try pressing Enter
        this.log('⚠️ Search button not found, trying Enter key...');
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results
      this.log('⏳ Waiting for search results...');
      await this.randomWait(3000, 5000);

      await this.page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('result') || text.includes('document') ||
               document.querySelectorAll('table tr').length > 3;
      }, { timeout: 30000 }).catch(() => {
        this.log('⚠️ Results timeout, continuing...');
      });

      // Step 3: Click on the result entry
      this.log('🖱️ Clicking on search result entry...');

      const resultClicked = await this.page.evaluate((doc) => {
        // Strategy 1: Find row containing the doc number
        const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));

        for (const row of rows) {
          const rowText = row.textContent || '';
          if (rowText.includes(doc)) {
            // Try clicking link in row
            const link = row.querySelector('a');
            if (link) {
              link.click();
              return { success: true, method: 'row-link' };
            }

            // Try clicking row itself
            if (row.onclick || row.style.cursor === 'pointer') {
              row.click();
              return { success: true, method: 'row-click' };
            }
          }
        }

        // Strategy 2: Find any link with doc number
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent?.includes(doc)) {
            link.click();
            return { success: true, method: 'doc-link' };
          }
        }

        // Strategy 3: Click first result
        const firstResultRow = document.querySelector('tbody tr');
        if (firstResultRow) {
          const link = firstResultRow.querySelector('a');
          if (link) {
            link.click();
            return { success: true, method: 'first-result' };
          }
        }

        return { success: false };
      }, docNumber);

      if (!resultClicked.success) {
        throw new Error('Could not find or click search result');
      }

      this.log(`✅ Clicked result (${resultClicked.method})`);

      // Wait for document detail page
      this.log('⏳ Waiting for document detail page...');
      await this.randomWait(3000, 5000);

      // Step 4: Download deed image/PDF
      this.log('📥 Looking for download button...');

      // Set up CDP to intercept PDF downloads
      const client = await this.page.target().createCDPSession();
      await client.send('Fetch.enable', {
        patterns: [
          {
            urlPattern: '*',
            requestStage: 'Response'
          }
        ]
      });

      this.log('✅ CDP Fetch enabled for PDF capture');

      const pdfBuffer = await new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('PDF download timeout after 60 seconds'));
        }, 60000);

        client.on('Fetch.requestPaused', async (event) => {
          try {
            if (event.responseHeaders) {
              const contentType = event.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');

              // Check for PDF or image content
              if (contentType && (contentType.value.toLowerCase().includes('pdf') ||
                                  contentType.value.toLowerCase().includes('image'))) {
                this.log(`🎉 Document detected (${contentType.value})! Capturing...`);

                try {
                  const response = await client.send('Fetch.getResponseBody', {
                    requestId: event.requestId
                  });

                  let buffer;
                  if (response.base64Encoded) {
                    buffer = Buffer.from(response.body, 'base64');
                  } else {
                    buffer = Buffer.from(response.body);
                  }

                  clearTimeout(timeout);

                  // Check if it's a PDF
                  const isPDF = buffer.slice(0, 4).toString() === '%PDF';
                  this.log(`   Buffer size: ${buffer.length} bytes, isPDF: ${isPDF}`);

                  if (buffer.length > 1000) { // Minimum size check
                    this.log(`✅ Document captured successfully`);
                    resolve(buffer);
                  }
                } catch (e) {
                  this.log(`⚠️ Error getting response body: ${e.message}`);
                }
              }
            }

            // Continue the request
            try {
              await client.send('Fetch.continueRequest', {
                requestId: event.requestId
              });
            } catch (e) {
              // May already be handled
            }
          } catch (e) {
            // Continue anyway
          }
        });

        // Try to find and click download button
        const downloadClicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));

          for (const button of buttons) {
            const text = (button.textContent || button.value || '').toLowerCase();
            if (text.includes('download') || text.includes('view') ||
                text.includes('pdf') || text.includes('image') ||
                text.includes('document')) {
              button.click();
              return { success: true, buttonText: text };
            }
          }

          // Look for image or iframe that might contain the document
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.src) {
            window.location.href = iframe.src;
            return { success: true, buttonText: 'iframe-src' };
          }

          const img = document.querySelector('img[src*="document"], img[src*="deed"], img[src*="image"]');
          if (img && img.src) {
            window.location.href = img.src;
            return { success: true, buttonText: 'image-src' };
          }

          return { success: false };
        });

        if (downloadClicked.success) {
          this.log(`✅ Clicked: ${downloadClicked.buttonText}`);
        } else {
          this.log('⚠️ Could not find download button, waiting for auto-load...');
        }
      });

      this.log(`✅ Document downloaded successfully (${pdfBuffer.length} bytes)`);

      return {
        success: true,
        docNumber: docNumber,
        pdfData: pdfBuffer.toString('base64'),
        fileSize: pdfBuffer.length,
        message: 'Document downloaded successfully',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log(`❌ Download failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Main scraping method
   */
  async scrape(address) {
    this.log(`\n${'='.repeat(80)}`);
    this.log(`🚀 Starting Bexar County deed scrape for: ${address}`);
    this.log(`${'='.repeat(80)}\n`);

    try {
      // Step 1: Search BCAD and get doc number
      const searchResult = await this.searchBCAD(address);

      if (!searchResult.success) {
        return searchResult;
      }

      // Step 2: Download the deed from public search
      const downloadResult = await this.downloadDeedFromPublicSearch(searchResult.docNumber);

      return downloadResult;

    } catch (error) {
      this.log(`❌ Scraping failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * getPriorDeed - Alias for scrape() to match server API expectations
   */
  async getPriorDeed(address) {
    return await this.scrape(address);
  }

  /**
   * Random wait helper
   */
  async randomWait(min, max) {
    const wait = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

module.exports = BexarCountyTexasScraper;
