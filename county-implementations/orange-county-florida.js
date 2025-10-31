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
      const streetAddress = fullAddress.split(',')[0].trim();

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

                  // Add download URL if link exists
                  if (instrumentLink) {
                    record.downloadUrl = instrumentLink.href;
                    record.linkText = instrumentText;
                  }

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
   * Search Orange County Clerk of Courts by document ID or CFN
   * URL: https://myorangeclerk.com/official-records/
   */
  async searchByDocumentId(documentId) {
    this.log(`🔍 Searching Orange County Clerk for Document ID/CFN: ${documentId}`);

    try {
      // Navigate to the actual search portal (myeclerk)
      await this.page.goto('https://myeclerk.myorangeclerk.com/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Orange County Clerk uses a search interface
      // Look for document number/CFN search input
      const docSearchSelectors = [
        'input[name*="cfn"]',
        'input[name*="CFN"]',
        'input[name*="document"]',
        'input[id*="cfn"]',
        'input[id*="document"]',
        'input[placeholder*="CFN"]',
        'input[placeholder*="Document"]'
      ];

      let searchInput = null;
      for (const selector of docSearchSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchInput = selector;
          this.log(`✅ Found document search input: ${selector}`);
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!searchInput) {
        this.log('⚠️ Could not find document search input, trying general search');
        // Try general search input
        const generalSelectors = [
          'input[type="text"]',
          'input[type="search"]',
          '#searchInput'
        ];

        for (const selector of generalSelectors) {
          try {
            searchInput = await this.page.$(selector);
            if (searchInput) {
              this.log(`✅ Using general search input`);
              break;
            }
          } catch (e) {
            // Continue
          }
        }
      }

      if (!searchInput) {
        return {
          success: false,
          message: 'Document search input not found'
        };
      }

      // Enter document ID
      await this.page.click(searchInput);
      await this.page.type(searchInput, documentId, { delay: 100 });

      // Click search button
      const searchButton = await this.page.$('button[type="submit"], input[type="submit"]');
      if (searchButton) {
        await searchButton.click();
        await this.randomWait(3000, 5000);
      } else {
        await this.page.keyboard.press('Enter');
        await this.randomWait(3000, 5000);
      }

      // Look for results and download links
      const result = await this.page.evaluate(() => {
        // Look for PDF download links
        const pdfLinks = Array.from(document.querySelectorAll('a')).filter(link => {
          const href = link.href?.toLowerCase() || '';
          return href.includes('.pdf') ||
                 href.includes('download') ||
                 href.includes('view') ||
                 href.includes('document');
        });

        if (pdfLinks.length > 0) {
          return {
            success: true,
            downloadUrl: pdfLinks[0].href,
            linkText: pdfLinks[0].textContent?.trim()
          };
        }

        // Check if we found results
        const text = document.body.innerText.toLowerCase();
        const hasResults = !text.includes('no results') &&
                          !text.includes('not found') &&
                          (text.includes('record') || text.includes('deed') || text.includes('document'));

        return {
          success: hasResults,
          message: hasResults ? 'Results found but no direct download link' : 'No results found'
        };
      });

      if (result.success) {
        this.log(`✅ Found document in Orange County Clerk records`);
      }

      return result;

    } catch (error) {
      this.log(`❌ Document search failed: ${error.message}`);
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
