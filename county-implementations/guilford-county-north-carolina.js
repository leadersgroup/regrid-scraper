/**
 * Guilford County, North Carolina - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Records: https://lrcpwa.ncptscloud.com/guilford/
 *
 * Search Method: Location Address (street number and street name separately)
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

// Add reCAPTCHA plugin if 2Captcha API key is available
if (process.env.TWOCAPTCHA_TOKEN) {
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.TWOCAPTCHA_TOKEN
      },
      visualFeedback: true
    })
  );
}

class GuilfordCountyNorthCarolinaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Guilford';
    this.state = 'NC';
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
   * Parse address into street number and street name
   * Example: "1205 Glendale Dr" -> { streetNumber: "1205", streetName: "Glendale" }
   */
  parseAddress(address) {
    this.log(`📍 Parsing address: ${address}`);

    // Clean the address
    let cleaned = address.trim();

    // Remove common suffixes, city, state, zip
    cleaned = cleaned.replace(/,.*$/g, ''); // Remove everything after comma
    cleaned = cleaned.replace(/\b(NC|North Carolina|Guilford)\b/gi, '');
    cleaned = cleaned.replace(/\b\d{5}(-\d{4})?\b/g, ''); // Remove zip
    cleaned = cleaned.trim();

    // Split into parts
    const parts = cleaned.split(/\s+/);

    if (parts.length < 2) {
      throw new Error(`Cannot parse address: ${address}`);
    }

    // First part should be the street number
    const streetNumber = parts[0];

    // Everything else is the street name (excluding suffix like Dr, St, etc.)
    const streetSuffixes = ['street', 'st', 'drive', 'dr', 'road', 'rd', 'avenue', 'ave',
                            'boulevard', 'blvd', 'lane', 'ln', 'court', 'ct', 'circle', 'cir',
                            'way', 'place', 'pl', 'trail', 'parkway', 'pkwy'];

    let streetName = parts.slice(1).join(' ');

    // Remove suffix if present (but keep the original case for now)
    for (const suffix of streetSuffixes) {
      const regex = new RegExp(`\\b${suffix}\\b`, 'i');
      streetName = streetName.replace(regex, '').trim();
    }

    this.log(`  Street Number: ${streetNumber}`);
    this.log(`  Street Name: ${streetName}`);

    return { streetNumber, streetName };
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
      const { streetNumber, streetName } = this.parseAddress(address);

      // Step 1: Search for property
      this.log('\n📍 STEP 1: Searching for property...');
      const searchResult = await this.searchProperty(streetNumber, streetName);
      result.steps.search = {
        success: searchResult.success,
        duration: searchResult.duration,
        parcelNumber: searchResult.parcelNumber
      };

      if (!searchResult.success) {
        throw new Error('Property search failed');
      }

      // Step 2: Navigate to Deeds tab and get deed info
      this.log('\n📄 STEP 2: Getting deed information...');
      const deedResult = await this.getDeedInfo();
      result.steps.deed = {
        success: deedResult.success,
        duration: deedResult.duration
      };

      if (!deedResult.success) {
        throw new Error('Failed to get deed information');
      }

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
   * Search for property by street number and street name using Location Address
   */
  async searchProperty(streetNumber, streetName) {
    const startTime = Date.now();

    try {
      this.log('🌐 Navigating to Guilford County Property Search...');
      await this.page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click on "Location Address" tab
      this.log('🔍 Looking for Location Address tab...');
      const locationAddressClicked = await this.page.evaluate(() => {
        // Look for the Location Address tab link (Bootstrap tab)
        const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));

        for (const link of links) {
          const text = link.textContent.trim();
          if (text.includes('Location Address')) {
            link.click();
            return true;
          }
        }

        return false;
      });

      if (!locationAddressClicked) {
        throw new Error('Could not find Location Address tab');
      }

      this.log('✅ Clicked Location Address tab');

      // Wait for tab content to be visible
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for the tab pane to become active
      await this.page.waitForSelector('#locationaddress.active', { timeout: 5000 }).catch(() => {
        this.log('⚠️ Tab pane did not become active, continuing anyway...');
      });

      // Find and fill street number field using specific ID
      this.log(`📝 Filling street number: ${streetNumber}`);

      // Wait for field to be visible
      await this.page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', {
        visible: true,
        timeout: 10000
      });

      await this.page.focus('#ctl00_ContentPlaceHolder1_StreetNumberTextBox');
      await this.page.click('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', { clickCount: 3 });
      await this.page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', streetNumber);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find and fill street name field using specific ID
      this.log(`📝 Filling street name: ${streetName}`);

      // Wait for field to be visible
      await this.page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNameTextBox', {
        visible: true,
        timeout: 10000
      });

      await this.page.focus('#ctl00_ContentPlaceHolder1_StreetNameTextBox');
      await this.page.click('#ctl00_ContentPlaceHolder1_StreetNameTextBox', { clickCount: 3 });
      await this.page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', streetName);

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Press Enter to submit the search and wait for navigation
      this.log('⏎ Pressing Enter to search...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.keyboard.press('Enter')
      ]);

      // Wait a bit more for page to fully render
      this.log('⏳ Waiting for results to render...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click on first available entry under "parcel" column
      this.log('🔍 Looking for first parcel entry...');

      // Log current URL to debug
      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`);

      // First, get the parcel link info - look for numeric link like "60312"
      const parcelLinkInfo = await this.page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));

        // Look for any link that is purely numeric (like "60312")
        for (const link of allLinks) {
          const text = link.textContent.trim();
          const href = link.href;

          // Look for any link that is purely numeric
          if (/^\d+$/.test(text) && text.length >= 3) {
            return { success: true, parcelNumber: text, href };
          }
        }

        return { success: false };
      });

      if (!parcelLinkInfo.success) {
        throw new Error('Could not find parcel entry');
      }

      this.log(`✅ Found parcel: ${parcelLinkInfo.parcelNumber} -> ${parcelLinkInfo.href}`);

      // Click and wait for navigation
      this.log('🖱️  Clicking parcel link...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.evaluate((href) => {
          const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
          if (link) link.click();
        }, parcelLinkInfo.href)
      ]);

      this.log(`✅ Navigated to parcel page: ${this.page.url()}`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      return {
        success: true,
        duration: Date.now() - startTime,
        parcelNumber: parcelLinkInfo.parcelNumber
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
   * Navigate to Deeds tab and click first deed entry
   */
  async getDeedInfo() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for Deeds tab...');

      // Find and click Deeds tab
      const deedsTabClicked = await this.page.evaluate(() => {
        // Look for Deeds tab/link
        const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"]'));

        for (const el of allElements) {
          const text = el.textContent.trim().toLowerCase();
          if (text === 'deeds' || text.includes('deed')) {
            el.click();
            return true;
          }
        }

        return false;
      });

      if (!deedsTabClicked) {
        throw new Error('Could not find or click Deeds tab');
      }

      this.log('✅ Clicked Deeds tab');

      // Wait for deeds page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Click on 'Deeds' tab (might be nested)
      this.log('🔍 Checking for nested Deeds tab...');
      await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"]'));
        for (const el of allElements) {
          const text = el.textContent.trim().toLowerCase();
          if (text === 'deeds') {
            el.click();
            return true;
          }
        }
        return false;
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find and click first entry under "Deed Type" column
      this.log('🔍 Looking for first Deed Type entry...');
      const deedTypeInfo = await this.page.evaluate(() => {
        // Look for table with deed information
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));

          // Find header row to identify Deed Type column
          let deedTypeColumnIndex = -1;
          let headerRowIndex = -1;

          for (let i = 0; i < rows.length; i++) {
            const headers = Array.from(rows[i].querySelectorAll('th'));
            for (let j = 0; j < headers.length; j++) {
              const headerText = headers[j].textContent.toLowerCase().trim();
              // Look for exact "deed type" header
              if (headerText === 'deed type') {
                deedTypeColumnIndex = j;
                headerRowIndex = i;
                break;
              }
            }
            if (deedTypeColumnIndex !== -1) break;
          }

          // Find first data row AFTER header row with a clickable deed type
          if (deedTypeColumnIndex !== -1 && headerRowIndex !== -1) {
            // Start from row after header
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              const cells = Array.from(row.querySelectorAll('td'));

              if (cells.length > deedTypeColumnIndex) {
                const deedTypeCell = cells[deedTypeColumnIndex];
                const link = deedTypeCell.querySelector('a');

                if (link) {
                  const deedType = link.textContent.trim();
                  // Only return href if the deed type text contains "deed" (like "CORR DEED")
                  // This filters out navigation links
                  if (deedType.length > 0 && deedType.toLowerCase().includes('deed')) {
                    const href = link.href;
                    // Don't click - just return the href so we can navigate to it in the current tab
                    return { success: true, deedType, href };
                  }
                }
              }
            }
          }
        }

        return { success: false };
      });

      if (!deedTypeInfo.success) {
        throw new Error('Could not find or click Deed Type entry');
      }

      this.log(`✅ Found deed type: ${deedTypeInfo.deedType}`);
      this.log(`📄 Deed image URL: ${deedTypeInfo.href}`);

      // Store the viewer URL - we'll download it directly instead of navigating
      this.deedImageUrl = deedTypeInfo.href;

      // Check for captcha (check current page before download)
      this.log('🔍 Checking for captcha on deeds page...');
      const captchaInfo = await this.page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        const hasCaptcha = bodyText.includes('captcha') ||
                          bodyText.includes('recaptcha') ||
                          document.querySelector('[class*="captcha"]') !== null ||
                          document.querySelector('[id*="captcha"]') !== null ||
                          document.querySelector('.g-recaptcha') !== null ||
                          document.querySelector('iframe[src*="recaptcha"]') !== null;
        return { hasCaptcha };
      });

      if (captchaInfo.hasCaptcha) {
        this.log('⚠️  reCAPTCHA detected');

        // Check if 2Captcha API key is configured
        if (process.env.TWOCAPTCHA_TOKEN) {
          this.log('🔧 Attempting to solve reCAPTCHA using 2Captcha API...');

          try {
            // Use puppeteer-extra-plugin-recaptcha to solve CAPTCHA
            await this.page.solveRecaptchas();
            this.log('✅ reCAPTCHA solved successfully!');

            // Wait for page to process the CAPTCHA solution
            this.log('⏳ Waiting for page to load after CAPTCHA...');
            await new Promise(resolve => setTimeout(resolve, 5000));

          } catch (captchaError) {
            this.log(`❌ Failed to solve reCAPTCHA: ${captchaError.message}`);
            throw new Error(`CAPTCHA solving failed: ${captchaError.message}`);
          }
        } else {
          // No 2Captcha API key - wait for manual solution
          this.log('⚠️  No 2Captcha API key configured - waiting for manual solution...');
          this.log('Please solve the captcha in the browser window or set TWOCAPTCHA_TOKEN environment variable');

          // Wait up to 2 minutes for captcha to be solved manually
          let captchaWaitTime = 0;
          const maxWaitTime = 120000; // 2 minutes

          while (captchaWaitTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            captchaWaitTime += 5000;

            const stillHasCaptcha = await this.page.evaluate(() => {
              const bodyText = document.body.innerText.toLowerCase();
              return bodyText.includes('captcha') || bodyText.includes('recaptcha');
            });

            if (!stillHasCaptcha) {
              this.log('✅ Captcha appears to be solved');
              break;
            }
          }

          if (captchaWaitTime >= maxWaitTime) {
            throw new Error('Captcha timeout - please solve captcha faster or configure TWOCAPTCHA_TOKEN');
          }
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.log(`❌ Failed to get deed info: ${error.message}`);
      return {
        success: false,
        duration: Date.now() - startTime,
        error: error.message
      };
    }
  }

  /**
   * Download PDF using same method as Wake County
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for PDF...');

      // Strategy 0: Download PDF using fetch (maintains cookies/session)
      if (this.deedImageUrl) {
        this.log(`📥 Downloading PDF from deed URL...`);
        this.log(`   URL: ${this.deedImageUrl}`);

        try {
          // Use fetch from within page context to maintain cookies and session
          // This is the same approach as Wake County
          const pdfBase64 = await this.page.evaluate(async (url) => {
            const response = await fetch(url);
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
          }, this.deedImageUrl);

          // Verify it's actually a PDF
          const pdfBuffer = Buffer.from(pdfBase64, 'base64');
          const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

          if (pdfSignature !== '%PDF') {
            this.log(`⚠️  Downloaded content doesn't appear to be a PDF (signature: ${pdfSignature})`);
            this.log(`  First 100 chars: ${pdfBuffer.toString('utf8', 0, 100)}`);
            this.log('   Trying other strategies...');
          } else {
            this.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

            return {
              success: true,
              duration: Date.now() - startTime,
              pdfBase64,
              filename: `guilford_deed_${Date.now()}.pdf`,
              fileSize: pdfBuffer.length,
              downloadPath: ''
            };
          }
        } catch (fetchError) {
          this.log(`⚠️  Fetch download failed: ${fetchError.message}`);
          this.log('   Trying other strategies...');
        }
      }

      // Wait longer for PDF to load after CAPTCHA
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check current URL
      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`);

      // Strategy 1: Check if current page has PDF
      if (currentUrl.toLowerCase().includes('.pdf')) {
        this.log('✅ Current page is PDF');
        const pdfBase64 = await this.downloadPdfFromUrl(currentUrl);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 2: Look for iframe with PDF
      this.log('🔍 Checking for PDF in iframe...');
      const iframeInfo = await this.page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        for (const iframe of iframes) {
          if (iframe.src && (iframe.src.includes('.pdf') || iframe.src.includes('pdf'))) {
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
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 3: Look for embed or object tags
      this.log('🔍 Checking for PDF embed/object...');
      const embedInfo = await this.page.evaluate(() => {
        const embeds = Array.from(document.querySelectorAll('embed, object'));
        for (const embed of embeds) {
          const src = embed.src || embed.data;
          if (src && (src.includes('.pdf') || src.includes('pdf'))) {
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
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 4: Look for download button or link
      this.log('🔍 Looking for download button/link...');
      const downloadUrl = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button'));

        for (const el of allElements) {
          const text = el.textContent.toLowerCase();
          const href = el.href || '';

          if ((text.includes('download') || text.includes('pdf') || text.includes('view') || href.includes('.pdf')) &&
              el.offsetParent !== null) {
            return el.href || null;
          }
        }

        return null;
      });

      if (downloadUrl) {
        this.log(`✅ Found download URL: ${downloadUrl}`);
        const pdfBase64 = await this.downloadPdfFromUrl(downloadUrl);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 5: Try to construct PDF URL from current page parameters
      this.log('🔍 Attempting to construct PDF URL...');
      const constructedUrl = await this.page.evaluate(() => {
        // Look for any URL patterns in the page that might lead to PDF
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          if (link.href.includes('ShowDocument') ||
              link.href.includes('ViewDocument') ||
              link.href.includes('GetDocument') ||
              link.href.includes('.pdf')) {
            return link.href;
          }
        }
        return null;
      });

      if (constructedUrl) {
        this.log(`✅ Found document URL: ${constructedUrl}`);
        const pdfBase64 = await this.downloadPdfFromUrl(constructedUrl);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 6: Look for image (gis_viewimage.php displays deed as image)
      this.log('🔍 Checking for deed image...');
      const imageInfo = await this.page.evaluate(() => {
        // Look for large images (deed documents are typically large)
        const images = Array.from(document.querySelectorAll('img'));
        for (const img of images) {
          // Check if image is large enough to be a document (width > 500px)
          if (img.width > 500 && img.src) {
            return { found: true, src: img.src, width: img.width, height: img.height };
          }
        }
        // Also check for any image
        if (images.length > 0 && images[0].src) {
          return { found: true, src: images[0].src, width: images[0].width, height: images[0].height };
        }
        return { found: false };
      });

      if (imageInfo.found) {
        this.log(`✅ Found deed image: ${imageInfo.src} (${imageInfo.width}x${imageInfo.height})`);
        // Try to download as if it were a PDF URL
        try {
          const pdfBase64 = await this.downloadPdfFromUrl(imageInfo.src);
          return {
            success: true,
            duration: Date.now() - startTime,
            pdfBase64,
            filename: `guilford_deed_${Date.now()}.pdf`,
            fileSize: Buffer.from(pdfBase64, 'base64').length,
            downloadPath: ''
          };
        } catch (imgError) {
          this.log(`⚠️  Image found but failed to download: ${imgError.message}`);
        }
      }

      throw new Error('Could not find PDF to download. PDF may require manual CAPTCHA solution or additional navigation.');

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
   * Download PDF from URL using same method as Wake County
   * Uses fetch() in browser context to maintain cookies and authentication
   */
  async downloadPdfFromUrl(url) {
    this.log(`📥 Downloading PDF from: ${url}`);

    // Extract actual PDF URL if it's wrapped in a viewer
    let pdfUrl = url;
    if (url.includes('pdfjs') || url.includes('file=')) {
      const match = url.match(/file=([^&]+)/);
      if (match) {
        let extractedPath = decodeURIComponent(match[1]);
        this.log(`  Extracted path from viewer: ${extractedPath}`);

        // Remove any query parameters from the extracted path
        extractedPath = extractedPath.split('?')[0];
        this.log(`  Cleaned path: ${extractedPath}`);

        // Construct full URL if it's a relative path
        if (extractedPath.startsWith('/')) {
          const baseUrl = new URL(url).origin;
          pdfUrl = baseUrl + extractedPath;
          this.log(`  Full PDF URL: ${pdfUrl}`);
        } else {
          pdfUrl = extractedPath;
        }
      }
    }

    // Use fetch from within page context to maintain cookies and session
    const pdfBase64 = await this.page.evaluate(async (url) => {
      const response = await fetch(url);
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
    }, pdfUrl);

    // Verify it's actually a PDF
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

    if (pdfSignature !== '%PDF') {
      this.log(`⚠️  Downloaded content doesn't appear to be a PDF (signature: ${pdfSignature})`);
      this.log(`  First 100 chars: ${pdfBuffer.toString('utf8', 0, 100)}`);
    } else {
      this.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    }

    return pdfBase64;
  }
}

module.exports = GuilfordCountyNorthCarolinaScraper;
