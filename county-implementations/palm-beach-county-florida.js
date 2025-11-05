/**
 * Palm Beach County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://pbcpao.gov/
 * - Clerk of Courts (Official Records): https://erec.mypalmbeachclerk.com/
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class PalmBeachCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Palm Beach';
    this.state = 'FL';
    this.debugLogs = []; // Collect debug logs for API response
  }

  /**
   * Override log method - use parent implementation
   * All logs will be visible in Railway logs
   */
  log(message) {
    // Call parent log method (console.log if verbose)
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
      protocolTimeout: 300000, // 5 minute timeout for protocol operations
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
   * Palm Beach County can search Property Appraiser directly by address
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

      // SKIP STEP 1 (Regrid) - Palm Beach County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Palm Beach County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Palm Beach County supports direct address search',
        county: 'Palm Beach',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for property
      this.log(`📋 Step 2: Searching county property assessor for: ${this.county} County, ${this.state}`);
      this.log(`🌐 Navigating to assessor: https://pbcpao.gov/`);

      const assessorResult = await this.searchAssessorSite(null, null);

      if (!assessorResult.success) {
        result.success = false;
        result.message = 'Could not find property on assessor website';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        result.steps.step2 = {
          success: false,
          message: 'Could not find property on assessor website',
          originalAddress: address,
          county: 'Palm Beach',
          state: 'FL'
        };
        return result;
      }

      // Extract transaction records
      const transactionResult = await this.extractTransactionRecords();

      result.steps.step2 = {
        success: transactionResult.success,
        transactions: transactionResult.transactions || [],
        assessorUrl: 'https://pbcpao.gov/',
        originalAddress: address,
        county: 'Palm Beach',
        state: 'FL'
      };

      if (!transactionResult.success || !transactionResult.transactions || transactionResult.transactions.length === 0) {
        result.success = false;
        result.message = 'No transactions found on Property Appraiser';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        return result;
      }

      // STEP 3: Download the most recent deed
      // Prioritize transactions that have href (direct clerk URLs)
      let mostRecentDeed = transactionResult.transactions.find(t => t.href);
      if (!mostRecentDeed) {
        mostRecentDeed = transactionResult.transactions[0];
      }

      const deedId = mostRecentDeed.documentId || mostRecentDeed.instrumentNumber || `Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`;
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
   * Get deed recorder/clerk URL for Palm Beach County
   */
  getDeedRecorderUrl(county, state) {
    if (county === 'Palm Beach' && state === 'FL') {
      return 'https://erec.mypalmbeachclerk.com/';
    }
    return null;
  }

  /**
   * Get Property Appraiser URL for Palm Beach County
   */
  getAssessorUrl(county, state) {
    if (county === 'Palm Beach' && state === 'FL') {
      return 'https://pbcpao.gov/';
    }
    return null;
  }

  /**
   * Search Palm Beach County Property Appraiser by address
   * URL: https://pbcpao.gov/
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching Palm Beach County FL Property Appraiser`);
    this.log(`   Using address search`);

    try {
      // Navigate to property search page
      await this.page.goto('https://pbcpao.gov/', {
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
        'input[name="address"]',
        'input[placeholder*="Address"]',
        'input[placeholder*="address"]',
        'input[id*="address"]',
        'input[type="text"]',
        'input[type="search"]'
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

      // Strip "#" from unit numbers (e.g., "100 Sunrise Ave #513" -> "100 Sunrise Ave 513")
      // The property search doesn't work with "#" in unit numbers
      const cleanedAddress = streetAddress.replace(/#/g, '');

      if (cleanedAddress !== streetAddress) {
        this.log(`ℹ️  Cleaned address: "${streetAddress}" -> "${cleanedAddress}" (removed #)`);
      }

      // Enter street address
      await this.page.click(addressInput);
      await this.randomWait(200, 400);
      await this.page.type(addressInput, cleanedAddress, { delay: 100 });

      this.log(`✅ Entered address: ${cleanedAddress}`);

      // Wait for autocomplete popup to appear
      await this.randomWait(2000, 3000);

      // Look for autocomplete suggestions and click matching one
      this.log(`🔍 Looking for autocomplete suggestions...`);

      let autocompleteClicked = { clicked: false };
      try {
        autocompleteClicked = await Promise.race([
          this.page.evaluate((searchAddr) => {
            // Look for autocomplete dropdown items
            const autocompleteSelectors = [
              '.ui-menu-item',
              '.ui-autocomplete li',
              '.autocomplete-item',
              '[role="option"]',
              '.suggestion',
              '.dropdown-item'
            ];

            for (const selector of autocompleteSelectors) {
              const items = Array.from(document.querySelectorAll(selector));
              for (const item of items) {
                const text = (item.textContent || '').trim();
                // Check if this item matches the address
                if (text.includes(searchAddr) || searchAddr.includes(text.split(',')[0].trim())) {
                  item.click();
                  return { clicked: true, text: text.substring(0, 100) };
                }
              }
            }

            return { clicked: false };
          }, cleanedAddress),
          new Promise(resolve => setTimeout(() => resolve({ clicked: false, timeout: true }), 5000))
        ]);
      } catch (e) {
        this.log(`⚠️ Autocomplete search timed out: ${e.message}`);
        autocompleteClicked = { clicked: false };
      }

      if (autocompleteClicked.clicked && !autocompleteClicked.timeout) {
        this.log(`✅ Clicked autocomplete suggestion: "${autocompleteClicked.text}"`);
        // Wait for navigation after autocomplete click
        await this.randomWait(5000, 7000);
      } else {
        if (autocompleteClicked.timeout) {
          this.log(`ℹ️  Autocomplete search timed out, trying Enter key...`);
        } else {
          this.log(`ℹ️  No autocomplete found, trying Enter key...`);
        }

        // Press Enter to submit form
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => null),
          this.page.keyboard.press('Enter')
        ]);
        await this.randomWait(3000, 5000);
      }


      // Check if property was found
      const searchStatus = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();

        const hasNoResults = text.includes('no results') ||
                            text.includes('not found') ||
                            text.includes('no records found') ||
                            text.includes('no properties found') ||
                            text.includes('no matches');

        // Look for property information
        const hasPropertyInfo = text.includes('property') &&
                               (text.includes('owner') || text.includes('parcel'));

        return {
          hasNoResults,
          hasPropertyInfo,
          url: window.location.href
        };
      });

      this.log(`🔍 Search result analysis:`);
      this.log(`   Current URL: ${searchStatus.url}`);
      this.log(`   Has property info: ${searchStatus.hasPropertyInfo}`);
      this.log(`   Has "no results" message: ${searchStatus.hasNoResults}`);

      if (!searchStatus.hasNoResults && searchStatus.hasPropertyInfo) {
        this.log(`✅ Property found`);

        // Look for and click on the property link/result
        await this.randomWait(2000, 3000);

        const resultClicked = await this.page.evaluate((searchAddr) => {
          // Look for clickable property links
          const allLinks = Array.from(document.querySelectorAll('a, [onclick], [role="button"]'));

          for (const el of allLinks) {
            const text = (el.innerText || el.textContent || '').trim();

            // Look for parcel number or address that matches
            if (text && (text.includes(searchAddr.split(' ')[0]) || /^\d{2}-\d{2}/.test(text))) {
              el.click();
              return { clicked: true, text: text.substring(0, 100) };
            }
          }

          return { clicked: false };
        }, streetAddress);

        if (resultClicked.clicked) {
          this.log(`✅ Clicked on property result: "${resultClicked.text}"`);

          // Wait for property detail page to load
          await this.randomWait(5000, 7000);

          this.log(`✅ Property detail page loaded`);
        } else {
          this.log(`ℹ️  Could not find clickable property result, proceeding anyway`);
        }

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
   * Navigate to Sales Information section and extract OR Book/Page
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records from Property Appraiser...');

    try {
      await this.randomWait(2000, 3000);

      // Debug: Log current URL
      const currentUrl = this.page.url();
      this.log(`🔍 Current URL: ${currentUrl}`);

      // Look for Sales Information section
      this.log('🔍 Looking for Sales Information section...');

      // Scroll to find Sales Information section
      await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Sales Information') || text.includes('SALES INFORMATION')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });

      await this.randomWait(2000, 3000);

      // Extract OR Book/Page links from Sales Information section
      this.log('🔍 Extracting OR Book/Page from Sales Information section...');

      const transactions = await this.page.evaluate(() => {
        const results = [];

        // Find Sales Information section
        const allText = document.body.innerText;
        const allElements = Array.from(document.querySelectorAll('*'));

        // Look for elements containing "OR Book/Page" or similar
        for (const el of allElements) {
          const text = (el.textContent || '').trim();

          // Look for OR Book/Page pattern (e.g., "33358 / 1920" or "33358 /  01920")
          // Allow multiple spaces and leading zeros in page number
          const orBookPageMatch = text.match(/^(\d{4,6})\s*\/\s*(\d{3,6})$/);
          if (orBookPageMatch) {
            const bookNumber = orBookPageMatch[1];
            const pageNumber = orBookPageMatch[2].replace(/^0+/, ''); // Remove leading zeros

            // Check if this is a clickable link
            const link = el.closest('a');
            if (link) {
              results.push({
                bookNumber,
                pageNumber,
                type: 'or_book_page',
                source: 'Palm Beach County Property Appraiser - Sales Information',
                href: link.href || '',
                text: text
              });
            } else {
              results.push({
                bookNumber,
                pageNumber,
                type: 'or_book_page',
                source: 'Palm Beach County Property Appraiser - Sales Information',
                text: text
              });
            }
          }
        }

        // Also look for links with Book/Page in them
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // Check if link text contains book/page pattern (more flexible - not anchored)
          const bookPageMatch = text.match(/(\d{4,6})\s*\/\s*(\d{3,6})/);
          if (bookPageMatch) {
            const bookNumber = bookPageMatch[1];
            const pageNumber = bookPageMatch[2].replace(/^0+/, ''); // Remove leading zeros

            // Check if not already added
            if (!results.some(r => r.bookNumber === bookNumber && r.pageNumber === pageNumber)) {
              results.push({
                bookNumber: bookNumber,
                pageNumber: pageNumber,
                type: 'or_book_page',
                source: 'Palm Beach County Property Appraiser',
                href: href,
                text: text
              });
            }
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} OR Book/Page record(s)`);

      // Log what we found
      for (const trans of transactions) {
        this.log(`   OR Book/Page: ${trans.bookNumber}/${trans.pageNumber}`);
        if (trans.href) {
          this.log(`      Link: ${trans.href.substring(0, 100)}`);
        }
      }

      return {
        success: transactions.length > 0,
        transactions,
        debugLogs: this.debugLogs
      };

    } catch (error) {
      this.log(`❌ Failed to extract transaction records: ${error.message}`);
      return {
        success: false,
        error: error.message,
        debugLogs: this.debugLogs
      };
    }
  }

  /**
   * Download deed PDF from Palm Beach County Clerk
   * Click on OR Book/Page link and download PDF using Orange County method
   */
  async downloadDeed(transaction) {
    this.log('📄 Downloading deed from Palm Beach County Clerk...');

    try {
      const bookNumber = transaction.bookNumber;
      const pageNumber = transaction.pageNumber;
      const clerkUrl = transaction.href || transaction.clerkUrl; // Get URL from href field

      this.log(`🔍 Transaction details: OR Book/Page=${bookNumber}/${pageNumber}`);

      // If we have a direct clerk URL, use it
      if (clerkUrl) {
        this.log(`📍 Using direct clerk URL: ${clerkUrl}`);
        await this.page.goto(clerkUrl, {
          waitUntil: 'networkidle2',
          timeout: this.timeout
        });
        await this.randomWait(5000, 7000);
      } else {
        // Navigate to the clerk's official records search and search manually
        const clerkSearchUrl = 'https://erec.mypalmbeachclerk.com/';
        await this.page.goto(clerkSearchUrl, {
          waitUntil: 'networkidle2',
          timeout: this.timeout
        });
        await this.randomWait(5000, 7000);

        // Search by instrument number or book/page
        if (transaction.instrumentNumber) {
          this.log(`🔍 Searching by instrument number: ${transaction.instrumentNumber}`);
          await this.searchClerkByInstrument(transaction.instrumentNumber);
        } else if (transaction.bookNumber && transaction.pageNumber) {
          this.log(`🔍 Searching by book/page: ${transaction.bookNumber}/${transaction.pageNumber}`);
          await this.searchClerkByBookPage(transaction.bookNumber, transaction.pageNumber);
        } else {
          throw new Error('No valid search criteria for clerk search');
        }
      }

      // Palm Beach serves documents as PNG images via GetDocumentImage endpoint
      // We need to: 1) Get page count, 2) Extract document ID, 3) Download PNG images, 4) Convert to PDF
      await this.randomWait(3000, 5000);

      // Get page count from the document page
      this.log('🔍 Getting page count...');
      const pageCount = await this.page.evaluate(() => {
        // Look for page count indicator
        const pageInfo = document.body.innerText;
        const match = pageInfo.match(/Page \d+ of (\d+)/i) || pageInfo.match(/(\d+) pages/i);
        if (match) {
          return parseInt(match[1]);
        }

        // Try to find in carousel or pagination
        const paginationElements = Array.from(document.querySelectorAll('*'));
        for (const el of paginationElements) {
          const text = el.textContent || '';
          const pageMatch = text.match(/of (\d+)/i);
          if (pageMatch) {
            return parseInt(pageMatch[1]);
          }
        }

        return 1; // Default to 1 page
      });

      this.log(`📄 Document has ${pageCount} page(s)`);

      // Extract document ID from network requests
      this.log('🔍 Monitoring network for document ID...');
      const pdfRequests = [];
      const requestHandler = (request) => {
        const url = request.url();
        if (url.includes('GetDocumentImage') || url.includes('Document/') || url.includes('documentId=')) {
          pdfRequests.push(url);
          this.log(`📥 Captured request: ${url}`);
        }
      };

      this.page.on('request', requestHandler);

      // More aggressive scrolling to trigger all lazy-loaded images
      this.log('🔄 Scrolling to trigger image loads...');

      // Scroll to bottom
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await this.randomWait(2000, 3000);

      // Scroll to top
      await this.page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await this.randomWait(2000, 3000);

      // Scroll to middle
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await this.randomWait(2000, 3000);

      this.page.off('request', requestHandler);

      this.log(`📊 Captured ${pdfRequests.length} total requests`);
      if (pdfRequests.length > 0) {
        this.log('   Requests captured:');
        pdfRequests.forEach((url, idx) => {
          this.log(`   ${idx + 1}. ${url}`);
        });
      }

      // Find document ID from captured requests
      let documentId = null;
      if (pdfRequests.length > 0) {
        // Try to find document ID from GetDocumentImage requests
        for (const url of pdfRequests) {
          const match = url.match(/documentId=(\d+)/);
          if (match && match[1]) {
            const id = match[1];
            // Document IDs should be large numbers (at least 7 digits) to filter out index/page numbers
            // Real document IDs like "24424937" are 8 digits, while index/page numbers like "16" are 1-2 digits
            if (id.length >= 7 && parseInt(id) > 0) {
              documentId = id;
              this.log(`✅ Found document ID from network: ${documentId}`);
              break;
            }
          }
        }
      }

      // If not found in network, try to extract from page JavaScript
      if (!documentId) {
        this.log('🔍 Looking for document ID in page JavaScript...');
        documentId = await this.page.evaluate(() => {
          // Check all script tags with multiple patterns
          const scripts = Array.from(document.querySelectorAll('script'));
          const allMatches = [];

          for (const script of scripts) {
            const text = script.textContent || '';

            // Try multiple patterns
            const patterns = [
              /documentId["\s:=]+(\d+)/g,
              /DocumentId["\s:=]+(\d+)/g,
              /document_id["\s:=]+(\d+)/g,
              /"docId"[:\s]+(\d+)/g,
              /GetDocumentImage[^?]*\?[^"']*documentId=(\d+)/g,
              /var\s+docId\s*=\s*(\d+)/g,
              /var\s+documentId\s*=\s*(\d+)/g
            ];

            for (const pattern of patterns) {
              let match;
              while ((match = pattern.exec(text)) !== null) {
                const id = match[1];
                // Only consider IDs with at least 7 digits (real document IDs like "24424937")
                // Filter out small numbers like "16", "0", etc.
                if (id && id.length >= 7 && parseInt(id) > 0) {
                  allMatches.push(id);
                }
              }
            }
          }

          // Return the first valid match
          if (allMatches.length > 0) {
            return allMatches[0];
          }

          // Check data attributes
          const elements = Array.from(document.querySelectorAll('[data-document-id], [data-documentid], [data-doc-id]'));
          for (const el of elements) {
            const id = el.getAttribute('data-document-id') || el.getAttribute('data-documentid') || el.getAttribute('data-doc-id');
            if (id && id.length >= 7 && parseInt(id) > 0) return id;
          }

          // Check window object
          const windowIds = [
            window.documentId,
            window.DocumentId,
            window.docId
          ];

          for (const id of windowIds) {
            if (id) {
              const idStr = id.toString();
              if (idStr !== '0' && idStr.length >= 7 && parseInt(idStr) > 0) {
                return idStr;
              }
            }
          }

          return null;
        });

        if (documentId) {
          this.log(`✅ Found document ID from page JavaScript: ${documentId}`);
        }
      }

      // If still not found, try extracting from current URL or page content
      if (!documentId) {
        this.log('🔍 Looking for document ID in URL or page content...');
        const currentUrl = this.page.url();
        this.log(`   Current URL: ${currentUrl}`);

        // Try to find in URL query parameters
        const urlMatch = currentUrl.match(/documentId=(\d+)/i);
        if (urlMatch) {
          documentId = urlMatch[1];
          this.log(`✅ Found document ID from URL: ${documentId}`);
        }
      }

      this.log(`📋 Document ID: ${documentId}`);

      if (!documentId) {
        throw new Error('Could not find document ID');
      }

      // Download all pages as PNG images
      this.log(`📥 Downloading ${pageCount} page(s) as images...`);
      const cookies = await this.page.cookies();
      const referer = this.page.url();
      const imageBuffers = [];

      const https = require('https');
      const url = require('url');

      for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        const imageUrl = `https://erec.mypalmbeachclerk.com/Document/GetDocumentImage/?documentId=${documentId}&index=0&pageNum=${pageNum}&type=normal&rotate=0`;
        this.log(`  Page ${pageNum + 1}/${pageCount}: Downloading...`);

        // Download image using HTTPS module with cookies
        const imageBuffer = await new Promise((resolve, reject) => {
          const parsedUrl = url.parse(imageUrl);
          const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
              'Cookie': cookieString,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'image/*,*/*',
              'Referer': referer
            }
          };

          https.get(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
              const buffer = Buffer.concat(chunks);
              resolve(buffer);
            });
          }).on('error', reject);
        });

        this.log(`    ✅ Downloaded: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
        imageBuffers.push(imageBuffer);

        await this.randomWait(500, 1000); // Small delay between requests
      }

      // Convert images to PDF using pdf-lib
      this.log('📄 Converting images to PDF...');
      const { PDFDocument } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < imageBuffers.length; i++) {
        this.log(`  Adding page ${i + 1}/${imageBuffers.length}...`);
        const image = await pdfDoc.embedPng(imageBuffers[i]);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);
      this.log(`✅ PDF created: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

      // Convert to base64 for in-memory return (similar to Broward County)
      const pdfBase64 = pdfBuffer.toString('base64');
      this.log(`✅ PDF converted to base64`);

      // Generate filename
      const docId = transaction.instrumentNumber || transaction.documentId || `${transaction.bookNumber}_${transaction.pageNumber}`;
      const filename = `palm_beach_deed_${docId}.pdf`;

      return {
        success: true,
        pdfBase64: pdfBase64,
        filename: filename,
        downloadPath: '', // In-memory download, no file saved to disk
        documentId: documentId,
        timestamp: new Date().toISOString(),
        fileSize: pdfBuffer.length
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
   * Search clerk's office by instrument number
   */
  async searchClerkByInstrument(instrumentNumber) {
    this.log(`🔍 Searching clerk by instrument: ${instrumentNumber}`);

    // Look for instrument number search field
    const instrumentInputSelectors = [
      'input[name*="instrument"]',
      'input[name*="Instrument"]',
      'input[placeholder*="Instrument"]',
      'input[id*="instrument"]'
    ];

    let instrumentInput = null;
    for (const selector of instrumentInputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        instrumentInput = selector;
        this.log(`✅ Found instrument input: ${selector}`);
        break;
      } catch (e) {
        // Try next selector
      }
    }

    if (instrumentInput) {
      await this.page.click(instrumentInput);
      await this.page.type(instrumentInput, instrumentNumber, { delay: 100 });
      this.log(`✅ Entered instrument number: ${instrumentNumber}`);

      // Click search button
      await this.randomWait(1000, 2000);
      await this.page.keyboard.press('Enter');

      // Wait for results
      await this.randomWait(5000, 7000);
    } else {
      this.log(`⚠️ Could not find instrument number input field`);
    }
  }

  /**
   * Search clerk's office by book and page
   */
  async searchClerkByBookPage(bookNumber, pageNumber) {
    this.log(`🔍 Searching clerk by book/page: ${bookNumber}/${pageNumber}`);

    // Look for book/page search fields
    const bookInputSelectors = [
      'input[name*="book"]',
      'input[name*="Book"]',
      'input[placeholder*="Book"]',
      'input[id*="book"]'
    ];

    const pageInputSelectors = [
      'input[name*="page"]',
      'input[name*="Page"]',
      'input[placeholder*="Page"]',
      'input[id*="page"]'
    ];

    let bookInput = null;
    let pageInput = null;

    for (const selector of bookInputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        bookInput = selector;
        this.log(`✅ Found book input: ${selector}`);
        break;
      } catch (e) {
        // Try next selector
      }
    }

    for (const selector of pageInputSelectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: 3000 });
        pageInput = selector;
        this.log(`✅ Found page input: ${selector}`);
        break;
      } catch (e) {
        // Try next selector
      }
    }

    if (bookInput && pageInput) {
      await this.page.click(bookInput);
      await this.page.type(bookInput, bookNumber, { delay: 100 });
      this.log(`✅ Entered book: ${bookNumber}`);

      await this.page.click(pageInput);
      await this.page.type(pageInput, pageNumber, { delay: 100 });
      this.log(`✅ Entered page: ${pageNumber}`);

      // Click search button
      await this.randomWait(1000, 2000);
      await this.page.keyboard.press('Enter');

      // Wait for results
      await this.randomWait(5000, 7000);
    } else {
      this.log(`⚠️ Could not find book/page input fields`);
    }
  }
}

module.exports = PalmBeachCountyFloridaScraper;
