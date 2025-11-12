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
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

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
      this.log(`📄 Deed page URL: ${deedTypeInfo.href}`);

      // Handle new tab opening with proper session preservation
      this.log('🌐 Opening deed document page with session...');

      // CRITICAL: Get cookies from current page to preserve PHP session
      const cookies = await this.page.cookies();
      this.log(`🍪 Captured ${cookies.length} cookies from current session`);

      // Instead of clicking link (which loses session), open new tab manually with cookies
      const deedPage = await this.browser.newPage();

      // Set cookies BEFORE navigating to preserve session variables (like tiffInfo)
      if (cookies.length > 0) {
        this.log('🍪 Setting session cookies in new tab...');
        await deedPage.setCookie(...cookies);
      }

      // Now navigate to the deed URL with session intact
      this.log(`📄 Navigating to deed URL: ${deedTypeInfo.href}`);
      await deedPage.goto(deedTypeInfo.href, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Switch context to the new page
      this.page = deedPage;

      // Wait a moment for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));

      this.log('✅ On deed document page');

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
      this.log('🔍 Looking for deed document on current page...');

      // Set up network monitoring to capture dynamically loaded images
      const capturedImageUrls = [];
      const responseHandler = async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Capture image URLs (TIFF, PDF, or large images)
        if (contentType.includes('image') || contentType.includes('pdf') ||
            url.includes('.tif') || url.includes('.pdf') ||
            url.includes('viewimage') || url.includes('getimage')) {
          capturedImageUrls.push(url);
          this.log(`📸 Captured resource URL: ${url}`);
        }
      };
      this.page.on('response', responseHandler);  // Attach to main page before any frame switching

      // Wait for page to fully load (deed images may take time)
      this.log('⏳ Waiting for deed content to load...');

      // If we're on the deed viewer page, try to wait for specific elements
      if (this.page.url().includes('gis_viewimage.php')) {
        try {
          // Try to wait for an image, canvas, or embed to appear
          await this.page.waitForSelector('img[src*=".tif"], img[src*=".jpg"], img[src*=".png"], canvas, embed, object', {
            timeout: 10000
          });
          this.log('✅ Deed viewer element detected');
        } catch (e) {
          // Element might not exist or might load differently
          this.log('⏳ Standard wait for content...');
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 8000));  // Standard wait for frames
      }

      // Keep reference to main page for navigation
      const mainPage = this.page;
      let currentContext = this.page;  // This will be either the main page or a frame

      // Check for frames (deed content might be in an iframe)
      const frames = this.page.frames();
      if (frames.length > 1) {
        this.log(`🖼️  Found ${frames.length} frames on page`);

        // Check each frame for deed content
        for (const frame of frames) {
          try {
            const frameUrl = frame.url();
            if (frameUrl && frameUrl !== 'about:blank') {
              this.log(`  Checking frame: ${frameUrl}`);

              // Check if frame contains deed viewer
              if (frameUrl.includes('viewimage') || frameUrl.includes('gis_viewimage')) {
                this.log('✅ Found deed viewer in frame!');
                // Use frame as current context but keep main page reference
                currentContext = frame;
                break;
              }
            }
          } catch (e) {
            // Frame might be detached
          }
        }
      }

      // Check current URL (works for both pages and frames)
      const currentUrl = currentContext.url();
      this.log(`Current URL: ${currentUrl}`);

      // Check if the current context (page or frame) has deed content
      const pageStatus = await currentContext.evaluate(() => {
        const bodyHtml = document.body.innerHTML || '';
        const bodyText = document.body.innerText || '';

        // Check for PHP/server errors
        const hasError = bodyText.includes('Notice</b>') ||
                        bodyText.includes('Error</b>') ||
                        bodyText.includes('Undefined variable');

        // Look for images
        const images = Array.from(document.querySelectorAll('img'));
        const hasLargeImage = images.some(img =>
          (img.width > 400 || img.naturalWidth > 400) &&
          img.src &&
          !img.src.includes('data:')
        );

        // Check for canvas elements (some viewers render to canvas)
        const canvases = Array.from(document.querySelectorAll('canvas'));
        const hasCanvas = canvases.some(canvas =>
          canvas.width > 400 || canvas.height > 400
        );

        // Check for embed/object elements (for PDFs or TIFF viewers)
        const embeds = Array.from(document.querySelectorAll('embed, object'));
        const hasEmbed = embeds.some(embed => {
          const src = embed.src || embed.data || '';
          return src.includes('.pdf') || src.includes('.tif') ||
                 src.includes('viewimage') || embed.type?.includes('pdf');
        });

        // Check if content is still loading
        const isLoading = bodyText.toLowerCase().includes('loading') ||
                         bodyHtml.includes('spinner') ||
                         bodyHtml.includes('loader');

        return {
          hasError,
          hasLargeImage,
          hasCanvas,
          hasEmbed,
          isLoading,
          imageCount: images.length,
          canvasCount: canvases.length,
          embedCount: embeds.length,
          textLength: bodyText.length,
          url: window.location.href
        };
      });

      this.log(`Page status: Images: ${pageStatus.imageCount}, Canvas: ${pageStatus.canvasCount}, Embeds: ${pageStatus.embedCount}, Loading: ${pageStatus.isLoading}`);

      // If content is still loading, wait more
      if (pageStatus.isLoading) {
        this.log('⏳ Content still loading, waiting longer...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Re-check status after additional wait
        pageStatus = await currentContext.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          const hasLargeImage = images.some(img =>
            (img.width > 400 || img.naturalWidth > 400) &&
            img.src && !img.src.includes('data:')
          );
          const canvases = Array.from(document.querySelectorAll('canvas'));
          const hasCanvas = canvases.some(canvas => canvas.width > 400);
          const embeds = Array.from(document.querySelectorAll('embed, object'));
          const hasEmbed = embeds.length > 0;

          return {
            hasLargeImage,
            hasCanvas,
            hasEmbed,
            imageCount: images.length,
            canvasCount: canvases.length,
            embedCount: embeds.length
          };
        });
        this.log(`Updated status: Images: ${pageStatus.imageCount}, Canvas: ${pageStatus.canvasCount}, Embeds: ${pageStatus.embedCount}`);
      }

      // Check for actual PHP/server errors (not just missing content)
      if (pageStatus.hasError) {
        this.log('⚠️  Server returned an error');
        throw new Error('Guilford County server returned an error. Please try again later.');
      }

      // Strategy 1: If we have a large image on the current page
      if (pageStatus.hasLargeImage) {
        this.log('✅ Found image on current page');

        const imageUrl = await currentContext.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          for (const img of images) {
            if ((img.width > 400 || img.naturalWidth > 400) && img.src && !img.src.includes('data:')) {
              return img.src;
            }
          }
          return null;
        });

        if (imageUrl) {
          try {
            const pdfBase64 = await this.downloadPdfFromUrl(imageUrl);
            
            // Verify the PDF is not blank
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');
            const isBlank = await this.isImageBlank(pdfBuffer);
            
            if (isBlank) {
              throw new Error('Downloaded content appears to be blank');
            }
            
            return {
              success: true,
              duration: Date.now() - startTime,
              pdfBase64,
              filename: `guilford_deed_${Date.now()}.pdf`,
              fileSize: pdfBuffer.length,
              downloadPath: ''
            };
          } catch (imgErr) {
            this.log(`⚠️  Image download failed: ${imgErr.message}`);
          }
        }
      }

      // Strategy 2: If we have a canvas element (some viewers render to canvas)
      if (pageStatus.hasCanvas) {
        this.log('📊 Found canvas element - attempting screenshot...');
        try {
          // Take a screenshot of the viewer area
          const screenshotBuffer = await currentContext.screenshot({
            type: 'png',
            fullPage: false
          });

          // Convert screenshot to PDF
          const pdfBase64 = await this.screenshotToPdf(screenshotBuffer);

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
        } catch (canvasErr) {
          this.log(`⚠️  Canvas capture failed: ${canvasErr.message}`);
        }
      }

      // Strategy 3: If we have embed/object elements
      if (pageStatus.hasEmbed) {
        this.log('📋 Found embed/object element...');
        const embedUrl = await currentContext.evaluate(() => {
          const embeds = Array.from(document.querySelectorAll('embed, object'));
          for (const embed of embeds) {
            const src = embed.src || embed.data;
            if (src && (src.includes('.pdf') || src.includes('.tif') || src.includes('viewimage'))) {
              return src;
            }
          }
          return null;
        });

        if (embedUrl) {
          try {
            this.log(`  Downloading from embed: ${embedUrl}`);
            const pdfBase64 = await this.downloadPdfFromUrl(embedUrl);
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');

            if (pdfBuffer.length > 1000) {
              return {
                success: true,
                duration: Date.now() - startTime,
                pdfBase64,
                filename: `guilford_deed_${Date.now()}.pdf`,
                fileSize: pdfBuffer.length,
                downloadPath: ''
              };
            }
          } catch (embedErr) {
            this.log(`⚠️  Embed download failed: ${embedErr.message}`);
          }
        }
      }

      // Strategy 4: Try direct download from URL
      if (currentUrl.includes('gis_viewimage.php') || currentUrl.includes('.pdf')) {
        this.log('📥 Attempting direct download...');
        
        try {
          const pdfBase64 = await this.downloadPdfFromUrl(currentUrl);
          
          // Verify the content
          const pdfBuffer = Buffer.from(pdfBase64, 'base64');
          const firstChars = pdfBuffer.toString('utf8', 0, Math.min(100, pdfBuffer.length));
          
          // Check if it's actually an error or blank
          if (firstChars.includes('<html') || 
              firstChars.includes('Notice</b>') ||
              pdfBuffer.length < 1000) {
            throw new Error('Downloaded content is not a valid deed document');
          }
          
          return {
            success: true,
            duration: Date.now() - startTime,
            pdfBase64,
            filename: `guilford_deed_${Date.now()}.pdf`,
            fileSize: pdfBuffer.length,
            downloadPath: ''
          };
        } catch (dlErr) {
          this.log(`⚠️  Direct download failed: ${dlErr.message}`);
        }
      }

      // Strategy 5: Look for deed links on the current page
      this.log('🔍 Looking for deed links...');
      const deedLinks = await currentContext.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .filter(link => {
            const href = link.href || '';
            const text = link.textContent || '';
            return href.includes('gis_viewimage') || 
                   href.includes('deed') ||
                   text.toLowerCase().includes('deed');
          })
          .map(link => ({
            text: link.textContent.trim(),
            href: link.href
          }));
      });

      if (deedLinks.length > 0) {
        this.log(`Found ${deedLinks.length} deed links`);
        
        for (const link of deedLinks) {
          try {
            this.log(`Trying: ${link.text}`);
            await mainPage.goto(link.href, {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Recursively try to download from the new page
            return await this.downloadDeedPdf();
          } catch (linkErr) {
            this.log(`  Failed: ${linkErr.message}`);
          }
        }
      }

      // Strategy 6: Try captured image URLs from network monitoring
      if (capturedImageUrls.length > 0) {
        this.log(`🌐 Trying ${capturedImageUrls.length} captured resource URLs...`);

        for (const imageUrl of capturedImageUrls) {
          try {
            this.log(`  Attempting: ${imageUrl}`);
            const pdfBase64 = await this.downloadPdfFromUrl(imageUrl);

            // Verify the content
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');
            const isBlank = await this.isImageBlank(pdfBuffer);

            if (!isBlank && pdfBuffer.length > 1000) {
              this.log('✅ Successfully downloaded deed from captured URL');

              // Clean up event listener
              mainPage.off('response', responseHandler);

              return {
                success: true,
                duration: Date.now() - startTime,
                pdfBase64,
                filename: `guilford_deed_${Date.now()}.pdf`,
                fileSize: pdfBuffer.length,
                downloadPath: ''
              };
            }
          } catch (captureErr) {
            this.log(`    Failed: ${captureErr.message}`);
          }
        }
      }

      // Clean up event listener before throwing error
      mainPage.off('response', responseHandler);

      // If all strategies fail, provide a meaningful error
      throw new Error(
        'Unable to capture deed document. Tried multiple strategies including image capture, ' +
        'canvas screenshot, embed detection, and network monitoring. The deed may be displayed ' +
        'in an unsupported format or require additional interaction to load.'
      );

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

    // Try direct fetch first
    try {
      // Use fetch from within page context to maintain cookies and session
      const result = await this.page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to base64
        let binary = '';
        uint8Array.forEach((byte) => {
          binary += String.fromCharCode(byte);
        });
        
        return {
          base64: btoa(binary),
          contentType: response.headers.get('content-type') || ''
        };
      }, pdfUrl);

      const pdfBase64 = result.base64;
      const contentType = result.contentType.toLowerCase();

      // Verify it's a valid document (not HTML error page)
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const firstChars = pdfBuffer.toString('utf8', 0, Math.min(100, pdfBuffer.length));
      
      // Check if it's an HTML error page
      if (contentType.includes('text/html') || 
          firstChars.includes('<html') || 
          firstChars.includes('<!DOCTYPE') ||
          firstChars.includes('<br') ||
          firstChars.includes('Notice</b>') ||
          firstChars.includes('Error</b>') ||
          firstChars.includes('Warning</b>')) {
        this.log(`⚠️  Received HTML error page instead of document`);
        this.log(`  Content type: ${contentType}`);
        this.log(`  First 100 chars: ${firstChars}`);
        
        // Try alternative approach: navigate to the URL directly and screenshot
        this.log(`🔄 Attempting alternative approach: direct navigation and screenshot`);
        return await this.screenshotToPdf(pdfUrl);
      }

      const pdfSignature = pdfBuffer.toString('utf8', 0, 4);
      const tiffSignature = pdfBuffer.toString('ascii', 0, 2);

      // Check for PDF signature
      if (pdfSignature === '%PDF') {
        this.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        return pdfBase64;
      }
      // Check for TIFF signature (II* or MM*) and convert to PDF
      else if (tiffSignature === 'II' || tiffSignature === 'MM') {
        this.log(`✅ TIFF image downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        this.log(`🔄 Converting TIFF to PDF...`);

        try {
          // Convert TIFF to PNG using sharp (pdf-lib doesn't support TIFF directly)
          const pngBuffer = await sharp(pdfBuffer)
            .png()
            .toBuffer();

          this.log(`✅ Converted to PNG: ${(pngBuffer.length / 1024).toFixed(2)} KB`);

          // Get image dimensions
          const metadata = await sharp(pdfBuffer).metadata();
          const width = metadata.width || 612;
          const height = metadata.height || 792;

          // Create a new PDF document
          const pdfDoc = await PDFDocument.create();

          // Embed the PNG image
          const pngImage = await pdfDoc.embedPng(pngBuffer);

          // Calculate page size to fit image (maintain aspect ratio)
          const maxWidth = 612; // 8.5 inches at 72 DPI
          const maxHeight = 792; // 11 inches at 72 DPI
          let pageWidth = width;
          let pageHeight = height;

          // Scale down if image is too large
          if (pageWidth > maxWidth || pageHeight > maxHeight) {
            const scale = Math.min(maxWidth / pageWidth, maxHeight / pageHeight);
            pageWidth = pageWidth * scale;
            pageHeight = pageHeight * scale;
          }

          // Add a page with the image dimensions
          const page = pdfDoc.addPage([pageWidth, pageHeight]);

          // Draw the image on the page
          page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
          });

          // Save the PDF
          const pdfBytes = await pdfDoc.save();
          const convertedPdfBase64 = Buffer.from(pdfBytes).toString('base64');

          this.log(`✅ PDF created: ${(pdfBytes.length / 1024).toFixed(2)} KB`);
          return convertedPdfBase64;
        } catch (conversionError) {
          this.log(`⚠️  Failed to convert TIFF to PDF: ${conversionError.message}`);
          this.log(`  Returning original TIFF as base64`);
          return pdfBase64;
        }
      }
      // Check for other image formats (PNG, JPG, etc.)
      else if (contentType.includes('image/')) {
        this.log(`✅ Image downloaded (${contentType}): ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        return await this.convertImageToPdf(pdfBuffer);
      }
      // Unknown format but accept it anyway
      else {
        this.log(`⚠️  Downloaded content (signature: ${pdfSignature}): ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        this.log(`  Content type: ${contentType}`);
        return pdfBase64;
      }
    } catch (error) {
      this.log(`⚠️  Direct download failed: ${error.message}`);
      this.log(`🔄 Attempting screenshot approach...`);
      return await this.screenshotToPdf(pdfUrl);
    }
  }

  /**
   * Convert any image buffer to PDF
   */
  /**
   * Check if an image/screenshot is mostly blank
   */
  async isImageBlank(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      const stats = await sharp(imageBuffer).stats();
      
      // Check if the image is very small (likely an error page)
      if (metadata.width < 100 || metadata.height < 100) {
        return true;
      }
      
      // Check color statistics - if all channels have very similar values, it's likely blank
      if (stats && stats.channels && stats.channels.length > 0) {
        const means = stats.channels.map(ch => ch.mean);
        const allSimilar = means.every(mean => Math.abs(mean - means[0]) < 10);
        
        // If all channels are very dark (< 50) or very light (> 250) and similar
        if (allSimilar && (means[0] < 50 || means[0] > 250)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      this.log(`⚠️  Could not analyze image: ${error.message}`);
      return false;
    }
  }

  async convertImageToPdf(imageBuffer) {
    try {
      this.log(`🔄 Converting image to PDF...`);
      
      // Convert any image format to PNG using sharp
      const pngBuffer = await sharp(imageBuffer)
        .png()
        .toBuffer();

      // Get image dimensions
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width || 612;
      const height = metadata.height || 792;

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Embed the PNG image
      const pngImage = await pdfDoc.embedPng(pngBuffer);

      // Calculate page size to fit image (maintain aspect ratio)
      const maxWidth = 612; // 8.5 inches at 72 DPI
      const maxHeight = 792; // 11 inches at 72 DPI
      let pageWidth = width;
      let pageHeight = height;

      // Scale down if image is too large
      if (pageWidth > maxWidth || pageHeight > maxHeight) {
        const scale = Math.min(maxWidth / pageWidth, maxHeight / pageHeight);
        pageWidth = pageWidth * scale;
        pageHeight = pageHeight * scale;
      }

      // Add a page with the image dimensions
      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Draw the image on the page
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const convertedPdfBase64 = Buffer.from(pdfBytes).toString('base64');

      this.log(`✅ PDF created from image: ${(pdfBytes.length / 1024).toFixed(2)} KB`);
      return convertedPdfBase64;
    } catch (error) {
      this.log(`❌ Failed to convert image to PDF: ${error.message}`);
      throw error;
    }
  }

  /**
   * Take a screenshot of the deed page and convert to PDF
   */
  /**
   * Take a screenshot of the deed page and convert to PDF
   */
  /**
   * Take a screenshot of the deed page and convert to PDF
   */
  async screenshotToPdf(url) {
    try {
      this.log(`📸 Attempting screenshot approach for: ${url}`);
      
      // Check if the current page has a deed image before proceeding
      const currentPageCheck = await this.page.evaluate(() => {
        // Check for blank page indicators
        const bodyHtml = document.body.innerHTML || '';
        const bodyText = document.body.innerText || '';
        
        // Check if page is essentially empty
        if (bodyHtml.trim().length < 50 && bodyText.trim().length < 10) {
          return { isBlank: true, reason: 'Page is empty' };
        }
        
        // Check for dark background (common in blank deed viewer)
        const bodyStyle = window.getComputedStyle(document.body);
        const bgColor = bodyStyle.backgroundColor;
        if (bgColor && (bgColor.includes('40, 40, 40') || bgColor.includes('rgb(40'))) {
          return { isBlank: true, reason: 'Page has blank deed viewer background' };
        }
        
        // Look for any meaningful content
        const images = Array.from(document.querySelectorAll('img'));
        const hasLargeImage = images.some(img => 
          (img.width > 200 || img.naturalWidth > 200) && img.src && !img.src.includes('data:')
        );
        
        return {
          isBlank: !hasLargeImage && bodyText.length < 100,
          hasImages: images.length > 0,
          hasLargeImage,
          textLength: bodyText.length
        };
      });
      
      if (currentPageCheck.isBlank) {
        this.log(`❌ Current page appears to be blank: ${currentPageCheck.reason || 'No content'}`);
        throw new Error('The Guilford County deed viewer is not displaying content. The server may be having issues or requires different authentication.');
      }
      
      // If we have a large image on the current page, try to get it
      if (currentPageCheck.hasLargeImage) {
        const imageUrl = await this.page.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          for (const img of images) {
            if ((img.width > 200 || img.naturalWidth > 200) && img.src && !img.src.includes('data:')) {
              return img.src;
            }
          }
          return null;
        });
        
        if (imageUrl) {
          this.log(`✅ Found deed image on page`);
          try {
            const imageResponse = await this.page.evaluate(async (src) => {
              const response = await fetch(src);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              
              let binary = '';
              uint8Array.forEach((byte) => {
                binary += String.fromCharCode(byte);
              });
              
              return btoa(binary);
            }, imageUrl);
            
            const imageBuffer = Buffer.from(imageResponse, 'base64');
            
            // Check if the image is blank before converting
            const isBlank = await this.isImageBlank(imageBuffer);
            if (isBlank) {
              throw new Error('Downloaded image appears to be blank');
            }
            
            return await this.convertImageToPdf(imageBuffer);
          } catch (imgError) {
            this.log(`⚠️  Failed to process image: ${imgError.message}`);
          }
        }
      }
      
      // Last resort: Take a screenshot if there's meaningful content
      if (currentPageCheck.textLength > 100 || currentPageCheck.hasImages) {
        this.log(`📸 Taking screenshot of current page content...`);
        const screenshotBuffer = await this.page.screenshot({
          fullPage: true,
          type: 'png'
        });
        
        // Check if the screenshot is blank
        const isBlank = await this.isImageBlank(screenshotBuffer);
        if (isBlank) {
          throw new Error('Screenshot appears to be blank or contains no meaningful content');
        }
        
        return await this.convertImageToPdf(screenshotBuffer);
      }
      
      // If we reach here, we couldn't get any content
      throw new Error('Unable to capture deed document. The Guilford County server is not providing the deed image.');
      
    } catch (error) {
      this.log(`❌ Screenshot approach failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = GuilfordCountyNorthCarolinaScraper;
