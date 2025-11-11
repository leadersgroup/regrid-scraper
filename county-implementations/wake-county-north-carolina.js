/**
 * Wake County, North Carolina - Deed Scraper Implementation
 *
 * County Resources:
 * - Real Estate Search: https://services.wake.gov/realestate/
 *
 * Search Method: Property Address (street number and street name separately)
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

class WakeCountyNorthCarolinaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Wake';
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
   * Example: "4501 Rockwood Dr" -> { streetNumber: "4501", streetName: "rockwood" }
   */
  parseAddress(address) {
    this.log(`📍 Parsing address: ${address}`);

    // Clean the address
    let cleaned = address.trim();

    // Remove common suffixes, city, state, zip
    cleaned = cleaned.replace(/,.*$/g, ''); // Remove everything after comma
    cleaned = cleaned.replace(/\b(NC|North Carolina)\b/gi, '');
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

    let streetName = parts.slice(1).join(' ').toLowerCase();

    // Remove suffix if present
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
        accountNumber: searchResult.accountNumber
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
   * Search for property by street number and street name
   */
  async searchProperty(streetNumber, streetName) {
    const startTime = Date.now();

    try {
      this.log('🌐 Navigating to Wake County Real Estate Search...');
      await this.page.goto('https://services.wake.gov/realestate/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Find and fill street number field (name="stnum")
      this.log(`📝 Filling street number: ${streetNumber}`);
      const streetNumField = await this.page.$('input[name="stnum"]');

      if (!streetNumField) {
        throw new Error('Could not find street number input field');
      }

      await streetNumField.click({ clickCount: 3 });
      await streetNumField.type(streetNumber);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Find and fill street name field (name="stname")
      this.log(`📝 Filling street name: ${streetName}`);
      const streetNameField = await this.page.$('input[name="stname"]');

      if (!streetNameField) {
        throw new Error('Could not find street name input field');
      }

      await streetNameField.click({ clickCount: 3 });
      await streetNameField.type(streetName);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click the "Search by Address" button
      this.log('🔍 Clicking search button...');
      const searchClicked = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="image"]'));
        const searchBtn = inputs.find(input => input.name === 'Search by Address');
        if (searchBtn) {
          searchBtn.click();
          return true;
        }
        return false;
      });

      if (!searchClicked) {
        this.log('⚠️ Could not find search button, trying Enter');
        await this.page.keyboard.press('Enter');
      }

      // Wait for results
      this.log('⏳ Waiting for results...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Click first account entry (it's a link)
      this.log('🖱️  Clicking first account entry...');
      const accountClicked = await this.page.evaluate(() => {
        // Look for account number links (format: 0027142)
        const links = Array.from(document.querySelectorAll('a'));

        for (const link of links) {
          const text = link.textContent.trim();
          // Look for 7-digit account numbers
          if (/^\d{7}$/.test(text)) {
            link.click();
            return { success: true, accountNumber: text };
          }
        }

        return { success: false };
      });

      if (!accountClicked.success) {
        throw new Error('Could not find or click account entry');
      }

      this.log(`✅ Clicked account: ${accountClicked.accountNumber}`);

      // Wait for navigation to account page
      await new Promise(resolve => setTimeout(resolve, 5000));

      return {
        success: true,
        duration: Date.now() - startTime,
        accountNumber: accountClicked.accountNumber
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
   * Navigate to Deeds tab and click first page entry
   */
  async getDeedInfo() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for Deeds tab...');

      // Find and click Deeds tab (it's a link in the navigation)
      const deedsTabClicked = await this.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));

        for (const link of links) {
          const text = link.textContent.trim().toLowerCase();
          // Look for "Deeds" link
          if (text === 'deeds') {
            link.click();
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

      // Look for first entry in Page column
      this.log('🔍 Looking for first Page entry...');

      // Get the URL of the page link first (it opens in a new tab)
      const pageLinkInfo = await this.page.evaluate(() => {
        // Look for all links with page number pattern (4 digits)
        const allLinks = Array.from(document.querySelectorAll('a'));

        for (const link of allLinks) {
          const text = link.textContent.trim();
          const href = link.href || '';

          // Look for links that go to rodrecords.wake.gov with Book/Page parameters
          if (href.includes('rodrecords.wake.gov') &&
              href.includes('BookPageID') &&
              /^\d{4}$/.test(text)) {
            return {
              success: true,
              page: text,
              href: href
            };
          }
        }

        return { success: false };
      });

      if (!pageLinkInfo.success) {
        throw new Error('Could not find Page link');
      }

      this.log(`✅ Found page link: ${pageLinkInfo.page} -> ${pageLinkInfo.href}`);

      // Click the link and wait for new tab to open
      const newPagePromise = new Promise(resolve =>
        this.browser.once('targetcreated', target => resolve(target.page()))
      );

      // Click the page link
      await this.page.evaluate((targetHref) => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          if (link.href === targetHref) {
            link.click();
            return;
          }
        }
      }, pageLinkInfo.href);

      this.log('⏳ Waiting for new tab to open...');
      const rodPage = await newPagePromise;
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

      this.log(`✅ New tab opened: ${rodPage.url()}`);

      // Switch to the new tab (rodrecords.wake.gov)
      this.page = rodPage;

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for captcha on the new page
      this.log('🔍 Checking for captcha on ROD page...');
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

            // Wait for page to process the CAPTCHA solution and load PDF
            this.log('⏳ Waiting for PDF to load...');
            await new Promise(resolve => setTimeout(resolve, 10000));

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
   * Download PDF using same method as Durham County
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for PDF...');

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
          filename: `wake_deed_${Date.now()}.pdf`,
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
          filename: `wake_deed_${Date.now()}.pdf`,
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
          filename: `wake_deed_${Date.now()}.pdf`,
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
          filename: `wake_deed_${Date.now()}.pdf`,
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
          filename: `wake_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
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
   * Download PDF from URL using same method as Durham County
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

module.exports = WakeCountyNorthCarolinaScraper;
