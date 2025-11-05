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
      this.log(`🌐 Navigating to assessor: https://bcpa.net/RecAddr.asp`);

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
      return 'https://bcpa.net/RecAddr.asp';
    }
    return null;
  }

  /**
   * Parse address into components for Broward County search form
   * Example: "1274 NE 40 STREET #4, OAKLAND PARK FL 33334"
   * Returns: { houseNumber: "1274", direction: "NE", streetName: "40", streetType: "STREET", unit: "4", city: "OAKLAND PARK" }
   */
  parseAddress(fullAddress) {
    this.log(`🔍 Parsing address: ${fullAddress}`);

    // Remove extra whitespace
    let address = fullAddress.trim().toUpperCase();

    // Extract city (after comma)
    let city = '';
    const parts = address.split(',');
    if (parts.length >= 2) {
      // City is in second part (before state and zip)
      const cityPart = parts[1].trim();
      // Remove state and zip (FL 33334)
      city = cityPart.replace(/\s+FL\s+\d{5}.*$/, '').trim();
    }

    // Work with first part (street address)
    const streetPart = parts[0].trim();

    // Extract unit number (anything after # or APT or UNIT)
    let unit = '';
    const unitMatch = streetPart.match(/#\s*(\S+)|(?:APT|UNIT)\s+(\S+)/i);
    if (unitMatch) {
      unit = unitMatch[1] || unitMatch[2];
    }

    // Remove unit from street address
    let street = streetPart.replace(/#\s*\S+|(?:APT|UNIT)\s+\S+/gi, '').trim();

    // Parse street components
    // Pattern: [house number] [direction?] [street name] [street type]
    const streetRegex = /^(\d+)\s+([NSEW]{1,2})?\s*(.+?)\s+(STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|LANE|LN|WAY|BOULEVARD|BLVD|COURT|CT|CIRCLE|CIR|PLACE|PL|TERRACE|TER|TRAIL|TRL)(?:\s|$)/i;

    const match = street.match(streetRegex);

    if (!match) {
      // Fallback: try without street type
      const simpleRegex = /^(\d+)\s+([NSEW]{1,2})?\s*(.+)/i;
      const simpleMatch = street.match(simpleRegex);

      if (simpleMatch) {
        return {
          houseNumber: simpleMatch[1],
          direction: simpleMatch[2] || '',
          streetName: simpleMatch[3],
          streetType: '',
          unit,
          city
        };
      }

      this.log(`⚠️ Could not parse address: ${fullAddress}`);
      return null;
    }

    const parsed = {
      houseNumber: match[1],
      direction: match[2] || '',
      streetName: match[3].trim().replace(/(\d+)(ST|ND|RD|TH)$/i, '$1'), // Remove ordinal suffix from street name
      streetType: match[4].toUpperCase(),
      unit,
      city
    };

    this.log(`✅ Parsed address:`, JSON.stringify(parsed, null, 2));
    return parsed;
  }

  /**
   * Search Broward County Property Appraiser by address
   * URL: https://bcpa.net/RecAddr.asp
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Broward County FL Property Appraiser`);
    this.log(`   Using address search at https://bcpa.net/RecAddr.asp`);

    try {
      // Navigate to property search page
      await this.page.goto('https://bcpa.net/RecAddr.asp', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Inspect page structure first
      const pageStructure = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const selects = Array.from(document.querySelectorAll('select'));
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));

        return {
          title: document.title,
          url: window.location.href,
          inputs: inputs.map(input => ({
            name: input.name,
            type: input.type,
            id: input.id,
            value: input.value,
            placeholder: input.placeholder
          })),
          selects: selects.map(select => ({
            name: select.name,
            id: select.id,
            optionCount: select.options.length
          })),
          buttons: buttons.map(btn => ({
            tag: btn.tagName,
            type: btn.type,
            value: btn.value,
            text: btn.textContent?.trim().substring(0, 30)
          }))
        };
      });

      this.log(`📋 Page structure:`);
      this.log(`   Title: ${pageStructure.title}`);
      this.log(`   All inputs: ${JSON.stringify(pageStructure.inputs, null, 2)}`);
      this.log(`   Buttons: ${JSON.stringify(pageStructure.buttons, null, 2)}`);

      // Parse address into components
      const fullAddress = this.currentAddress || '';
      const addressParts = this.parseAddress(fullAddress);

      if (!addressParts) {
        return {
          success: false,
          message: 'Could not parse address into components'
        };
      }

      this.log(`🏠 Filling address form with parsed components...`);

      // Fill in house number (Situs_Street_Number)
      if (addressParts.houseNumber) {
        await this.page.type('input[name="Situs_Street_Number"]', addressParts.houseNumber);
        this.log(`   House number: ${addressParts.houseNumber}`);
      }

      await this.randomWait(300, 500);

      // Fill in street direction (optional) (Situs_Street_Direction)
      if (addressParts.direction) {
        await this.page.select('select[name="Situs_Street_Direction"]', addressParts.direction);
        this.log(`   Street direction: ${addressParts.direction}`);
      }

      await this.randomWait(300, 500);

      // Fill in street name (Situs_Street_Name)
      if (addressParts.streetName) {
        await this.page.type('input[name="Situs_Street_Name"]', addressParts.streetName);
        this.log(`   Street name: ${addressParts.streetName}`);
      }

      await this.randomWait(300, 500);

      // Fill in street type (Situs_Street_Type)
      if (addressParts.streetType) {
        await this.page.select('select[name="Situs_Street_Type"]', addressParts.streetType);
        this.log(`   Street type: ${addressParts.streetType}`);
      }

      await this.randomWait(300, 500);

      // Fill in unit number (optional) (Situs_Unit_Number)
      if (addressParts.unit) {
        await this.page.type('input[name="Situs_Unit_Number"]', addressParts.unit);
        this.log(`   Unit: ${addressParts.unit}`);
      }

      await this.randomWait(300, 500);

      // Fill in city (optional) (Situs_City)
      if (addressParts.city) {
        // City is a select dropdown, need to find matching option
        const citySet = await this.page.evaluate((cityName) => {
          const citySelect = document.querySelector('select[name="Situs_City"]');
          if (!citySelect) return false;

          // Find option that matches the city name
          const options = Array.from(citySelect.options);
          for (const option of options) {
            if (option.text.toUpperCase().includes(cityName.toUpperCase())) {
              citySelect.value = option.value;
              return true;
            }
          }
          return false;
        }, addressParts.city);

        if (citySet) {
          this.log(`   City: ${addressParts.city}`);
        } else {
          this.log(`   ⚠️ Could not find city "${addressParts.city}" in dropdown`);
        }
      }

      await this.randomWait(500, 1000);

      // Submit the form using JavaScript
      this.log(`🔍 Submitting search form...`);
      const submitted = await this.page.evaluate(() => {
        const forms = document.querySelectorAll('form');
        if (forms.length > 0) {
          forms[0].submit();
          return { submitted: true, formCount: forms.length };
        }
        return { submitted: false, formCount: 0 };
      });

      this.log(`📋 Form submit: ${JSON.stringify(submitted)}`);

      // Wait for results
      await this.randomWait(3000, 5000);

      // Check if property was found
      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      if (currentUrl.includes('RecInfo.asp')) {
        this.log(`✅ Property found! Redirected to property details page`);

        // Wait for page to fully load
        await this.randomWait(2000, 3000);

        return {
          success: true,
          message: 'Property details page loaded',
          url: currentUrl
        };
      } else {
        this.log(`⚠️ Property not found or multiple results`);
        return {
          success: false,
          message: 'Property not found or multiple results returned'
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
      const documentId = transaction.documentId;

      this.log(`🔍 Transaction details: Book/Page=${bookPage}, CIN=${instrumentNumber}, DocumentID=${documentId}`);

      if (!documentId && !instrumentNumber && !bookPage) {
        throw new Error('No document ID, book/page, or instrument number available');
      }

      // The Book/Page or CIN should be a clickable link on the current page (RecInfo.asp)
      // Click on it to load the PDF
      const searchValue = documentId || instrumentNumber || bookPage;
      this.log(`🔍 Looking for clickable link with: ${searchValue}`);

      // Scroll to Sale History section first
      await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (const el of elements) {
          const text = el.textContent || '';
          if (text.includes('Sale History') || text.includes('Sales History')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });

      await this.randomWait(1000, 2000);

      // Set up network request monitoring BEFORE clicking the link
      this.log('📡 Setting up network monitoring to capture PDF requests...');
      const pdfRequests = [];

      const requestHandler = (request) => {
        const url = request.url();
        const resourceType = request.resourceType();

        // Capture any PDF-related requests
        if (url.includes('.pdf') || url.includes('/pdf') || url.includes('document') ||
            url.includes('Image') || url.includes('blob') || url.includes('DocumentImage') ||
            resourceType === 'document') {
          pdfRequests.push({
            url,
            resourceType,
            method: request.method()
          });
          this.log(`📥 Captured request: ${resourceType} - ${url.substring(0, 150)}`);
        }
      };

      this.page.on('request', requestHandler);

      // Find and click the link with the document ID
      const linkClicked = await this.page.evaluate((searchValue) => {
        // Look for links containing the search value
        const allLinks = Array.from(document.querySelectorAll('a'));

        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // Match the CIN (9 digits) or Book/Page format
          if (text === searchValue || text.includes(searchValue)) {
            link.click();
            return { clicked: true, text, href: href.substring(0, 150) };
          }
        }

        return { clicked: false, linksFound: allLinks.length };
      }, searchValue);

      this.log(`🔍 Link click result: ${JSON.stringify(linkClicked)}`);

      if (!linkClicked.clicked) {
        throw new Error(`Could not find clickable link for document ${searchValue}`);
      }

      this.log(`✅ Clicked on document link: ${linkClicked.text}`);

      // Wait for PDF page to load (it loads in the same window)
      // The page navigates to a document details page, then the PDF loads
      this.log(`⏳ Waiting for PDF document page to load...`);
      await this.randomWait(5000, 7000);

      // Get current URL - should be on document details page now
      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      // The PDF should be on this page - use current page as the PDF page
      const targetPage = this.page;

      // Remove the request handler
      this.page.off('request', requestHandler);

      // Log captured requests
      if (pdfRequests.length > 0) {
        this.log(`📋 Found ${pdfRequests.length} PDF-related network request(s):`);
        pdfRequests.forEach((req, idx) => {
          this.log(`   ${idx + 1}. ${req.resourceType}: ${req.url.substring(0, 150)}`);
        });
      }

      // Look for PDF in iframe or any element - try multiple times as PDF may load async
      this.log(`🔍 Looking for PDF in iframe or page elements (will try multiple times)...`);

      let pageInfo = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        await this.randomWait(1000, 2000);

        pageInfo = await targetPage.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll('iframe'));
          const embeds = Array.from(document.querySelectorAll('embed, object'));
          const links = Array.from(document.querySelectorAll('a'));

          // Check iframes - look for any iframe, not just ones with 'pdf' in src
          for (const iframe of iframes) {
            const src = iframe.src || '';
            // Any iframe could contain the PDF
            if (src && src.length > 10) {
              return { found: true, type: 'iframe', src: src };
            }
          }

          // Check embeds/objects
          for (const el of embeds) {
            const src = el.src || el.data || '';
            if (src && src.length > 10) {
              return { found: true, type: el.tagName.toLowerCase(), src: src };
            }
          }

          // Check if page content is PDF
          const contentType = document.contentType || '';
          if (contentType.includes('pdf')) {
            return { found: true, type: 'page', src: window.location.href };
          }

          // Check for PDF links on the page (including download/view buttons)
          const pdfLinks = links.filter(a => {
            const href = (a.href || '').toLowerCase();
            const text = (a.textContent || '').toLowerCase();
            return href.includes('.pdf') || href.includes('document') || href.includes('pdf') ||
                   href.includes('download') || href.includes('view') ||
                   text.includes('download') || text.includes('view') || text.includes('pdf');
          }).map(a => ({ href: a.href, text: a.textContent?.trim().substring(0, 50) }));

          // Debug: get page structure info
          return {
            found: false,
            iframeCount: iframes.length,
            iframeSrcs: iframes.map(i => i.src?.substring(0, 100)),
            embedCount: embeds.length,
            pdfLinksCount: pdfLinks.length,
            pdfLinks: pdfLinks.slice(0, 5), // First 5 PDF-related links
            pageContentPreview: document.body.innerText.substring(0, 300),
            url: window.location.href
          };
        });

        if (pageInfo.found || pageInfo.iframeCount > 0 || pageInfo.pdfLinksCount > 0) {
          this.log(`✅ Found PDF source on attempt ${attempt + 1}`);
          break;
        }

        this.log(`   Attempt ${attempt + 1}/10: No PDF found yet, waiting...`);
      }

      this.log(`🔍 [DEBUG] Page info: ${JSON.stringify(pageInfo)}`);

      let pdfUrl = null;

      // PRIORITY 1: Use captured PDF request from network monitoring (most reliable)
      if (pdfRequests.length > 0) {
        this.log(`🎯 Using PDF URL from network capture (most recent)...`);
        // Find the most promising PDF request - prefer ones with .pdf or document in URL
        const pdfRequest = pdfRequests.find(r => r.url.includes('.pdf') || r.url.includes('/pdf/')) || pdfRequests[pdfRequests.length - 1];
        pdfUrl = pdfRequest.url;
        this.log(`📄 PDF URL from network: ${pdfUrl.substring(0, 150)}`);
      }
      // PRIORITY 2: Found PDF in iframe or embed
      else if (pageInfo.found) {
        this.log(`📄 Found PDF in ${pageInfo.type}: ${pageInfo.src}`);
        pdfUrl = pageInfo.src;
      }
      // PRIORITY 3: Found PDF links on the page
      else if (pageInfo.pdfLinksCount > 0 && pageInfo.pdfLinks.length > 0) {
        this.log(`📄 Found ${pageInfo.pdfLinksCount} PDF link(s), using first one`);
        pdfUrl = pageInfo.pdfLinks[0].href;
      }
      // PRIORITY 4: Try using the current page URL as PDF source
      else {
        this.log(`⚠️ No PDF found via network or page elements, will try current page URL as fallback`);
        pdfUrl = currentUrl;
      }

      if (pdfUrl) {
        this.log(`📄 Using PDF URL: ${pdfUrl.substring(0, 150)}`);
      } else {
        throw new Error('Could not find PDF URL');
      }

      // Download the PDF using Orange County method (https with cookies)
      if (true) {  // Always use Orange County method
        this.log(`📥 Downloading PDF using Orange County method (https with cookies)...`);

        // Download the PDF using Node.js https module with session cookies
        // This is the same approach as Orange County
        const path = require('path');
        const fs = require('fs');
        const https = require('https');
        const url = require('url');

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
