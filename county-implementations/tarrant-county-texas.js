/**
 * Tarrant County, Texas - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Search: https://www.tad.org/index
 * - Credentials: ericatl828@gmail.com / Cdma2000@1
 *
 * Workflow:
 * 1. Search property by address on TAD (Tarrant Appraisal District)
 * 2. Click on account number from results
 * 3. Find and click on Instrument number (e.g., D225045226)
 * 4. Click on instrument number again to view PDF
 * 5. Login if required and download PDF
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class TarrantCountyTexasScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Tarrant';
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
   * Search TAD for property by address
   * Returns account number and instrument number
   */
  async searchTAD(address) {
    this.log(`🔍 Searching TAD for: ${address}`);

    try {
      // Navigate to TAD property search
      this.log('📍 Loading TAD property search...');
      await this.page.goto('https://www.tad.org/index', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(3000, 5000);

      // Set search type to "property address"
      this.log('📝 Setting search type to Property Address...');

      // Look for dropdown/select for search type
      const searchTypeSet = await this.page.evaluate(() => {
        // Try to find and set property address option
        const selects = Array.from(document.querySelectorAll('select'));
        for (const select of selects) {
          const options = Array.from(select.options);
          for (const option of options) {
            if (option.textContent.toLowerCase().includes('property address') ||
                option.textContent.toLowerCase().includes('address')) {
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return true;
            }
          }
        }

        // Try radio buttons
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        for (const radio of radios) {
          const label = radio.parentElement?.textContent || '';
          if (label.toLowerCase().includes('property address') ||
              label.toLowerCase().includes('address')) {
            radio.click();
            return true;
          }
        }

        return false;
      });

      if (searchTypeSet) {
        this.log('✅ Set search type to Property Address');
      } else {
        this.log('⚠️ Could not find property address option, continuing anyway');
      }

      await this.randomWait(1000, 2000);

      // Enter search address (without city and state)
      // Remove city and state from address: "1009 WICKWOOD Ct. FORT WORTH, TX 76131" -> "1009 WICKWOOD Ct"
      const addressParts = address.split(',')[0].trim(); // Get everything before first comma
      this.log(`📝 Entering address: ${addressParts}`);

      // Find search input box
      const searchInputSelectors = [
        'input[name*="search"]',
        'input[id*="search"]',
        'input[placeholder*="search"]',
        'input[type="text"]'
      ];

      let searchInput = null;
      for (const selector of searchInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchInput = selector;
          this.log(`✅ Found search input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchInput) {
        throw new Error('Could not find search input field');
      }

      // Clear and type in search input
      await this.page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
          input.focus();
        }
      }, searchInput);

      await this.randomWait(500, 1000);
      await this.page.type(searchInput, addressParts, { delay: 50 });

      await this.randomWait(1000, 2000);

      // Submit the search form
      this.log('🔍 Submitting search...');

      const formSubmitted = await this.page.evaluate(() => {
        // Strategy 1: Find and click search button
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
        for (const button of buttons) {
          const text = (button.textContent || button.value || button.innerText || '').toLowerCase();
          if (text.includes('search') || text.includes('find') || text.includes('go')) {
            try {
              button.click();
              return { method: 'button', text };
            } catch (e) {
              // Continue to next strategy
            }
          }
        }

        // Strategy 2: Submit the form directly
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
          const formText = form.innerText.toLowerCase();
          if (formText.includes('property') || formText.includes('search') || formText.includes('address')) {
            try {
              form.submit();
              return { method: 'form' };
            } catch (e) {
              // Continue
            }
          }
        }

        return { method: 'none' };
      });

      this.log(`📝 Form submission: ${formSubmitted.method}`);

      if (formSubmitted.method === 'none') {
        // Fallback: Press Enter in the search field
        this.log('⚠️ Trying Enter key as fallback...');
        await this.page.keyboard.press('Enter');
      }

      this.log('⏳ Waiting for search results...');
      await this.randomWait(7000, 10000);

      // Wait for results to load
      await this.page.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('Account') || text.includes('account') || /\d{8}/.test(text);
      }, { timeout: 30000 });

      this.log('✅ Search results loaded');

      // Log page content for debugging
      const pageDebug = await this.page.evaluate(() => {
        return {
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 300)
        };
      });
      this.log(`📄 Current URL: ${pageDebug.url}`);
      this.log(`📄 Page text: ${pageDebug.bodyText.substring(0, 150)}...`);

      // Click on account number (e.g., 07042744)
      this.log('🖱️ Looking for account number...');

      const accountClicked = await this.page.evaluate(() => {
        // Look for 8-digit account numbers
        const links = Array.from(document.querySelectorAll('a, td, div, span'));
        const debugInfo = [];

        for (const element of links) {
          const text = element.textContent?.trim() || '';
          const match = text.match(/\b\d{8}\b/);

          if (match) {
            const accountNumber = match[0];
            debugInfo.push(`Found ${accountNumber} in ${element.tagName}`);

            // Try to click if it's a link
            if (element.tagName === 'A') {
              element.click();
              return { clicked: true, accountNumber, debugInfo };
            }

            // If it's in a table cell, try to find a link in the same row
            if (element.tagName === 'TD') {
              const row = element.closest('tr');
              const link = row?.querySelector('a');
              if (link) {
                link.click();
                return { clicked: true, accountNumber, debugInfo };
              }
            }

            // Try clicking the element itself
            if (typeof element.click === 'function') {
              element.click();
              return { clicked: true, accountNumber, debugInfo };
            }
          }
        }

        return { clicked: false, debugInfo };
      });

      if (accountClicked.debugInfo && accountClicked.debugInfo.length > 0) {
        this.log(`🔍 Debug: ${accountClicked.debugInfo.join(', ')}`);
      }

      if (!accountClicked.clicked) {
        throw new Error('Could not find or click account number');
      }

      this.log(`✅ Clicked on account number: ${accountClicked.accountNumber}`);

      await this.randomWait(5000, 7000);

      // Wait for property detail page to load
      await this.page.waitForFunction(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('owner information') ||
               text.includes('instrument') ||
               text.includes('property');
      }, { timeout: 30000 });

      this.log('✅ Property detail page loaded');

      // Find instrument number (e.g., D225045226)
      this.log('🔍 Looking for Instrument number...');

      const instrumentData = await this.page.evaluate(() => {
        const text = document.body.innerText;

        // Look for instrument numbers starting with D followed by numbers
        const match = text.match(/\b(D\d{9})\b/);

        if (match) {
          return { instrumentNumber: match[1] };
        }

        return null;
      });

      if (!instrumentData) {
        throw new Error('Could not find instrument number');
      }

      this.log(`✅ Found instrument number: ${instrumentData.instrumentNumber}`);

      return {
        success: true,
        accountNumber: accountClicked.accountNumber,
        instrumentNumber: instrumentData.instrumentNumber
      };

    } catch (error) {
      this.log(`❌ TAD search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download deed PDF from TAD
   */
  async downloadDeed(instrumentNumber) {
    this.log(`📄 Downloading deed PDF: ${instrumentNumber}`);

    try {
      // Click on instrument number to view details
      this.log(`🖱️ Clicking on instrument number: ${instrumentNumber}...`);

      const firstClickDone = await this.page.evaluate((instNum) => {
        const elements = Array.from(document.querySelectorAll('a, td, div, span'));

        for (const element of elements) {
          const text = element.textContent?.trim() || '';

          if (text === instNum) {
            if (element.tagName === 'A') {
              element.click();
              return true;
            }

            if (element.click) {
              element.click();
              return true;
            }
          }
        }

        return false;
      }, instrumentNumber);

      if (!firstClickDone) {
        throw new Error(`Could not click on instrument number: ${instrumentNumber}`);
      }

      this.log('✅ Clicked on first instrument number link');
      await this.randomWait(5000, 7000);

      // Click on instrument number again to view PDF
      this.log(`🖱️ Clicking on instrument number again to view PDF...`);

      const secondClickDone = await this.page.evaluate((instNum) => {
        const elements = Array.from(document.querySelectorAll('a, td, div, span'));

        for (const element of elements) {
          const text = element.textContent?.trim() || '';

          if (text.includes(instNum) || text === instNum) {
            if (element.tagName === 'A') {
              element.click();
              return true;
            }

            if (element.click) {
              element.click();
              return true;
            }
          }
        }

        return false;
      }, instrumentNumber);

      if (!secondClickDone) {
        this.log('⚠️ Could not click instrument number second time, trying to find Download button');
      } else {
        this.log('✅ Clicked on second instrument number link');
        await this.randomWait(5000, 7000);
      }

      // Look for Download (Free) button and login if needed
      this.log('🔍 Looking for Download button...');

      const downloadButtonFound = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));

        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase();

          if (text.includes('download') && (text.includes('free') || text.includes('pdf'))) {
            return true;
          }
        }

        return false;
      });

      if (downloadButtonFound) {
        this.log('✅ Found Download button');

        // Check if we need to login
        const needsLogin = await this.page.evaluate(() => {
          return document.body.innerText.toLowerCase().includes('login') ||
                 document.body.innerText.toLowerCase().includes('sign in');
        });

        if (needsLogin) {
          this.log('🔐 Login required, attempting to log in...');

          const email = process.env.TARRANT_COUNTY_EMAIL || 'ericatl828@gmail.com';
          const password = process.env.TARRANT_COUNTY_PASSWORD || 'Cdma2000@1';

          // Fill in login credentials
          const emailSelectors = [
            'input[type="email"]',
            'input[name*="email"]',
            'input[name*="Email"]',
            'input[id*="email"]',
            'input[id*="Email"]'
          ];

          let emailInput = null;
          for (const selector of emailSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000 });
              emailInput = selector;
              break;
            } catch (e) {
              // Try next
            }
          }

          if (emailInput) {
            await this.page.type(emailInput, email);
            this.log('✅ Entered email');
          }

          const passwordSelectors = [
            'input[type="password"]',
            'input[name*="password"]',
            'input[name*="Password"]'
          ];

          let passwordInput = null;
          for (const selector of passwordSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 3000 });
              passwordInput = selector;
              break;
            } catch (e) {
              // Try next
            }
          }

          if (passwordInput) {
            await this.page.type(passwordInput, password);
            this.log('✅ Entered password');
          }

          await this.randomWait(1000, 2000);

          // Click login button
          const loginClicked = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));

            for (const button of buttons) {
              const text = (button.textContent || button.value || '').toLowerCase();

              if (text.includes('login') || text.includes('sign in') || text.includes('submit')) {
                button.click();
                return true;
              }
            }

            return false;
          });

          if (loginClicked) {
            this.log('✅ Clicked login button');
            await this.randomWait(5000, 7000);
          }
        }

        // Now click Download button
        this.log('📥 Clicking Download button...');

        const downloadClicked = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));

          for (const button of buttons) {
            const text = (button.textContent || button.value || '').toLowerCase();

            if (text.includes('download')) {
              button.click();
              return true;
            }
          }

          return false;
        });

        if (!downloadClicked) {
          throw new Error('Could not click Download button');
        }

        this.log('✅ Clicked Download button');
        await this.randomWait(5000, 7000);

        // Use CDP Fetch domain to intercept PDF response
        const pdfPage = this.page;
        const client = await pdfPage.target().createCDPSession();

        await client.send('Fetch.enable', {
          patterns: [
            {
              urlPattern: '*',
              requestStage: 'Response'
            }
          ]
        });

        this.log('✅ CDP Fetch domain enabled');

        const pdfBuffer = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('PDF download timeout after 30 seconds'));
          }, 30000);

          client.on('Fetch.requestPaused', async (event) => {
            try {
              if (event.responseHeaders) {
                const contentType = event.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');

                if (contentType && contentType.value.toLowerCase().includes('pdf')) {
                  this.log(`🎉 PDF detected! Capturing response body...`);

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

                    const isPDF = buffer.slice(0, 4).toString() === '%PDF';
                    this.log(`   Buffer size: ${buffer.length} bytes, isPDF: ${isPDF}`);

                    if (isPDF && buffer.length > 10000) {
                      this.log(`✅ Full PDF captured successfully`);
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

          // Trigger download by reloading
          this.log(`🔄 Triggering PDF download...`);
          pdfPage.reload({ waitUntil: 'networkidle2' }).catch(() => {});
        });

        this.log(`✅ PDF downloaded successfully`);

        return {
          success: true,
          instrumentNumber: instrumentNumber,
          pdfData: pdfBuffer.toString('base64'),
          fileSize: pdfBuffer.length,
          message: 'PDF downloaded successfully',
          timestamp: new Date().toISOString()
        };

      } else {
        throw new Error('Could not find Download button');
      }

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
    this.log(`🚀 Starting Tarrant County deed scrape for: ${address}`);
    this.log(`${'='.repeat(80)}\n`);

    try {
      // Step 1: Search TAD and get instrument number
      const searchResult = await this.searchTAD(address);

      if (!searchResult.success) {
        return searchResult;
      }

      // Step 2: Download the deed PDF
      const downloadResult = await this.downloadDeed(searchResult.instrumentNumber);

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

module.exports = TarrantCountyTexasScraper;
