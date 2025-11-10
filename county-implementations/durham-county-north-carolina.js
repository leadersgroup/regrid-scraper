/**
 * Durham County, North Carolina - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Search: https://property.spatialest.com/nc/durham-tax/
 * - Register of Deeds: https://rodweb.dconc.gov/web/search/DOCSEARCH5S1
 *
 * Workflow:
 * 1. Search property by address on spatialest.com
 * 2. Extract book number and page number from Deeds tab
 * 3. Search Register of Deeds by book/page
 * 4. Download PDF deed
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class DurhamCountyNorthCarolinaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Durham';
    this.state = 'NC';
  }

  /**
   * Override initialize to use puppeteer-extra with stealth plugin
   */
  async initialize() {
    this.log('🚀 Initializing browser (vanilla Puppeteer)...');

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
        '--window-size=1920,1080'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1920, height: 1080 });

    this.log('✅ Browser initialized');
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Durham County can search property directly by address
   */
  async getPriorDeed(address) {
    this.log(`🏠 Starting Durham County deed scrape for: ${address}`);
    this.currentAddress = address;

    const startTime = Date.now();
    const result = {
      address,
      county: this.county,
      state: this.state,
      timestamp: new Date().toISOString(),
      steps: {}
    };

    try {
      // Initialize browser
      await this.initialize();

      // Step 1: Skip Regrid (not needed)
      result.steps.step1 = {
        name: 'Regrid search',
        success: true,
        skipped: true,
        message: 'Durham County supports direct address search'
      };

      // Step 2: Search Durham property database
      this.log('📍 Step 2: Searching Durham Property...');
      const propertyData = await this.searchDurhamProperty(address);

      if (!propertyData.success) {
        result.steps.step2 = {
          name: 'Durham Property search',
          success: false,
          data: propertyData
        };
        result.success = false;
        result.error = propertyData.error || 'Failed to find property';
        return result;
      }

      result.steps.step2 = {
        name: 'Durham Property search',
        success: true,
        data: propertyData
      };

      // Step 3: Download deed from Register of Deeds
      this.log('📥 Step 3: Downloading deed...');
      const deedData = await this.downloadDeed({
        bookNumber: propertyData.bookNumber,
        pageNumber: propertyData.pageNumber
      });

      if (!deedData.success) {
        result.steps.step3 = {
          name: 'Deed download',
          success: false,
          data: deedData
        };
        result.success = false;
        result.error = deedData.error || 'Failed to download deed';
        return result;
      }

      result.steps.step3 = {
        name: 'Deed download',
        success: true,
        data: deedData
      };

      result.success = true;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

      return result;

    } catch (error) {
      this.log(`❌ Error: ${error.message}`);
      result.success = false;
      result.error = error.message;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      return result;
    }
  }

  /**
   * Step 2: Search Durham property database for book/page
   */
  async searchDurhamProperty(address) {
    try {
      this.log(`🔍 Searching Durham Property for: ${address}`);

      // Navigate to Durham property search
      const propertyUrl = 'https://property.spatialest.com/nc/durham-tax/#/';
      this.log(`🌐 Navigating to: ${propertyUrl}`);
      await this.page.goto(propertyUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.randomWait(2000, 3000);

      // Extract address without state/zip for search
      // e.g., "6409 Winding Arch Dr Durham NC 27713" -> "6409 winding arch"
      const searchTerm = address.split(',')[0].toLowerCase().trim();
      this.log(`🔍 Searching for: ${searchTerm}`);

      // Wait for search input and type address
      // The search input has id="searchTerm" and placeholder="Owner Name / Address / Bill # / Parcel #"
      await this.page.waitForSelector('#searchTerm', { timeout: 10000 });
      const searchInput = await this.page.$('#searchTerm');

      if (!searchInput) {
        return {
          success: false,
          error: 'Could not find search input field'
        };
      }

      await searchInput.click();
      await this.randomWait(500, 1000);
      await searchInput.type(searchTerm);
      await this.randomWait(1000, 2000);

      // Click the Search button (green button with magnifying glass icon)
      this.log('🔍 Clicking Search button...');
      const searchButtonClicked = await this.page.evaluate(() => {
        // Look for the green Search button - it has text "Search" and icon
        const buttons = Array.from(document.querySelectorAll('button'));
        const searchButton = buttons.find(btn => {
          const text = btn.textContent.trim();
          return text.includes('Search') || btn.querySelector('.fa-search');
        });

        if (searchButton) {
          searchButton.click();
          return true;
        }
        return false;
      });

      if (!searchButtonClicked) {
        return {
          success: false,
          error: 'Could not find Search button'
        };
      }

      this.log('✅ Search button clicked, waiting for results...');
      await this.randomWait(3000, 5000);

      // Look for first result with Parcel ID and click it (opens in new window)
      this.log('📄 Looking for first parcel result in table...');

      const parcelClicked = await this.page.evaluate(() => {
        // Look for table rows in the results table
        const rows = Array.from(document.querySelectorAll('tbody tr'));

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          // Look for a cell with just a parcel ID number (e.g., "149960")
          for (const cell of cells) {
            const text = cell.textContent.trim();
            // Match parcel ID pattern: 5+ digits
            if (/^\d{5,}$/.test(text)) {
              // Click on this cell or any link inside it
              const link = cell.querySelector('a');
              if (link) {
                link.click();
                return { success: true, parcelId: text };
              }
              // If no link, click the cell itself
              cell.click();
              return { success: true, parcelId: text };
            }
          }
        }
        return { success: false, reason: 'No parcel ID found in table' };
      });

      if (!parcelClicked.success) {
        return {
          success: false,
          error: 'Could not find parcel result to click'
        };
      }

      this.log(`✅ Clicked parcel: ${parcelClicked.parcelId}`);

      // Wait for new window/tab to open and switch to it
      this.log('⏳ Waiting for new window to open...');
      await this.randomWait(3000, 5000);

      // Get all pages and find the new one (property detail page)
      const pages = await this.browser.pages();
      this.log(`📄 Found ${pages.length} total pages/tabs`);

      // The new page should be the last one, or look for one with property URL pattern
      let newPage = null;
      for (const page of pages) {
        const url = page.url();
        this.log(`  - Checking page: ${url}`);
        // Look for property detail page (not the search page)
        if (url.includes('durham-tax') && !url.includes('#/search')) {
          newPage = page;
          break;
        }
      }

      // Fallback: use the last page if no property page found
      if (!newPage && pages.length > 1) {
        newPage = pages[pages.length - 1];
      }

      if (!newPage || newPage === this.page) {
        return {
          success: false,
          error: 'Could not find new property detail window'
        };
      }

      // Switch to the new page
      this.page = newPage;
      await this.randomWait(2000, 3000);
      this.log(`✅ Switched to property detail page: ${this.page.url()}`);

      // Navigate to Deeds tab
      this.log('📄 Navigating to Deeds tab...');
      const deedsTabClicked = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('a, button, div[role="tab"], span'));
        const deedsTab = elements.find(el => {
          const text = el.textContent.toLowerCase();
          return text.includes('deed') && !text.includes('deed type');
        });

        if (deedsTab) {
          deedsTab.click();
          return true;
        }
        return false;
      });

      if (!deedsTabClicked) {
        return {
          success: false,
          error: 'Could not find Deeds tab'
        };
      }

      // Wait for Deeds tab content to load
      this.log('⏳ Waiting for Deeds table to load...');
      await this.randomWait(5000, 6000);

      // Also wait for specific content to appear
      try {
        await this.page.waitForFunction(
          () => {
            const text = document.body.innerText;
            return text.includes('Current') && (text.includes('Book') || text.includes('book'));
          },
          { timeout: 10000 }
        );
        this.log('✅ Deeds table content loaded');
      } catch (error) {
        this.log('⚠️ Timeout waiting for Deeds table, continuing anyway...');
      }

      await this.randomWait(1000, 2000);

      // Extract book and page from first deed entry (the "Current" row in the Deeds table)
      this.log('📄 Extracting book and page numbers...');
      const deedInfo = await this.page.evaluate(() => {
        // Strategy 1: Look for row containing "Current" and extract Book/Page from same row
        const rows = Array.from(document.querySelectorAll('tr'));

        // First, find the header row with "Book" and "Page" to get column indices
        let bookIndex = -1;
        let pageIndex = -1;

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td, th'));
          const cellTexts = cells.map(c => c.textContent.trim());

          // Look for header row with Book and Page
          const bookIdx = cellTexts.findIndex(text =>
            text.toLowerCase() === 'book' || text === 'Book'
          );
          const pageIdx = cellTexts.findIndex(text =>
            text.toLowerCase() === 'page' || text === 'Page'
          );

          if (bookIdx !== -1 && pageIdx !== -1) {
            bookIndex = bookIdx;
            pageIndex = pageIdx;
            break;
          }
        }

        // Now find the row with "Current" label and extract from same indices
        if (bookIndex !== -1 && pageIndex !== -1) {
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            const cellTexts = cells.map(c => c.textContent.trim());

            // Look for row that starts with "Current"
            if (cellTexts[0] && cellTexts[0].toLowerCase().includes('current')) {
              // Extract book and page from the column indices we found
              if (cells.length > Math.max(bookIndex, pageIndex)) {
                const bookNumber = cells[bookIndex].textContent.trim();
                const pageNumber = cells[pageIndex].textContent.trim();

                // Validate numeric format (4-6 digits)
                if (/^\d{4,6}$/.test(bookNumber) && /^\d{4,6}$/.test(pageNumber)) {
                  return {
                    success: true,
                    bookNumber: bookNumber,
                    pageNumber: pageNumber
                  };
                }
              }
            }
          }
        }

        // Strategy 2: Fallback - look for any cells with 6-digit patterns near "Current"
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          const cellTexts = cells.map(c => c.textContent.trim());

          // Check if this row mentions "Current"
          const hasCurrentNode = Array.from(row.querySelectorAll('*')).some(el =>
            el.textContent.trim().toLowerCase() === 'current'
          );

          if (hasCurrentNode || cellTexts.some(t => t.toLowerCase() === 'current')) {
            // Look for 6-digit and 5-digit patterns in this row
            let possibleBook = null;
            let possiblePage = null;

            for (const text of cellTexts) {
              if (/^\d{6}$/.test(text) && !possibleBook) {
                possibleBook = text;
              } else if (/^\d{5}$/.test(text) && !possiblePage) {
                possiblePage = text;
              }
            }

            if (possibleBook && possiblePage) {
              return {
                success: true,
                bookNumber: possibleBook,
                pageNumber: possiblePage
              };
            }
          }
        }

        return {
          success: false,
          bodyPreview: document.body.innerText.substring(0, 500)
        };
      });

      if (!deedInfo.success || !deedInfo.bookNumber || !deedInfo.pageNumber) {
        return {
          success: false,
          error: 'Could not extract book and page numbers',
          ...deedInfo
        };
      }

      this.log(`✅ Found - Book: ${deedInfo.bookNumber}, Page: ${deedInfo.pageNumber}`);

      return {
        success: true,
        bookNumber: deedInfo.bookNumber,
        pageNumber: deedInfo.pageNumber
      };

    } catch (error) {
      this.log(`❌ Property search error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Step 3: Download deed from Register of Deeds
   */
  async downloadDeed(searchData) {
    try {
      this.log(`🔍 Finding deed with book: ${searchData.bookNumber}, page: ${searchData.pageNumber}`);

      // Navigate to Register of Deeds search
      const rodUrl = 'https://rodweb.dconc.gov/web/search/DOCSEARCH5S1';
      this.log(`🌐 Navigating to Register of Deeds: ${rodUrl}`);
      await this.page.goto(rodUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.randomWait(2000, 3000);

      // Check for and dismiss disclaimer
      this.log('🔍 Checking for disclaimer...');
      try {
        const disclaimerBtn = await this.page.$('#submitDisclaimerAccept');
        if (disclaimerBtn) {
          this.log('📝 Clicking "I Accept"...');
          await disclaimerBtn.click();
          this.log('⏳ Waiting for navigation...');
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
            this.log('⚠️ No navigation event');
          });
          await this.randomWait(2000, 3000);
          this.log('✅ Dismissed disclaimer');
        }
      } catch (error) {
        this.log('⚠️ No disclaimer found or error dismissing it');
      }

      // Fill in book field
      this.log('📝 Filling book field...');
      const bookField = await this.page.$('#field_BookPageID_DOT_Volume');
      if (!bookField) {
        return {
          success: false,
          error: 'Could not find book input field'
        };
      }

      await bookField.click({ clickCount: 3 });
      await bookField.type(searchData.bookNumber);
      await this.randomWait(500, 1000);

      // Fill in page field
      this.log('📝 Filling page field...');
      const pageField = await this.page.$('#field_BookPageID_DOT_Page');
      if (!pageField) {
        return {
          success: false,
          error: 'Could not find page input field'
        };
      }

      await pageField.click({ clickCount: 3 });
      await pageField.type(searchData.pageNumber);
      await this.randomWait(1000, 2000);

      // Click search button
      this.log('🔍 Clicking search button...');
      const searchClicked = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        const searchBtn = buttons.find(btn => {
          const text = btn.textContent.toLowerCase() || btn.value?.toLowerCase() || '';
          return text.includes('search') && !text.includes('clear');
        });

        if (searchBtn) {
          searchBtn.click();
          return true;
        }
        return false;
      });

      if (!searchClicked) {
        await this.page.keyboard.press('Enter');
      }

      await this.randomWait(3000, 5000);

      // Find first result (document number like 2024114785) and hover to reveal download button
      this.log('📄 Looking for first result...');
      const resultInfo = await this.page.evaluate(() => {
        // Look for result rows in table - typically the first data row after headers
        const rows = Array.from(document.querySelectorAll('tbody tr, table tr'));

        for (const row of rows) {
          // Skip header rows
          if (row.querySelector('th')) continue;

          const cells = Array.from(row.querySelectorAll('td'));
          // Look for document number pattern (e.g., 2024114785 - typically 10 digits)
          for (const cell of cells) {
            const text = cell.textContent.trim();
            if (/^\d{10}$/.test(text)) {
              return {
                success: true,
                documentNumber: text,
                hasRow: true
              };
            }
          }
        }

        return { success: false };
      });

      if (!resultInfo.success) {
        return {
          success: false,
          error: 'Could not find result document number'
        };
      }

      this.log(`✅ Found result: ${resultInfo.documentNumber}`);

      // Hover over the first result row to reveal download button
      this.log('🖱️  Hovering over result to reveal download button...');
      const hoverResult = await this.page.evaluate((docNum) => {
        const rows = Array.from(document.querySelectorAll('tbody tr, table tr'));

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          for (const cell of cells) {
            if (cell.textContent.trim() === docNum) {
              // Trigger hover on the row
              const mouseoverEvent = new MouseEvent('mouseover', {
                bubbles: true,
                cancelable: true,
                view: window
              });
              row.dispatchEvent(mouseoverEvent);
              return { success: true };
            }
          }
        }
        return { success: false };
      }, resultInfo.documentNumber);

      await this.randomWait(1000, 2000);

      // Click the download PDF button that appears on hover
      this.log('📥 Clicking download PDF button...');
      const downloadClicked = await this.page.evaluate(() => {
        // Look for download/PDF button - could be icon or text
        const buttons = Array.from(document.querySelectorAll('button, a, i, img, span[class*="icon"], [class*="download"], [class*="pdf"]'));

        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase() || btn.title?.toLowerCase() || btn.alt?.toLowerCase() || '';
          const className = btn.className?.toLowerCase() || '';

          // Look for download, PDF, or document icons/text
          if (text.includes('download') ||
              text.includes('pdf') ||
              className.includes('download') ||
              className.includes('pdf') ||
              btn.querySelector('[class*="download"]') ||
              btn.querySelector('[class*="pdf"]')) {

            // Check if visible (download button appears on hover)
            if (btn.offsetParent !== null) {
              btn.click();
              return { success: true };
            }
          }
        }

        return { success: false };
      });

      if (!downloadClicked.success) {
        this.log('⚠️ Download button not found after hover');
        return {
          success: false,
          error: 'Could not find download PDF button'
        };
      }

      this.log('✅ Clicked download button');
      await this.randomWait(3000, 5000);

      // Download the PDF
      this.log('📥 Attempting to download PDF...');

      // Check if we're on a PDF page or need to find download link
      const currentUrl = this.page.url();
      if (currentUrl.endsWith('.pdf') || currentUrl.includes('.pdf')) {
        // Direct PDF URL
        this.log('✅ Found direct PDF URL');
        const pdfBase64 = await this.downloadPdfFromUrl(currentUrl);

        return {
          success: true,
          pdfBase64,
          bookNumber: searchData.bookNumber,
          pageNumber: searchData.pageNumber
        };
      } else {
        // Look for PDF link/iframe
        const pdfUrl = await this.page.evaluate(() => {
          // Check for iframe with PDF
          const iframe = document.querySelector('iframe[src*=".pdf"], iframe[src*="document"]');
          if (iframe) return iframe.src;

          // Check for PDF link
          const link = document.querySelector('a[href*=".pdf"]');
          if (link) return link.href;

          return null;
        });

        if (!pdfUrl) {
          return {
            success: false,
            error: 'Could not find PDF to download'
          };
        }

        this.log(`✅ Found PDF URL: ${pdfUrl}`);
        const pdfBase64 = await this.downloadPdfFromUrl(pdfUrl);

        return {
          success: true,
          pdfBase64,
          bookNumber: searchData.bookNumber,
          pageNumber: searchData.pageNumber
        };
      }

    } catch (error) {
      this.log(`❌ Deed download error: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Helper: Download PDF from URL
   */
  async downloadPdfFromUrl(url) {
    // Navigate to PDF URL
    await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await this.randomWait(2000, 3000);

    // Get PDF content as base64
    const pdfBuffer = await this.page.pdf({
      format: 'A4',
      printBackground: true
    });

    return pdfBuffer.toString('base64');
  }
}

module.exports = DurhamCountyNorthCarolinaScraper;
