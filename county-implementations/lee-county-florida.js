/**
 * Lee County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://www.leepa.org/search/propertysearch.aspx
 * - Clerk of Courts (Official Records): https://or.leeclerk.org/LandMarkWeb
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection on Lee County website
puppeteer.use(StealthPlugin());

class LeeCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Lee';
    this.state = 'FL';
    this.debugLogs = []; // Collect debug logs for API response
  }

  /**
   * Override log method - just use parent implementation
   * All logs will be visible in Railway logs
   */
  log(message) {
    // Call parent log method (console.log if verbose)
    super.log(message);
  }

  /**
   * Override initialize to use puppeteer-extra with stealth plugin
   * Lee County may have bot detection
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
      protocolTimeout: 600000, // 10 minute timeout for protocol operations (increased from 5 min)
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

    // Set realistic user agent
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Set realistic viewport
    await this.page.setViewport({ width: 1920, height: 1080 });

    // Add realistic headers
    await this.page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1'
    });

    this.log('✅ Browser initialized with stealth mode');
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Lee County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Lee County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Lee County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Lee County supports direct address search',
        county: 'Lee',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://www.leepa.org/search/propertysearch.aspx`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Lee',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://www.leepa.org/search/propertysearch.aspx',
        originalAddress: address,
        county: 'Lee',
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
      const deedId = mostRecentDeed.instrumentNumber || `Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`;
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
   * Get deed recorder/clerk URL for Lee County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Lee' && state === 'FL') {
      return 'https://or.leeclerk.org/LandMarkWeb';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Lee County
   */
  getAssessorUrl(county, state) {
    if (county === 'Lee' && state === 'FL') {
      return 'https://www.leepa.org/search/propertysearch.aspx';
    }
    return null;
  }

  /**
   * Search Lee County Property Appraiser by address
   * URL: https://www.leepa.org/Search/PropertySearch.aspx
   * Workflow:
   * 1. Find 'street address' search box
   * 2. Type in address without city and state (e.g., "503 NORIDGE DR")
   * 3. Click on search button
   * 4. After match table is shown, find 'parcel details' button and click it
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Lee County FL Property Appraiser`);
    this.log(`   Using street address search (without city/state)`);

    try {
      // Navigate to property search page
      await this.page.goto('https://www.leepa.org/Search/PropertySearch.aspx', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(3000, 5000);

      // Check for and dismiss any popups or overlays
      const popupDismissed = await this.page.evaluate(() => {
        // Look for close buttons on modals/dialogs
        const closeButtons = Array.from(document.querySelectorAll('button, a, [class*="close"], [class*="dismiss"]'));
        for (const btn of closeButtons) {
          const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
          if (text.includes('close') || text.includes('dismiss') || text.includes('×')) {
            const style = window.getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              btn.click();
              return true;
            }
          }
        }
        return false;
      });

      if (popupDismissed) {
        this.log(`✅ Dismissed popup`);
        await this.randomWait(1000, 2000);
      }

      // Extract just the street address (remove city, state, zip)
      const fullAddress = this.currentAddress || '';
      let streetAddress = fullAddress.split(',')[0].trim();

      this.log(`🏠 Searching for address: ${streetAddress}`);

      // Look for the 'street address' search box
      const addressInputSelectors = [
        'input[id*="txtStreetAddress"]',
        'input[name*="txtStreetAddress"]',
        'input[id*="StreetAddress"]',
        'input[placeholder*="Street"]',
        'input[name*="Address"]',
        'input[type="text"]'
      ];

      let addressInput = null;
      for (const selector of addressInputSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000, visible: true });
          addressInput = selector;
          this.log(`✅ Found street address input: ${selector}`);
          break;
        } catch (e) {
          this.log(`⚠️  Selector not found: ${selector}`);
          // Try next selector
        }
      }

      if (!addressInput) {
        // Log all input fields on the page for debugging
        const allInputs = await this.page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
          return inputs.map(input => ({
            id: input.id,
            name: input.name,
            placeholder: input.placeholder,
            className: input.className,
            visible: window.getComputedStyle(input).display !== 'none'
          }));
        });

        this.log(`⚠️  All text inputs found on page:`);
        this.log(JSON.stringify(allInputs, null, 2));

        throw new Error('Could not find street address input field');
      }

      // Enter street address using DOM manipulation (page.type() times out on this site)
      await this.page.evaluate((selector, address) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = address;
          // Trigger input events to ensure the form recognizes the change
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, addressInput, streetAddress);

      this.log(`✅ Entered address: ${streetAddress}`);
      await this.randomWait(1000, 2000);

      // Press Enter to submit the search (simpler than clicking button)
      this.log(`⌨️  Pressing Enter to submit search...`);
      await this.page.keyboard.press('Enter');

      this.log(`✅ Search submitted via Enter key`);

      // Wait for search results to load (match table)
      this.log(`⏳ Waiting for search results to load...`);
      await this.randomWait(5000, 7000);

      // Wait for match table to appear
      try {
        await this.page.waitForFunction(() => {
          const text = document.body.innerText.toLowerCase();
          return text.includes('match') ||
                 text.includes('results') ||
                 text.includes('folio') ||
                 text.includes('parcel');
        }, { timeout: 30000 });

        this.log(`✅ Search results loaded`);
      } catch (waitError) {
        this.log(`⚠️ Timeout waiting for results, checking page content anyway...`);
      }

      await this.randomWait(2000, 3000);

      // Debug: Check page content
      const pageContent = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;
        return {
          hasMatch: bodyText.toLowerCase().includes('match'),
          hasResults: bodyText.toLowerCase().includes('results'),
          hasProperty: bodyText.toLowerCase().includes('property'),
          hasNoMatch: bodyText.toLowerCase().includes('no match') || bodyText.toLowerCase().includes('no results'),
          snippet: bodyText.substring(0, 500)
        };
      });

      this.log(`⚠️  Debug: Page content check:`);
      this.log(`   Has "match": ${pageContent.hasMatch}`);
      this.log(`   Has "results": ${pageContent.hasResults}`);
      this.log(`   Has "no match": ${pageContent.hasNoMatch}`);
      this.log(`   Content snippet: ${pageContent.snippet.substring(0, 200)}...`);

      // Look for 'parcel details' button and click it
      this.log(`🔍 Looking for "Parcel Details" button or link...`);

      // Find the link selector (not clicking yet, just finding)
      const linkInfo = await this.page.evaluate(() => {
        const debugInfo = {
          allLinks: [],
          displayParcelLinks: [],
          foundSelector: null
        };

        // First, collect all links for debugging
        const allLinks = Array.from(document.querySelectorAll('a[href]'));
        debugInfo.allLinks = allLinks.slice(0, 20).map(a => ({
          text: a.textContent?.trim().substring(0, 50),
          href: a.href
        }));

        // Check for links with DisplayParcel.aspx
        const displayParcelLinks = Array.from(document.querySelectorAll('a[href*="DisplayParcel"]'));
        debugInfo.displayParcelLinks = displayParcelLinks.map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        }));

        if (displayParcelLinks.length > 0) {
          // Return selector instead of clicking
          const link = displayParcelLinks[0];
          if (link.id) {
            debugInfo.foundSelector = `#${link.id}`;
          } else {
            debugInfo.foundSelector = `a[href*="DisplayParcel"]`;
          }
          return { found: true, text: link.textContent?.trim() || 'DisplayParcel link', debugInfo };
        }

        // Look for buttons/links with "details" text
        const allElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

        for (const el of allElements) {
          const text = (el.textContent || el.value || '').toLowerCase();
          const title = (el.title || '').toLowerCase();

          if (text.includes('parcel details') ||
              title.includes('parcel details') ||
              text.includes('view details') ||
              text.includes('details')) {
            if (el.id) {
              debugInfo.foundSelector = `#${el.id}`;
            } else if (el.tagName === 'A') {
              debugInfo.foundSelector = `a:has-text("${el.textContent?.trim()}")`;
            }
            return { found: true, text: el.textContent || el.value || el.title, debugInfo };
          }
        }

        // Try first visible link in a table row
        const tableLinks = Array.from(document.querySelectorAll('table a[href]'));
        if (tableLinks.length > 0) {
          const link = tableLinks[0];
          debugInfo.foundSelector = 'table a[href]';
          return { found: true, text: `First table link: ${link.textContent?.trim()}`, debugInfo };
        }

        return { found: false, debugInfo };
      });

      if (!linkInfo || !linkInfo.found) {
        this.log(`⚠️  Debug: Found ${linkInfo.debugInfo.allLinks.length} links on page:`);
        linkInfo.debugInfo.allLinks.forEach((link, i) => {
          this.log(`   [${i+1}] "${link.text}" -> ${link.href}`);
        });

        this.log(`⚠️  Debug: Found ${linkInfo.debugInfo.displayParcelLinks.length} DisplayParcel links`);

        throw new Error('Could not find "Parcel Details" button or link');
      }

      this.log(`✅ Found link: ${linkInfo.text}, selector: ${linkInfo.debugInfo.foundSelector}`);

      // Check if link opens in new tab/window
      const linkTarget = await this.page.evaluate((selector) => {
        const link = document.querySelector(selector);
        return link ? { target: link.target, href: link.href } : null;
      }, linkInfo.debugInfo.foundSelector);

      this.log(`🔗 Link target: ${linkTarget.target || 'same window'}, href: ${linkTarget.href}`);

      // If there's a DisplayParcel link, navigate directly to it
      if (linkTarget && linkTarget.href && linkTarget.href.includes('DisplayParcel.aspx')) {
        this.log(`🌐 Navigating directly to: ${linkTarget.href}`);
        await this.page.goto(linkTarget.href, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        this.log(`✅ Navigated to parcel details page`);
      } else {
        // Try clicking and waiting for navigation
        try {
          await Promise.all([
            this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            this.page.click(linkInfo.debugInfo.foundSelector)
          ]);
          this.log(`✅ Clicked link and navigated successfully`);
        } catch (navError) {
          this.log(`⚠️  No navigation occurred after clicking: ${navError.message}`);
        }
      }

      // Wait for parcel details content to load
      await this.randomWait(3000, 5000);

      // Verify we're on the parcel details page
      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      if (currentUrl.includes('DisplayParcel.aspx')) {
        this.log(`✅ Successfully navigated to parcel details page`);
        return {
          success: true,
          message: 'Property found and navigated to parcel details'
        };
      } else {
        throw new Error('Did not navigate to parcel details page');
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
   * Navigate to Sales/Transactions tab and extract Clerk file number
   * Workflow:
   * 1. Click on 'Sales/Transactions' tab to open it
   * 2. Click on 1st entry in "Clerk file number" column (e.g., 2022000220622)
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Click on 'Sales/Transactions' tab
      this.log('🔍 Looking for "Sales/Transactions" tab...');

      const salesTabClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li'));

        for (const el of allElements) {
          const text = (el.textContent || '').trim();

          if (text.toLowerCase().includes('sales') &&
              (text.toLowerCase().includes('transaction') || text.toLowerCase().includes('history'))) {

            if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'LI') {
              el.click();
              return { clicked: true, element: el.tagName, text: text };
            }

            const clickableParent = el.closest('a, button, li, [onclick]');
            if (clickableParent) {
              clickableParent.click();
              return { clicked: true, element: clickableParent.tagName, text: text };
            }
          }

          // Also look for exact match "Sales/Transactions"
          if (text === 'Sales/Transactions' || text === 'Sales / Transactions') {
            if (el.tagName === 'A' || el.tagName === 'BUTTON' || el.tagName === 'LI') {
              el.click();
              return { clicked: true, element: el.tagName, text: text };
            }

            const clickableParent = el.closest('a, button, li, [onclick]');
            if (clickableParent) {
              clickableParent.click();
              return { clicked: true, element: clickableParent.tagName, text: text };
            }
          }
        }

        return { clicked: false };
      });

      if (!salesTabClicked || !salesTabClicked.clicked) {
        throw new Error('Could not find "Sales/Transactions" tab');
      }

      this.log(`✅ Clicked on "Sales/Transactions" tab: ${salesTabClicked.text}`);

      // Wait for tab content to load
      await this.randomWait(5000, 7000);

      // Scroll to ensure content is loaded
      await this.page.evaluate(() => {
        window.scrollBy(0, 500);
      });
      await this.randomWait(2000, 3000);

      // Extract Clerk file numbers from the table
      this.log('🔍 Extracting Clerk file numbers from Sales/Transactions table...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Look for table with Clerk file number column
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const tableText = (table.innerText || table.textContent || '').toLowerCase();

          // Check if this table contains "clerk file" or similar
          if (tableText.includes('clerk file') ||
              tableText.includes('instrument') ||
              tableText.includes('sale')) {

            // Find all rows
            const rows = table.querySelectorAll('tr');

            for (const row of rows) {
              const cells = Array.from(row.querySelectorAll('td'));

              // Look for clerk file numbers in cells (typically 13 digits like 2022000220622)
              for (const cell of cells) {
                const text = (cell.textContent || '').trim();

                // Clerk file number format: YYYYXXXXXXXXX (year + sequence)
                // Example: 2022000220622 (13 digits starting with year)
                const clerkFileMatch = text.match(/^(20\d{11})$/);

                if (clerkFileMatch) {
                  results.push({
                    clerkFileNumber: clerkFileMatch[1],
                    type: 'clerk_file',
                    source: 'Lee County Property Appraiser - Sales/Transactions',
                    rawText: text
                  });
                }

                // Also look for links with CFN parameter
                const links = cell.querySelectorAll('a[href*="CFN"]');
                for (const link of links) {
                  const href = link.href || '';
                  const cfnMatch = href.match(/cfn=(\d+)/i);

                  if (cfnMatch) {
                    const exists = results.some(r => r.clerkFileNumber === cfnMatch[1]);
                    if (!exists) {
                      results.push({
                        clerkFileNumber: cfnMatch[1],
                        type: 'clerk_file',
                        source: 'Lee County Property Appraiser - Sales/Transactions (link)',
                        rawText: link.textContent?.trim() || cfnMatch[1]
                      });
                    }
                  }
                }
              }
            }
          }
        }

        return results;
      });

      if (transactions.length > 0) {
        this.log(`🔍 Extracted ${transactions.length} clerk file number(s)`);
        transactions.forEach((t, i) => {
          this.log(`   📄 Clerk File #${i+1}: ${t.clerkFileNumber}`);
        });

        return {
          success: true,
          transactions: transactions.map(t => ({
            instrumentNumber: t.clerkFileNumber,  // Use instrumentNumber for compatibility
            clerkFileNumber: t.clerkFileNumber,
            type: 'clerk_file',
            source: t.source
          }))
        };
      }

      this.log(`⚠️ No clerk file numbers found in Sales/Transactions table`);
      return {
        success: false,
        message: 'No clerk file numbers found',
        transactions: []
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message,
        transactions: []
      };
    }
  }

  /**
   * Download deed PDF from Lee County Clerk
   * Workflow:
   * 1. Directly navigate to PDF URL: https://or.leeclerk.org/LandMarkWeb/Document/GetDocumentByCFN/?cfn=2022000220622
   * 2. Download using Brevard County method (iframe + Save Document button)
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Lee County Clerk...');

    try {
      const clerkFileNumber = transaction.clerkFileNumber || transaction.instrumentNumber;

      if (!clerkFileNumber) {
        throw new Error('No clerk file number found in transaction record');
      }

      // Construct direct PDF URL
      const pdfUrl = `https://or.leeclerk.org/LandMarkWeb/Document/GetDocumentByCFN/?cfn=${clerkFileNumber}`;
      this.log(`🌐 Navigating to PDF page: ${pdfUrl}`);

      // Set up download handling BEFORE navigating
      const path = require('path');
      const fs = require('fs');
      const relativePath = process.env.DEED_DOWNLOAD_PATH || './downloads';
      const downloadPath = path.resolve(relativePath);

      // Ensure download directory exists
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
        this.log(`📁 Created download directory: ${downloadPath}`);
      }

      // Set download behavior
      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      this.log(`📁 Download path set to: ${downloadPath}`);

      // Navigate to the PDF page
      await this.page.goto(pdfUrl, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      this.log(`✅ PDF page loaded`);

      // Wait for the page to load
      await this.randomWait(3000, 5000);

      // Check if there's an iframe with PDF viewer (like Brevard)
      const iframeElement = await this.page.$('iframe');

      if (iframeElement) {
        this.log(`✅ Found PDF iframe`);

        // Get the iframe's content frame
        const frame = await iframeElement.contentFrame();

        if (frame) {
          this.log(`✅ Accessed iframe content`);

          // Wait for PDF viewer to load in iframe
          await this.randomWait(2000, 3000);

          // Look for "Save Document" button (like Brevard)
          this.log(`🔍 Looking for "Save Document" button...`);

          try {
            await frame.waitForSelector('#SaveDoc', { timeout: 10000 });

            this.log(`🔘 Found "Save Document" button (id=SaveDoc)`);

            // Click the button using evaluate
            await frame.evaluate(() => {
              const btn = document.querySelector('#SaveDoc');
              if (btn) {
                btn.click();
                return true;
              }
              return false;
            });

            this.log(`✅ Clicked "Save Document" button`);

            // Wait for download to complete
            this.log(`⏳ Waiting for PDF download to complete...`);
            await this.randomWait(5000, 8000);

            // Find the downloaded PDF
            const files = fs.readdirSync(downloadPath);
            const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

            if (pdfFiles.length === 0) {
              throw new Error('No PDF file found in download directory after clicking Save');
            }

            // Get the most recent PDF
            const latestPdf = pdfFiles.sort((a, b) => {
              const statA = fs.statSync(path.join(downloadPath, a));
              const statB = fs.statSync(path.join(downloadPath, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            })[0];

            const filepath = path.join(downloadPath, latestPdf);
            const stats = fs.statSync(filepath);

            // Read the PDF to get base64
            const pdfBuffer = fs.readFileSync(filepath);
            const pdfBase64 = pdfBuffer.toString('base64');

            this.log(`✅ PDF downloaded successfully: ${latestPdf}`);
            this.log(`💾 File size: ${(stats.size / 1024).toFixed(2)} KB`);

            // Rename to standard format
            const filename = `lee_deed_${clerkFileNumber}.pdf`;
            const newFilepath = path.join(downloadPath, filename);

            if (filepath !== newFilepath) {
              fs.renameSync(filepath, newFilepath);
              this.log(`📝 Renamed to: ${filename}`);
            }

            return {
              success: true,
              filename,
              downloadPath,
              filepath: newFilepath,
              clerkFileNumber,
              instrumentNumber: clerkFileNumber,
              pdfUrl,
              timestamp: new Date().toISOString(),
              fileSize: stats.size,
              pdfBase64
            };

          } catch (saveButtonError) {
            this.log(`⚠️ Could not find Save Document button: ${saveButtonError.message}`);
            // Fall through to alternative download method
          }
        }
      }

      // Alternative: Try to download PDF directly from current page
      this.log('ℹ️  Trying to download PDF directly from page...');

      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      // Try to download PDF using fetch
      const pdfArrayBuffer = await this.page.evaluate(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        } catch (err) {
          return null;
        }
      }, currentUrl);

      if (!pdfArrayBuffer) {
        throw new Error('Could not download PDF - iframe Save button not found and direct download failed');
      }

      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      // Verify it's a PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      if (!isPDF) {
        throw new Error('Downloaded file is not a valid PDF');
      }

      this.log(`✅ PDF downloaded successfully (${pdfBuffer.length} bytes)`);

      const filename = `lee_deed_${clerkFileNumber}.pdf`;
      const filepath = path.join(downloadPath, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      this.log(`💾 Saved PDF to: ${filepath}`);

      return {
        success: true,
        filename,
        downloadPath,
        filepath,
        clerkFileNumber,
        instrumentNumber: clerkFileNumber,
        pdfUrl,
        timestamp: new Date().toISOString(),
        fileSize: pdfBuffer.length,
        pdfBase64: pdfBuffer.toString('base64')
      };

    } catch (error) {
      this.log(`❌ Failed to download deed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Random wait helper
   */
  async randomWait(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = LeeCountyFloridaScraper;
