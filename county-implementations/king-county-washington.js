/**
 * King County, Washington - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Records: https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx
 *
 * Search Method: Address search
 *
 * Workflow:
 * 1. Search by address (e.g., "7550 41ST")
 * 2. Wait for results page
 * 3. Navigate to 'Property Detail' tab
 * 4. Go to "Sales History" table
 * 5. Click on "recording number" to download prior deed
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class KingCountyWashingtonScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'King';
    this.state = 'WA';
    this.debugLogs = [];
  }

  /**
   * Override log method to use parent implementation
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

    this.log('✅ Browser initialized with stealth mode');
  }

  /**
   * Parse address - King County uses simple address format
   * Example: "7550 41ST" or "7550 41st Ave NE"
   */
  parseAddress(address) {
    this.log(`📍 Parsing address: ${address}`);

    // Clean the address
    let cleaned = address.trim();

    // Remove common suffixes, city, state, zip
    cleaned = cleaned.replace(/,.*$/g, ''); // Remove everything after comma
    cleaned = cleaned.replace(/\b(WA|Washington|King County)\b/gi, '');
    cleaned = cleaned.replace(/\b\d{5}(-\d{4})?\b/g, ''); // Remove zip
    cleaned = cleaned.trim();

    this.log(`  Cleaned address: ${cleaned}`);

    return { searchAddress: cleaned };
  }

  /**
   * Main method to get prior deed by property address
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
      // Parse address into components
      const { searchAddress } = this.parseAddress(address);

      // Step 1: Search for property
      this.log('\n📍 STEP 1: Searching for property...');
      const searchResult = await this.searchProperty(searchAddress);
      result.steps.search = {
        success: searchResult.success,
        duration: searchResult.duration
      };

      if (!searchResult.success) {
        throw new Error('Property search failed');
      }

      // Step 2: Navigate to Property Detail and get recording number
      this.log('\n📄 STEP 2: Getting recording number from Sales History...');
      const recordingResult = await this.getRecordingNumber();
      result.steps.recording = {
        success: recordingResult.success,
        duration: recordingResult.duration,
        recordingNumber: recordingResult.recordingNumber
      };

      if (!recordingResult.success) {
        throw new Error('Failed to get recording number');
      }

      // Store deed URL for downloading
      this.deedUrl = recordingResult.deedUrl;
      this.recordingNumber = recordingResult.recordingNumber;

      // Step 3: Download PDF
      this.log('\n📥 STEP 3: Downloading PDF...');
      const pdfResult = await this.downloadDeedPdf();
      result.steps.download = {
        success: pdfResult.success,
        duration: pdfResult.duration,
        fileSize: pdfResult.fileSize
      };

      if (!pdfResult.success) {
        throw new Error('Failed to download PDF');
      }

      // Success
      result.success = true;
      result.pdfBase64 = pdfResult.pdfBase64;
      result.filename = pdfResult.filename;
      result.fileSize = pdfResult.fileSize;
      result.downloadPath = pdfResult.downloadPath || '';
      result.totalDuration = Date.now() - startTime;

      this.log(`\n✅ SUCCESS! Total time: ${(result.totalDuration / 1000).toFixed(1)}s`);
      return result;

    } catch (error) {
      this.log(`\n❌ ERROR: ${error.message}`);
      result.success = false;
      result.error = error.message;
      result.totalDuration = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Search for property by address
   */
  async searchProperty(searchAddress) {
    const startTime = Date.now();

    try {
      this.log('🌐 Navigating to King County Property Search...');
      await this.page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check the acknowledgment checkbox first (RCW 42.56.070(9))
      this.log('✅ Checking acknowledgment checkbox...');
      const checkboxSelector = '#cphContent_checkbox_acknowledge';

      try {
        await this.page.waitForSelector(checkboxSelector, { timeout: 5000 });
        await this.page.click(checkboxSelector);
        this.log('✅ Acknowledged RCW 42.56.070(9)');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        this.log('⚠️  Checkbox not found, continuing...');
      }

      // Find and fill address search field
      this.log(`📝 Searching for address: ${searchAddress}`);

      // Look for the address input field (avoid global search)
      // The property search field should be in the content area, not the header
      const addressFieldSelector = 'input[name*="Address"]:not([id="global-search-text"]), input[id*="cph"]:not([type="hidden"]), input[id*="Address"]:not([id="global-search-text"]), input[placeholder*="Address"]:not([id="global-search-text"])';

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for address field to appear
      await this.page.waitForSelector(addressFieldSelector, { timeout: 10000 });

      // Get the actual field we're typing into
      const fieldInfo = await this.page.evaluate((selector) => {
        const field = document.querySelector(selector);
        return field ? {
          id: field.id || '',
          name: field.name || '',
          placeholder: field.placeholder || ''
        } : null;
      }, addressFieldSelector);

      this.log(`  Using field: ${JSON.stringify(fieldInfo)}`);

      await this.page.click(addressFieldSelector, { clickCount: 3 });
      await this.page.type(addressFieldSelector, searchAddress);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Submit search - just press Enter to avoid clicking wrong button
      this.log('🔍 Submitting search...');
      this.log('⏎ Pressing Enter to search...');

      try {
        // Wait for navigation after pressing Enter
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          this.page.keyboard.press('Enter')
        ]);
        this.log('✅ Navigation completed');
      } catch (navError) {
        this.log(`⚠️ Navigation timeout: ${navError.message}`);
        // Check if we're still on the same page or if we navigated to kingcounty.gov
        const currentUrl = this.page.url();
        if (currentUrl.includes('kingcounty.gov') && !currentUrl.includes('Assessor/eRealProperty')) {
          throw new Error('Search navigated to wrong page (kingcounty.gov main site). Check if address format is correct.');
        }
      }

      // Wait for results page to fully load
      this.log('⏳ Waiting for results page...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we got results
      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`);

      return {
        success: true,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.log(`❌ Search failed: ${error.message}`);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Navigate to Property Detail page and get recording number from Sales History
   */
  async getRecordingNumber() {
    const startTime = Date.now();

    try {
      // Click on "Property Detail" link (this is a navigation, not a tab)
      // The link has ID: cphContent_LinkButtonDetail
      this.log('🔍 Looking for Property Detail link...');

      const propertyDetailLinkSelector = '#cphContent_LinkButtonDetail, a[id*="LinkButtonDetail"]';

      try {
        await this.page.waitForSelector(propertyDetailLinkSelector, { timeout: 10000 });
      } catch (e) {
        throw new Error('Property Detail link not found');
      }

      this.log('📋 Clicking Property Detail link...');

      // Click and wait for navigation to Detail.aspx
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click(propertyDetailLinkSelector)
      ]);

      const currentUrl = this.page.url();
      this.log(`✅ Navigated to Property Detail page: ${currentUrl}`);

      if (!currentUrl.includes('Detail.aspx')) {
        throw new Error(`Expected Detail.aspx page, but got: ${currentUrl}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Scroll down to make sure Sales History table is visible
      this.log('📜 Scrolling to load all content...');
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Scroll back up a bit and then down again to trigger any lazy loading
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await this.page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find Sales History table and get first recording number
      this.log('🔍 Looking for Sales History table...');

      const recordingInfo = await this.page.evaluate(() => {
        // Look for "SALES HISTORY" table header (case-insensitive)
        const allElements = Array.from(document.querySelectorAll('*'));

        let salesHistoryTableFound = false;
        for (const el of allElements) {
          const text = el.textContent.trim().toUpperCase();
          // Look for exact "SALES HISTORY" text
          if (text === 'SALES HISTORY' || text === 'SALES HISTORY:') {
            salesHistoryTableFound = true;
            console.log('Found Sales History section');
            break;
          }
        }

        if (!salesHistoryTableFound) {
          return { success: false, error: 'Sales History table not found' };
        }

        // Look for recording number in table cells
        // Recording numbers are in format like: 20250430000422 (14 digits)
        const allCells = Array.from(document.querySelectorAll('td'));

        for (const cell of allCells) {
          const text = cell.textContent.trim();

          // Check if this cell contains a recording number (14+ digits)
          if (/^\d{14,}$/.test(text)) {
            console.log('Found recording number:', text);

            // Check if it's a link
            const link = cell.querySelector('a');
            if (link) {
              console.log('Recording number link found:', link.href);
              // Don't click - just return the URL
              return {
                success: true,
                recordingNumber: text,
                href: link.href
              };
            } else {
              // It's just text, not clickable
              console.log('Recording number is not clickable');
              return {
                success: false,
                error: 'Recording number is not a clickable link'
              };
            }
          }
        }

        return { success: false, error: 'No recording number found in Sales History table' };
      });

      if (!recordingInfo.success) {
        // Log available headings if provided
        if (recordingInfo.availableHeadings) {
          this.log(`  Available page sections: ${recordingInfo.availableHeadings.join(', ')}`);
        }
        throw new Error(recordingInfo.error || 'Could not find recording number');
      }

      this.log(`✅ Found recording number: ${recordingInfo.recordingNumber}`);
      this.log(`   Deed URL: ${recordingInfo.href}`);

      return {
        success: true,
        duration: Date.now() - startTime,
        recordingNumber: recordingInfo.recordingNumber,
        deedUrl: recordingInfo.href
      };

    } catch (error) {
      this.log(`❌ Failed to get recording number: ${error.message}`);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Download PDF - Navigate directly to deed URL and download document
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      if (!this.deedUrl) {
        throw new Error('No deed URL available. getRecordingNumber() must be called first.');
      }

      this.log(`🌐 Navigating to deed URL: ${this.deedUrl}`);

      // Navigate directly to the deed URL
      await this.page.goto(this.deedUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`);

      // Strategy 1: Check if current page is a PDF
      if (currentUrl.toLowerCase().includes('.pdf') || currentUrl.includes('document') || currentUrl.includes('recording')) {
        this.log('📥 Attempting to download PDF from current page...');

        const pdfData = await this.page.evaluate(async (url) => {
          try {
            const response = await fetch(url, {
              credentials: 'include',
              headers: {
                'Accept': 'application/pdf,*/*'
              }
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Convert to base64
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
              binary += String.fromCharCode(uint8Array[i]);
            }

            return {
              success: true,
              base64: btoa(binary),
              size: uint8Array.length
            };
          } catch (err) {
            return {
              success: false,
              error: err.message
            };
          }
        }, currentUrl);

        if (pdfData.success) {
          const pdfBuffer = Buffer.from(pdfData.base64, 'base64');
          const signature = pdfBuffer.toString('utf8', 0, 4);

          if (signature === '%PDF') {
            this.log(`✅ PDF downloaded successfully: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
            return {
              success: true,
              duration: Date.now() - startTime,
              pdfBase64: pdfData.base64,
              filename: `king_deed_${Date.now()}.pdf`,
              fileSize: pdfBuffer.length,
              downloadPath: ''
            };
          }
        }
      }

      // Strategy 2: Look for PDF in iframe
      this.log('📥 Checking for PDF in iframe...');
      const iframeInfo = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const iframe of iframes) {
          if (iframe.src && (iframe.src.includes('.pdf') || iframe.src.includes('document'))) {
            return { found: true, src: iframe.src };
          }
        }
        return { found: false };
      });

      if (iframeInfo.found) {
        this.log(`✅ Found PDF in iframe: ${iframeInfo.src}`);
        const pdfBase64 = await this.downloadPdfFromUrl(iframeInfo.src);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `king_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 3: Look for embed or object
      this.log('📥 Checking for PDF embed/object...');
      const embedInfo = await this.page.evaluate(() => {
        const embeds = Array.from(document.querySelectorAll('embed, object'));
        for (const embed of embeds) {
          const src = embed.src || embed.data;
          if (src && (src.includes('.pdf') || src.includes('document'))) {
            return { found: true, src };
          }
        }
        return { found: false };
      });

      if (embedInfo.found) {
        this.log(`✅ Found PDF in embed: ${embedInfo.src}`);
        const pdfBase64 = await this.downloadPdfFromUrl(embedInfo.src);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `king_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      throw new Error('Could not find PDF to download');

    } catch (error) {
      this.log(`❌ PDF download failed: ${error.message}`);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Download PDF from URL
   */
  async downloadPdfFromUrl(url) {
    this.log(`📥 Downloading PDF from: ${url}`);

    const pdfBase64 = await this.page.evaluate(async (url) => {
      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }, url);

    // Verify it's a PDF
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

    if (pdfSignature !== '%PDF') {
      this.log(`⚠️  Downloaded content doesn't appear to be a PDF (signature: ${pdfSignature})`);
    } else {
      this.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    }

    return pdfBase64;
  }
}

module.exports = KingCountyWashingtonScraper;
