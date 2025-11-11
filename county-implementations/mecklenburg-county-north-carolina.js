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
    cleaned = cleaned.trim();

    // Split into parts BEFORE removing ZIP codes (to preserve street number)
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
        // Look for the Polaris autocomplete structure
        // It uses li elements inside a ul with clickable divs
        const listItems = Array.from(document.querySelectorAll('ul.bg-lienzo li'));

        if (listItems.length > 0) {
          // Click the clickable div inside the first li
          const firstItem = listItems[0];
          const clickableDiv = firstItem.querySelector('div.hover\\:cursor-pointer');

          if (clickableDiv) {
            clickableDiv.click();
            return { success: true, address: clickableDiv.textContent.trim() };
          }
        }

        // Fallback: Try generic selectors
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

      // Click the link and wait for new tab to open (target="_blank")
      const newPagePromise = new Promise(resolve =>
        this.browser.once('targetcreated', target => resolve(target.page()))
      );

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

      this.log('⏳ Waiting for new tab to open...');
      const rodPage = await newPagePromise;
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

      this.log(`✅ New tab opened: ${rodPage.url()}`);

      // Switch to the new tab (ROD page)
      this.page = rodPage;

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
          // Wait for navigation after disclaimer
          await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          this.log('⚠️ Could not find disclaimer acceptance link');
        }
      }

      // Extract page count from the page
      this.log('🔍 Extracting page count...');
      const pageCount = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;
        const match = bodyText.match(/#\s*Pages\s*in\s*Image:\s*(\d+)/i);
        if (match) {
          return parseInt(match[1], 10);
        }
        return 3; // Default to 3 pages if not found
      });

      this.log(`✅ Found ${pageCount} page(s) in document`);

      return {
        success: true,
        duration: Date.now() - startTime,
        bookPage: deedLink.bookPage,
        pageCount
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
  async downloadDeedPdf(pageCount = 3) {
    const startTime = Date.now();

    try {
      this.log(`🔍 Capturing ${pageCount} page(s) from LTViewer...`);

      // Wait for viewer to fully load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Find the LTViewer iframe
      const frames = this.page.frames();
      let viewerFrame = null;
      for (const frame of frames) {
        if (frame.url().includes('LTViewer')) {
          viewerFrame = frame;
          break;
        }
      }

      if (!viewerFrame) {
        throw new Error('Could not find LTViewer iframe');
      }

      this.log('✅ Found LTViewer iframe');

      // Capture screenshots of each page
      const imageBuffers = [];

      for (let pageNum = 0; pageNum < pageCount; pageNum++) {
        this.log(`📸 Capturing page ${pageNum + 1}/${pageCount}...`);

        // If not the first page, navigate to next page
        if (pageNum > 0) {
          // Try to click "Next Page" button in the viewer
          await viewerFrame.evaluate(() => {
            // Look for next page button
            const buttons = Array.from(document.querySelectorAll('img, a, button'));
            for (const btn of buttons) {
              const title = btn.title || btn.alt || '';
              const onclick = btn.getAttribute('onclick') || '';
              if (title.toLowerCase().includes('next') || onclick.includes('Next') || onclick.includes('nextPage')) {
                btn.click();
                return true;
              }
            }
            return false;
          }).catch(() => false);

          // Wait for page to load
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Take screenshot of the viewer iframe
        const screenshot = await viewerFrame.evaluate(async () => {
          // Find the image element in the viewer
          const imgElement = document.querySelector('img[id*="WIV"], img[src*="ImageHandler"], img[src*="GetImage"]');
          if (!imgElement) {
            return null;
          }

          // Get the image as base64
          const canvas = document.createElement('canvas');
          canvas.width = imgElement.naturalWidth || imgElement.width;
          canvas.height = imgElement.naturalHeight || imgElement.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgElement, 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        });

        if (screenshot) {
          imageBuffers.push(Buffer.from(screenshot, 'base64'));
          this.log(`  ✅ Captured: ${(imageBuffers[imageBuffers.length - 1].length / 1024).toFixed(2)} KB`);
        } else {
          this.log(`  ⚠️ Could not capture page ${pageNum + 1}, trying fallback...`);
          // Fallback: screenshot the entire iframe
          const element = await viewerFrame.frameElement();
          if (element) {
            const screenshotBuffer = await element.screenshot({ type: 'png' });
            imageBuffers.push(screenshotBuffer);
            this.log(`  ✅ Captured (fallback): ${(screenshotBuffer.length / 1024).toFixed(2)} KB`);
          }
        }
      }

      if (imageBuffers.length === 0) {
        throw new Error('Could not capture any pages');
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

      // Convert to base64
      const pdfBase64 = pdfBuffer.toString('base64');

      return {
        success: true,
        duration: Date.now() - startTime,
        pdfBase64,
        filename: `mecklenburg_deed_${Date.now()}.pdf`,
        fileSize: pdfBuffer.length,
        downloadPath: ''
      };

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
      const pageCount = deedResult.pageCount || 3;
      const downloadResult = await this.downloadDeedPdf(pageCount);
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

  /**
   * Download PDF from URL using browser context (copied from Durham County)
   */
  async downloadPdfFromUrl(url) {
    try {
      this.log(`📥 Downloading PDF from: ${url}`);

      // If the URL is a PDF.js viewer, extract the actual PDF URL
      let pdfUrl = url;
      if (url.includes('pdfjs') || url.includes('file=')) {
        // Extract the actual PDF path from the viewer URL
        const match = url.match(/file=([^&]+)/);
        if (match) {
          let extractedPath = decodeURIComponent(match[1]);
          // Remove any query parameters from the extracted path
          extractedPath = extractedPath.split('?')[0];

          this.log(`  Extracted PDF path: ${extractedPath}`);

          // Construct full URL if it's a relative path
          if (extractedPath.startsWith('/')) {
            const baseUrl = new URL(url).origin;
            pdfUrl = baseUrl + extractedPath;
          } else {
            pdfUrl = extractedPath;
          }

          this.log(`  Full PDF URL: ${pdfUrl}`);
        }
      }

      // Use fetch from within the page context to download the PDF with proper auth/cookies
      const pdfBase64 = await this.page.evaluate(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();

        // Convert blob to base64
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // Remove the data:application/pdf;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }, pdfUrl);

      // Verify we got a valid PDF
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

      if (pdfSignature !== '%PDF') {
        this.log(`⚠️ Downloaded content doesn't appear to be a PDF. First bytes: ${pdfBuffer.toString('utf8', 0, 50)}`);
        // Don't throw - return it anyway as the caller might want to see what was downloaded
      }

      this.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
      return pdfBase64;

    } catch (error) {
      this.log(`❌ Error downloading PDF: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MecklenburgCountyNorthCarolinaScraper;
