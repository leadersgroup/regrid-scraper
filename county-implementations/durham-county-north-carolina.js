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
      protocolTimeout: 600000, // Increase to 10 minutes
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

      // Extract address without city, state, and zip for search
      // e.g., "6409 Winding Arch Dr Durham NC 27713" -> "6409 winding arch dr"
      // Remove common city names, state abbreviations, and zip codes
      let searchTerm = address.toLowerCase().trim();

      // Remove zip code (5 digits at the end)
      searchTerm = searchTerm.replace(/\b\d{5}(-\d{4})?\b/g, '');

      // Remove "durham", "nc", "north carolina"
      searchTerm = searchTerm
        .replace(/\bdurham\b/gi, '')
        .replace(/\bnc\b/gi, '')
        .replace(/\bnorth carolina\b/gi, '')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/,/g, '') // Remove commas
        .trim();

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

      // Find document number in body text (not in a table)
      this.log('📄 Looking for document number in results...');
      const resultInfo = await this.page.evaluate(() => {
        // Look for 10-digit document number in body text
        const bodyText = document.body.innerText;
        const match = bodyText.match(/\b(\d{10})\b/);

        if (match) {
          return {
            success: true,
            documentNumber: match[1]
          };
        }

        return { success: false };
      });

      if (!resultInfo.success) {
        return {
          success: false,
          error: 'Could not find result document number'
        };
      }

      this.log(`✅ Found document number: ${resultInfo.documentNumber}`);

      // Find and click the document number element (it should be clickable)
      this.log('🖱️  Clicking document number...');
      const clickResult = await this.page.evaluate((docNum) => {
        // Search for clickable elements containing the document number
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

        for (const el of allElements) {
          const text = el.textContent.trim();
          // Check if this element contains just the document number or starts with it
          if (text === docNum || text.startsWith(docNum)) {
            // Try to click it
            el.click();
            return { success: true, clicked: true };
          }
        }

        return { success: false };
      }, resultInfo.documentNumber);

      if (!clickResult.success) {
        this.log('⚠️ Could not click document number');
        return {
          success: false,
          error: 'Could not click document number'
        };
      }

      this.log('✅ Clicked document number');
      await this.randomWait(3000, 5000);

      // Verify we're on the Register of Deeds site
      const currentPageUrl = this.page.url();
      this.log(`Current page after clicking document: ${currentPageUrl}`);

      if (!currentPageUrl.includes('rodweb.dconc.gov')) {
        this.log('⚠️ Not on Register of Deeds site, might be on wrong page');
      }

      // Find and click either a Download button or View button/link
      this.log('📥 Looking for Download or View button...');
      const btnClicked = await this.page.evaluate(() => {
        // Priority 1: Look for "View →" text in the document detail area (NOT in navigation/header)
        // The View button in Related Documents section should be lower on the page
        const allElements = Array.from(document.querySelectorAll('*'));

        const viewCandidates = [];
        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          // Match "View" or "View →" (with arrow)
          if (text.match(/^View\s*→?\s*$/) && el.offsetParent !== null) {
            // Check if this is a link to another domain (property.spatialest.com)
            // We want to EXCLUDE those and only click View buttons that stay on rodweb.dconc.gov
            const href = el.href || el.parentElement?.href || '';

            // Skip if it's a link to property.spatialest.com or other external sites
            if (href && (href.includes('spatialest.com') || href.includes('property.'))) {
              continue;
            }

            const rect = el.getBoundingClientRect();
            // Store candidates with their position (prefer elements lower on page, likely in content area)
            viewCandidates.push({
              element: el,
              text: text,
              y: rect.y,
              href: href,
              isLink: !!(el.onclick || el.parentElement?.onclick || el.tagName === 'A' || el.parentElement?.tagName === 'A')
            });
          }
        }

        // Sort by Y position (descending) - prefer elements lower on the page (in content, not header)
        // and that are actually clickable
        viewCandidates.sort((a, b) => {
          // First prioritize clickable elements
          if (a.isLink && !b.isLink) return -1;
          if (!a.isLink && b.isLink) return 1;
          // Then sort by Y position (lower on page is better)
          return b.y - a.y;
        });

        // Try to click the best candidate
        if (viewCandidates.length > 0) {
          const best = viewCandidates[0];
          const clickTarget = best.element.onclick || best.element.parentElement?.onclick ||
                             best.element.tagName === 'A' || best.element.parentElement?.tagName === 'A'
                             ? best.element : best.element.parentElement;
          if (clickTarget) {
            clickTarget.click();
            return { success: true, text: best.text, type: 'view-text', position: best.y };
          }
        }

        // Priority 2: Look for clickable elements with "view" in text (but NOT external links)
        const clickableElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"], div[onclick], span[onclick], div[class*="click"], span[class*="click"]'));

        for (const el of clickableElements) {
          const text = (el.textContent || el.value || el.title || el.alt || '').trim().toLowerCase();
          const className = (el.className || '').toLowerCase();
          const id = (el.id || '').toLowerCase();
          const href = el.href || '';

          // Skip external links to property sites
          if (href && (href.includes('spatialest.com') || href.includes('property.'))) {
            continue;
          }

          // Check for view-related text/attributes
          if ((text.includes('view') || className.includes('view') || id.includes('view')) &&
              el.offsetParent !== null) {
            el.click();
            return { success: true, text: el.textContent || el.value || el.title || 'View', type: 'view', href: href };
          }
        }

        // Priority 3: Look for Download button
        for (const el of clickableElements) {
          const text = (el.textContent || el.value || el.title || el.alt || '').trim().toLowerCase();
          const className = (el.className || '').toLowerCase();
          const id = (el.id || '').toLowerCase();

          // Check for download-related text/attributes
          if ((text.includes('download') || className.includes('download') || id.includes('download')) &&
              el.offsetParent !== null) {
            el.click();
            return { success: true, text: el.textContent || el.value || el.title || 'Download', type: 'download' };
          }
        }

        // Priority 4: Look for icon buttons (download/view icons)
        const iconElements = Array.from(document.querySelectorAll('i, img, svg'));
        for (const el of iconElements) {
          const className = (el.className || '').toLowerCase();
          const title = (el.title || el.alt || '').toLowerCase();

          if ((className.includes('download') || className.includes('view') ||
               title.includes('download') || title.includes('view')) &&
              el.offsetParent !== null) {
            // Click the icon or its parent if parent is clickable
            const clickTarget = el.onclick || el.parentElement?.onclick ? el : el.parentElement;
            if (clickTarget) {
              clickTarget.click();
              return { success: true, text: title || className, type: 'icon' };
            }
          }
        }

        // Debug: Return what we found
        const viewElements = allElements
          .filter(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            return text.includes('view') && el.offsetParent !== null;
          })
          .slice(0, 5)
          .map(el => ({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 50),
            clickable: !!(el.onclick || el.href || el.tagName === 'BUTTON')
          }));

        return { success: false, debug: { foundViewElements: viewElements } };
      });

      if (!btnClicked.success) {
        this.log('⚠️ Could not find Download or View button');
        if (btnClicked.debug) {
          this.log('Debug info: ' + JSON.stringify(btnClicked.debug, null, 2));
        }
        return {
          success: false,
          error: 'Could not find Download or View button',
          debug: btnClicked.debug
        };
      }

      this.log(`✅ Clicked ${btnClicked.type} button: ${btnClicked.text}`);

      // Check if the current page navigated after clicking View
      await this.randomWait(2000, 3000);
      const currentUrlAfterClick = this.page.url();
      this.log(`Current URL after clicking View: ${currentUrlAfterClick}`);

      // Wait for new window/tab to open after clicking View
      this.log('⏳ Waiting for new window to open after clicking View...');
      await this.randomWait(5000, 7000); // Give it more time to open

      const allPages = await this.browser.pages();
      this.log(`📄 Found ${allPages.length} total windows`);

      // Log all pages for debugging
      for (const page of allPages) {
        this.log(`  - Window: ${page.url()}`);
      }

      // Find the rodweb.dconc.gov page that's NOT the search page
      let rodPage = null;
      for (const page of allPages) {
        const url = page.url();
        // Look specifically for rodweb.dconc.gov pages that are NOT the search page
        if (url.includes('rodweb.dconc.gov') && !url.includes('DOCSEARCH')) {
          rodPage = page;
          this.log(`  ✓ Found ROD document page: ${url}`);
          break;
        }
      }

      // If we found a rodweb page, use it; otherwise look for any new page
      let pdfPage = rodPage;

      if (!pdfPage) {
        this.log('⚠️ No rodweb.dconc.gov document page found, checking for other new windows...');
        // Get the newest page that's not the current page
        for (let i = allPages.length - 1; i >= 0; i--) {
          const page = allPages[i];
          const url = page.url();
          // Skip current page, about:blank, and property tax site
          if (page !== this.page &&
              url !== 'about:blank' &&
              !url.includes('spatialest.com')) {
            pdfPage = page;
            this.log(`  ✓ Using page: ${url}`);
            break;
          }
        }
      }

      if (!pdfPage) {
        return {
          success: false,
          error: 'Could not find new window after clicking View'
        };
      }

      // Switch to the document page
      this.page = pdfPage;
      await this.randomWait(2000, 3000);
      this.log(`✅ Switched to document window: ${this.page.url()}`);

      // Look for "Primary Document" on the right side and click to download PDF
      this.log('📥 Looking for Primary Document link...');

      const primaryDocClicked = await this.page.evaluate(() => {
        // Look for "Primary Document" text on the right side of the page
        const allElements = Array.from(document.querySelectorAll('*'));

        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          // Look for "Primary Document" text
          if (text.toLowerCase().includes('primary document') && el.offsetParent !== null) {
            const rect = el.getBoundingClientRect();
            // Check if it's on the right side (x position > 50% of window width)
            if (rect.x > window.innerWidth * 0.5) {
              // Find clickable element (could be the element itself or a link inside/around it)
              const clickTarget = el.tagName === 'A' ? el :
                                 el.querySelector('a') ||
                                 el.parentElement?.tagName === 'A' ? el.parentElement : null;

              if (clickTarget) {
                clickTarget.click();
                return { success: true, text: text.substring(0, 100) };
              }
            }
          }
        }

        return { success: false };
      });

      if (!primaryDocClicked.success) {
        this.log('⚠️ Could not find Primary Document link');

        // Fallback: Try general PDF detection
        this.log('📥 Attempting general PDF detection...');
        const currentUrl = this.page.url();
        this.log(`Current page URL: ${currentUrl}`);

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
        }

        // Look for PDF in iframes/embeds
        const pdfInfo = await this.page.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const iframe of iframes) {
            if (iframe.src) return { type: 'iframe', url: iframe.src };
          }

          const embeds = Array.from(document.querySelectorAll('embed'));
          for (const embed of embeds) {
            if (embed.src) return { type: 'embed', url: embed.src };
          }

          const objects = Array.from(document.querySelectorAll('object'));
          for (const obj of objects) {
            if (obj.data) return { type: 'object', url: obj.data };
          }

          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            if (link.href && link.href.includes('.pdf')) {
              return { type: 'link', url: link.href };
            }
          }

          return {
            type: 'none',
            debug: {
              iframeCount: iframes.length,
              embedCount: embeds.length,
              objectCount: objects.length,
              bodyPreview: document.body.innerText.substring(0, 500)
            }
          };
        });

        this.log(`PDF detection result: ${JSON.stringify(pdfInfo, null, 2)}`);

        if (!pdfInfo.url) {
          return {
            success: false,
            error: 'Could not find Primary Document or PDF',
            debug: pdfInfo.debug
          };
        }

        this.log(`✅ Found PDF in ${pdfInfo.type}: ${pdfInfo.url}`);
        const pdfBase64 = await this.downloadPdfFromUrl(pdfInfo.url);

        return {
          success: true,
          pdfBase64,
          bookNumber: searchData.bookNumber,
          pageNumber: searchData.pageNumber
        };
      }

      this.log(`✅ Clicked Primary Document: ${primaryDocClicked.text}`);

      // Wait for PDF to load or new window to open
      await this.randomWait(3000, 5000);

      // Check if a new PDF window opened
      const allPages2 = await this.browser.pages();
      this.log(`📄 Found ${allPages2.length} total windows after clicking Primary Document`);

      let pdfWindowPage = null;
      for (const page of allPages2) {
        const url = page.url();
        this.log(`  - Checking window: ${url}`);
        if (page !== this.page && (url.includes('.pdf') || url.includes('document') || url.includes('rodweb'))) {
          pdfWindowPage = page;
          break;
        }
      }

      if (pdfWindowPage) {
        this.page = pdfWindowPage;
        await this.randomWait(2000, 3000);
        this.log(`✅ Switched to PDF window: ${this.page.url()}`);
      }

      // Download the PDF
      this.log('📥 Attempting to download PDF...');
      const currentUrl = this.page.url();

      if (currentUrl.endsWith('.pdf') || currentUrl.includes('.pdf')) {
        this.log('✅ Found direct PDF URL');
        const pdfBase64 = await this.downloadPdfFromUrl(currentUrl);

        return {
          success: true,
          pdfBase64,
          bookNumber: searchData.bookNumber,
          pageNumber: searchData.pageNumber
        };
      }

      // Look for PDF in iframe/embed
      const pdfInfo = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const iframe of iframes) {
          if (iframe.src) return { type: 'iframe', url: iframe.src };
        }

        const embeds = Array.from(document.querySelectorAll('embed'));
        for (const embed of embeds) {
          if (embed.src) return { type: 'embed', url: embed.src };
        }

        return { type: 'none' };
      });

      if (pdfInfo.url) {
        this.log(`✅ Found PDF in ${pdfInfo.type}: ${pdfInfo.url}`);
        const pdfBase64 = await this.downloadPdfFromUrl(pdfInfo.url);

        return {
          success: true,
          pdfBase64,
          bookNumber: searchData.bookNumber,
          pageNumber: searchData.pageNumber
        };
      }

      return {
        success: false,
        error: 'Could not find PDF after clicking Primary Document'
      };

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
