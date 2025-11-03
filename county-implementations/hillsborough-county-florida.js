/**
 * Hillsborough County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://gis.hcpafl.org/propertysearch/
 * - Clerk of Courts (Official Records): https://publicaccess.hillsclerk.com/oripublicaccess/
 */

const DeedScraper = require('../deed-scraper');

class HillsboroughCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Hillsborough';
    this.state = 'FL';
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Hillsborough County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Hillsborough County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Hillsborough County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Hillsborough County supports direct address search',
        county: 'Hillsborough',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for transaction records
      const step2Result = await this.searchPropertyAssessor({
        originalAddress: address,
        county: 'Hillsborough',
        state: 'FL'
      });

      result.steps.step2 = step2Result;

      if (!step2Result.success || !step2Result.transactions || step2Result.transactions.length === 0) {
        result.success = false;
        result.message = 'No transactions found on Property Appraiser';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        return result;
      }

      // STEP 3: Download the most recent deed
      const mostRecentDeed = step2Result.transactions[0];
      this.log(`📥 Attempting to download most recent deed: ${mostRecentDeed.documentId}`);

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
   * Get deed recorder/clerk URL for Hillsborough County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Hillsborough' && state === 'FL') {
      return 'https://publicaccess.hillsclerk.com/oripublicaccess/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Hillsborough County
   */
  getAssessorUrl(county, state) {
    if (county === 'Hillsborough' && state === 'FL') {
      return 'https://gis.hcpafl.org/propertysearch/';
    }
    return null;
  }

  /**
   * Search Hillsborough County Property Appraiser by address
   * Use address search then navigate to get folio number
   * URL: https://gis.hcpafl.org/propertysearch/#/nav/Basic%20Search
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Hillsborough County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://gis.hcpafl.org/propertysearch/#/nav/Basic%20Search', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for property address input field
      const addressInputSelectors = [
        'input[name*="SITE_ADDR"]',
        'input[placeholder*="Site Address"]',
        'input[placeholder*="Address"]',
        'input[name*="Address"]',
        'input[id*="address"]',
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
        'button:contains("Search")',
        'button[aria-label*="Search"]',
        '.btn-search',
        '#btnSearch',
        'button.submit',
        'input.submit'
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
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const pageText = text.substring(0, 500);

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found');

        const hasPropertyInfo = text.includes('folio') ||
                               text.includes('owner') ||
                               text.includes('sales') ||
                               text.includes('property information') ||
                               text.includes('assessed value') ||
                               text.includes('parcel');

        return {
          hasNoResults,
          hasPropertyInfo,
          pageText
        };
      });

      this.log(`🔍 Search result analysis:`);
      this.log(`   Has "no results" message: ${searchStatus.hasNoResults}`);
      this.log(`   Has property info: ${searchStatus.hasPropertyInfo}`);

      if (!searchStatus.hasNoResults && searchStatus.hasPropertyInfo) {
        this.log(`✅ Property found via address search`);
        return {
          success: true,
          message: 'Property found on assessor website'
        };
      } else {
        this.log(`⚠️ Property not found or search failed`);
        return {
          success: false,
          message: `Property not found (noResults: ${searchStatus.hasNoResults}, hasInfo: ${searchStatus.hasPropertyInfo})`
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
   * Navigate to Sales/Transfer tab and extract document ID links
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Look for Sales/Transfer information tabs or sections
      this.log('🔍 Looking for Sales/Transfer information...');

      const salesTabSelectors = [
        'a:contains("Sales")',
        'button:contains("Sales")',
        'li:contains("Sales")',
        'a:contains("Transfer")',
        'button:contains("Transfer")',
        '[role="tab"]:contains("Sales")',
        'a[href*="sales"]',
        'a[href*="transfer"]',
        '.tab:contains("Sales")'
      ];

      // Try to find and click Sales/Transfer tab
      const salesClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';

          if (text === 'SALES' || text === 'Sales' ||
              text === 'TRANSFERS' || text === 'Transfers' ||
              text === 'TRANSFER HISTORY' || text === 'Transfer History' ||
              text === 'SALES HISTORY' || text === 'Sales History') {

            if (el.tagName === 'A' || el.tagName === 'BUTTON') {
              el.click();
              return { clicked: true, element: el.tagName, text: text };
            }

            const clickableParent = el.closest('a, button, [onclick]');
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

      // Extract transaction information from the page
      this.log('🔍 Extracting transaction data...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for various patterns that might contain document IDs
        // Hillsborough County typically uses format: CFN (Clerk File Number) or OR (Official Records) Book/Page

        // Pattern 1: Look for tables with transaction/sales data
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const headerText = table.innerText || '';

          // Check if this table contains sale/transfer information
          if (headerText.toLowerCase().includes('sale') ||
              headerText.toLowerCase().includes('transfer') ||
              headerText.toLowerCase().includes('document') ||
              headerText.toLowerCase().includes('instrument')) {

            const rows = Array.from(table.querySelectorAll('tr'));

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const cells = Array.from(row.querySelectorAll('td'));
              const rowText = row.innerText;

              // Look for document ID patterns in the row
              // CFN format: CFN followed by 12 digits
              const cfnMatch = rowText.match(/CFN[:\s]?(\d{12})/i);

              // OR Book/Page format: Book XXXX Page XXXX
              const bookPageMatch = rowText.match(/Book[:\s]?(\d+)[,\s]+Page[:\s]?(\d+)/i);

              // Clerk File Number format
              const clerkFileMatch = rowText.match(/Clerk[:\s]+File[:\s]+(?:Number|No\.?|#)[:\s]?(\d+)/i);

              if (cfnMatch) {
                results.push({
                  documentId: cfnMatch[1],
                  type: 'cfn',
                  source: 'Hillsborough County Property Appraiser',
                  rawText: rowText.trim().substring(0, 200)
                });
              } else if (clerkFileMatch) {
                results.push({
                  documentId: clerkFileMatch[1],
                  type: 'clerk_file_number',
                  source: 'Hillsborough County Property Appraiser',
                  rawText: rowText.trim().substring(0, 200)
                });
              } else if (bookPageMatch) {
                results.push({
                  bookNumber: bookPageMatch[1],
                  pageNumber: bookPageMatch[2],
                  type: 'book_page',
                  source: 'Hillsborough County Property Appraiser',
                  rawText: rowText.trim().substring(0, 200)
                });
              }
            }
          }
        }

        // Pattern 2: Look for labeled fields with document IDs
        const allText = document.body.innerText;
        const lines = allText.split('\n');

        for (const line of lines) {
          // Look for CFN pattern
          const cfnMatch = line.match(/CFN[:\s]?(\d{12})/i);
          if (cfnMatch && !results.some(r => r.documentId === cfnMatch[1])) {
            results.push({
              documentId: cfnMatch[1],
              type: 'cfn',
              source: 'Hillsborough County Property Appraiser',
              rawText: line.trim().substring(0, 200)
            });
          }

          // Look for OR Book/Page
          const bookPageMatch = line.match(/(?:OR|O\.R\.|Official Record)[:\s]+Book[:\s]?(\d+)[,\s]+Page[:\s]?(\d+)/i);
          if (bookPageMatch) {
            const exists = results.some(r => r.bookNumber === bookPageMatch[1] && r.pageNumber === bookPageMatch[2]);
            if (!exists) {
              results.push({
                bookNumber: bookPageMatch[1],
                pageNumber: bookPageMatch[2],
                type: 'book_page',
                source: 'Hillsborough County Property Appraiser',
                rawText: line.trim().substring(0, 200)
              });
            }
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s)`);

      if (transactions.length > 0) {
        transactions.forEach((t, i) => {
          if (t.documentId) {
            this.log(`   ${i + 1}. Document ID: ${t.documentId} (${t.type})`);
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
   * Download deed from Hillsborough County Clerk's website
   * Uses the official records search: https://publicaccess.hillsclerk.com/oripublicaccess/
   */
  async downloadDeed(deedRecord) {
    this.log(`⬇️ Downloading deed from Hillsborough County Clerk`);

    try {
      const { documentId, bookNumber, pageNumber, type } = deedRecord;

      if (!documentId && !bookNumber) {
        throw new Error('No document ID or book/page number available');
      }

      this.log(`🌐 Navigating to Hillsborough Clerk Official Records...`);

      await this.page.goto('https://publicaccess.hillsclerk.com/oripublicaccess/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Accept disclaimer if present
      const disclaimerAccepted = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('accept') || text.includes('agree') || text.includes('continue')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (disclaimerAccepted) {
        this.log(`✅ Accepted disclaimer`);
        await this.randomWait(3000, 4000);
      }

      // Look for search options
      this.log('🔍 Looking for document search...');

      if (documentId) {
        // Search by CFN or Clerk File Number
        this.log(`🔍 Searching by Document ID: ${documentId}`);

        // Look for CFN or document number input
        const searchInput = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
          for (const input of inputs) {
            const label = input.previousElementSibling?.textContent ||
                         input.parentElement?.textContent ||
                         input.placeholder || '';

            if (label.toLowerCase().includes('cfn') ||
                label.toLowerCase().includes('clerk file') ||
                label.toLowerCase().includes('document') ||
                label.toLowerCase().includes('instrument')) {
              return input.id || input.name || 'found';
            }
          }
          return null;
        });

        if (searchInput) {
          await this.page.type(`input`, documentId, { delay: 100 });
          this.log(`✅ Entered document ID: ${documentId}`);
        }

      } else if (bookNumber && pageNumber) {
        // Search by Book/Page
        this.log(`🔍 Searching by Book ${bookNumber}, Page ${pageNumber}`);

        // Find book and page inputs
        const bookInput = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
          for (const input of inputs) {
            const label = input.previousElementSibling?.textContent ||
                         input.parentElement?.textContent ||
                         input.placeholder || '';

            if (label.toLowerCase().includes('book')) {
              return input.id || input.name || 'book-found';
            }
          }
          return null;
        });

        const pageInput = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"]'));
          for (const input of inputs) {
            const label = input.previousElementSibling?.textContent ||
                         input.parentElement?.textContent ||
                         input.placeholder || '';

            if (label.toLowerCase().includes('page')) {
              return input.id || input.name || 'page-found';
            }
          }
          return null;
        });

        if (bookInput && pageInput) {
          // Find and fill book input
          const bookInputElement = await this.page.evaluateHandle((id) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            for (const input of inputs) {
              const label = input.previousElementSibling?.textContent ||
                           input.parentElement?.textContent ||
                           input.placeholder || '';
              if (label.toLowerCase().includes('book')) {
                return input;
              }
            }
            return null;
          }, bookInput);

          if (bookInputElement) {
            await bookInputElement.asElement().type(bookNumber, { delay: 100 });
            this.log(`✅ Entered book number: ${bookNumber}`);
          }

          // Find and fill page input
          const pageInputElement = await this.page.evaluateHandle((id) => {
            const inputs = Array.from(document.querySelectorAll('input'));
            for (const input of inputs) {
              const label = input.previousElementSibling?.textContent ||
                           input.parentElement?.textContent ||
                           input.placeholder || '';
              if (label.toLowerCase().includes('page')) {
                return input;
              }
            }
            return null;
          }, pageInput);

          if (pageInputElement) {
            await pageInputElement.asElement().type(pageNumber, { delay: 100 });
            this.log(`✅ Entered page number: ${pageNumber}`);
          }
        }
      }

      // Click search button
      await this.randomWait(1000, 2000);

      const searchClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit')) {
            btn.click();
            return true;
          }
        }
        return false;
      });

      if (searchClicked) {
        this.log(`✅ Clicked search button`);
        await this.randomWait(5000, 7000);

        // Look for PDF link or download button
        this.log('🔍 Looking for PDF download link...');

        const pdfLink = await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a, button'));
          for (const link of links) {
            const href = link.href || '';
            const text = (link.textContent || '').toLowerCase();

            if (href.includes('.pdf') ||
                text.includes('view') ||
                text.includes('download') ||
                text.includes('document')) {
              return {
                url: link.href,
                text: link.textContent?.trim()
              };
            }
          }
          return null;
        });

        if (pdfLink && pdfLink.url) {
          this.log(`📥 Found PDF link: ${pdfLink.text}`);

          // Setup download
          const path = require('path');
          const fs = require('fs');
          const downloadPath = path.join(process.cwd(), 'downloads');

          if (!fs.existsSync(downloadPath)) {
            fs.mkdirSync(downloadPath, { recursive: true });
          }

          const client = await this.page.target().createCDPSession();
          await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
          });

          // Navigate to PDF
          await this.page.goto(pdfLink.url, {
            waitUntil: 'networkidle2',
            timeout: this.timeout
          });

          await this.randomWait(5000, 7000);

          // Check if PDF downloaded or need to extract from iframe
          const pdfContent = await this.page.evaluate(() => {
            const iframe = document.querySelector('iframe[src*=".pdf"], embed[src*=".pdf"]');
            if (iframe) {
              return iframe.src;
            }
            return null;
          });

          if (pdfContent) {
            this.log(`📄 Extracting PDF from iframe: ${pdfContent}`);

            // Download PDF using fetch with cookies
            const cookies = await this.page.cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            const https = require('https');
            const url = require('url');

            return new Promise((resolve, reject) => {
              const pdfUrl = new URL(pdfContent, this.page.url());
              const filename = `deed_${documentId || `${bookNumber}_${pageNumber}`}_${Date.now()}.pdf`;
              const filepath = path.join(downloadPath, filename);

              const options = {
                method: 'GET',
                headers: {
                  'Cookie': cookieString,
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              };

              https.get(pdfUrl.toString(), options, (res) => {
                if (res.statusCode === 200) {
                  const chunks = [];
                  res.on('data', (chunk) => chunks.push(chunk));
                  res.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    fs.writeFileSync(filepath, pdfBuffer);

                    const pdfBase64 = pdfBuffer.toString('base64');

                    this.log(`✅ PDF downloaded: ${filename} (${(pdfBuffer.length / 1024).toFixed(2)} KB)`);

                    resolve({
                      success: true,
                      filename,
                      downloadPath,
                      documentId: documentId || `${bookNumber}/${pageNumber}`,
                      timestamp: new Date().toISOString(),
                      fileSize: pdfBuffer.length,
                      pdfBase64: pdfBase64
                    });
                  });
                } else {
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              }).on('error', reject);
            });
          }
        }
      }

      // If we get here, download failed
      return {
        success: false,
        error: 'Could not find or download PDF from Hillsborough Clerk website',
        documentId: documentId || `${bookNumber}/${pageNumber}`
      };

    } catch (error) {
      this.log(`❌ Download failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = HillsboroughCountyFloridaScraper;
