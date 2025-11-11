/**
 * Mecklenburg County, North Carolina Deed Scraper
 *
 * - Property Search: https://polaris3g.mecklenburgcountync.gov/
 *
 * Search Method: Property Address with autocomplete
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class MecklenburgCountyNorthCarolinaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Mecklenburg';
    this.state = 'NC';
    this.debugLogs = [];
  }

  /**
   * Override createBrowser to use puppeteer-extra with stealth
   */
  async createBrowser() {
    this.log('🚀 Initializing browser with stealth mode...');

    this.browser = await puppeteer.launch({
      headless: this.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080'
      ],
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    this.page = await this.browser.newPage();

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    this.log('✅ Browser initialized with stealth mode');
  }

  /**
   * Parse address into street number and street name
   */
  parseAddress(address) {
    this.log(`📍 Parsing address: ${address}`);

    // Clean up address - remove city, state, zip
    let cleaned = address.trim();
    cleaned = cleaned.replace(/,.*$/g, ''); // Remove everything after comma
    cleaned = cleaned.replace(/\b(NC|North Carolina)\b/gi, '');
    cleaned = cleaned.replace(/\b(CORNELIUS|Charlotte|Matthews|Mint Hill)\b/gi, ''); // Remove common cities
    cleaned = cleaned.replace(/\b\d{5}(-\d{4})?\b/g, ''); // Remove ZIP codes
    cleaned = cleaned.trim();

    // Split into parts
    const parts = cleaned.split(/\s+/);
    if (parts.length < 2) {
      throw new Error(`Cannot parse address: ${address}`);
    }

    const streetNumber = parts[0];
    const streetName = parts.slice(1).join(' ').toLowerCase();

    this.log(`  Street Number: ${streetNumber}`);
    this.log(`  Street Name: ${streetName}`);

    return { streetNumber, streetName };
  }

  /**
   * Search for property by address
   */
  async searchProperty(address) {
    const startTime = Date.now();

    try {
      const { streetNumber, streetName } = this.parseAddress(address);
      const searchQuery = `${streetNumber} ${streetName}`;

      this.log('🌐 Navigating to Mecklenburg County Property Search...');
      await this.page.goto('https://polaris3g.mecklenburgcountync.gov/', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find and click the search input box
      this.log(`📝 Entering search query: ${searchQuery}`);

      // Look for the address search input
      const searchInput = await this.page.$('input[placeholder*="address"], input[placeholder*="Address"], input[type="text"]');

      if (!searchInput) {
        throw new Error('Could not find address search input field');
      }

      // Click and type the address
      await searchInput.click();
      await searchInput.type(searchQuery, { delay: 100 });

      this.log('⏳ Waiting for autocomplete suggestions...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Look for autocomplete dropdown and click first matching result
      this.log('🔍 Looking for autocomplete match...');
      const selectedAddress = await this.page.evaluate((query) => {
        // Look for autocomplete suggestions - common patterns
        const selectors = [
          '.pac-item',
          '.autocomplete-item',
          '.suggestion-item',
          '[role="option"]',
          '.ui-menu-item',
          'li[data-value]',
          'div[data-value]'
        ];

        for (const selector of selectors) {
          const items = Array.from(document.querySelectorAll(selector));
          if (items.length > 0) {
            for (const item of items) {
              const text = item.textContent.trim().toLowerCase();
              if (text.includes(query.toLowerCase())) {
                item.click();
                return { success: true, address: item.textContent.trim() };
              }
            }
            // If no exact match, click first item
            items[0].click();
            return { success: true, address: items[0].textContent.trim() };
          }
        }

        return { success: false };
      }, searchQuery);

      if (!selectedAddress.success) {
        // Try pressing Enter as fallback
        this.log('⚠️ No autocomplete found, pressing Enter...');
        await this.page.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        this.log(`✅ Selected address: ${selectedAddress.address}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

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
   * Navigate to Deeds tab and click first deed entry
   */
  async getDeedInfo() {
    const startTime = Date.now();

    try {
      this.log('🔍 Looking for "Deeds and Sale Price" tab...');

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Find and click Deeds and Sale Price tab
      const tabClicked = await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, li'));

        for (const el of allElements) {
          const text = el.textContent.trim().toLowerCase();
          if (text.includes('deeds and sale price') ||
              text.includes('deeds') && text.includes('sale')) {
            el.click();
            return { success: true, text: el.textContent.trim() };
          }
        }

        return { success: false };
      });

      if (!tabClicked.success) {
        throw new Error('Could not find "Deeds and Sale Price" tab');
      }

      this.log(`✅ Clicked tab: ${tabClicked.text}`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Look for first deed entry (Book-Page format like 28644-106)
      this.log('🔍 Looking for first deed entry...');

      const deedLink = await this.page.evaluate(() => {
        // Look for links that match Book-Page pattern (e.g., 28644-106)
        const allLinks = Array.from(document.querySelectorAll('a'));

        for (const link of allLinks) {
          const text = link.textContent.trim();
          // Match pattern: numbers-numbers (Book-Page)
          if (/^\d{4,5}-\d{1,5}$/.test(text)) {
            return {
              success: true,
              bookPage: text,
              href: link.href
            };
          }
        }

        return { success: false };
      });

      if (!deedLink.success) {
        throw new Error('Could not find deed book-page link');
      }

      this.log(`✅ Found deed link: ${deedLink.bookPage}`);

      // Click the deed link
      await this.page.evaluate((href) => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          if (link.href === href) {
            link.click();
            return;
          }
        }
      }, deedLink.href);

      this.log('⏳ Waiting for page to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if we're on disclaimer page
      const currentUrl = this.page.url();
      if (currentUrl.includes('disclaimer') || await this.page.evaluate(() => {
        const bodyText = document.body.innerText.toLowerCase();
        return bodyText.includes('disclaimer') && bodyText.includes('acknowledge');
      })) {
        this.log('📋 Disclaimer page detected, accepting...');

        // Look for disclaimer acceptance link
        const disclaimerClicked = await this.page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('a, button'));

          for (const el of allElements) {
            const text = el.textContent.toLowerCase();
            if (text.includes('click here to acknowledge') ||
                text.includes('acknowledge the disclaimer') ||
                text.includes('enter the site')) {
              el.click();
              return true;
            }
          }

          return false;
        });

        if (disclaimerClicked) {
          this.log('✅ Clicked disclaimer acceptance link');
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          this.log('⚠️ Could not find disclaimer acceptance link');
        }
      }

      return {
        success: true,
        duration: Date.now() - startTime,
        bookPage: deedLink.bookPage
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

      // Wait for PDF to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check current URL
      const currentUrl = this.page.url();
      this.log(`Current URL: ${currentUrl}`);

      // Strategy 1: Check if current page is PDF
      if (currentUrl.toLowerCase().includes('.pdf')) {
        this.log('✅ Current page is PDF');
        const pdfBase64 = await this.downloadPdfFromUrl(currentUrl);

        return {
          success: true,
          duration: Date.now() - startTime,
          pdfBase64,
          filename: `mecklenburg_deed_${Date.now()}.pdf`,
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
          filename: `mecklenburg_deed_${Date.now()}.pdf`,
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
          filename: `mecklenburg_deed_${Date.now()}.pdf`,
          fileSize: Buffer.from(pdfBase64, 'base64').length,
          downloadPath: ''
        };
      }

      // Strategy 4: Look for download/view links
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
          filename: `mecklenburg_deed_${Date.now()}.pdf`,
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
   * Main method to get prior deed
   */
  async getPriorDeed(address) {
    this.log(`\n🏁 Starting prior deed download for: ${address}`);

    const result = {
      success: false,
      address,
      county: this.county,
      state: this.state,
      steps: {}
    };

    try {
      // Step 1: Search for property
      this.log('\n📍 STEP 1: Searching for property...');
      const searchResult = await this.searchProperty(address);
      result.steps.search = searchResult;

      if (!searchResult.success) {
        throw new Error('Property search failed');
      }

      // Step 2: Get deed information
      this.log('\n📄 STEP 2: Getting deed information...');
      const deedResult = await this.getDeedInfo();
      result.steps.deed = deedResult;

      if (!deedResult.success) {
        throw new Error('Failed to get deed information');
      }

      // Step 3: Download PDF
      this.log('\n📥 STEP 3: Downloading PDF...');
      const downloadResult = await this.downloadDeedPdf();
      result.steps.download = downloadResult;

      if (!downloadResult.success) {
        throw new Error('Failed to download PDF');
      }

      // Success!
      result.success = true;
      result.pdfBase64 = downloadResult.pdfBase64;
      result.filename = downloadResult.filename;
      result.fileSize = downloadResult.fileSize;
      result.bookPage = deedResult.bookPage;

      this.log('\n✅ SUCCESS: Prior deed downloaded successfully');
      return result;

    } catch (error) {
      this.log(`\n❌ ERROR: ${error.message}`);
      result.error = error.message;
      return result;
    }
  }
}

module.exports = MecklenburgCountyNorthCarolinaScraper;
