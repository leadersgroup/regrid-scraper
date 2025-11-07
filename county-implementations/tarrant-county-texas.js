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

      // Look for dropdown/select for search type (under "Property Search" text)
      const searchTypeSet = await this.page.evaluate(() => {
        // Strategy 1: Find "Property Search" text and look for dropdown nearby
        const allText = Array.from(document.querySelectorAll('*'));
        for (const element of allText) {
          const text = element.textContent?.trim() || '';
          if (text === 'Property Search' || text.toLowerCase().includes('property search')) {
            // Look for select dropdown in the same container or nearby
            const parent = element.closest('div, form, section');
            if (parent) {
              const select = parent.querySelector('select');
              if (select) {
                const options = Array.from(select.options);
                for (const option of options) {
                  if (option.textContent.toLowerCase().includes('property address')) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    return { success: true, method: 'dropdown-near-text' };
                  }
                }
              }
            }
          }
        }

        // Strategy 2: Try all select elements
        const selects = Array.from(document.querySelectorAll('select'));
        for (const select of selects) {
          const options = Array.from(select.options);
          for (const option of options) {
            if (option.textContent.toLowerCase().includes('property address')) {
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true, method: 'dropdown-all' };
            }
          }
        }

        // Strategy 3: Try radio buttons
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        for (const radio of radios) {
          const label = radio.parentElement?.textContent || '';
          if (label.toLowerCase().includes('property address')) {
            radio.click();
            return { success: true, method: 'radio' };
          }
        }

        return { success: false };
      });

      if (searchTypeSet.success) {
        this.log(`✅ Set search type to Property Address (${searchTypeSet.method})`);
      } else {
        this.log('⚠️ Could not find property address option, continuing anyway');
      }

      await this.randomWait(1000, 2000);

      // Enter search address (without city and state)
      // Remove city and state from address: "1009 WICKWOOD Ct. FORT WORTH, TX 76131" -> "1009 WICKWOOD Ct"
      let addressParts = address.split(',')[0].trim(); // Get everything before first comma

      // Remove common Tarrant County city names
      const cities = ['FORT WORTH', 'ARLINGTON', 'GRAND PRAIRIE', 'MANSFIELD', 'EULESS', 'BEDFORD', 'HURST', 'KELLER', 'SOUTHLAKE', 'COLLEYVILLE', 'GRAPEVINE', 'NORTH RICHLAND HILLS', 'RICHLAND HILLS'];
      for (const city of cities) {
        if (addressParts.toUpperCase().includes(city)) {
          // Remove the city name from the end
          addressParts = addressParts.replace(new RegExp(`\\s+${city}\\s*$`, 'i'), '').trim();
          break;
        }
      }

      this.log(`📝 Entering address: ${addressParts}`);

      // Find search input box (TAD uses #query as the search input)
      const searchInput = '#query';
      await this.page.waitForSelector(searchInput, { timeout: 10000 });
      this.log(`✅ Found search input: ${searchInput}`);

      // Type address in search input and press Enter
      await this.page.type(searchInput, addressParts, { delay: 50 });
      await this.randomWait(500, 1000);

      this.log('🔍 Pressing Enter to submit search...');

      // Press Enter to submit the form and wait for navigation
      const navigationPromise = this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.keyboard.press('Enter');
      await navigationPromise;

      this.log('⏳ Waiting for search results...');
      await this.randomWait(2000, 3000);

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
        // Look for 8-digit account numbers - prioritize links first
        const accountPattern = /\b\d{8}\b/;
        const debugInfo = [];

        // Strategy 1: Find direct links with account numbers
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const text = link.textContent?.trim() || '';
          const match = text.match(accountPattern);
          if (match) {
            const accountNumber = match[0];
            debugInfo.push(`Found ${accountNumber} in <A> tag`);
            link.click();
            return { clicked: true, accountNumber, debugInfo };
          }
        }

        // Strategy 2: Find account number in any element and look for nearby link
        const allElements = Array.from(document.querySelectorAll('td, div, span'));
        for (const element of allElements) {
          const text = element.textContent?.trim() || '';
          const match = text.match(accountPattern);

          if (match) {
            const accountNumber = match[0];
            debugInfo.push(`Found ${accountNumber} in ${element.tagName}`);

            // If it's in a table cell, find link in the same row
            if (element.tagName === 'TD') {
              const row = element.closest('tr');
              const link = row?.querySelector('a');
              if (link) {
                debugInfo.push(`Clicking link in same row`);
                link.click();
                return { clicked: true, accountNumber, debugInfo };
              }
            }

            // Look for a clickable parent or ancestor
            let current = element;
            while (current && current !== document.body) {
              if (current.tagName === 'A') {
                debugInfo.push(`Clicking parent <A> tag`);
                current.click();
                return { clicked: true, accountNumber, debugInfo };
              }
              current = current.parentElement;
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

      // Wait for navigation to property detail page
      this.log('⏳ Waiting for property detail page to load...');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        this.log('⚠️ Navigation timeout, checking if page loaded...');
      });

      await this.randomWait(2000, 3000);

      // Wait for property detail page to load (wait for URL to change)
      await this.page.waitForFunction(() => {
        return window.location.href.includes('/property?account=');
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
      // Step 1: Click on instrument number link on TAD property page
      // This opens a new tab to tarrant.tx.publicsearch.us
      this.log(`🖱️ Clicking on instrument number: ${instrumentNumber}...`);

      // Set up listener for new page/tab BEFORE clicking
      const newPagePromise = new Promise((resolve) => {
        const handler = async (target) => {
          if (target.type() === 'page') {
            const newPage = await target.page();
            this.browser.off('targetcreated', handler);
            resolve(newPage);
          }
        };
        this.browser.on('targetcreated', handler);

        // Timeout after 15 seconds
        setTimeout(() => {
          this.browser.off('targetcreated', handler);
          resolve(null);
        }, 15000);
      });

      // Click the instrument number link (which is an <A> tag)
      const firstClickDone = await this.page.evaluate((instNum) => {
        const links = Array.from(document.querySelectorAll('a'));

        for (const link of links) {
          const text = link.textContent?.trim() || '';
          if (text === instNum) {
            link.click();
            return true;
          }
        }

        return false;
      }, instrumentNumber);

      if (!firstClickDone) {
        throw new Error(`Could not click on instrument number: ${instrumentNumber}`);
      }

      this.log('✅ Clicked on instrument number link');

      // Wait for new tab to open
      const publicSearchPage = await newPagePromise;

      if (!publicSearchPage) {
        throw new Error('New tab did not open after clicking instrument number');
      }

      this.log('✅ New tab opened to publicsearch.us');
      await this.randomWait(3000, 5000);

      // Step 2: On the publicsearch.us page, click on the deed row to open details
      this.log(`🖱️ Clicking on deed row to view details...`);

      // Wait for results table to load
      await publicSearchPage.waitForFunction(() => {
        const text = document.body.innerText;
        return text.includes('SEARCH RESULTS') || text.includes('results');
      }, { timeout: 15000 });

      // Click on the row containing the instrument number
      const rowClickDone = await publicSearchPage.evaluate((instNum) => {
        const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));

        for (const row of rows) {
          const text = row.textContent || '';
          if (text.includes(instNum)) {
            // Check if row has click handler
            if (row.onclick || row.style.cursor === 'pointer') {
              row.click();
              return true;
            }

            // Try clicking the row anyway
            row.click();
            return true;
          }
        }

        return false;
      }, instrumentNumber);

      if (!rowClickDone) {
        this.log('⚠️ Could not click on deed row');
        throw new Error('Could not click on deed row');
      }

      this.log('✅ Clicked on deed row');
      await this.randomWait(3000, 5000);

      // Step 3: Check if login is required or if download is available
      this.log('🔍 Checking for login or download options...');

      // Check if we need to login
      const needsLogin = await publicSearchPage.evaluate(() => {
        return document.body.innerText.toLowerCase().includes('sign in');
      });

      if (needsLogin) {
        this.log('🔐 Login required, clicking Sign In...');

        // Click "Sign In" link
        await publicSearchPage.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            if (link.textContent.trim().toLowerCase() === 'sign in') {
              link.click();
              return;
            }
          }
        });

        await this.randomWait(3000, 5000);

        // Wait for login form
        await publicSearchPage.waitForFunction(() => {
          return document.body.innerText.toLowerCase().includes('email') ||
                 document.body.innerText.toLowerCase().includes('username');
        }, { timeout: 10000 }).catch(() => {
          this.log('⚠️ Login form did not appear');
        });

        const email = process.env.TARRANT_COUNTY_EMAIL || 'ericatl828@gmail.com';
        const password = process.env.TARRANT_COUNTY_PASSWORD || 'Cdma2000@1';

        this.log(`📧 Entering email: ${email}`);

        // Fill in login credentials
        const emailSelectors = [
          'input[type="email"]',
          'input[name*="email"]',
          'input[name*="Email"]',
          'input[id*="email"]',
          'input[id*="Email"]',
          'input[name*="username"]',
          'input[name*="Username"]'
        ];

        let emailInput = null;
        for (const selector of emailSelectors) {
          try {
            await publicSearchPage.waitForSelector(selector, { timeout: 2000 });
            emailInput = selector;
            break;
          } catch (e) {
            // Try next
          }
        }

        if (emailInput) {
          await publicSearchPage.type(emailInput, email, { delay: 50 });
          this.log('✅ Entered email');
        } else {
          this.log('⚠️ Could not find email input');
        }

        const passwordSelectors = [
          'input[type="password"]',
          'input[name*="password"]',
          'input[name*="Password"]'
        ];

        let passwordInput = null;
        for (const selector of passwordSelectors) {
          try {
            await publicSearchPage.waitForSelector(selector, { timeout: 2000 });
            passwordInput = selector;
            break;
          } catch (e) {
            // Try next
          }
        }

        if (passwordInput) {
          await publicSearchPage.type(passwordInput, password, { delay: 50 });
          this.log('✅ Entered password');
        } else {
          this.log('⚠️ Could not find password input');
        }

        await this.randomWait(1000, 2000);

        // Click login button
        const loginClicked = await publicSearchPage.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));

          for (const button of buttons) {
            const text = (button.textContent || button.value || '').trim().toLowerCase();

            if (text.includes('login') || text.includes('sign in') || text === 'submit') {
              button.click();
              return true;
            }
          }

          return false;
        });

        if (loginClicked) {
          this.log('✅ Clicked login button');
          await this.randomWait(5000, 7000);

          // After login, we're back on the search results page
          // We need to click the deed row AGAIN to navigate to the document preview page
          this.log('🔄 After login, clicking deed row again to navigate to document preview...');

          // Wait for search results page to load
          await publicSearchPage.waitForFunction(() => {
            const text = document.body.innerText;
            return text.includes('SEARCH RESULTS') || text.includes('results');
          }, { timeout: 15000 }).catch(() => {
            this.log('⚠️ Search results page did not load after login');
          });

          await this.randomWait(2000, 3000);

          // Click on the instrument number column specifically
          const secondClickDone = await publicSearchPage.evaluate((instNum) => {
            const rows = document.querySelectorAll('tbody tr');

            for (const row of rows) {
              if (row.textContent.includes(instNum)) {
                // Click the instrument number column specifically
                const instrumentCol = row.querySelector('.col-7');
                if (instrumentCol) {
                  instrumentCol.click();
                  return { clicked: true, method: 'col-7' };
                }

                // Fallback to clicking the row
                row.click();
                return { clicked: true, method: 'row' };
              }
            }

            return { clicked: false };
          }, instrumentNumber);

          if (secondClickDone.clicked) {
            this.log(`✅ Clicked deed row (${secondClickDone.method}) to navigate to document preview`);

            // Wait for navigation to document preview page
            await publicSearchPage.waitForFunction(() => {
              return window.location.href.includes('/doc/') &&
                     document.body.innerText.toLowerCase().includes('download');
            }, { timeout: 15000 }).catch(() => {
              this.log('⚠️ Document preview page did not load');
            });

            await this.randomWait(2000, 3000);
            this.log('✅ Document preview page loaded');
          } else {
            this.log('⚠️ Could not click deed row after login');
          }
        } else {
          this.log('⚠️ Could not find login button');
        }
      } else {
        this.log('✅ No login required (unofficial copies are free)');
      }

      // Step 4: Look for and click download button
      this.log('📥 Looking for download/view button...');

      const downloadClicked = await publicSearchPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));

        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase();

          if (text.includes('download') || text.includes('view') || text.includes('pdf') || text.includes('unofficial')) {
            console.log('Found button:', text);
            button.click();
            return { clicked: true, text };
          }
        }

        return { clicked: false };
      });

      if (!downloadClicked.clicked) {
        this.log('⚠️ Could not find download button, checking if PDF loaded directly...');
      } else {
        this.log(`✅ Clicked button: ${downloadClicked.text}`);
        await this.randomWait(3000, 5000);
      }

      // Step 5: Use CDP Fetch domain to intercept PDF response
      const pdfPage = publicSearchPage;
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

        const pdfBuffer = await new Promise(async (resolve, reject) => {
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

          // Trigger download by clicking the "Download (Free)" button
          this.log(`🔄 Clicking Download button to trigger PDF download...`);

          const downloadButtonClicked = await pdfPage.evaluate(() => {
            // Look for Download button
            const buttons = Array.from(document.querySelectorAll('button, a'));

            for (const btn of buttons) {
              const text = (btn.textContent || '').toLowerCase();
              if (text.includes('download') && text.includes('free')) {
                btn.click();
                return true;
              }
            }

            // Fallback: look for any download button
            for (const btn of buttons) {
              const text = (btn.textContent || '').toLowerCase();
              if (text.includes('download')) {
                btn.click();
                return true;
              }
            }

            return false;
          });

          if (!downloadButtonClicked) {
            this.log('⚠️ Could not find download button, trying reload...');
            pdfPage.reload({ waitUntil: 'networkidle2' }).catch(() => {});
          } else {
            this.log('✅ Clicked Download button');
          }
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
