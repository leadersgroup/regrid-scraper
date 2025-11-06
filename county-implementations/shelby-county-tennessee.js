/**
 * Shelby County, Tennessee (Memphis) - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Assessor: https://www.assessormelvinburgess.com/propertySearch
 * - Register of Deeds: https://search.register.shelby.tn.us/search/
 *
 * Workflow:
 * 1. Search Property Assessor by street number and street name
 * 2. View matching property details
 * 3. Navigate to Sales History
 * 4. Extract deed number from first sales entry
 * 5. Navigate to Register of Deeds search
 * 6. Download deed PDF
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class ShelbyCountyTennesseeScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Shelby';
    this.state = 'TN';
    this.debugLogs = []; // Collect debug logs for API response
  }

  /**
   * Override log method
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
      'Upgrade-Insecure-Requests': '1'
    });

    this.log('✅ Browser initialized with stealth mode');
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Shelby County can search Property Assessor directly by address
   */
  async getPriorDeed(address) {
    this.log(`🏁 Starting prior deed download for: ${address}`);
    this.currentAddress = address;

    const startTime = Date.now();
    const result = {
      success: false,
      address,
      county: this.county,
      state: this.state,
      timestamp: new Date().toISOString()
    };

    try {
      // Ensure browser is initialized
      if (!this.browser) {
        await this.initialize();
      }

      // Step 1: Search Property Assessor by address
      this.log('📋 Step 1: Searching Property Assessor...');
      const searchResult = await this.searchAssessorByAddress(address);

      if (!searchResult.success) {
        result.error = searchResult.error || 'Could not find property on assessor website';
        result.message = searchResult.message || 'Property search failed';
        return result;
      }

      // Step 2: Click Sales History and find deed number link
      this.log('📄 Step 2: Clicking Sales History and finding deed number link...');
      const deedInfo = await this.clickSalesHistoryAndFindDeedLink();

      if (!deedInfo.success) {
        result.error = deedInfo.error || 'Could not find deed link';
        result.message = deedInfo.message || 'No deed number link found in sales history';
        return result;
      }

      // Step 3: Navigate to Register of Deeds and download PDF
      this.log('📥 Step 3: Downloading PDF from Register of Deeds...');
      const download = await this.downloadDeedFromRegister(deedInfo);

      if (download.success) {
        result.success = true;
        result.download = download;
        result.deedNumber = deedInfo.deedNumber;
        result.deedLink = deedInfo.deedLink;
        result.message = 'Deed downloaded successfully';
      } else {
        result.error = download.error || 'Download failed';
        result.message = download.message || 'Could not download deed';
      }

      const endTime = Date.now();
      result.duration = `${((endTime - startTime) / 1000).toFixed(2)}s`;

      return result;

    } catch (error) {
      this.log(`❌ Error: ${error.message}`);
      result.error = error.message;
      result.message = 'Unexpected error occurred';
      return result;
    }
  }

  /**
   * Parse address into street number and street name
   * Example: "809 Harbor Isle Cir W, Memphis, TN 38103, USA"
   * Returns: { number: "809", street: "harbor isle" }
   */
  parseAddress(address) {
    // Remove city, state, zip (everything after first comma)
    const streetPart = address.split(',')[0].trim();

    // Split into words
    const parts = streetPart.split(/\s+/);

    // First word should be the street number
    const number = parts[0];

    // Rest is street name (join and lowercase, remove common suffixes for search)
    const street = parts.slice(1)
      .join(' ')
      .toLowerCase()
      .replace(/\s+(cir|circle|st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|ct|court|way|pl|place|pkwy|parkway)\.?(\s+[nesw])?$/i, '')
      .trim();

    return { number, street };
  }

  /**
   * Search Property Assessor by address
   * Workflow:
   * 1. Navigate to https://www.assessormelvinburgess.com/propertySearch
   * 2. Find 'street number' and 'street name' boxes
   * 3. Enter street number and street name
   * 4. Click 'submit' button
   * 5. Wait for search results
   * 6. If 1 result: click 'view'. If multiple: match address and click 'view' on best match
   */
  async searchAssessorByAddress(address) {
    this.log(`🔍 Searching Shelby County Property Assessor for: ${address}`);

    try {
      const targetUrl = 'https://www.assessormelvinburgess.com/propertySearch';

      this.log(`🌐 Navigating to: ${targetUrl}`);
      await this.page.goto(targetUrl, {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      this.log(`✅ Page loaded`);
      await this.randomWait(3000, 5000);

      // Parse address into number and street name
      const { number, street } = this.parseAddress(this.currentAddress);
      this.log(`📍 Parsed address - Number: ${number}, Street: ${street}`);

      // Step 1: Find and fill street number field
      this.log(`🔍 Step 1: Looking for street number field...`);

      const numberEntered = await this.page.evaluate((num) => {
        // Look for input labeled "street number" or similar
        const labels = Array.from(document.querySelectorAll('label'));
        const numberLabel = labels.find(l =>
          l.textContent.toLowerCase().includes('street number') ||
          l.textContent.toLowerCase().includes('number')
        );

        let numberInput = null;

        if (numberLabel && numberLabel.htmlFor) {
          numberInput = document.getElementById(numberLabel.htmlFor);
        }

        // Fallback: look for input by name/id
        if (!numberInput) {
          numberInput = document.querySelector('input[name*="number"]') ||
                       document.querySelector('input[id*="number"]') ||
                       document.querySelector('input[placeholder*="number"]');
        }

        if (!numberInput) {
          return { success: false, error: 'No street number input found' };
        }

        numberInput.value = num;
        numberInput.dispatchEvent(new Event('input', { bubbles: true }));
        numberInput.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true };
      }, number);

      if (!numberEntered.success) {
        this.log(`❌ Could not enter street number: ${numberEntered.error}`);
        return {
          success: false,
          error: 'Could not enter street number'
        };
      }

      this.log(`✅ Entered street number: ${number}`);
      await this.randomWait(1000, 1500);

      // Step 2: Find and fill street name field
      this.log(`🔍 Step 2: Looking for street name field...`);

      const streetEntered = await this.page.evaluate((streetName) => {
        // Look for input labeled "street name" or similar
        const labels = Array.from(document.querySelectorAll('label'));
        const streetLabel = labels.find(l =>
          l.textContent.toLowerCase().includes('street name') ||
          (l.textContent.toLowerCase().includes('name') &&
           !l.textContent.toLowerCase().includes('owner'))
        );

        let streetInput = null;

        if (streetLabel && streetLabel.htmlFor) {
          streetInput = document.getElementById(streetLabel.htmlFor);
        }

        // Fallback: look for input by name/id
        if (!streetInput) {
          streetInput = document.querySelector('input[name*="street"]') ||
                       document.querySelector('input[id*="street"]') ||
                       document.querySelector('input[placeholder*="street"]');
        }

        if (!streetInput) {
          return { success: false, error: 'No street name input found' };
        }

        streetInput.value = streetName;
        streetInput.dispatchEvent(new Event('input', { bubbles: true }));
        streetInput.dispatchEvent(new Event('change', { bubbles: true }));

        return { success: true };
      }, street);

      if (!streetEntered.success) {
        this.log(`❌ Could not enter street name: ${streetEntered.error}`);
        return {
          success: false,
          error: 'Could not enter street name'
        };
      }

      this.log(`✅ Entered street name: ${street}`);
      await this.randomWait(1000, 2000);

      // Step 3: Submit the form
      this.log(`🔍 Step 3: Submitting search form...`);

      const formSubmitted = await this.page.evaluate(() => {
        // Look for submit button
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase().trim();
          if (text.includes('submit') || text.includes('search')) {
            btn.click();
            return { success: true, method: 'button.click()' };
          }
        }

        // Fallback: try to submit the form directly
        const forms = document.querySelectorAll('form');
        if (forms.length > 0) {
          forms[0].submit();
          return { success: true, method: 'form.submit()' };
        }

        return { success: false, error: 'No submit button or form found' };
      });

      if (formSubmitted.success) {
        this.log(`✅ Form submitted: ${formSubmitted.method}`);
      } else {
        this.log(`⚠️  Could not submit form: ${formSubmitted.error}`);
        this.log(`   Trying Enter key as fallback...`);
        await this.page.keyboard.press('Enter');
      }

      // Wait for search results
      this.log(`⏳ Waiting for search results...`);
      await this.randomWait(5000, 7000);

      // Step 4: Check number of results and click appropriate "view" button
      this.log(`🔍 Step 4: Analyzing search results...`);

      const viewInfo = await this.page.evaluate((originalAddress) => {
        // Remove city, state, zip from original for comparison
        const addressForMatch = originalAddress.split(',')[0].trim().toLowerCase();

        // Find all "view" buttons or links, but exclude ones that contain "review" or "assessor"
        const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        const viewButtons = allElements.filter(el => {
          const text = (el.textContent || el.value || '').toLowerCase().trim();
          const isView = text === 'view' || (text.includes('view') && !text.includes('review') && !text.includes('assessor'));
          return isView;
        });

        console.log(`Found ${viewButtons.length} view buttons`);

        if (viewButtons.length === 0) {
          return { found: false, error: 'No view buttons found' };
        }

        if (viewButtons.length === 1) {
          // Only one result
          return { found: true, reason: 'single_result', index: 0 };
        }

        // Multiple results - need to match address
        console.log('Multiple results found, attempting to match address');

        // Look for property location text near each view button
        for (let i = 0; i < viewButtons.length; i++) {
          const btn = viewButtons[i];
          // Get parent row/container
          let container = btn.closest('tr') || btn.closest('div') || btn.parentElement;

          if (container) {
            const containerText = container.textContent.toLowerCase();
            console.log(`Container text: ${containerText.substring(0, 100)}`);

            // Check if this container's address matches our target
            if (containerText.includes(addressForMatch)) {
              console.log(`Found matching address`);
              return { found: true, reason: 'matched_address', index: i, matched: containerText.substring(0, 100) };
            }
          }
        }

        // If no exact match, use the first one
        console.log('No exact match, using first result');
        return { found: true, reason: 'first_result', index: 0, warning: 'No exact address match' };

      }, this.currentAddress);

      if (!viewInfo.found) {
        this.log(`❌ Could not find view button: ${viewInfo.error}`);
        return {
          success: false,
          error: 'No view button found in search results'
        };
      }

      this.log(`✅ Found view button (${viewInfo.reason})`);
      if (viewInfo.warning) {
        this.log(`⚠️  ${viewInfo.warning}`);
      }

      // Click view button and wait for navigation
      this.log(`🖱️  Clicking view button...`);
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: this.timeout }),
        this.page.evaluate((index) => {
          const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
          const viewButtons = allElements.filter(el => {
            const text = (el.textContent || el.value || '').toLowerCase().trim();
            const isView = text === 'view' || (text.includes('view') && !text.includes('review') && !text.includes('assessor'));
            return isView;
          });
          if (viewButtons[index]) {
            viewButtons[index].click();
          }
        }, viewInfo.index)
      ]);

      await this.randomWait(2000, 3000);
      this.log(`✅ Successfully navigated to property details`);

      return {
        success: true,
        message: 'Property found and navigated to details page'
      };

    } catch (error) {
      this.log(`❌ Search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Click on Sales History and find PDF link
   * Workflow:
   * 1. Click on "Sales History" tab/section
   * 2. Find and click PDF link directly (don't extract deed number first)
   */
  async clickSalesHistoryAndFindDeedLink() {
    this.log('📋 Clicking Sales History and finding deed number link...');

    try {
      // Step 1: Click on "Sales History" section (it's an accordion)
      this.log(`🔍 Step 1: Looking for "Sales History" section...`);

      await this.randomWait(2000, 3000);

      const salesHistoryClicked = await this.page.evaluate(() => {
        // Look for elements with "Sales History" text - it's a div with card-header class
        const allElements = Array.from(document.querySelectorAll('div, a, button, h2, h3, h4, h5, h6'));

        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          // Match exact "Sales History" text
          if (text === 'Sales History' || (text.includes('Sales History') && text.length < 50)) {
            const style = window.getComputedStyle(el);
            if (style.display !== 'none' && style.visibility !== 'hidden') {
              console.log(`Found Sales History element: ${el.tagName} id="${el.id}" class="${el.className}"`);
              el.click();
              return { clicked: true, tag: el.tagName, id: el.id };
            }
          }
        }
        return { clicked: false };
      });

      if (!salesHistoryClicked.clicked) {
        this.log(`❌ Could not find "Sales History" section`);
        return {
          success: false,
          error: 'No Sales History section found'
        };
      }

      this.log(`✅ Clicked "Sales History" accordion (${salesHistoryClicked.tag}#${salesHistoryClicked.id})`);
      await this.randomWait(2000, 3000);

      // Step 2: Find the first deed number link
      this.log(`🔍 Step 2: Looking for first deed number link...`);

      const deedLinkInfo = await this.page.evaluate(() => {
        // Find links that point to register.shelby.tn.us with instnum parameter
        // These are the deed number links in the sales history table
        const links = Array.from(document.querySelectorAll('a[href]'));

        for (const link of links) {
          const href = link.href || '';
          const text = (link.textContent || '').trim();

          // Check if link points to register search with instrument number
          if (href.includes('search.register.shelby.tn.us') && href.includes('instnum=')) {
            console.log(`Found deed link: ${text} -> ${href}`);
            return {
              found: true,
              href: href,
              deedNumber: text
            };
          }
        }

        return { found: false };
      });

      if (!deedLinkInfo.found) {
        this.log(`❌ Could not find deed number link in sales history`);
        return {
          success: false,
          error: 'No deed number link found in sales history'
        };
      }

      this.log(`✅ Found deed number link: ${deedLinkInfo.deedNumber} (${deedLinkInfo.href})`);

      return {
        success: true,
        deedLink: deedLinkInfo.href,
        deedNumber: deedLinkInfo.deedNumber
      };

    } catch (error) {
      this.log(`❌ Failed to find deed link: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download deed PDF by navigating to Register of Deeds and clicking PDF link
   * Workflow:
   * 1. Click the deed number link to go to Register of Deeds site
   * 2. Switch to the content iframe
   * 3. Find and click the PDF link in the iframe
   * 4. Download the PDF file
   */
  async downloadDeedFromRegister(deedInfo) {
    this.log('📥 Navigating to Register of Deeds and downloading PDF...');

    try {
      const { deedLink, deedNumber } = deedInfo;

      //Set up download handling
      const downloadPath = path.resolve(process.env.DEED_DOWNLOAD_PATH || './downloads');
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      const client = await this.page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      // Step 1: Navigate to the Register of Deeds site
      this.log(`🌐 Navigating to Register of Deeds: ${deedLink}`);
      await this.page.goto(deedLink, { waitUntil: 'networkidle0', timeout: this.timeout });
      await this.randomWait(3000, 5000);

      // Step 2: Switch to the content iframe
      this.log(`🔄 Looking for content iframe...`);
      const frames = this.page.frames();
      const contentFrame = frames.find(f => f.name() === 'content_frame' || f.url().includes('content.php'));

      if (!contentFrame) {
        this.log(`❌ Could not find content iframe`);
        return {
          success: false,
          error: 'No content iframe found on Register of Deeds site'
        };
      }

      this.log(`✅ Found content iframe: ${contentFrame.url()}`);
      await this.randomWait(2000, 3000);

      // Step 3: Find and click the PDF link in the iframe
      this.log(`🔍 Looking for PDF link in iframe...`);

      const pdfLinkInfo = await contentFrame.evaluate(() => {
        // Find PDF link in the table
        const links = Array.from(document.querySelectorAll('a[href]'));

        for (const link of links) {
          const text = (link.textContent || '').trim();
          const href = link.href;

          // Look for PDF link
          if (text === 'PDF' && href.includes('view_image.php') && href.includes('type=pdf')) {
            return {
              found: true,
              href: href,
              text: text
            };
          }
        }

        return { found: false };
      });

      if (!pdfLinkInfo.found) {
        this.log(`❌ Could not find PDF link in iframe`);
        return {
          success: false,
          error: 'No PDF link found in Register of Deeds iframe'
        };
      }

      this.log(`✅ Found PDF link: ${pdfLinkInfo.href}`);

      // Step 4: Download the PDF using axios instead of navigating
      // This ensures we get the complete file, not a browser-rendered version
      this.log(`📥 Downloading PDF from: ${pdfLinkInfo.href}`);

      try {
        // Download the PDF directly using axios with the same cookies/session
        const cookies = await this.page.cookies();
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

        const response = await axios.get(pdfLinkInfo.href, {
          responseType: 'arraybuffer',
          headers: {
            'Cookie': cookieString,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: this.timeout,
          maxContentLength: 50 * 1024 * 1024, // 50MB max
          maxBodyLength: 50 * 1024 * 1024
        });

        const pdfBuffer = Buffer.from(response.data);

        this.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

        // Verify it's actually a PDF
        const magicNumber = pdfBuffer.slice(0, 4).toString();
        if (magicNumber !== '%PDF') {
          this.log(`❌ Downloaded file is not a valid PDF (magic number: ${magicNumber})`);
          return {
            success: false,
            error: 'Downloaded file is not a valid PDF'
          };
        }

        // Save to file
        const filename = `shelby_deed_${Date.now()}.pdf`;
        const filepath = path.join(downloadPath, filename);
        fs.writeFileSync(filepath, pdfBuffer);

        this.log(`💾 Saved to: ${filename}`);

        // Read the PDF to get base64
        const pdfBase64 = pdfBuffer.toString('base64');

        return {
          success: true,
          filename,
          downloadPath,
          filepath,
          deedLink: deedLink,
          deedNumber: deedNumber,
          timestamp: new Date().toISOString(),
          fileSize: pdfBuffer.length,
          pdfBase64
        };

      } catch (downloadError) {
        this.log(`❌ Failed to download PDF via axios: ${downloadError.message}`);
        return {
          success: false,
          error: downloadError.message
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

  /**
   * Random wait helper
   */
  async randomWait(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

module.exports = ShelbyCountyTennesseeScraper;
