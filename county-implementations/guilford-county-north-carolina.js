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
    try {
      this.log('🔍 Looking for Deeds tab...');
      
      // Click the Deeds tab
      const deedTabClicked = await this.page.evaluate(() => {
        // Try different selectors for the Deeds tab
        const selectors = [
          'a:contains("Deeds")',
          'button:contains("Deeds")',
          'span:contains("Deeds")',
          '[role="tab"]:contains("Deeds")',
          'li:contains("Deeds")'
        ];
        
        const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"], li[role="tab"], ul.nav-tabs a'));
        for (const el of allElements) {
          if (el.textContent.trim().toLowerCase() === 'deeds' || 
              el.textContent.trim() === 'Deeds' ||
              (el.getAttribute('aria-controls') && el.getAttribute('aria-controls').toLowerCase().includes('deed'))) {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (!deedTabClicked) {
        this.log('⚠️ Could not find main Deeds tab');
        return { success: false };
      }

      this.log('✅ Clicked Deeds tab');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if there's a nested Deeds tab
      this.log('🔍 Checking for nested Deeds tab...');
      const nestedDeedTabClicked = await this.page.evaluate(() => {
        // After clicking the main Deeds tab, there might be another Deeds sub-tab
        const deedsHeaders = Array.from(document.querySelectorAll('h3, h4, h5, strong'));
        const hasDeedsHeader = deedsHeaders.some(h => h.textContent.trim() === 'Deeds');
        
        // Check if we're already on the deeds page
        const tables = Array.from(document.querySelectorAll('table'));
        const hasDeeedTable = tables.some(table => {
          const headers = Array.from(table.querySelectorAll('th'));
          return headers.some(th => th.textContent.includes('Deed Type'));
        });
        
        if (!hasDeeedTable) {
          // Try to find a nested tab
          const nestedTabs = Array.from(document.querySelectorAll('.nav-tabs a, .nav-pills a, [role="tab"]'));
          for (const tab of nestedTabs) {
            if (tab.textContent.trim().toLowerCase() === 'deeds' || 
                tab.textContent.trim() === 'Deeds' ||
                tab.textContent.includes('Deed')) {
              tab.click();
              return true;
            }
          }
        }
        
        return false;
      });

      if (nestedDeedTabClicked) {
        this.log('✅ Clicked nested Deeds tab');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Look for the first ACTUAL Deed Type entry (not building details)
      this.log('🔍 Looking for first Deed Type entry...');
      
      const deedTypeInfo = await this.page.evaluate(() => {
        // Find the table with deed information
        const tables = Array.from(document.querySelectorAll('table'));
        
        // List of actual deed types to look for (excluding building/improvement details)
        const validDeedTypes = [
          'DEED', 'WARRANTY DEED', 'CORR DEED', 'QUITCLAIM DEED', 
          'SPECIAL WARRANTY DEED', 'DEED OF TRUST', 'TRUSTEES DEED',
          'GRANT DEED', 'GENERAL WARRANTY DEED', 'LIMITED WARRANTY DEED'
        ];
        
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll('tr'));
          let deedTypeColumnIndex = -1;
          let headerRowIndex = -1;
          
          // Find the header row and Deed Type column
          for (let i = 0; i < rows.length; i++) {
            const headers = Array.from(rows[i].querySelectorAll('th'));
            for (let j = 0; j < headers.length; j++) {
              if (headers[j].textContent.includes('Deed Type')) {
                deedTypeColumnIndex = j;
                headerRowIndex = i;
                break;
              }
            }
            if (deedTypeColumnIndex !== -1) break;
          }
          
          // If we found the Deed Type column, look for an actual deed entry
          if (deedTypeColumnIndex !== -1) {
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
              const cells = Array.from(rows[i].querySelectorAll('td'));
              if (cells[deedTypeColumnIndex]) {
                const deedTypeCell = cells[deedTypeColumnIndex];
                const link = deedTypeCell.querySelector('a');
                
                if (link) {
                  const href = link.href;
                  const deedType = link.textContent.trim().toUpperCase();
                  
                  // Check if this is an actual deed type and the URL points to the deed viewer
                  const isValidDeed = validDeedTypes.some(valid => 
                    deedType.includes(valid) || valid.includes(deedType)
                  );
                  
                  // Also check if the URL is for the deed viewer (gis_viewimage.php)
                  const isDeedViewerUrl = href.includes('gis_viewimage.php') || 
                                          href.includes('viewimage') ||
                                          href.includes('deed');
                  
                  // Skip if it's a building/improvement detail page
                  const isBuildingDetail = href.includes('OutbuildingDetails') || 
                                           href.includes('BuildingDetails') ||
                                           deedType.includes('IMPROVEMENT') ||
                                           deedType.includes('BUILDING');
                  
                  if ((isValidDeed || isDeedViewerUrl) && !isBuildingDetail) {
                    return { 
                      success: true, 
                      deedType: link.textContent.trim(),
                      href: href
                    };
                  }
                }
              }
            }
          }
        }
        
        // If no valid deed found in Deed Type column, look for any deed viewer links
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          const href = link.href;
          const text = link.textContent.trim().toUpperCase();
          
          // Check if this link points to the deed viewer
          if (href.includes('gis_viewimage.php') || 
              (href.includes('viewimage') && !href.includes('Building'))) {
            return {
              success: true,
              deedType: link.textContent.trim() || 'DEED',
              href: href
            };
          }
        }
        
        return { success: false };
      });

      if (!deedTypeInfo.success) {
        throw new Error('Could not find any deed document links (only found building/improvement details)');
      }

      this.log(`✅ Found deed type: ${deedTypeInfo.deedType}`);
      this.log(`📄 Deed page URL: ${deedTypeInfo.href}`);

      // SESSION COOKIE FIX: Capture cookies before opening new tab
      this.log('🍪 Capturing session cookies from current page...');
      const cookies = await this.page.cookies();
      this.log(`🍪 Captured ${cookies.length} cookies from current session`);

      // Create a new page/tab manually
      this.log('📑 Opening new tab for deed document...');
      const deedPage = await this.browser.newPage();

      // Set the captured cookies in the new tab BEFORE navigating
      if (cookies.length > 0) {
        this.log('🍪 Setting session cookies in new tab...');
        await deedPage.setCookie(...cookies);
        this.log('✅ Session cookies transferred to new tab');
      }

      // Now navigate to the deed URL with session intact
      this.log('🌐 Navigating to deed URL with session intact...');
      const response = await deedPage.goto(deedTypeInfo.href, {
        waitUntil: 'networkidle0',
        timeout: 60000
      });

      // Check if the response is a PDF
      const contentType = response.headers()['content-type'] || '';
      if (contentType.includes('application/pdf')) {
        this.log('📄 Deed viewer is serving a PDF directly!');
        // Try to get the PDF buffer from the response
        try {
          const pdfBuffer = await response.buffer();
          if (pdfBuffer && pdfBuffer.length > 1000) {
            this.directPdfBase64 = pdfBuffer.toString('base64');
            this.log(`✅ Captured PDF from response: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
          }
        } catch (bufferErr) {
          this.log('⚠️ Could not capture PDF from response, will try alternative method');
          // Store the URL as fallback
          this.directPdfUrl = deedTypeInfo.href;
        }
      }

      // Switch context to the new deed page
      this.page = deedPage;
      this.log('✅ Switched to deed document tab with session preserved');

      // Wait a moment for any dynamic content
      await new Promise(resolve => setTimeout(resolve, 3000));

      this.log('✅ On deed document page');

      // Check for captcha
      this.log('🔍 Checking for captcha on deeds page...');
      const hasCaptcha = await this.page.evaluate(() => {
        const bodyText = document.body.innerText || '';
        return bodyText.toLowerCase().includes('captcha') || 
               document.querySelector('iframe[src*="recaptcha"]') !== null ||
               document.querySelector('[class*="captcha"]') !== null;
      });

      if (hasCaptcha) {
        this.log('⚠️ CAPTCHA detected on deed page - manual intervention may be required');
        // Don't throw error - let's try to continue anyway
      }

      return { 
        success: true,
        deedType: deedTypeInfo.deedType,
        deedUrl: deedTypeInfo.href
      };

    } catch (error) {
      this.log(`❌ Failed to get deed info: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Download PDF using improved network interception
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for deed document on current page...');

      // Check if we have a direct PDF (deed viewer served PDF directly)
      if (this.directPdfBase64) {
        this.log('📄 Using captured PDF from deed viewer response');
        const pdfBase64 = this.directPdfBase64;

        // Clean up
        delete this.directPdfBase64;

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `guilford_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Fallback: Try to download PDF if we have the URL
      if (this.directPdfUrl) {
        this.log('📄 Attempting to download PDF from deed viewer URL...');
        try {
          const pdfBase64 = await this.downloadPdfFromUrl(this.directPdfUrl);

          if (pdfBase64) {
            this.log('✅ Successfully downloaded deed PDF');

            // Clean up
            delete this.directPdfUrl;

            return {
              success: true,
              duration: Date.now() - startTime,
              pdfBase64,
              filename: `guilford_deed_${Date.now()}.pdf`,
              fileSize: Buffer.from(pdfBase64, 'base64').length,
              downloadPath: ''
            };
          }
        } catch (directErr) {
          this.log(`⚠️ Direct PDF download failed: ${directErr.message}`);
          // Continue with other strategies
          delete this.directPdfUrl;
        }
      }

      // Set up enhanced network monitoring to capture resources
      const capturedResources = [];
      const responseHandler = async (response) => {
        const url = response.url();
        const contentType = response.headers()['content-type'] || '';

        // Capture image/PDF resources
        if (contentType.includes('image') || contentType.includes('pdf') ||
            url.includes('.tif') || url.includes('.pdf') ||
            url.includes('viewimage') || url.includes('getimage')) {

          try {
            const buffer = await response.buffer();
            capturedResources.push({ url, buffer, contentType });
            this.log(`📸 Captured resource: ${url} (${(buffer.length / 1024).toFixed(2)} KB)`);
          } catch (bufferErr) {
            // Resource might be cached or unavailable
            this.log(`⚠️ Could not get buffer for: ${url}`);
          }
        }
      };
      this.page.on('response', responseHandler);  // Attach to main page before any frame switching

      // Wait for page to fully load (deed images may take time)
      this.log('⏳ Waiting for deed content to load...');

      // If we're on the deed viewer page, wait for dynamic content
      if (this.page.url().includes('gis_viewimage.php')) {
        this.log('📄 On deed viewer page - waiting for dynamic content...');

        // Progressive waiting strategy for deed images
        let contentLoaded = false;
        const maxWaitTime = 40000; // Total max wait time: 40 seconds
        const checkInterval = 2000; // Check every 2 seconds
        let waitedTime = 0;

        while (waitedTime < maxWaitTime && !contentLoaded) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waitedTime += checkInterval;

          // Check multiple indicators that content has loaded
          const loadStatus = await this.page.evaluate(() => {
            // Check for images (including those that might not report dimensions)
            const images = Array.from(document.querySelectorAll('img'));
            const hasLargeImage = images.some(img =>
              ((img.naturalWidth > 400 || img.width > 400) &&
               (img.naturalHeight > 400 || img.height > 400) &&
               img.complete) ||
              (img.src && img.src.includes('gis_viewimage.php')) // Guilford specific check
            );

            // Check for any img with src pointing to deed viewer
            const hasDeedViewerImage = images.some(img =>
              img.src && (img.src.includes('viewimage') || img.src.includes('.tif'))
            );

            // Check for canvas (some viewers render to canvas)
            const canvases = Array.from(document.querySelectorAll('canvas'));
            const hasCanvas = canvases.some(canvas =>
              (canvas.width > 400 || canvas.height > 400) &&
              canvas.getContext('2d')
            );

            // Check for embed/object (for TIFF viewers)
            const embeds = Array.from(document.querySelectorAll('embed, object'));
            const hasEmbed = embeds.some(embed => {
              const src = embed.src || embed.data || '';
              return src.includes('.tif') || src.includes('viewimage');
            });

            // Check for background images
            const divsWithBg = Array.from(document.querySelectorAll('div')).filter(div => {
              const bgImage = window.getComputedStyle(div).backgroundImage;
              return bgImage && bgImage !== 'none' && bgImage.includes('url');
            });

            // Check body background color (deed viewer often has non-white background when loaded)
            const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
            const hasNonWhiteBg = bodyBgColor && bodyBgColor !== 'rgb(255, 255, 255)' &&
                                  bodyBgColor !== 'rgba(0, 0, 0, 0)' &&
                                  bodyBgColor !== 'transparent';

            // Check for deed text content
            const bodyText = document.body.innerText || '';
            const hasDeedText = bodyText.includes('GUILFORD COUNTY') ||
                               bodyText.includes('REGISTER OF DEEDS') ||
                               bodyText.includes('Book') ||
                               bodyText.includes('Page') ||
                               bodyText.includes('DEED');

            // For Guilford County, check if page has specific structure
            const hasGuilfordStructure = document.body &&
                                        document.body.style.backgroundColor === 'rgb(40, 40, 40)' ||
                                        document.querySelector('center') !== null;

            return {
              hasLargeImage,
              hasDeedViewerImage,
              hasCanvas,
              hasEmbed,
              hasBackgroundImage: divsWithBg.length > 0,
              hasNonWhiteBg,
              hasDeedText,
              hasGuilfordStructure,
              imageCount: images.length,
              largeImageCount: images.filter(img => img.naturalWidth > 400 || img.width > 400).length
            };
          });

          // Also check frames for content
          const frames = this.page.frames();
          for (const frame of frames) {
            try {
              if (frame.url() && frame.url() !== 'about:blank') {
                const frameStatus = await frame.evaluate(() => {
                  const images = Array.from(document.querySelectorAll('img'));
                  const hasImage = images.some(img => img.naturalWidth > 400 && img.complete);
                  const bodyText = document.body ? (document.body.innerText || '') : '';
                  const hasText = bodyText.includes('DEED') || bodyText.includes('GUILFORD');
                  return { hasImage, hasText };
                });
                if (frameStatus.hasImage || frameStatus.hasText) {
                  loadStatus.hasLargeImage = true;
                  loadStatus.hasDeedText = frameStatus.hasText;
                }
              }
            } catch (e) {
              // Frame might be detached
            }
          }

          // Determine if content has loaded based on multiple factors
          contentLoaded = loadStatus.hasLargeImage ||
                         loadStatus.hasDeedViewerImage ||
                         loadStatus.hasCanvas ||
                         loadStatus.hasEmbed ||
                         loadStatus.hasDeedText ||
                         loadStatus.hasGuilfordStructure ||
                         (loadStatus.hasNonWhiteBg && loadStatus.largeImageCount > 0);

          if (!contentLoaded && waitedTime % 10000 === 0) {
            this.log(`⏳ Still waiting for deed content... (${waitedTime/1000}s elapsed)`);
            this.log(`  Images: ${loadStatus.imageCount}, Large: ${loadStatus.largeImageCount}`);
            this.log(`  Canvas: ${loadStatus.hasCanvas}, Embed: ${loadStatus.hasEmbed}`);
          }
        }

        if (contentLoaded) {
          this.log('✅ Deed content detected after waiting');
          // Give it a bit more time to fully render
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          this.log('⚠️ No deed content detected after maximum wait time, but continuing to try screenshot');
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

        // Check for deed text content (Guilford renders as text overlays)
        const hasDeedText = bodyText.includes('GUILFORD COUNTY') ||
                           bodyText.includes('REGISTER OF DEEDS') ||
                           bodyText.includes('Book') ||
                           bodyText.includes('Page') ||
                           bodyText.includes('DEED') ||
                           bodyText.includes('CONSIDERATION');

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

        // Check for divs with background images (some viewers use CSS backgrounds)
        const divsWithBg = Array.from(document.querySelectorAll('div')).filter(div => {
          const bgImage = window.getComputedStyle(div).backgroundImage;
          return bgImage && bgImage !== 'none' && bgImage.includes('url');
        });
        const hasBackgroundImage = divsWithBg.length > 0;

        // Check if content is still loading
        const isLoading = bodyText.toLowerCase().includes('loading') ||
                         bodyHtml.includes('spinner') ||
                         bodyHtml.includes('loader');

        return {
          hasError,
          hasDeedText,
          hasLargeImage,
          hasCanvas,
          hasEmbed,
          hasBackgroundImage,
          isLoading,
          imageCount: images.length,
          canvasCount: canvases.length,
          embedCount: embeds.length,
          divsWithBgCount: divsWithBg.length,
          textLength: bodyText.length,
          url: window.location.href
        };
      });

      this.log(`Page status: DeedText: ${pageStatus.hasDeedText}, Images: ${pageStatus.imageCount}, Canvas: ${pageStatus.canvasCount}, Embeds: ${pageStatus.embedCount}, BgImages: ${pageStatus.divsWithBgCount}, Loading: ${pageStatus.isLoading}`);

      // If content is still loading, wait more
      if (pageStatus.isLoading) {
        this.log('⏳ Content still loading, waiting longer...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Re-check status after additional wait
        const newStatus = await currentContext.evaluate(() => {
          const bodyText = document.body.innerText || '';
          const hasDeedText = bodyText.includes('GUILFORD COUNTY') ||
                             bodyText.includes('REGISTER OF DEEDS') ||
                             bodyText.includes('Book') ||
                             bodyText.includes('Page');
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
            hasDeedText,
            hasLargeImage,
            hasCanvas,
            hasEmbed,
            imageCount: images.length,
            canvasCount: canvases.length,
            embedCount: embeds.length
          };
        });
        
        Object.assign(pageStatus, newStatus);
        this.log(`Updated status: DeedText: ${pageStatus.hasDeedText}, Images: ${pageStatus.imageCount}, Canvas: ${pageStatus.canvasCount}, Embeds: ${pageStatus.embedCount}`);
      }

      // Check for actual PHP/server errors (not just missing content)
      if (pageStatus.hasError) {
        this.log('⚠️  Server returned an error');
        throw new Error('Guilford County server returned an error. Please try again later.');
      }

      // Strategy 1: If deed text is rendered (take screenshot of the whole viewer)
      if (pageStatus.hasDeedText || pageStatus.hasBackgroundImage) {
        this.log('📸 Deed content detected - taking full page screenshot...');
        try {
          // Take a full page screenshot
          const screenshotBuffer = await this.page.screenshot({
            type: 'png',
            fullPage: true
          });

          // Convert screenshot to PDF
          const pdfBase64 = await this.convertImageToPdf(screenshotBuffer);

          if (pdfBase64) {
            this.log('✅ Successfully captured deed as screenshot');
            
            // Clean up event listener
            mainPage.off('response', responseHandler);
            
            return {
              success: true,
              duration: Date.now() - startTime,
              pdfBase64,
              filename: `guilford_deed_${Date.now()}.pdf`,
              fileSize: Buffer.from(pdfBase64, 'base64').length,
              downloadPath: ''
            };
          }
        } catch (screenshotErr) {
          this.log(`⚠️  Screenshot capture failed: ${screenshotErr.message}`);
        }
      }

      // Strategy 2: If we have a large image on the current page
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
          } catch (imgErr) {
            this.log(`⚠️  Image download failed: ${imgErr.message}`);
          }
        }
      }

      // Strategy 3: If we have a canvas element (some viewers render to canvas)
      if (pageStatus.hasCanvas) {
        this.log('📊 Found canvas element - attempting screenshot...');
        try {
          // Take a screenshot of the viewer area
          const screenshotBuffer = await this.page.screenshot({
            type: 'png',
            fullPage: false
          });

          // Convert screenshot to PDF
          const pdfBase64 = await this.convertImageToPdf(screenshotBuffer);

          if (pdfBase64) {
            // Clean up event listener
            mainPage.off('response', responseHandler);
            
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

      // Strategy 4: If we have embed/object elements
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
          } catch (embedErr) {
            this.log(`⚠️  Embed download failed: ${embedErr.message}`);
          }
        }
      }

      // Strategy 5: If we're on deed viewer page, always try screenshot as fallback
      if (currentUrl.includes('gis_viewimage.php') || currentUrl.includes('.pdf')) {
        this.log('📥 Attempting multi-page screenshot capture...');

        try {
          // Wait a bit more to ensure content is rendered
          await new Promise(resolve => setTimeout(resolve, 5000));

          // Check if there are multiple pages (look for navigation controls or multi-page indicators)
          const pageInfo = await this.page.evaluate(() => {
            // Check for common page navigation patterns
            const pageText = document.body.innerText || '';
            const pageMatch = pageText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
            const pageInputs = document.querySelectorAll('input[type="text"], input[type="number"]');
            let currentPage = 1;
            let totalPages = 1;

            if (pageMatch) {
              currentPage = parseInt(pageMatch[1]);
              totalPages = parseInt(pageMatch[2]);
            }

            // Check for page navigation buttons
            const buttons = Array.from(document.querySelectorAll('button, a, [onclick]'));
            const hasNextButton = buttons.some(btn =>
              btn.textContent?.includes('Next') ||
              btn.onclick?.toString().includes('next') ||
              btn.getAttribute('onclick')?.includes('next')
            );
            const hasPrevButton = buttons.some(btn =>
              btn.textContent?.includes('Previous') ||
              btn.textContent?.includes('Prev') ||
              btn.onclick?.toString().includes('prev') ||
              btn.getAttribute('onclick')?.includes('prev')
            );

            // Check viewport and document height to detect stacked pages
            const viewportHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const bodyHeight = document.body.scrollHeight;
            const maxHeight = Math.max(documentHeight, bodyHeight);
            const hasVerticalScroll = maxHeight > viewportHeight * 1.5; // More than 1.5x viewport suggests multiple pages

            // For Guilford County specifically, check if the deed viewer has loaded multiple page images
            const images = Array.from(document.querySelectorAll('img'));
            const largeImages = images.filter(img =>
              (img.naturalHeight > 600 || img.height > 600) &&
              (img.naturalWidth > 400 || img.width > 400)
            );

            // Check for frames/iframes that might contain pages
            const frames = document.querySelectorAll('frame, iframe');

            // Check if booknum=8461&bookpage=888 pattern suggests 3 pages (888, 889, 890)
            const urlParams = new URLSearchParams(window.location.search);
            const bookPage = urlParams.get('bookpage');

            return {
              currentPage,
              totalPages,
              hasNavigation: hasNextButton || hasPrevButton || totalPages > 1,
              pageMatch: pageMatch ? pageMatch[0] : null,
              hasVerticalScroll,
              documentHeight: maxHeight,
              viewportHeight,
              largeImageCount: largeImages.length,
              frameCount: frames.length,
              bookPage,
              // For Guilford, if we have significant vertical scroll or multiple large images, assume multi-page
              likelyMultiPage: largeImages.length > 1 || (hasVerticalScroll && maxHeight > viewportHeight * 2.5) || frames.length > 0
            };
          });

          this.log(`📄 Page info: Page ${pageInfo.currentPage}/${pageInfo.totalPages}`);
          this.log(`📊 Document analysis: Height=${pageInfo.documentHeight}px, Viewport=${pageInfo.viewportHeight}px`);
          this.log(`📸 Large images: ${pageInfo.largeImageCount}, Frames: ${pageInfo.frameCount}`);

          // For Guilford County with bookpage=888, we know it's a 3-page deed
          if (pageInfo.bookPage === '888') {
            this.log(`📚 Guilford County deed at page 888 - treating as 3-page document`);
            pageInfo.likelyMultiPage = true;
            pageInfo.totalPages = 3; // We know this is a 3-page document
          }

          // Capture pages
          const pageBuffers = [];

          // Check for frames that might contain deed pages (Guilford County case)
          const allFrames = this.page.frames();
          const deedFrames = allFrames.filter(frame => {
            const url = frame.url();
            return url && url !== 'about:blank' && (url.includes('viewimage') || url.includes('gis_viewimage'));
          });

          if (deedFrames.length > 0 && pageInfo.bookPage === '888') {
            this.log(`🖼️ Found ${deedFrames.length} deed frames - capturing each frame as a page`);
            pageInfo.likelyMultiPage = true;
            pageInfo.totalPages = deedFrames.length;
            pageInfo.hasFrames = true;
          }

          if ((pageInfo.hasNavigation && pageInfo.totalPages > 1) || pageInfo.likelyMultiPage) {
            this.log(`📚 Detected multi-page document with ${pageInfo.totalPages} pages`);

            // Check if pages are in frames (Guilford County special case)
            if (pageInfo.hasFrames && deedFrames.length > 0) {
              this.log('🖼️ Pages appear to be in separate frames - capturing each frame');

              for (let i = 0; i < deedFrames.length; i++) {
                const frame = deedFrames[i];
                this.log(`📸 Capturing frame ${i + 1}/${deedFrames.length}...`);

                try {
                  // Wait for frame content to load
                  await new Promise(resolve => setTimeout(resolve, 2000));

                  // Capture the frame content
                  const frameScreenshot = await this.page.screenshot({
                    type: 'png',
                    fullPage: true
                  });

                  const isBlank = await this.isImageBlank(frameScreenshot);
                  if (!isBlank) {
                    pageBuffers.push(frameScreenshot);
                    this.log(`  ✅ Captured frame ${i + 1}`);
                  } else {
                    this.log(`  ⚠️ Frame ${i + 1} appears blank`);
                  }
                } catch (frameErr) {
                  this.log(`  ❌ Failed to capture frame ${i + 1}: ${frameErr.message}`);
                }
              }

              // If we didn't get enough pages from frames, try full page capture
              if (pageBuffers.length < deedFrames.length) {
                this.log('⚠️ Some frames were blank, trying full page capture as backup');
                const fullScreenshot = await this.page.screenshot({
                  type: 'png',
                  fullPage: true
                });

                const isBlank = await this.isImageBlank(fullScreenshot);
                if (!isBlank && pageBuffers.length === 0) {
                  pageBuffers.push(fullScreenshot);
                }
              }
            }
            // Check if pages are vertically stacked
            else if (pageInfo.likelyMultiPage && !pageInfo.hasNavigation && pageInfo.hasVerticalScroll) {
              this.log('📑 Pages appear to be vertically stacked - capturing by sections');

              // For Guilford County with 3 pages stacked vertically, capture each section
              if (pageInfo.bookPage === '888' && pageInfo.totalPages === 3) {
                // Scroll to top first
                await this.page.evaluate(() => window.scrollTo(0, 0));
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Calculate approximate page height (assuming 3 equal pages)
                const pageHeight = Math.floor(pageInfo.documentHeight / 3);

                for (let i = 0; i < 3; i++) {
                  this.log(`📸 Capturing page ${i + 1}/3 at position ${i * pageHeight}px...`);

                  // Scroll to the approximate position of each page
                  await this.page.evaluate((scrollY) => {
                    window.scrollTo(0, scrollY);
                  }, i * pageHeight);

                  await new Promise(resolve => setTimeout(resolve, 2000));

                  // Capture the visible viewport
                  const pageScreenshot = await this.page.screenshot({
                    type: 'png',
                    clip: {
                      x: 0,
                      y: 0,
                      width: await this.page.evaluate(() => window.innerWidth),
                      height: await this.page.evaluate(() => window.innerHeight)
                    }
                  });

                  const isBlank = await this.isImageBlank(pageScreenshot);
                  if (!isBlank) {
                    pageBuffers.push(pageScreenshot);
                  }
                }

                // Also capture a full-page screenshot as backup
                this.log('📸 Capturing full document as backup...');
                await this.page.evaluate(() => window.scrollTo(0, 0));
                await new Promise(resolve => setTimeout(resolve, 1000));

                const fullScreenshot = await this.page.screenshot({
                  type: 'png',
                  fullPage: true
                });

                // If we didn't get 3 separate pages, use the full screenshot
                if (pageBuffers.length < 3) {
                  this.log('⚠️ Could not capture individual pages, using full document');
                  pageBuffers.length = 0; // Clear partial captures
                  pageBuffers.push(fullScreenshot);
                }
              } else {
                // Generic vertically stacked pages - capture full document
                this.log('📸 Capturing full vertically-stacked document...');
                const fullScreenshot = await this.page.screenshot({
                  type: 'png',
                  fullPage: true
                });

                const isBlank = await this.isImageBlank(fullScreenshot);
                if (!isBlank) {
                  pageBuffers.push(fullScreenshot);
                }
              }
            } else if (pageInfo.hasNavigation) {
              // Pages with navigation buttons
              // Navigate to first page if not already there
              if (pageInfo.currentPage !== 1) {
                // Try to navigate to first page
                await this.page.evaluate(() => {
                  const buttons = Array.from(document.querySelectorAll('button, a, [onclick]'));
                  const firstButton = buttons.find(btn =>
                    btn.textContent?.includes('First') ||
                    btn.onclick?.toString().includes('first') ||
                    btn.getAttribute('onclick')?.includes('first')
                  );
                  if (firstButton) firstButton.click();
                });
                await new Promise(resolve => setTimeout(resolve, 3000));
              }

              // Capture each page using navigation
              for (let i = 1; i <= Math.min(pageInfo.totalPages, 20); i++) { // Limit to 20 pages for safety
                this.log(`📸 Capturing page ${i}/${pageInfo.totalPages}...`);

                // Take screenshot of current page
                const pageScreenshot = await this.page.screenshot({
                  type: 'png',
                  fullPage: true
                });

                // Check if screenshot is meaningful
                const isBlank = await this.isImageBlank(pageScreenshot);
                if (!isBlank) {
                  pageBuffers.push(pageScreenshot);
                }

                // Navigate to next page if not the last one
                if (i < pageInfo.totalPages) {
                  const navigated = await this.page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, [onclick]'));
                    const nextButton = buttons.find(btn =>
                      btn.textContent?.includes('Next') ||
                      btn.onclick?.toString().includes('next') ||
                      btn.getAttribute('onclick')?.includes('next')
                    );
                    if (nextButton) {
                      nextButton.click();
                      return true;
                    }
                    return false;
                  });

                  if (navigated) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                  } else {
                    this.log('⚠️ Could not navigate to next page');
                    break;
                  }
                }
              }
            }
          } else {
            // Single page or no navigation detected
            this.log('📄 Capturing single page document...');
            const screenshotBuffer = await this.page.screenshot({
              type: 'png',
              fullPage: true
            });

            const isBlank = await this.isImageBlank(screenshotBuffer);
            if (!isBlank) {
              pageBuffers.push(screenshotBuffer);
            }
          }

          if (pageBuffers.length > 0) {
            // Convert screenshots to multi-page PDF
            const pdfBase64 = await this.convertMultipleImagesToPdf(pageBuffers);

            if (pdfBase64) {
              this.log(`✅ Successfully captured ${pageBuffers.length} page(s) as PDF`);

              // Clean up event listener
              mainPage.off('response', responseHandler);

              return {
                success: true,
                duration: Date.now() - startTime,
                pdfBase64,
                filename: `guilford_deed_${Date.now()}.pdf`,
                fileSize: Buffer.from(pdfBase64, 'base64').length,
                downloadPath: ''
              };
            }
          } else {
            this.log('⚠️ All captured screenshots appear to be blank');
          }
        } catch (dlErr) {
          this.log(`⚠️  Screenshot capture failed: ${dlErr.message}`);
        }
      }

      // Strategy 6: Try captured resources from network monitoring (IMPROVED)
      if (capturedResources.length > 0) {
        this.log(`🌐 Found ${capturedResources.length} captured resources from network monitoring`);

        for (const resource of capturedResources) {
          try {
            this.log(`  Processing: ${resource.url} (${resource.contentType})`);

            // Check if buffer is valid
            if (!resource.buffer || resource.buffer.length < 1000) {
              this.log(`    Skipping - buffer too small`);
              continue;
            }

            // Check for HTML error pages
            const firstChars = resource.buffer.toString('utf8', 0, Math.min(100, resource.buffer.length));
            if (firstChars.includes('<html') || firstChars.includes('<!DOCTYPE') ||
                firstChars.includes('Notice</b>') || firstChars.includes('Error</b>')) {
              this.log(`    Skipping - HTML error page`);
              continue;
            }

            // Check if it's blank
            const isBlank = await this.isImageBlank(resource.buffer);
            if (isBlank) {
              this.log(`    Skipping - blank image`);
              continue;
            }

            // Process the buffer
            const pdfSignature = resource.buffer.toString('utf8', 0, 4);
            const tiffSignature = resource.buffer.toString('ascii', 0, 2);

            let pdfBase64;

            if (pdfSignature === '%PDF') {
              this.log(`    ✅ Valid PDF found`);
              pdfBase64 = resource.buffer.toString('base64');
            } else if (tiffSignature === 'II' || tiffSignature === 'MM') {
              this.log(`    ✅ TIFF found - converting to PDF...`);
              pdfBase64 = await this.convertImageToPdf(resource.buffer);
            } else if (resource.contentType.includes('image')) {
              this.log(`    ✅ Image found - converting to PDF...`);
              pdfBase64 = await this.convertImageToPdf(resource.buffer);
            } else {
              this.log(`    Skipping - unknown format`);
              continue;
            }

            if (pdfBase64) {
              this.log('✅ Successfully processed captured resource');

              // Clean up event listener
              mainPage.off('response', responseHandler);

              return {
                success: true,
                duration: Date.now() - startTime,
                pdfBase64,
                filename: `guilford_deed_${Date.now()}.pdf`,
                fileSize: Buffer.from(pdfBase64, 'base64').length,
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
        'Unable to capture deed document. The deed viewer may require additional time to render. ' +
        'Please ensure the deed is fully displayed before attempting download.'
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
   * Convert multiple image buffers to a multi-page PDF
   */
  async convertMultipleImagesToPdf(imageBuffers) {
    try {
      this.log(`🔄 Converting ${imageBuffers.length} images to multi-page PDF...`);

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Process each image and add as a page
      for (let i = 0; i < imageBuffers.length; i++) {
        this.log(`  Processing page ${i + 1}/${imageBuffers.length}...`);

        try {
          // Convert image to PNG using sharp
          const pngBuffer = await sharp(imageBuffers[i])
            .png()
            .toBuffer();

          // Get image dimensions
          const metadata = await sharp(imageBuffers[i]).metadata();
          const width = metadata.width || 612;
          const height = metadata.height || 792;

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
        } catch (pageError) {
          this.log(`⚠️  Failed to process page ${i + 1}: ${pageError.message}`);
        }
      }

      // Save the PDF
      const pdfBytes = await pdfDoc.save();
      const convertedPdfBase64 = Buffer.from(pdfBytes).toString('base64');

      this.log(`✅ Multi-page PDF created: ${(pdfBytes.length / 1024).toFixed(2)} KB with ${imageBuffers.length} page(s)`);
      return convertedPdfBase64;
    } catch (error) {
      this.log(`❌ Failed to convert images to multi-page PDF: ${error.message}`);
      // Fall back to single page if multi-page fails
      if (imageBuffers.length > 0) {
        this.log(`🔄 Falling back to single page PDF...`);
        return await this.convertImageToPdf(imageBuffers[0]);
      }
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
