/**
 * Guilford County, North Carolina - Deed Scraper Implementation (Playwright Version)
 *
 * County Resources:
 * - Property Records: https://lrcpwa.ncptscloud.com/guilford/
 *
 * Search Method: Location Address (street number and street name separately)
 *
 * This is an improved implementation using Playwright for more reliable browser automation
 */

const DeedScraper = require('../deed-scraper');
const { chromium } = require('playwright');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

class GuilfordCountyNorthCarolinaPlaywrightScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Guilford';
    this.state = 'NC';
    this.debugLogs = [];
    this.playwrightBrowser = null;
    this.playwrightPage = null;
    this.playwrightContext = null;
  }

  /**
   * Override log method to use parent implementation
   */
  log(message) {
    super.log(message);
  }

  /**
   * Override initialize to use Playwright
   */
  async initialize() {
    this.log('🚀 Initializing browser with Playwright...');

    const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_NAME;
    const isLinux = process.platform === 'linux';

    const launchOptions = {
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ]
    };

    if (isRailway || isLinux) {
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
                            process.env.PUPPETEER_EXECUTABLE_PATH ||
                            '/usr/bin/google-chrome-stable';
      launchOptions.executablePath = executablePath;
    }

    this.playwrightBrowser = await chromium.launch(launchOptions);

    // Create a new context with proper settings
    this.playwrightContext = await this.playwrightBrowser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    this.playwrightPage = await this.playwrightContext.newPage();

    this.log('✅ Browser initialized with Playwright');
  }

  /**
   * Parse address into street number and street name
   */
  parseAddress(address) {
    this.log(`📍 Parsing address: ${address}`);

    let cleaned = address.trim();
    cleaned = cleaned.replace(/,.*$/g, '');
    cleaned = cleaned.replace(/\b(NC|North Carolina|Guilford)\b/gi, '');
    cleaned = cleaned.replace(/\b\d{5}(-\d{4})?\b/g, '');
    cleaned = cleaned.trim();

    const parts = cleaned.split(/\s+/);

    if (parts.length < 2) {
      throw new Error(`Cannot parse address: ${address}`);
    }

    const streetNumber = parts[0];
    const streetSuffixes = ['street', 'st', 'drive', 'dr', 'road', 'rd', 'avenue', 'ave',
                            'boulevard', 'blvd', 'lane', 'ln', 'court', 'ct', 'circle', 'cir',
                            'way', 'place', 'pl', 'trail', 'parkway', 'pkwy'];

    let streetName = parts.slice(1).join(' ');

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
      const { streetNumber, streetName } = this.parseAddress(address);

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

      this.log('\n📄 STEP 2: Getting deed information...');
      const deedResult = await this.getDeedInfo();
      result.steps.deed = {
        success: deedResult.success,
        duration: deedResult.duration
      };

      if (!deedResult.success) {
        throw new Error('Failed to get deed information');
      }

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
      this.log('🌐 Navigating to Guilford County Property Search...');
      await this.playwrightPage.goto('https://lrcpwa.ncptscloud.com/guilford/', {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      await this.playwrightPage.waitForTimeout(2000);

      this.log('🔍 Looking for Location Address tab...');
      const locationAddressClicked = await this.playwrightPage.evaluate(() => {
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
      await this.playwrightPage.waitForTimeout(1000);

      await this.playwrightPage.waitForSelector('#locationaddress.active', { timeout: 5000 }).catch(() => {
        this.log('⚠️ Tab pane did not become active, continuing anyway...');
      });

      this.log(`📝 Filling street number: ${streetNumber}`);
      await this.playwrightPage.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', {
        state: 'visible',
        timeout: 10000
      });

      await this.playwrightPage.fill('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', '');
      await this.playwrightPage.fill('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', streetNumber);
      await this.playwrightPage.waitForTimeout(500);

      this.log(`📝 Filling street name: ${streetName}`);
      await this.playwrightPage.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNameTextBox', {
        state: 'visible',
        timeout: 10000
      });

      await this.playwrightPage.fill('#ctl00_ContentPlaceHolder1_StreetNameTextBox', '');
      await this.playwrightPage.fill('#ctl00_ContentPlaceHolder1_StreetNameTextBox', streetName);
      await this.playwrightPage.waitForTimeout(1000);

      this.log('⏎ Pressing Enter to search...');
      await Promise.all([
        this.playwrightPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        this.playwrightPage.keyboard.press('Enter')
      ]);

      this.log('⏳ Waiting for results to render...');
      await this.playwrightPage.waitForTimeout(2000);

      this.log('🔍 Looking for first parcel entry...');
      const currentUrl = this.playwrightPage.url();
      this.log(`Current URL: ${currentUrl}`);

      const parcelLinkInfo = await this.playwrightPage.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const text = link.textContent.trim();
          const href = link.href;
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

      this.log('🖱️  Clicking parcel link...');
      await Promise.all([
        this.playwrightPage.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        this.playwrightPage.evaluate((href) => {
          const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
          if (link) link.click();
        }, parcelLinkInfo.href)
      ]);

      this.log(`✅ Navigated to parcel page: ${this.playwrightPage.url()}`);
      await this.playwrightPage.waitForTimeout(3000);

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

      const deedsTabClicked = await this.playwrightPage.evaluate(() => {
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
      await this.playwrightPage.waitForTimeout(5000);

      this.log('🔍 Checking for nested Deeds tab...');
      await this.playwrightPage.evaluate(() => {
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

      await this.playwrightPage.waitForTimeout(3000);

      this.log('🔍 Looking for first Deed Type entry...');

      // Store the current context for cookie transfer
      const cookies = await this.playwrightContext.cookies();
      this.log(`🍪 Captured ${cookies.length} cookies for session preservation`);

      const deedTypeInfo = await this.playwrightPage.evaluate(() => {
        const tables = Array.from(document.querySelectorAll('table'));

        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));
          let deedTypeColumnIndex = -1;
          let headerRowIndex = -1;

          for (let i = 0; i < rows.length; i++) {
            const headers = Array.from(rows[i].querySelectorAll('th'));
            for (let j = 0; j < headers.length; j++) {
              const headerText = headers[j].textContent.toLowerCase().trim();
              if (headerText === 'deed type') {
                deedTypeColumnIndex = j;
                headerRowIndex = i;
                break;
              }
            }
            if (deedTypeColumnIndex !== -1) break;
          }

          if (deedTypeColumnIndex !== -1 && headerRowIndex !== -1) {
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const row = rows[i];
              const cells = Array.from(row.querySelectorAll('td'));

              if (cells.length > deedTypeColumnIndex) {
                const deedTypeCell = cells[deedTypeColumnIndex];
                const link = deedTypeCell.querySelector('a');

                if (link) {
                  const deedType = link.textContent.trim();
                  if (deedType.length > 0 && deedType.toLowerCase().includes('deed')) {
                    let href = link.href;
                    if (href.includes('https://rdlxweb')) {
                      href = href.replace('https://', 'http://');
                    }
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
      this.log(`📄 Deed page URL: ${deedTypeInfo.href}`);

      // Create a new page in the same context (inherits cookies automatically)
      this.log('🔄 Opening deed document in new page with session cookies...');
      const deedPage = await this.playwrightContext.newPage();

      // Navigate to the deed page with session intact
      await deedPage.goto(deedTypeInfo.href, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      this.log('✅ Navigated to deed document page with session');

      // Switch to the new page
      this.playwrightPage = deedPage;

      await this.playwrightPage.waitForTimeout(5000);

      // Check for captcha
      this.log('🔍 Checking for captcha...');
      const captchaInfo = await this.playwrightPage.evaluate(() => {
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
        this.log('⚠️ reCAPTCHA detected - manual solving required');
        this.log('⏳ Waiting 2 minutes for manual CAPTCHA solution...');

        let captchaWaitTime = 0;
        const maxWaitTime = 120000;

        while (captchaWaitTime < maxWaitTime) {
          await this.playwrightPage.waitForTimeout(5000);
          captchaWaitTime += 5000;

          const stillHasCaptcha = await this.playwrightPage.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            return bodyText.includes('captcha') || bodyText.includes('recaptcha');
          });

          if (!stillHasCaptcha) {
            this.log('✅ Captcha appears to be solved');
            break;
          }
        }

        if (captchaWaitTime >= maxWaitTime) {
          throw new Error('Captcha timeout');
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
   * Download PDF using Playwright with network interception
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for deed document on current page...');

      // Set up network monitoring for images
      const capturedResources = [];

      this.playwrightPage.on('response', async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('image') || contentType.includes('pdf') ||
            url.includes('.tif') || url.includes('.pdf') ||
            url.includes('viewimage') || url.includes('getimage')) {
          try {
            const buffer = await response.body();
            capturedResources.push({ url, buffer, contentType });
            this.log(`📸 Captured resource: ${url} (${contentType})`);
          } catch (e) {
            // Resource might be cached or unavailable
          }
        }
      });

      // Wait for page to fully load
      this.log('⏳ Waiting for deed content to load...');
      await this.playwrightPage.waitForTimeout(10000);

      // Check for frames
      const frames = this.playwrightPage.frames();
      this.log(`🖼️ Found ${frames.length} frames on page`);

      let targetFrame = this.playwrightPage;

      for (const frame of frames) {
        const frameUrl = frame.url();
        if (frameUrl && frameUrl !== 'about:blank' &&
            (frameUrl.includes('viewimage') || frameUrl.includes('gis_viewimage'))) {
          this.log(`✅ Found deed viewer in frame: ${frameUrl}`);
          targetFrame = frame;
          break;
        }
      }

      // Try to find and download images
      const pageStatus = await targetFrame.evaluate(() => {
        const bodyHtml = document.body.innerHTML || '';
        const bodyText = document.body.innerText || '';

        const hasError = bodyText.includes('Notice</b>') ||
                        bodyText.includes('Error</b>') ||
                        bodyText.includes('Undefined variable');

        const hasDeedText = bodyText.includes('GUILFORD COUNTY') ||
                           bodyText.includes('REGISTER OF DEEDS') ||
                           bodyText.includes('Book') ||
                           bodyText.includes('Page') ||
                           bodyText.includes('DEED');

        const images = Array.from(document.querySelectorAll('img'));
        const imageUrls = images
          .filter(img => (img.width > 400 || img.naturalWidth > 400) &&
                        img.src && !img.src.includes('data:'))
          .map(img => img.src);

        return {
          hasError,
          hasDeedText,
          imageUrls,
          imageCount: images.length
        };
      });

      this.log(`Page status: DeedText: ${pageStatus.hasDeedText}, Images: ${pageStatus.imageCount}, Errors: ${pageStatus.hasError}`);

      if (pageStatus.hasError) {
        throw new Error('Server returned an error');
      }

      // Strategy 1: Use captured resources from network monitoring
      if (capturedResources.length > 0) {
        this.log(`📦 Found ${capturedResources.length} captured resources`);

        for (const resource of capturedResources) {
          if (resource.buffer && resource.buffer.length > 1000) {
            this.log(`📥 Processing captured resource: ${resource.url}`);

            const pdfBase64 = await this.processImageBuffer(resource.buffer);
            if (pdfBase64) {
              return {
                success: true,
                duration: Date.now() - startTime,
                pdfBase64,
                filename: `guilford_deed_${Date.now()}.pdf`,
                fileSize: Buffer.from(pdfBase64, 'base64').length,
                downloadPath: ''
              };
            }
          }
        }
      }

      // Strategy 2: Download images from page
      if (pageStatus.imageUrls && pageStatus.imageUrls.length > 0) {
        this.log(`🖼️ Found ${pageStatus.imageUrls.length} images on page`);

        for (const imageUrl of pageStatus.imageUrls) {
          try {
            this.log(`📥 Downloading image: ${imageUrl}`);
            const response = await this.playwrightPage.request.get(imageUrl);
            const buffer = await response.body();

            if (buffer && buffer.length > 1000) {
              const pdfBase64 = await this.processImageBuffer(buffer);
              if (pdfBase64) {
                return {
                  success: true,
                  duration: Date.now() - startTime,
                  pdfBase64,
                  filename: `guilford_deed_${Date.now()}.pdf`,
                  fileSize: Buffer.from(pdfBase64, 'base64').length,
                  downloadPath: ''
                };
              }
            }
          } catch (imgErr) {
            this.log(`⚠️ Failed to download image: ${imgErr.message}`);
          }
        }
      }

      // Strategy 3: Take screenshot
      if (pageStatus.hasDeedText) {
        this.log('📸 Taking full page screenshot...');
        const screenshot = await this.playwrightPage.screenshot({
          type: 'png',
          fullPage: true
        });

        const pdfBase64 = await this.convertImageToPdf(screenshot);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      throw new Error('Unable to capture deed document');

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
   * Process image buffer and convert to PDF
   */
  async processImageBuffer(buffer) {
    try {
      const firstChars = buffer.toString('utf8', 0, Math.min(100, buffer.length));

      // Check if it's an HTML error page
      if (firstChars.includes('<html') || firstChars.includes('<!DOCTYPE') ||
          firstChars.includes('Notice</b>') || firstChars.includes('Error</b>')) {
        this.log('⚠️ Received HTML error page, skipping');
        return null;
      }

      const pdfSignature = buffer.toString('utf8', 0, 4);
      const tiffSignature = buffer.toString('ascii', 0, 2);

      // Already a PDF
      if (pdfSignature === '%PDF') {
        this.log(`✅ PDF downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
        return buffer.toString('base64');
      }

      // TIFF image - convert to PDF
      if (tiffSignature === 'II' || tiffSignature === 'MM') {
        this.log(`✅ TIFF image downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
        return await this.convertImageToPdf(buffer);
      }

      // Other image format
      if (buffer.length > 1000) {
        this.log(`✅ Image downloaded: ${(buffer.length / 1024).toFixed(2)} KB`);
        return await this.convertImageToPdf(buffer);
      }

      return null;
    } catch (error) {
      this.log(`⚠️ Failed to process buffer: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert image buffer to PDF
   */
  async convertImageToPdf(imageBuffer) {
    try {
      this.log(`🔄 Converting image to PDF...`);

      const pngBuffer = await sharp(imageBuffer).png().toBuffer();
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width || 612;
      const height = metadata.height || 792;

      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      const maxWidth = 612;
      const maxHeight = 792;
      let pageWidth = width;
      let pageHeight = height;

      if (pageWidth > maxWidth || pageHeight > maxHeight) {
        const scale = Math.min(maxWidth / pageWidth, maxHeight / pageHeight);
        pageWidth = pageWidth * scale;
        pageHeight = pageHeight * scale;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      const pdfBytes = await pdfDoc.save();
      this.log(`✅ PDF created: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

      return Buffer.from(pdfBytes).toString('base64');
    } catch (error) {
      this.log(`❌ Failed to convert image to PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.playwrightBrowser) {
      await this.playwrightBrowser.close();
      this.playwrightBrowser = null;
      this.playwrightPage = null;
      this.playwrightContext = null;
    }
  }
}

module.exports = GuilfordCountyNorthCarolinaPlaywrightScraper;
