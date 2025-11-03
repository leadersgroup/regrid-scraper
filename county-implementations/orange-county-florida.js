/**
 * Orange County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.ocpafl.org/
 * - Clerk of Courts (Official Records): https://myorangeclerk.com/official-records/
 * - Comptroller (Property Search): https://www.ocpafl.org/searches/ParcelSearch.aspx
 */

const DeedScraper = require('../deed-scraper');

class OrangeCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Orange';
    this.state = 'FL';
  }

  /**
   * Get deed recorder/clerk URL for Orange County
   * Updated to use the new Self-Service Official Records system
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Orange' && state === 'FL') {
      return 'https://selfservice.or.occompt.com/';
    }
    return null;
  }

  /**
   * Normalize street suffix abbreviations to full words
   * Example: "123 Main St" -> "123 Main Street"
   */
  normalizeStreetSuffix(address) {
    const suffixMap = {
      // Common abbreviations
      ' St': ' Street',
      ' St.': ' Street',
      ' Ave': ' Avenue',
      ' Ave.': ' Avenue',
      ' Dr': ' Drive',
      ' Dr.': ' Drive',
      ' Rd': ' Road',
      ' Rd.': ' Road',
      ' Blvd': ' Boulevard',
      ' Blvd.': ' Boulevard',
      ' Ln': ' Lane',
      ' Ln.': ' Lane',
      ' Ct': ' Court',
      ' Ct.': ' Court',
      ' Pl': ' Place',
      ' Pl.': ' Place',
      ' Cir': ' Circle',
      ' Cir.': ' Circle',
      ' Way': ' Way',
      ' Wy': ' Way',
      ' Wy.': ' Way',
      ' Pkwy': ' Parkway',
      ' Pkwy.': ' Parkway',
      ' Ter': ' Terrace',
      ' Ter.': ' Terrace',
      ' Trl': ' Trail',
      ' Trl.': ' Trail'
    };

    let normalized = address;
    for (const [abbrev, full] of Object.entries(suffixMap)) {
      // Match at end of string or before a number (like unit number)
      const regex = new RegExp(abbrev.replace('.', '\\.') + '(?=\\s|$)', 'gi');
      normalized = normalized.replace(regex, full);
    }

    return normalized;
  }

  /**
   * Search Orange County Property Appraiser by address
   * Use address search (without city/state/zip) then navigate to sales tab
   * URL: https://ocpaweb.ocpafl.org/parcelsearch
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Orange County FL Property Appraiser`);

    try {
      // Navigate to property search page
      await this.page.goto('https://ocpaweb.ocpafl.org/parcelsearch', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      // Example: "12729 Hawkstone Drive, Windermere, FL 34786" -> "12729 Hawkstone Drive"
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      // Normalize street suffix abbreviations
      const originalAddress = streetAddress;
      streetAddress = this.normalizeStreetSuffix(streetAddress);

      if (originalAddress !== streetAddress) {
        this.log(`🔄 Normalized address: "${originalAddress}" -> "${streetAddress}"`);
      }

      this.log(`🏠 Using street address for search: ${streetAddress}`);

      // Look for property address input field
      const addressInputSelectors = [
        'input[name*="Address"]',
        'input[placeholder*="Address"]',
        'input[id*="address"]',
        'input[name*="PropertyAddress"]',
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

      // Enter street address
      await this.page.click(addressInput);
      await this.randomWait(200, 400);

      // Clear existing text
      await this.page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) input.value = '';
      }, addressInput);

      // Type address with human-like delays
      for (const char of streetAddress) {
        await this.page.keyboard.type(char);
        await this.randomWait(50, 150);
      }

      this.log(`✅ Entered address: ${streetAddress}`);

      // Look for and click search button
      await this.randomWait(1000, 2000);

      const searchButtonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Search")',
        'button[aria-label*="Search"]',
        '.btn-search',
        '#btnSearch'
      ];

      let searchClicked = false;
      for (const selector of searchButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            searchClicked = true;
            this.log(`✅ Clicked search button`);
            break;
          }
        } catch (e) {
          // Try next
        }
      }

      if (!searchClicked) {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
        this.log(`⌨️  Pressed Enter to search`);
      }

      // Wait for results
      await this.randomWait(3000, 5000);

      // Check if property was found
      const propertyFound = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return !text.includes('no results') &&
               !text.includes('not found') &&
               !text.includes('no records found');
      });

      if (propertyFound) {
        this.log(`✅ Property found via address search`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found`);
        return {
          success: false,
          message: 'Property not found'
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
   * DEPRECATED: Old Property Appraiser search (kept for reference)
   * The ocpaweb.ocpafl.org site uses Angular with hash routing that doesn't load property
   * data properly in Puppeteer. The direct URL format is:
   * https://ocpaweb.ocpafl.org/parcelsearch/#/summary/{parcelId}
   * But the content never loads beyond the search form (stays at 989 chars).
   */
  async _deprecatedSearchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Orange County FL Property Appraiser for Parcel: ${parcelId}`);

    try {
      // Try direct URL to property info with parcel ID
      const directUrl = `https://ocpaweb.ocpafl.org/parcelsearch/#/summary/${parcelId}`;
      this.log(`🌐 Trying direct URL: ${directUrl}`);

      await this.page.goto(directUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Check if we got property information
      const propertyFound = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return !text.includes('no results') &&
               !text.includes('not found') &&
               !text.includes('invalid') &&
               (text.includes('property') ||
                text.includes('owner') ||
                text.includes('parcel') ||
                text.includes('sale') ||
                text.includes('value'));
      });

      if (propertyFound) {
        this.log(`✅ Property found via direct URL`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      }

      // If direct URL didn't work, try search page
      this.log(`⚠️ Direct URL failed, trying search page`);

      await this.page.goto('https://ocpaweb.ocpafl.org/dashboard', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Look for search functionality on the page
      const parcelInputSelectors = [
        'input[type="search"]',
        'input[placeholder*="search"]',
        'input[placeholder*="Search"]',
        'input[name*="search"]',
        '#txtParcelID',
        'input[name*="ParcelID"]',
        'input[name*="parcel"]',
        'input[id*="parcel"]'
      ];

      let parcelInput = null;
      for (const selector of parcelInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          parcelInput = selector;
          this.log(`✅ Found search input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!parcelInput) {
        this.log(`⚠️ Could not find search input on dashboard`);
        return {
          success: false,
          message: 'Could not find search input'
        };
      }

      // Enter parcel ID
      await this.page.click(parcelInput);
      await this.randomWait(100, 300);

      // Clear existing text
      await this.page.evaluate((selector) => {
        document.querySelector(selector).value = '';
      }, parcelInput);

      // Type parcel ID with human-like delays
      for (const char of parcelId) {
        await this.page.keyboard.type(char);
        await this.randomWait(50, 100);
      }

      // Find and click search button
      const searchButtonSelectors = [
        '#btnSearch',
        'input[type="submit"][value*="Search"]',
        'button[type="submit"]',
        'input[id*="Search"]',
        'button[id*="Search"]'
      ];

      let searchButton = null;
      for (const selector of searchButtonSelectors) {
        try {
          searchButton = await this.page.$(selector);
          if (searchButton) {
            this.log(`✅ Found search button: ${selector}`);
            await searchButton.click();
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchButton) {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
      }

      // Wait for results
      await this.randomWait(3000, 5000);

      // Check if property was found via search
      const searchResult = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return !text.includes('no records found') &&
               !text.includes('not found') &&
               !text.includes('no results') &&
               (text.includes('property information') ||
                text.includes('parcel') ||
                text.includes('owner') ||
                text.includes('sale'));
      });

      if (searchResult) {
        this.log(`✅ Property found on Orange County Property Appraiser`);
      } else {
        this.log(`⚠️ Property not found on assessor website`);
      }

      return {
        success: searchResult,
        message: searchResult ? 'Property found on assessor website' : 'Property not found'
      };

    } catch (error) {
      this.log(`❌ Assessor search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Navigate to Sales tab and extract document ID hyperlinks
   */
  async extractTransactionRecords() {
    this.log('📋 Navigating to Sales tab to extract transaction records...');

    try {
      // Wait a bit for page to be ready
      await this.randomWait(2000, 3000);

      // Look for Sales tab/link
      this.log('🔍 Looking for Sales tab...');

      const salesTabSelectors = [
        'a:has-text("Sales")',
        'button:has-text("Sales")',
        'li:has-text("Sales")',
        '[role="tab"]:has-text("Sales")',
        'a[href*="sales"]',
        'button[aria-label*="Sales"]',
        '.tab:has-text("Sales")',
        '[data-tab*="sales"]'
      ];

      // Try to find and click Sales tab - look for the exact tab navigation element
      const salesClicked = await this.page.evaluate(() => {
        // Look for tab navigation - these are usually uppercase and exact matches
        const allElements = Array.from(document.querySelectorAll('a, button, div, span'));

        // Try exact match first for tab headers
        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          // Look for exact "SALES" (uppercase) which is typical for tab headers
          if (text === 'SALES' || text === 'Sales') {
            console.log('Found exact SALES tab:', el, el.tagName, el.className);
            el.click();
            return { clicked: true, element: el.tagName };
          }
        }

        // Fallback: look for any element containing "sales" with reasonable length
        for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          const lowerText = text.toLowerCase();

          if (lowerText === 'sales' || (lowerText.includes('sales') && text.length < 30)) {
            const clickable = el.tagName === 'A' || el.tagName === 'BUTTON' ||
                            el.onclick || el.getAttribute('role') === 'tab';

            if (clickable || el.parentElement?.onclick) {
              console.log('Clicking sales element (fallback):', el);
              el.click();
              return { clicked: true, element: el.tagName };
            }
          }
        }

        return { clicked: false };
      });

      if (salesClicked && salesClicked.clicked) {
        this.log(`✅ Clicked on Sales tab (${salesClicked.element})`);

        // Wait for Sales content to load - give it more time for the table to appear
        await this.randomWait(5000, 7000);

        // Scroll down to make sure all content is loaded/visible and trigger any lazy-loading
        await this.page.evaluate(() => {
          window.scrollBy(0, 1200);
        });

        await this.randomWait(2000, 3000);

        // Scroll back up to where sales history table should be
        await this.page.evaluate(() => {
          window.scrollBy(0, -600);
        });

        await this.randomWait(2000, 3000);

        // Try to wait for the sales history table specifically
        try {
          await this.page.waitForFunction(() => {
            const text = document.body.innerText;
            return text.includes('Instrument #') || text.includes('Parcel Sales History');
          }, { timeout: 10000 });
          this.log(`✅ Sales History table detected`);
        } catch (e) {
          this.log(`⚠️ Sales History table not detected after waiting`);
        }
      } else {
        this.log(`⚠️ Could not find Sales tab, extracting from current page`);
      }

      // Extract document IDs from the Sales History table
      this.log('🔍 Extracting sales history with Instrument # links...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for the Sales History table
        // Table structure: Sale Date | Sale Amt | Instrument # | Book/Page | Seller(s) | Buyer(s) | Deed Code | Vac/Imp Code
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          // Check if this is the sales history table by looking for "Instrument #" header
          const headerText = table.innerText || '';
          if (headerText.includes('Instrument #') || headerText.includes('Instrument')) {
            console.log('Found Sales History table');

            const rows = Array.from(table.querySelectorAll('tr'));

            for (let i = 1; i < rows.length; i++) { // Skip header row
              const row = rows[i];
              const cells = Array.from(row.querySelectorAll('td'));

              if (cells.length >= 4) { // Need at least Sale Date, Sale Amt, Instrument #, Book/Page
                const saleDate = cells[0]?.innerText?.trim();
                const saleAmt = cells[1]?.innerText?.trim();
                const instrumentCell = cells[2];
                const bookPageCell = cells[3];

                // Extract Instrument # - it should be a link
                const instrumentLink = instrumentCell?.querySelector('a');
                const instrumentText = instrumentCell?.innerText?.trim();

                // Extract Book/Page
                const bookPageText = bookPageCell?.innerText?.trim();
                const bookPageMatch = bookPageText?.match(/(\d+)\/(\d+)/);

                if (instrumentText && instrumentText.length >= 10) {
                  const record = {
                    documentId: instrumentText,
                    type: 'document_id',
                    saleDate: saleDate,
                    salePrice: saleAmt?.replace(/[,$]/g, ''),
                    source: 'Orange County Property Appraiser - Sales History'
                  };

                  // Check if this is a numeric instrument number (actual deed) vs property address
                  const isNumericInstrument = /^\d{10,12}$/.test(instrumentText);

                  // Add download URL if link exists
                  // Numeric instrument numbers link to Comptroller site (with popup)
                  // Property addresses link to other parcel pages (not useful for deeds)
                  if (instrumentLink && isNumericInstrument) {
                    // This is a real instrument number - mark for special handling
                    // We'll click it directly from the Sales tab page (not navigate to URL)
                    record.downloadUrl = 'CLICK_ON_PAGE'; // Placeholder to indicate link exists
                    record.linkText = instrumentText;
                    record.requiresPopupHandling = true; // Flag that this needs popup handling
                  }
                  // Don't add downloadUrl for property address links

                  // Add book/page if available
                  if (bookPageMatch) {
                    record.bookNumber = bookPageMatch[1];
                    record.pageNumber = bookPageMatch[2];
                  }

                  results.push(record);
                  console.log('Found transaction:', record);
                }
              }
            }
          }
        }

        // Fallback: Look for all links with document ID patterns (if table approach didn't work)
        if (results.length === 0) {
          console.log('Table approach found 0 results, trying link extraction fallback');
          const allLinks = Array.from(document.querySelectorAll('a'));

          for (const link of allLinks) {
          const linkText = link.textContent?.trim() || '';
          const href = link.href || '';

          // Check if link text looks like a document ID
          // Orange County format: typically numeric, 10-12 digits, may have year prefix
          const docIdPatterns = [
            /^(\d{10,12})$/,                          // Pure numeric: 20230012345
            /^(20\d{2}[:\-\s]?\d{7,8})$/,            // Year format: 2023-0012345 or 20230012345
            /^CFN[:\s]?(\d{10,12})$/i,               // CFN prefix
            /^Doc[:\s]?(\d{10,12})$/i,               // Doc prefix
            /^OR[:\s]?(\d{10,12})$/i,                // OR prefix
            /^Document[:\s]?(\d{10,12})$/i           // Document prefix
          ];

          for (const pattern of docIdPatterns) {
            const match = linkText.match(pattern);
            if (match) {
              const docId = match[1].replace(/[:\-\s]/g, '');
              results.push({
                documentId: docId,
                type: 'document_id',
                downloadUrl: href,
                linkText: linkText,
                source: 'Orange County Property Appraiser - Sales Tab'
              });
              break;
            }
          }

          // Also check if the link text is purely numeric and 10-12 digits
          if (/^\d{10,12}$/.test(linkText)) {
            // Check if this looks like it could be a document ID (not a phone number, etc.)
            const alreadyAdded = results.some(r => r.documentId === linkText);
            if (!alreadyAdded) {
              results.push({
                documentId: linkText,
                type: 'document_id',
                downloadUrl: href,
                linkText: linkText,
                source: 'Orange County Property Appraiser - Sales Tab'
              });
            }
          }
        }

        // Also look for Book/Page format as fallback
        const text = document.body.innerText || '';
        const bookPagePatterns = [
          /(?:OR|Official\s*Record)?\s*Book[:\s#]*(\d+)[,\s\-]+Page[:\s#]*(\d+)/gi,
          /Book[:\s#]*(\d+)[,\s\-]+Page[:\s#]*(\d+)/gi
        ];

        for (const pattern of bookPagePatterns) {
          const matches = [...text.matchAll(pattern)];
          for (const match of matches) {
            const bookPage = `${match[1]}-${match[2]}`;
            const exists = results.some(r => r.bookNumber === match[1] && r.pageNumber === match[2]);

            if (!exists) {
              results.push({
                bookNumber: match[1],
                pageNumber: match[2],
                bookPage: bookPage,
                type: 'book_page',
                source: 'Orange County Property Appraiser - Sales Section'
              });
            }
          }
        }
        } // End fallback if

        return results;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s) with document IDs`);

      if (transactions.length > 0) {
        transactions.forEach((t, i) => {
          if (t.documentId) {
            this.log(`   ${i + 1}. Document ID: ${t.documentId} ${t.downloadUrl ? '(has link)' : ''}`);
          } else if (t.bookNumber) {
            this.log(`   ${i + 1}. Book ${t.bookNumber}, Page ${t.pageNumber}`);
          }
        });
      }

      return transactions;

    } catch (error) {
      this.log(`❌ Transaction extraction failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Custom deed download for Orange County that handles the Comptroller popup
   * Clicks on instrument # link from Sales History table -> handles "Continue to site" popup -> downloads PDF
   */
  async downloadDeed(deedRecord) {
    this.log(`⬇️ Downloading deed: ${deedRecord.documentId || deedRecord.bookPage}`);

    try {
      const { downloadUrl, documentId, requiresPopupHandling } = deedRecord;

      if (!downloadUrl) {
        throw new Error('No download URL available for this deed');
      }

      // For Orange County instrument numbers, we need to click the link and handle popup
      if (requiresPopupHandling) {
        // Enable download handling first
        const path = require('path');
        const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
        const downloadPath = path.resolve(relativePath);

        const client = await this.page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: downloadPath
        });
        this.log(`📁 Download path set to: ${downloadPath}`);

        this.log(`🔗 Clicking on instrument # link: ${documentId}`);

        // Click on the instrument number link (should still be on Sales tab page)
        const linkClicked = await this.page.evaluate((docId) => {
          const allLinks = Array.from(document.querySelectorAll('a'));
          for (const link of allLinks) {
            const text = link.textContent?.trim();
            if (text === docId) {
              console.log('Clicking instrument link:', link);
              link.click();
              return true;
            }
          }
          return false;
        }, documentId);

        if (!linkClicked) {
          throw new Error(`Could not find clickable link for instrument ${documentId}`);
        }

        this.log(`✅ Clicked on instrument # link`);
        await this.randomWait(2000, 3000);

        // Handle the popup - Extract the "Continue to site" link which contains the direct deed URL
        this.log(`🔍 Looking for "Continue to site" link with deed URL...`);
        await this.randomWait(2000, 3000);

        const continueLink = await this.page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a'));
          for (const link of allLinks) {
            const text = (link.textContent || '').trim().toLowerCase();
            const href = link.href || '';

            // Look for "Continue to site" link that goes to selfservice.or.occompt.com
            if (text.includes('continue') && text.includes('site') && href.includes('selfservice.or.occompt.com')) {
              return {
                found: true,
                href: href,
                text: link.textContent?.trim()
              };
            }
          }
          return { found: false };
        });

        if (!continueLink.found) {
          throw new Error('Could not find "Continue to site" link with deed URL');
        }

        this.log(`✅ Found deed URL: ${continueLink.href}`);

        // Navigate directly to the deed URL
        this.log(`📄 Navigating to deed document page...`);
        await this.page.goto(continueLink.href, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page to load
        await this.randomWait(3000, 5000);

        // Check if we're on the disclaimer page
        const currentUrl = this.page.url();
        if (currentUrl.includes('/user/disclaimer')) {
          this.log(`⚠️ Disclaimer page detected, accepting terms...`);

          // Click "I Accept" button
          const acceptClicked = await this.page.evaluate(() => {
            const acceptButton = document.querySelector('#submitDisclaimerAccept');
            if (acceptButton) {
              acceptButton.click();
              return true;
            }
            return false;
          });

          if (acceptClicked) {
            this.log(`✅ Clicked "I Accept"`);
            await this.randomWait(3000, 5000);

            // Check if there's a "Yes - Continue" button (session management)
            const continueSessionClicked = await this.page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button'));
              for (const btn of buttons) {
                const text = btn.textContent?.trim().toLowerCase() || '';
                if (text.includes('yes') && text.includes('continue')) {
                  btn.click();
                  return true;
                }
              }
              return false;
            });

            if (continueSessionClicked) {
              this.log(`✅ Clicked "Yes - Continue" for session`);
              await this.randomWait(3000, 5000);
            }

            // Check if still on disclaimer page (CAPTCHA not solved)
            const stillOnDisclaimer = this.page.url().includes('/user/disclaimer');
            if (stillOnDisclaimer) {
              this.log(`⚠️ Still on disclaimer page - reCAPTCHA detected`);

              // Check for reCAPTCHA
              const hasCaptcha = await this.page.evaluate(() => {
                const iframes = Array.from(document.querySelectorAll('iframe'));
                return iframes.some(iframe => iframe.src && iframe.src.includes('recaptcha'));
              });

              if (hasCaptcha) {
                this.log(`⚠️ reCAPTCHA challenge detected`);

                // Check if 2Captcha API key is configured
                if (process.env.TWOCAPTCHA_TOKEN) {
                  this.log(`🔧 Attempting to solve reCAPTCHA using 2Captcha API...`);

                  try {
                    // Use puppeteer-extra-plugin-recaptcha to solve the CAPTCHA
                    await this.page.solveRecaptchas();
                    this.log(`✅ reCAPTCHA solved successfully!`);

                    // Wait for page to process the CAPTCHA solution
                    await this.randomWait(2000, 3000);

                    // After solving CAPTCHA, we need to submit the disclaimer by clicking "I Accept" again
                    // The reCAPTCHA solution is stored in hidden fields, clicking "I Accept" submits it
                    this.log(`📝 Clicking "I Accept" again to submit CAPTCHA solution...`);

                    const acceptClickedAgain = await this.page.evaluate(() => {
                      const acceptButton = document.querySelector('#submitDisclaimerAccept');
                      if (acceptButton) {
                        acceptButton.click();
                        return true;
                      }
                      return false;
                    });

                    if (acceptClickedAgain) {
                      this.log(`✅ Clicked "I Accept" to submit CAPTCHA solution`);
                      await this.randomWait(5000, 7000);

                      // Check if we've moved past the disclaimer page
                      const currentUrl = this.page.url();
                      if (currentUrl.includes('/user/disclaimer')) {
                        this.log(`⚠️ Still on disclaimer page after CAPTCHA submission`);
                      } else {
                        this.log(`✅ Successfully moved past disclaimer page to: ${currentUrl}`);
                      }
                    } else {
                      this.log(`⚠️ Could not find "I Accept" button to submit CAPTCHA`);
                    }
                  } catch (captchaError) {
                    this.log(`❌ Failed to solve reCAPTCHA: ${captchaError.message}`);

                    // Return useful information for manual solving
                    return {
                      success: false,
                      requiresCaptcha: true,
                      captchaSolverError: captchaError.message,
                      instrumentNumber: documentId,
                      deedUrl: continueLink.href,
                      message: 'reCAPTCHA solving failed. Manual intervention required.',
                      manualInstructions: `Visit ${continueLink.href}, complete the CAPTCHA, and download the PDF manually.`,
                      error: 'CAPTCHA_SOLVER_FAILED'
                    };
                  }
                } else {
                  this.log(`❌ No 2Captcha API key configured (set TWOCAPTCHA_TOKEN env variable)`);

                  // Return useful information instead of claiming success
                  return {
                    success: false,
                    requiresCaptcha: true,
                    instrumentNumber: documentId,
                    deedUrl: continueLink.href,
                    message: 'Orange County Self-Service requires reCAPTCHA verification. Set TWOCAPTCHA_TOKEN environment variable to enable automatic solving.',
                    manualInstructions: `Visit ${continueLink.href}, complete the CAPTCHA, and download the PDF manually.`,
                    error: 'CAPTCHA_REQUIRED_NO_API_KEY'
                  };
                }
              }
            }
          } else {
            this.log(`⚠️ Could not find "I Accept" button, proceeding anyway...`);
          }
        }

        // Look for download/PDF button on the deed page
        this.log(`🔍 Looking for download button on deed page...`);

        const downloadButtonClicked = await this.page.evaluate(() => {
          // Look for download buttons, PDF links, icons, etc.
          // PDF viewers often have download buttons in upper right corner
          const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"], i, span, div[role="button"]'));

          for (const el of allElements) {
            const text = (el.textContent || el.value || '').toLowerCase();
            const href = (el.href || '').toLowerCase();
            const title = (el.title || '').toLowerCase();
            const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
            const className = (el.className || '').toLowerCase();
            const id = (el.id || '').toLowerCase();

            // Check text, href, title, aria-label, class names, and IDs
            const searchStr = `${text} ${href} ${title} ${ariaLabel} ${className} ${id}`;

            if (searchStr.includes('download') ||
                searchStr.includes('save') ||
                searchStr.includes('pdf') ||
                className.includes('download') ||
                id.includes('download') ||
                // Common icon classes for download
                className.includes('fa-download') ||
                className.includes('icon-download') ||
                className.includes('glyphicon-download')) {

              console.log('Found potential download element:', {
                tag: el.tagName,
                text: el.textContent?.trim().substring(0, 50),
                className: el.className,
                id: el.id,
                title: el.title,
                ariaLabel: el.getAttribute('aria-label')
              });

              el.click();
              return {
                clicked: true,
                text: el.textContent?.trim() || el.title || el.getAttribute('aria-label') || 'Download button',
                element: el.tagName
              };
            }
          }
          return { clicked: false };
        });

        if (downloadButtonClicked.clicked) {
          this.log(`✅ Clicked download button: "${downloadButtonClicked.text}" (${downloadButtonClicked.element})`);
        } else {
          this.log(`⚠️ No download button found, trying alternative methods...`);

          // Try looking in iframe (PDF might be embedded in iframe)
          const iframeDownload = await this.page.evaluate(() => {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              if (iframe.src && (iframe.src.includes('pdf') || iframe.src.includes('document'))) {
                // Found PDF iframe, return the src
                return { found: true, src: iframe.src };
              }
            }
            return { found: false };
          });

          if (iframeDownload.found) {
            this.log(`📄 Found PDF in iframe: ${iframeDownload.src}`);

            // Extract the actual PDF URL from the iframe src
            // The iframe URL contains: ?file=/ssweb/document/servepdf/...pdf
            const pdfUrlMatch = iframeDownload.src.match(/file=([^&]+)/);
            if (pdfUrlMatch) {
              const pdfPath = decodeURIComponent(pdfUrlMatch[1]);
              const baseUrl = 'https://selfservice.or.occompt.com';
              const pdfUrl = baseUrl + pdfPath;

              this.log(`🔗 Extracted PDF URL: ${pdfUrl}`);
              this.log(`📥 Downloading PDF using direct fetch...`);

              // Download the PDF using fetch and save it manually
              const fs = require('fs');
              const path = require('path');
              const https = require('https');

              const filename = `deed_${documentId}_${Date.now()}.pdf`;
              const filepath = path.join(downloadPath, filename);

              // Use Puppeteer's page to fetch with cookies/session
              const pdfBuffer = await this.page.evaluate(async (url) => {
                const response = await fetch(url);
                const blob = await response.blob();
                const arrayBuffer = await blob.arrayBuffer();
                return Array.from(new Uint8Array(arrayBuffer));
              }, pdfUrl);

              // Convert array back to Buffer and save
              fs.writeFileSync(filepath, Buffer.from(pdfBuffer));

              this.log(`✅ PDF saved to: ${filepath}`);
              this.log(`📄 File size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

              return {
                success: true,
                filename,
                downloadPath: downloadPath,
                documentId,
                timestamp: new Date().toISOString(),
                fileSize: fs.statSync(filepath).size,
                pdfUrl: pdfUrl
              };
            } else {
              this.log(`⚠️ Could not extract PDF URL from iframe`);
            }
          }
        }

        // If we get here, download didn't work
        const filename = `deed_${documentId}_${Date.now()}.pdf`;

        return {
          success: false,
          filename,
          downloadPath: downloadPath,
          documentId,
          timestamp: new Date().toISOString(),
          error: 'Could not find or download PDF'
        };

      } else {
        // Use default download logic for non-popup cases
        return await super.downloadDeed(deedRecord);
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
   * Search Orange County Official Records Self-Service by document ID or Instrument Number
   * Updated for new system: https://selfservice.or.occompt.com/
   */
  async searchByDocumentId(documentId) {
    this.log(`🔍 Searching Orange County Official Records Self-Service for Document/Instrument: ${documentId}`);

    try {
      // Navigate to Self-Service Official Records
      await this.page.goto('https://selfservice.or.occompt.com/ssweb/user/disclaimer', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Accept disclaimer
      this.log('📋 Accepting disclaimer...');
      try {
        await this.page.waitForSelector('button[id*="submitDisclaimerAccept"], input[type="submit"]', { timeout: 5000 });
        await this.page.click('button[id*="submitDisclaimerAccept"], input[type="submit"]');
        await this.randomWait(3000, 5000);
      } catch (e) {
        this.log('⚠️ Disclaimer button not found or already accepted');
      }

      // Wait for search page to load
      await this.randomWait(2000, 3000);

      // Look for instrument number / document number input
      this.log('🔍 Looking for instrument/document number search field...');

      const searchFieldFound = await this.page.evaluate(() => {
        // Look for input fields with labels containing "instrument", "document", "cfn", etc.
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));

        for (const input of inputs) {
          // Check label
          const label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim().toLowerCase() || '';
          const name = (input.name || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();

          // Look for instrument number, CFN, document number fields
          if (label.includes('instrument') || label.includes('cfn') || label.includes('document number') ||
              name.includes('instrument') || name.includes('cfn') || name.includes('documentnumber') ||
              id.includes('instrument') || id.includes('cfn') || id.includes('documentnumber') ||
              placeholder.includes('instrument') || placeholder.includes('cfn') || placeholder.includes('document')) {
            return {
              found: true,
              id: input.id,
              name: input.name,
              label: label
            };
          }
        }

        return { found: false };
      });

      if (!searchFieldFound.found) {
        this.log('⚠️ Could not find instrument/document number field on Self-Service site');
        return {
          success: false,
          message: 'Search field not found on Official Records Self-Service'
        };
      }

      this.log(`✅ Found search field: ${searchFieldFound.label || searchFieldFound.id}`);

      // Enter document/instrument number
      const selector = searchFieldFound.id ? `#${searchFieldFound.id}` : `input[name="${searchFieldFound.name}"]`;
      await this.page.click(selector);
      await this.page.type(selector, documentId, { delay: 100 });
      this.log(`✅ Entered: ${documentId}`);

      await this.randomWait(1000, 2000);

      // Submit search
      await this.page.keyboard.press('Enter');
      this.log('⏎ Submitted search');

      // Wait for results
      await this.randomWait(5000, 7000);

      // Extract results and download links
      const result = await this.page.evaluate(() => {
        // Look for PDF/document download links
        const allLinks = Array.from(document.querySelectorAll('a'));
        const downloadLinks = allLinks.filter(link => {
          const href = (link.href || '').toLowerCase();
          const text = (link.textContent || '').trim().toLowerCase();

          return href.includes('.pdf') ||
                 href.includes('download') ||
                 href.includes('/document/') ||
                 text.includes('view') ||
                 text.includes('download') ||
                 text.includes('pdf');
        });

        if (downloadLinks.length > 0) {
          return {
            success: true,
            downloadUrl: downloadLinks[0].href,
            linkText: downloadLinks[0].textContent?.trim(),
            totalLinks: downloadLinks.length
          };
        }

        // Check if results were found even without direct download
        const bodyText = document.body.innerText.toLowerCase();
        const hasResults = !bodyText.includes('no results') &&
                          !bodyText.includes('not found') &&
                          !bodyText.includes('no records') &&
                          (bodyText.includes('instrument') || bodyText.includes('document') || bodyText.includes('deed'));

        return {
          success: false,
          message: hasResults ? 'Results found but no download link available' : 'No results found',
          bodyPreview: document.body.innerText.substring(0, 500)
        };
      });

      if (result.success) {
        this.log(`✅ Found document with download link: ${result.linkText}`);
      } else {
        this.log(`⚠️ ${result.message}`);
      }

      return result;

    } catch (error) {
      this.log(`❌ Self-Service search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search by book and page number in Orange County
   */
  async searchByBookPage(bookNumber, pageNumber) {
    this.log(`🔍 Searching Orange County Clerk for Book: ${bookNumber}, Page: ${pageNumber}`);

    try {
      // Navigate to clerk's official records
      await this.page.goto('https://myorangeclerk.com/official-records/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Look for book/page search fields
      const bookInputSelectors = [
        'input[name*="book"]',
        'input[id*="book"]',
        'input[placeholder*="Book"]'
      ];

      const pageInputSelectors = [
        'input[name*="page"]',
        'input[id*="page"]',
        'input[placeholder*="Page"]'
      ];

      let bookInput = null;
      let pageInput = null;

      // Find book input
      for (const selector of bookInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          bookInput = selector;
          this.log(`✅ Found book input: ${selector}`);
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
          this.log(`✅ Found page input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (bookInput && pageInput) {
        // Fill in book number
        await this.page.click(bookInput);
        await this.page.type(bookInput, bookNumber, { delay: 100 });

        // Fill in page number
        await this.page.click(pageInput);
        await this.page.type(pageInput, pageNumber, { delay: 100 });

        // Submit search
        const searchButton = await this.page.$('button[type="submit"], input[type="submit"]');
        if (searchButton) {
          await searchButton.click();
          await this.randomWait(3000, 5000);
        } else {
          await this.page.keyboard.press('Enter');
          await this.randomWait(3000, 5000);
        }

        // Look for download link
        const result = await this.page.evaluate(() => {
          const downloadLinks = Array.from(document.querySelectorAll('a')).filter(link => {
            const href = link.href?.toLowerCase() || '';
            return href.includes('.pdf') || href.includes('download') || href.includes('view');
          });

          if (downloadLinks.length > 0) {
            return {
              success: true,
              downloadUrl: downloadLinks[0].href
            };
          }

          const text = document.body.innerText.toLowerCase();
          const hasResults = !text.includes('no results') && !text.includes('not found');

          return {
            success: hasResults,
            message: hasResults ? 'Found but no download link' : 'Not found'
          };
        });

        return result;
      }

      return {
        success: false,
        message: 'Could not find book/page search fields'
      };

    } catch (error) {
      this.log(`❌ Book/Page search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search by grantee name (owner/buyer) in Orange County
   */
  async searchByGranteeName(granteeName) {
    this.log(`🔍 Searching Orange County Clerk by Grantee: ${granteeName}`);

    try {
      // Navigate to official records search
      await this.page.goto('https://myorangeclerk.com/official-records/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Look for grantee/name search field
      const granteeSelectors = [
        'input[name*="grantee"]',
        'input[id*="grantee"]',
        'input[placeholder*="Grantee"]',
        'input[name*="buyer"]',
        'input[name*="name"]',
        'input[placeholder*="Last Name"]'
      ];

      let granteeInput = null;
      for (const selector of granteeSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          granteeInput = selector;
          this.log(`✅ Found grantee input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!granteeInput) {
        this.log('⚠️ Could not find grantee search field');
        return [];
      }

      // Parse name - try to get last name
      const nameParts = granteeName.split(/[,\s]+/).filter(p => p.length > 0);
      const lastName = nameParts[0]; // Assume first part is last name

      // Enter last name
      await this.page.click(granteeInput);
      await this.page.type(granteeInput, lastName, { delay: 100 });

      // Submit search
      const searchButton = await this.page.$('button[type="submit"], input[type="submit"]');
      if (searchButton) {
        await searchButton.click();
        await this.randomWait(3000, 5000);
      } else {
        await this.page.keyboard.press('Enter');
        await this.randomWait(3000, 5000);
      }

      // Extract results
      const results = await this.page.evaluate(() => {
        const records = [];

        // Look for result rows in tables
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');

          for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length === 0) continue;

            const rowText = row.innerText;

            // Look for document identifiers
            const cfnMatch = rowText.match(/(\d{10,12})/);
            const bookPageMatch = rowText.match(/(\d{4,5})\s*-\s*(\d{3,5})/);
            const dateMatch = rowText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);

            // Look for download links in this row
            const downloadLink = row.querySelector('a[href*="pdf"], a[href*="download"], a[href*="view"]');

            if (cfnMatch || bookPageMatch) {
              const record = {
                source: 'Orange County Clerk - Grantee Search'
              };

              if (cfnMatch) {
                record.documentId = cfnMatch[1];
              }

              if (bookPageMatch) {
                record.bookNumber = bookPageMatch[1];
                record.pageNumber = bookPageMatch[2];
              }

              if (dateMatch) {
                record.recordDate = dateMatch[1];
              }

              if (downloadLink) {
                record.downloadUrl = downloadLink.href;
              }

              records.push(record);
            }
          }
        }

        // If no table results, look for list items or divs
        if (records.length === 0) {
          const resultDivs = document.querySelectorAll('[class*="result"], [class*="record"]');
          for (const div of resultDivs) {
            const text = div.innerText;
            const cfnMatch = text.match(/CFN[:\s]*(\d{10,12})/i);
            const downloadLink = div.querySelector('a[href*="pdf"], a[href*="download"]');

            if (cfnMatch) {
              records.push({
                documentId: cfnMatch[1],
                downloadUrl: downloadLink?.href || null,
                source: 'Orange County Clerk - Grantee Search'
              });
            }
          }
        }

        return records;
      });

      this.log(`✅ Found ${results.length} deed record(s) for grantee: ${granteeName}`);
      return results;

    } catch (error) {
      this.log(`❌ Grantee search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search Orange County Clerk by property address
   * This is the primary method for Orange County since Property Appraiser doesn't work
   */
  async searchByAddress(address) {
    this.log(`🔍 Searching Orange County Clerk by Address: ${address}`);

    try {
      // Navigate to Clerk's records search
      await this.page.goto('https://myeclerk.myorangeclerk.com/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Look for address or property search option
      const addressSelectors = [
        'input[name*="address"]',
        'input[name*="Address"]',
        'input[id*="address"]',
        'input[placeholder*="Address"]',
        'input[placeholder*="Property"]'
      ];

      let addressInput = null;
      for (const selector of addressSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          addressInput = selector;
          this.log(`✅ Found address input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!addressInput) {
        this.log('⚠️ No address input found, try owner name search instead');
        return [];
      }

      // Enter address
      await this.page.click(addressInput);
      await this.page.type(addressInput, address, { delay: 100 });

      // Submit search
      const searchButton = await this.page.$('button[type="submit"], input[type="submit"]');
      if (searchButton) {
        await searchButton.click();
        await this.randomWait(3000, 5000);
      } else {
        await this.page.keyboard.press('Enter');
        await this.randomWait(3000, 5000);
      }

      // Extract results
      const results = await this.page.evaluate(() => {
        const records = [];

        // Look for deed/document links
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const text = link.textContent?.trim() || '';
          const href = link.href || '';

          // Look for document/deed indicators
          if (href.includes('.pdf') || href.includes('document') || href.includes('deed') ||
              text.toLowerCase().includes('deed') || text.toLowerCase().includes('view')) {

            // Try to extract document ID from surrounding text
            const parentText = link.parentElement?.innerText || '';
            const docIdMatch = parentText.match(/(\d{10,12})/);

            records.push({
              downloadUrl: href,
              linkText: text,
              documentId: docIdMatch ? docIdMatch[1] : null,
              source: 'Orange County Clerk - Address Search'
            });
          }
        }

        // Also look in tables
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          for (const row of rows) {
            const rowText = row.innerText;
            const cfnMatch = rowText.match(/(\d{10,12})/);

            if (cfnMatch) {
              const downloadLink = row.querySelector('a[href*="pdf"], a[href*="download"]');
              records.push({
                documentId: cfnMatch[1],
                downloadUrl: downloadLink?.href || null,
                source: 'Orange County Clerk - Address Search'
              });
            }
          }
        }

        return records;
      });

      this.log(`✅ Found ${results.length} deed record(s) for address: ${address}`);
      return results;

    } catch (error) {
      this.log(`❌ Address search failed: ${error.message}`);
      return [];
    }
  }
}

module.exports = OrangeCountyFloridaScraper;
