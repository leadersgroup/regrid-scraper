/**
 * Broward County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://web.bcpa.net/BcpaClient/#/Record-Search
 * - Clerk of Courts (Official Records): https://officialrecords.broward.org/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class BrowardCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Broward';
    this.state = 'FL';
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
        '--window-size=1920,1080'
      ]
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await this.page.setViewport({ width: 1920, height: 1080 });

    this.log('✅ Browser initialized with stealth mode');
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Broward County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Broward County doesn't need parcel ID
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Broward County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Broward County supports direct address search',
        county: 'Broward',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://web.bcpa.net/BcpaClient/#/Record-Search`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Broward',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://web.bcpa.net/BcpaClient/#/Record-Search',
        originalAddress: address,
        county: 'Broward',
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
      const deedId = mostRecentDeed.documentId || mostRecentDeed.instrumentNumber;
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
   * Get deed recorder/clerk URL for Broward County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Broward' && state === 'FL') {
      return 'https://officialrecords.broward.org/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Broward County
   */
  getAssessorUrl(county, state) {
    if (county === 'Broward' && state === 'FL') {
      return 'https://web.bcpa.net/BcpaClient/#/Record-Search';
    }
    return null;
  }

  /**
   * Search Broward County Property Appraiser by address
   * URL: https://web.bcpa.net/BcpaClient/#/Record-Search
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Broward County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://web.bcpa.net/BcpaClient/#/Record-Search', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Wait for page to fully load (Angular app)
      await this.randomWait(3000, 5000);

      // Look for address input field
      const addressInput = await this.page.evaluate(() => {
        // Try multiple selectors for address field
        const selectors = [
          'input[placeholder*="Address"]',
          'input[placeholder*="address"]',
          'input[name*="address"]',
          'input[id*="address"]',
          'input[type="text"]'
        ];

        for (const selector of selectors) {
          const input = document.querySelector(selector);
          if (input && input.offsetParent !== null) {
            return {
              found: true,
              selector,
              placeholder: input.placeholder
            };
          }
        }
        return { found: false };
      });

      this.log(`🔍 [INFO] Address input search: ${JSON.stringify(addressInput)}`);

      if (!addressInput.found) {
        this.log(`⚠️ Could not find address input field`);
        return {
          success: false,
          message: 'Could not find address input'
        };
      }

      // Enter address
      // Use the returned selector directly (already found, no need to wait again)
      await this.randomWait(500, 1000);

      // Focus on the input field
      await this.page.focus(addressInput.selector);
      await this.randomWait(300, 500);

      // Clear any existing value and type the address
      await this.page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
          input.focus();
        }
      }, addressInput.selector);

      await this.randomWait(300, 500);

      // Type the address character by character with delay
      for (const char of streetAddress) {
        await this.page.keyboard.type(char);
        await this.randomWait(80, 120);
      }

      this.log(`✅ Entered address: ${streetAddress}`);

      await this.randomWait(2000, 3000);

      // Press Enter to search (Broward auto-suggests results)
      await this.page.keyboard.press('Enter');
      this.log(`⌨️  Pressed Enter to search`);

      // Wait for results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(7000, 10000);

      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found');

        // Look for property details or folio number
        const hasResults = text.includes('folio') ||
                          text.includes('property') ||
                          text.includes('owner') ||
                          text.includes('parcel');

        return {
          hasNoResults,
          hasResults,
          url: window.location.href
        };
      });

      this.log(`🔍 [INFO] Search status: ${JSON.stringify(searchStatus)}`);

      if (!searchStatus.hasNoResults && searchStatus.hasResults) {
        this.log(`✅ Property found in search results`);

        // Click on the folio number to open property details page
        this.log(`🖱️  Looking for folio number link to click...`);

        const folioClicked = await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          for (const link of links) {
            const text = link.textContent?.trim() || '';
            // Folio numbers are 12 digits
            if (text.match(/^\d{12}$/)) {
              link.click();
              return { clicked: true, folio: text };
            }
          }
          return { clicked: false };
        });

        this.log(`🔍 [INFO] Folio click: ${JSON.stringify(folioClicked)}`);

        if (!folioClicked.clicked) {
          this.log(`⚠️ Could not find folio number link to click`);
          return {
            success: false,
            message: 'Could not find folio number link'
          };
        }

        this.log(`✅ Clicked folio: ${folioClicked.folio}, waiting for property details page...`);

        // Wait for property details page to load (Angular SPA needs time)
        await this.randomWait(10000, 15000);

        // Additional wait for Sales History table data to populate
        this.log(`⏳ Waiting for Sales History table to fully load...`);
        await this.randomWait(5000, 7000);

        return {
          success: true,
          message: 'Property details page loaded'
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
   * Extract transaction records from Property Appraiser
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Scroll down to find Sales History section
      this.log('🔍 [INFO] Looking for Sales History section...');
      await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          const text = el.textContent || '';
          if (text.includes('Sales History for this Parcel')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });

      await this.randomWait(2000, 3000);

      // Extract transaction records from Sales History table
      const transactions = await this.page.evaluate(() => {
        const results = [];
        const debugInfo = {
          foundSalesHistory: false,
          foundTable: false,
          rowCount: 0,
          fiveCellRows: 0,
          fourCellRows: 0,
          linksFound: 0,
          allTables: 0,
          sampleRows: []
        };

        // Find the "Sales History for this Parcel" section
        const allElements = Array.from(document.querySelectorAll('*'));
        let salesHistorySection = null;

        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Sales History for this Parcel') ||
              text.includes('Sales History For This Parcel') ||
              text.includes('Sales History')) {
            salesHistorySection = el;
            debugInfo.foundSalesHistory = true;
            break;
          }
        }

        if (!salesHistorySection) {
          // Try alternative: find all tables on the page
          const allTables = Array.from(document.querySelectorAll('table'));
          debugInfo.allTables = allTables.length;

          // Look for tables with "sales" in nearby text
          for (const tbl of allTables) {
            const parent = tbl.parentElement;
            if (parent && parent.textContent?.toLowerCase().includes('sales')) {
              salesHistorySection = parent;
              debugInfo.foundSalesHistory = true;
              break;
            }
          }
        }

        if (!salesHistorySection) {
          return { results, debugInfo };
        }

        // Find the table within or after this section
        // First, try to find a table that has the expected headers
        let table = null;
        const allTables = Array.from(document.querySelectorAll('table'));
        debugInfo.allTables = allTables.length;

        // Look for table with "Date" and "Book/Page or CIN" headers
        for (const tbl of allTables) {
          const headerText = tbl.textContent || '';
          if (headerText.includes('Book/Page or CIN') ||
              headerText.includes('Book/Page') ||
              (headerText.includes('Date') && headerText.includes('Price'))) {
            table = tbl;
            debugInfo.foundTableBy = 'header_match';
            break;
          }
        }

        // Fallback: find table near Sales History text
        if (!table) {
          table = salesHistorySection.querySelector('table');
          if (table) {
            debugInfo.foundTableBy = 'querySelector';
          }
        }

        if (!table) {
          // Try to find table in parent or sibling elements
          let current = salesHistorySection;
          for (let i = 0; i < 5; i++) {
            current = current.parentElement;
            if (!current) break;
            table = current.querySelector('table');
            if (table) {
              debugInfo.foundTableBy = `parent_level_${i}`;
              break;
            }
          }
        }

        if (!table) {
          return { results, debugInfo };
        }

        debugInfo.foundTable = true;

        // Extract rows from the Sales History table
        const rows = Array.from(table.querySelectorAll('tr'));
        debugInfo.rowCount = rows.length;
        debugInfo.cellCounts = [];

        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll('td'));
          const headerCells = Array.from(row.querySelectorAll('th'));

          if (cells.length > 0) {
            debugInfo.cellCounts.push(cells.length);

            // Capture first 3 data rows for debugging
            if (debugInfo.sampleRows.length < 3) {
              debugInfo.sampleRows.push({
                cellCount: cells.length,
                cellTexts: cells.map(c => c.textContent?.trim().substring(0, 50)),
                hasLinks: cells.some(c => c.querySelector('a') !== null)
              });
            }
          }

          // Skip header rows
          if (cells.length === 0) continue;

          // Sales History table has 5 columns: Date | Type | Qualified/Disqualified | Price | Book/Page or CIN
          if (cells.length >= 5) {
            debugInfo.fiveCellRows++;
            // Check if this row contains a Book/Page or CIN in the last column
            const lastCell = cells[4];
            const cellText = lastCell.textContent?.trim() || '';

            // Skip header row
            if (cellText === 'Book/Page or CIN' || cellText === 'Date') {
              continue;
            }

            // Check if cell text contains CIN (9 digits) or Book/Page format
            const cinMatch = cellText.match(/^\d{9}$/);
            const bookPageMatch = cellText.match(/^\d{4,6}\s*\/\s*\d{3,4}$/);

            if (cinMatch || bookPageMatch) {
              const date = cells[0]?.textContent?.trim() || '';
              const type = cells[1]?.textContent?.trim() || '';
              const qualified = cells[2]?.textContent?.trim() || '';
              const price = cells[3]?.textContent?.trim() || '';

              let bookPage = '';
              let instrumentNumber = '';

              if (cinMatch) {
                instrumentNumber = cellText;
              } else if (bookPageMatch) {
                bookPage = cellText;
              }

              results.push({
                date: date,
                type: type,
                qualified: qualified,
                price: price,
                bookPage: bookPage,
                instrumentNumber: instrumentNumber,
                documentId: cellText,
                source: 'Broward County Property Appraiser - Sales History'
              });
            } else {
              // Also check if there's a link inside the cell
              const links = Array.from(lastCell.querySelectorAll('a'));
              if (links.length > 0) {
                debugInfo.linksFound++;
                const link = links[0];
                const linkText = link.textContent?.trim() || '';

                const cinMatchLink = linkText.match(/^\d{9}$/);
                const bookPageMatchLink = linkText.match(/^\d{4,6}\s*\/\s*\d{3,4}$/);

                if (cinMatchLink || bookPageMatchLink) {
                  const date = cells[0]?.textContent?.trim() || '';
                  const type = cells[1]?.textContent?.trim() || '';
                  const qualified = cells[2]?.textContent?.trim() || '';
                  const price = cells[3]?.textContent?.trim() || '';

                  let bookPage = '';
                  let instrumentNumber = '';

                  if (cinMatchLink) {
                    instrumentNumber = linkText;
                  } else if (bookPageMatchLink) {
                    bookPage = linkText;
                  }

                  results.push({
                    date: date,
                    type: type,
                    qualified: qualified,
                    price: price,
                    bookPage: bookPage,
                    instrumentNumber: instrumentNumber,
                    documentId: linkText,
                    source: 'Broward County Property Appraiser - Sales History'
                  });
                }
              }
            }
          }
          // Also check for 4-column rows (older format without Qualified/Disqualified)
          else if (cells.length === 4) {
            debugInfo.fourCellRows++;
            const lastCell = cells[3];
            const cellText = lastCell.textContent?.trim() || '';

            // Check if cell text contains CIN (9 digits) or Book/Page format
            const cinMatch = cellText.match(/^\d{9}$/);
            const bookPageMatch = cellText.match(/^\d{4,6}\s*\/\s*\d{3,4}$/);

            if (cinMatch || bookPageMatch) {
              const date = cells[0]?.textContent?.trim() || '';
              const type = cells[1]?.textContent?.trim() || '';
              const price = cells[2]?.textContent?.trim() || '';

              let bookPage = '';
              let instrumentNumber = '';

              if (cinMatch) {
                instrumentNumber = cellText;
              } else if (bookPageMatch) {
                bookPage = cellText;
              }

              results.push({
                date: date,
                type: type,
                qualified: '',
                price: price,
                bookPage: bookPage,
                instrumentNumber: instrumentNumber,
                documentId: cellText,
                source: 'Broward County Property Appraiser - Sales History'
              });
            } else {
              // Also check if there's a link inside the cell
              const links = Array.from(lastCell.querySelectorAll('a'));
              if (links.length > 0) {
                debugInfo.linksFound++;
                const link = links[0];
                const linkText = link.textContent?.trim() || '';

                const cinMatchLink = linkText.match(/^\d{9}$/);
                const bookPageMatchLink = linkText.match(/^\d{4,6}\s*\/\s*\d{3,4}$/);

                if (cinMatchLink || bookPageMatchLink) {
                  const date = cells[0]?.textContent?.trim() || '';
                  const type = cells[1]?.textContent?.trim() || '';
                  const price = cells[2]?.textContent?.trim() || '';

                  let bookPage = '';
                  let instrumentNumber = '';

                  if (cinMatchLink) {
                    instrumentNumber = linkText;
                  } else if (bookPageMatchLink) {
                    bookPage = linkText;
                  }

                  results.push({
                    date: date,
                    type: type,
                    qualified: '',
                    price: price,
                    bookPage: bookPage,
                    instrumentNumber: instrumentNumber,
                    documentId: linkText,
                    source: 'Broward County Property Appraiser - Sales History'
                  });
                }
              }
            }
          }
        }

        return { results, debugInfo };
      });

      this.log(`🔍 [DEBUG] Table extraction: ${JSON.stringify(transactions.debugInfo)}`);
      this.log(`🔍 [INFO] Extracted ${transactions.results.length} transaction record(s)`);

      if (transactions.results.length > 0) {
        this.log(`🔍 [INFO] First transaction: ${JSON.stringify(transactions.results[0])}`);
      }

      this.log(`✅ Found ${transactions.results.length} transaction record(s)`);

      return {
        success: transactions.results.length > 0,
        transactions: transactions.results
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download deed PDF from Broward County Clerk
   * Uses the approach from Orange County: extract PDF URL and download via https with cookies
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Broward County...');

    try {
      const bookPage = transaction.bookPage;
      const instrumentNumber = transaction.instrumentNumber;

      this.log(`🔍 [INFO] Transaction details: Book/Page=${bookPage}, CIN=${instrumentNumber}`);

      if (!bookPage && !instrumentNumber) {
        throw new Error('No book/page or instrument number available');
      }

      // Navigate directly to Broward County Clerk's Official Records website
      // The CINs in Property Appraiser are not clickable links - we need to construct the URL
      this.log(`🌐 Navigating to Broward County Clerk's Official Records website...`);

      const clerkUrl = `https://officialrecords.broward.org/AcclaimWeb/search/SearchTypeName`;
      await this.page.goto(clerkUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      this.log(`✅ On Clerk's website, searching for CIN/Book-Page...`);

      // Use the instrumentNumber or bookPage to search
      const searchValue = instrumentNumber || bookPage;
      this.log(`🔍 Searching for: ${searchValue}`);

      // Look for PDF in iframe or any element (browser without PDF viewer will show it in iframe)
      this.log(`🔍 Looking for PDF in iframe or page elements...`);

      const pageInfo = await targetPage.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const embeds = Array.from(document.querySelectorAll('embed, object'));
        const links = Array.from(document.querySelectorAll('a'));

        // Check iframes
        for (const iframe of iframes) {
          if (iframe.src && (iframe.src.includes('pdf') || iframe.src.includes('.pdf') || iframe.src.includes('document'))) {
            return { found: true, type: 'iframe', src: iframe.src };
          }
        }

        // Check embeds/objects
        for (const el of embeds) {
          const src = el.src || el.data || '';
          if (src && (src.includes('pdf') || src.includes('.pdf'))) {
            return { found: true, type: el.tagName.toLowerCase(), src: src };
          }
        }

        // Check if page content is PDF
        const contentType = document.contentType || '';
        if (contentType.includes('pdf')) {
          return { found: true, type: 'page', src: window.location.href };
        }

        // Check for PDF links on the page
        const pdfLinks = links.filter(a => {
          const href = (a.href || '').toLowerCase();
          const text = (a.textContent || '').toLowerCase();
          return href.includes('.pdf') || href.includes('document') || href.includes('pdf');
        }).map(a => ({ href: a.href, text: a.textContent?.trim() }));

        // Debug: get page structure info
        return {
          found: false,
          iframeCount: iframes.length,
          embedCount: embeds.length,
          pdfLinksCount: pdfLinks.length,
          pdfLinks: pdfLinks.slice(0, 3), // First 3 PDF links
          pageContentPreview: document.body.innerText.substring(0, 300),
          url: window.location.href
        };
      });

      this.log(`🔍 [DEBUG] Page info: ${JSON.stringify(pageInfo)}`);

      const iframeInfo = pageInfo.found ? pageInfo : { found: false };

      if (iframeInfo.found) {
        this.log(`📄 Found PDF in iframe: ${iframeInfo.src}`);

        // Download the PDF using Node.js https module with session cookies
        // This is the same approach as Orange County
        const path = require('path');
        const fs = require('fs');
        const https = require('https');
        const url = require('url');

        const pdfUrl = iframeInfo.src;
        this.log(`📥 Downloading PDF using https module with session cookies...`);

        // Get cookies from current page session
        const cookies = await targetPage.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        this.log(`📋 Using ${cookies.length} cookies from session`);

        const parsedUrl = url.parse(pdfUrl);

        return await new Promise((resolve, reject) => {
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
              'Cookie': cookieString,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/pdf,*/*',
              'Referer': currentUrl,
              'Accept-Language': 'en-US,en;q=0.9'
            },
            timeout: 60000
          };

          this.log(`🌐 GET ${pdfUrl}`);

          const req = https.request(options, (res) => {
            this.log(`📥 Response: ${res.statusCode} ${res.statusMessage}`);
            this.log(`   Content-Type: ${res.headers['content-type']}`);
            this.log(`   Content-Length: ${res.headers['content-length']}`);

            if (res.statusCode === 200) {
              const chunks = [];

              res.on('data', (chunk) => {
                chunks.push(chunk);
              });

              res.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);

                // Verify it's actually a PDF
                const header = pdfBuffer.slice(0, 5).toString();
                if (header !== '%PDF-') {
                  this.log(`❌ Response is not a PDF (header: ${header})`);
                  this.log(`   First 100 bytes: ${pdfBuffer.slice(0, 100).toString()}`);
                  reject(new Error('Downloaded content is not a PDF file'));
                  return;
                }

                this.log(`✅ PDF downloaded successfully`);
                this.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

                // Convert to base64 for API response
                const pdfBase64 = pdfBuffer.toString('base64');

                resolve({
                  success: true,
                  pdfBase64: pdfBase64,
                  filename: `broward_deed_${bookPage || instrumentNumber}.pdf`.replace(/\//g, '_'),
                  source: 'Broward County - Official Records',
                  bookPage: bookPage,
                  instrumentNumber: instrumentNumber,
                  fileSize: pdfBuffer.length
                });
              });
            } else if (res.statusCode === 302 || res.statusCode === 301) {
              reject(new Error(`Redirect to: ${res.headers.location}`));
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          });

          req.on('error', (err) => {
            this.log(`❌ Request error: ${err.message}`);
            reject(err);
          });

          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout after 60 seconds'));
          });

          req.end();
        });

      } else {
        // No iframe found - maybe PDF viewer worked or different page structure
        this.log(`⚠️ No PDF iframe found on page`);

        return {
          success: false,
          error: 'Could not find PDF on page (no iframe with PDF)',
          currentUrl: currentUrl
        };
      }

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = BrowardCountyFloridaScraper;
