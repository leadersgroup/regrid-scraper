/**
 * Dallas County, Texas - Deed Scraper Implementation
 *
 * County Resources:
 * - Appraisal District: https://www.dallascad.org/AcctDetailRes.aspx?ID={account_id}
 * - Deed Search: https://dallas.tx.publicsearch.us/
 *
 * Workflow:
 * 1. Search property by address on Dallas CAD (Dallas Central Appraisal District)
 * 2. Extract legal description (line 4) - find INT202400152203 number or Vol/book/page number
 * 3. Go to deed search page: https://dallas.tx.publicsearch.us/
 * 4. Search by instrument number (without "INT" prefix) or advanced search with Vol/book/page
 * 5. Download deed PDF
 *
 * Example:
 * - Address: 123 Main St, Dallas, TX
 * - Legal Desc: INT202400152203 or Vol 12345 Page 678
 * - Search: 202400152203 (without INT) or advanced search with book/page
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class DallasCountyTexasScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Dallas';
    this.state = 'TX';
  }

  async downloadDeed(searchData) {
    try {
      this.log(`🔍 Finding deed with instrument number: ${searchData.instrumentNumber}`);

      // Navigate to Dallas County Clerk Official Records search
      const clerkUrl = 'https://dallas.tx.publicsearch.us/';
      this.log(`🌐 Navigating to Dallas County Clerk records: ${clerkUrl}`);
      await this.page.goto(clerkUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.randomWait(2000, 3000);

      // Close the "Not sure where to start?" popup
      try {
        const closeButton = await this.page.$('button[aria-label="Close"]');
        if (closeButton) {
          this.log('✅ Closing popup modal');
          await closeButton.click();
          await this.randomWait(500, 1000);
        }
      } catch (error) {
        this.log('⚠️ No popup to close');
      }

      // Search for instrument number in the Quick Search field
      this.log(`🔍 Searching for instrument number: ${searchData.instrumentNumber}`);

      // Find the main search input field (the large text box to the right of "Property Records")
      const searchInput = await this.page.$('input[placeholder*="grantor"]') ||
                          await this.page.$('input[placeholder*="doc"]') ||
                          await this.page.$('input[type="text"]');

      if (!searchInput) {
        return { success: false, error: 'Could not find search input field' };
      }

      // Type the instrument number
      await searchInput.click({ clickCount: 3 }); // Select all existing text
      await this.randomWait(300, 500);
      await searchInput.type(searchData.instrumentNumber);
      await this.randomWait(1000, 2000);

      // Click the search button
      this.log('🔍 Clicking search button...');
      await this.page.keyboard.press('Enter');
      await this.randomWait(3000, 5000);

      // Wait for search results
      this.log('📄 Waiting for search results...');
      await this.waitForLoading();
      await this.randomWait(2000, 3000);

      // Find and click on the row containing the document
      this.log('📄 Looking for document row...');
      const rowClicked = await this.page.evaluate((instrumentNum) => {
        // Find the row containing our instrument number
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        const docRow = rows.find(row => {
          return row.textContent.includes(instrumentNum);
        });

        if (!docRow) {
          return { found: false, reason: 'Row not found' };
        }

        // Look for the button in the row (a11y-menu__control)
        const button = docRow.querySelector('button.a11y-menu__control');
        if (button) {
          button.click();
          return { found: true, clicked: 'button' };
        }

        // If no button, try clicking the row itself
        docRow.click();
        return { found: true, clicked: 'row' };
      }, searchData.instrumentNumber);

      if (!rowClicked.found) {
        this.log('⚠️ Could not find document row');
        await this.page.screenshot({ path: `/tmp/dallas-clerk-no-row-${Date.now()}.png`, fullPage: true });
        return {
          success: false,
          error: 'Document row not found in results'
        };
      }

      this.log(`✅ Clicked ${rowClicked.clicked} - checking for document viewer`);
      await this.randomWait(2000, 3000);

      // Monitor network requests to capture document image URLs BEFORE clicking on viewer
      this.log('🔍 Setting up network monitoring for document images...');
      const imageUrls = [];

      this.page.on('response', async (response) => {
        const url = response.url();
        // Look for document image PNGs: /files/documents/{docId}/images/{imageId}_{pageNum}.png
        if (url.includes('/files/documents/') && url.includes('/images/') && url.endsWith('.png')) {
          if (!imageUrls.includes(url)) {
            imageUrls.push(url);
            this.log(`  📷 Found image: ${url.split('/').pop()}`);
          }
        }
      });

      // Look for document viewer, preview, or image options
      // Try clicking directly on the row to open document viewer instead of the menu
      this.log('📄 Looking for document preview/viewer...');
      const viewerFound = await this.page.evaluate((instrumentNum) => {
        // Close any menus first
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        const docRow = rows.find(row => row.textContent.includes(instrumentNum));

        if (!docRow) {
          return { found: false, reason: 'Row disappeared' };
        }

        // Click on a cell in the row (not the button) to try to open viewer
        const cells = docRow.querySelectorAll('td');
        if (cells.length > 3) {
          // Click on the grantee or document type cell
          cells[4].click(); // Try clicking the GRANTEE cell
          return { found: true, clicked: 'cell' };
        }

        return { found: false, reason: 'No clickable cells' };
      }, searchData.instrumentNumber);

      this.log(`Viewer search result: ${JSON.stringify(viewerFound)}`);

      // Wait for initial image to load
      await this.randomWait(3000, 4000);

      // Get page count from document viewer
      this.log('📄 Getting document page count...');
      const pageInfo = await this.page.evaluate(() => {
        const pageText = document.body.innerText;
        const pageMatch = pageText.match(/(\d+)\s+of\s+(\d+)/i);

        // Also look for "Number of Pages" field
        const cells = Array.from(document.querySelectorAll('td, div, span'));
        let pagesFromField = null;
        for (const cell of cells) {
          const text = cell.textContent || '';
          if (text.includes('Number of Pages')) {
            const match = text.match(/Number of Pages:\s*(\d+)/);
            if (match) pagesFromField = parseInt(match[1]);
          }
        }

        return {
          currentPage: pageMatch ? parseInt(pageMatch[1]) : 1,
          totalPages: pageMatch ? parseInt(pageMatch[2]) : (pagesFromField || 1)
        };
      });

      this.log(`✅ Document has ${pageInfo.totalPages} page(s)`);

      // Verify we have at least one image URL
      if (imageUrls.length === 0) {
        throw new Error('No document images found');
      }

      // Construct URLs for all pages based on the first image URL pattern
      // Pattern: /files/documents/{docId}/images/{imageId}_{pageNum}.png
      const firstImageUrl = imageUrls[0];
      const urlMatch = firstImageUrl.match(/(.+\/)(\d+)_(\d+)\.png$/);

      if (!urlMatch) {
        throw new Error(`Could not parse image URL pattern: ${firstImageUrl}`);
      }

      const baseUrl = urlMatch[1]; // e.g., "https://dallas.tx.publicsearch.us/files/documents/232080994/images/"
      const imageId = urlMatch[2]; // e.g., "221553289"

      // Generate all page URLs
      const allImageUrls = [];
      for (let pageNum = 1; pageNum <= pageInfo.totalPages; pageNum++) {
        const pageUrl = `${baseUrl}${imageId}_${pageNum}.png`;
        allImageUrls.push(pageUrl);
      }

      this.log(`📋 Generated ${allImageUrls.length} image URL(s) from pattern`);
      allImageUrls.forEach((url, idx) => {
        this.log(`  ${idx + 1}. ${url.split('/').pop()}`);
      });

      this.log(`📥 Downloading ${allImageUrls.length} image(s)...`);

      // Download images using fetch with cookies
      const https = require('https');
      const cookies = await this.page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const pageBuffers = [];
      for (let i = 0; i < allImageUrls.length; i++) {
        const url = allImageUrls[i];
        this.log(`  Downloading ${i + 1}/${allImageUrls.length}: ${url.split('/').pop()}`);

        const imageBuffer = await new Promise((resolve, reject) => {
          const urlObj = new URL(url);
          const options = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {
              'Cookie': cookieString,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          };

          https.get(options, (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
          }).on('error', reject);
        });

        pageBuffers.push(imageBuffer);
        this.log(`    ✅ Downloaded: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      }

      // Convert images to PDF using pdf-lib
      this.log('📄 Converting images to PDF...');
      const { PDFDocument } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < pageBuffers.length; i++) {
        this.log(`  Adding page ${i + 1}/${pageBuffers.length} to PDF...`);
        const image = await pdfDoc.embedPng(pageBuffers[i]);
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

      // Convert to base64 for return
      const pdfBase64 = pdfBuffer.toString('base64');

      // Generate filename
      const filename = `dallas_deed_${searchData.instrumentNumber}.pdf`;

      return {
        success: true,
        pdfBase64: pdfBase64,
        filename: filename,
        downloadPath: '',
        instrumentNumber: searchData.instrumentNumber,
        timestamp: new Date().toISOString(),
        fileSize: pdfBuffer.length,
        pageCount: pageInfo.totalPages
      };
    } catch (error) {
      this.log(`❌ Download error: ${error.message}`);
      return {
        success: false,
        error: `Failed to download deed: ${error.message}`
      };
    }
  }

  async handleInitialOverlays() {
    try {
      // Check if we need to accept terms or handle initial redirect
      const acceptButtonTexts = ['Accept', 'I Accept', 'Continue'];

      // Try to find and click accept buttons by text
      for (const text of acceptButtonTexts) {
        try {
          const button = await this.findElementByText('button', text);
          if (button) {
            this.log(`✅ Found accept button: ${text}`);
            await button.click();
            await this.randomWait(1000, 2000);
          }
        } catch (error) {
          // Continue to next text
        }
      }

      // Also try input elements with Accept value
      try {
        const input = await this.page.$('input[value*="Accept"]');
        if (input) {
          this.log(`✅ Found accept input`);
          await input.click();
          await this.randomWait(1000, 2000);
        }
      } catch (error) {
        // Ignore
      }

      await this.randomWait(2000, 3000);

      // Dismiss "Where to start" popup if it appears
      this.log('🔍 Checking for "Where to start" popup...');

      // Try common selectors first
      const cssSelectors = [
        'button.close',
        'button[aria-label="Close"]',
        '[class*="close"]',
        '[class*="dismiss"]',
        '.modal button',
        '.popup button'
      ];

      for (const selector of cssSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            this.log(`✅ Found popup close button: ${selector}`);
            await button.click();
            this.log(`✅ Closed popup`);
            await this.randomWait(500, 1000);
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // Try to find buttons by text content
      const closeTexts = ['Close', 'Got it', 'OK', 'Dismiss'];
      for (const text of closeTexts) {
        try {
          const button = await this.findElementByText('button', text);
          if (button) {
            this.log(`✅ Found popup close button with text: ${text}`);
            await button.click();
            this.log(`✅ Closed popup`);
            await this.randomWait(500, 1000);
          }
        } catch (error) {
          // Continue to next text
        }
      }

      // Try pressing Escape key to close any modals
      try {
        await this.page.keyboard.press('Escape');
        this.log(`⚠️ No popup close button found, pressed Escape key`);
        await this.randomWait(500, 1000);
      } catch (error) {
        // Ignore errors
      }
    } catch (error) {
      this.log(`⚠️ Error handling popup: ${error.message}`);
    }
  }

  /**
   * Helper to find element by text content
   */
  async findElementByText(tagName, text) {
    return await this.page.evaluateHandle((tag, searchText) => {
      const elements = Array.from(document.querySelectorAll(tag));
      return elements.find(el => {
        const elText = el.textContent || '';
        return elText.trim() === searchText || elText.includes(searchText);
      });
    }, tagName, text);
  }

  findDeedDocument(instrumentNumber) {
    return this.page.evaluate((instNum) => {
      // Helper function to generate a selector for an element
      function getUniqueSelector(element) {
        if (element.id) return `#${element.id}`;
        if (element.getAttribute('data-testid')) 
          return `[data-testid="${element.getAttribute('data-testid')}"]`;
        if (element.className) {
          const classes = Array.from(element.classList)
            .filter(c => !c.includes('--')) // Filter out dynamic classes
            .join('.');
          if (classes) return `.${classes}`;
        }
        // Add aria attributes if present
        if (element.getAttribute('aria-label')) {
          return `${element.tagName.toLowerCase()}[aria-label="${element.getAttribute('aria-label')}"]`;
        }
        // Fall back to tag name + nth-child
        const parent = element.parentElement;
        if (parent) {
          const index = Array.from(parent.children).indexOf(element);
          return `${element.tagName.toLowerCase()}:nth-child(${index + 1})`;
        }
        return element.tagName.toLowerCase();
      }

      // First check for errors
      const errorElements = document.querySelectorAll('[class*="error"], .alert, .notification');
      for (const el of errorElements) {
        const text = el.textContent?.trim();
        if (text && !text.toLowerCase().includes('no error')) {
          return {
            found: false,
            reason: `Error found: ${text}`
          };
        }
      }

      // Find the results table
      const table = document.querySelector('table');
      if (!table) {
        return {
          found: false,
          reason: 'No results table found',
          debugInfo: {
            body: document.body.textContent.substring(0, 200),
            url: window.location.href
          }
        };
      }

      // Look for our document row
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      if (!rows.length) {
        return {
          found: false,
          reason: 'Table has no rows',
          debugInfo: {
            tableHtml: table.outerHTML.substring(0, 500)
          }
        };
      }

      // Find row with our document number
      const targetRow = rows.find(row => {
        const text = row.textContent || '';
        return text.includes(instNum);
      });

      if (!targetRow) {
        return {
          found: false,
          reason: 'Document number not found in results',
          debugInfo: {
            rowCount: rows.length,
            firstRowText: rows[0].textContent
          }
        };
      }

      // Document found, look for interactive elements
      const actionButton = targetRow.querySelector(
        '[data-testid="resultActionButton"] button, button[aria-expanded], [class*="menu"] button'
      );
      if (actionButton) {
        return {
          found: true,
          hasActionMenu: true,
          actionSelector: getUniqueSelector(actionButton),
          rowIndex: rows.indexOf(targetRow)
        };
      }

      const checkbox = targetRow.querySelector('input[type="checkbox"]');
      if (checkbox) {
        return {
          found: true,
          hasCheckbox: true,
          checkboxSelector: getUniqueSelector(checkbox),
          rowIndex: rows.indexOf(targetRow)
        };
      }

      const clickableRow = targetRow.querySelector('[role="button"], [tabindex="0"]');
      if (clickableRow) {
        return {
          found: true,
          isClickableRow: true,
          rowSelector: getUniqueSelector(targetRow),
          rowIndex: rows.indexOf(targetRow)
        };
      }

      // Fall back to simpler interactions
      return {
        found: true,
        fallbackMode: true,
        rowData: {
          docNumber: instNum,
          text: targetRow.textContent?.trim(),
          rowIndex: rows.indexOf(targetRow)
        }
      };
    }, instrumentNumber).then(documentInfo => {
      if (!documentInfo) {
        throw new Error('Failed to evaluate page for document search');
      }
      return documentInfo;
    }).catch(error => {
      this.log(`Error finding document: ${error.message}`);
      return {
        found: false,
        reason: 'Document search failed',
        error: error.message
      };
    });
  }

  waitForLoading() {
    // Common loading indicator classes and selectors
    const loadingSelectors = [
      '[class*="loading"]', 
      '[class*="spinner"]',
      '[class*="progress"]',
      '[role="progressbar"]',
      '.loader',
      '.loading'
    ];

    return Promise.all(loadingSelectors.map(selector => {
      return this.page.waitForFunction(
        (sel) => !document.querySelector(sel) || 
          document.querySelector(sel).style.display === 'none' ||
          document.querySelector(sel).classList.contains('hidden'),
        { timeout: 10000 },
        selector
      ).catch(e => {
        // Ignore timeout errors for individual selectors
        if (e.name !== 'TimeoutError') throw e;
      });
    }))
    .then(() => {
      // Additional wait for dynamic content
      return this.page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
        { timeout: 5000 }
      ).catch(() => {}); // Ignore timeout
    })
    .catch(error => {
      this.log(`⚠️ Warning: Loading wait error - ${error.message}`);
    });
  }

  async navigateDownloadWorkflow(findResult) {
    if (findResult.hasActionMenu) {
      // Click menu button and look for download option
      await this.page.click(findResult.actionSelector);
      await this.randomWait(500, 1000);

      // Try CSS selectors first
      const cssSelectors = ['[class*="download"]', '[role="menuitem"]'];
      for (const selector of cssSelectors) {
        try {
          const downloadBtn = await this.page.$(selector);
          if (downloadBtn) {
            await downloadBtn.click();
            return;
          }
        } catch (error) {
          // Continue to next selector
        }
      }

      // Try finding buttons by text
      const downloadTexts = ['Download', 'Save', 'Export'];
      for (const text of downloadTexts) {
        try {
          const downloadBtn = await this.findElementByText('button', text);
          if (downloadBtn) {
            await downloadBtn.click();
            return;
          }
        } catch (error) {
          // Continue to next text
        }
      }

      throw new Error('Could not find download option in menu');

    } else if (findResult.hasCheckbox) {
      // Select checkbox and look for batch download button
      await this.page.click(findResult.checkboxSelector);
      await this.randomWait(500, 1000);

      // Try CSS selector first
      try {
        const titleBtn = await this.page.$('button[title*="Download"]');
        if (titleBtn) {
          await titleBtn.click();
          return;
        }
      } catch (error) {
        // Continue
      }

      // Try finding buttons by text
      const downloadTexts = ['Download Selected', 'Download Checked', 'Download'];
      for (const text of downloadTexts) {
        try {
          const downloadBtn = await this.findElementByText('button', text);
          if (downloadBtn) {
            await downloadBtn.click();
            return;
          }
        } catch (error) {
          // Continue to next text
        }
      }

      throw new Error('Could not find batch download button');

    } else if (findResult.isClickableRow) {
      // Click the row and wait for details
      await this.page.click(findResult.rowSelector);
      await this.randomWait(1000, 2000);
      await this.waitForLoading();

      // Try CSS selectors first
      const cssSelectors = [
        '[title*="Download"]',
        '[aria-label*="download"]',
        '[aria-label*="Download"]'
      ];

      for (const selector of cssSelectors) {
        try {
          const downloadBtn = await this.page.$(selector);
          if (downloadBtn) {
            await downloadBtn.click();
            return;
          }
        } catch (error) {
          // Continue
        }
      }

      // Try finding by text
      const downloadTexts = ['Download Document', 'Download PDF', 'Download'];
      for (const text of downloadTexts) {
        try {
          // Try button first
          let downloadBtn = await this.findElementByText('button', text);
          if (downloadBtn) {
            await downloadBtn.click();
            return;
          }
          // Try anchor tag
          downloadBtn = await this.findElementByText('a', text);
          if (downloadBtn) {
            await downloadBtn.click();
            return;
          }
        } catch (error) {
          // Continue to next text
        }
      }

      throw new Error('Could not find download button in details view');

    } else if (findResult.fallbackMode) {
      throw new Error(
        'Document found but no clear download interaction available. ' +
        `Row data: ${JSON.stringify(findResult.rowData)}`
      );
    }
  }

  scrape(address) {
    return Promise.resolve()
      .then(() => {
        this.log(`🏠 Starting Dallas County deed scrape for: ${address}`);

        const result = {
          address,
          county: this.county,
          state: this.state,
          timestamp: new Date().toISOString(),
          steps: {}
        };

        return result;
      })
      .then(result => {
        if (!this.browser) {
          return this.initialize().then(() => result);
        }
        return result;
      })
      .then(result => {
        // Step 1: Skip Regrid (Dallas CAD supports direct address search)
        result.steps.step1 = {
          name: 'Regrid search',
          success: true,
          skipped: true,
          message: 'Dallas County supports direct address search'
        };

        // Step 2: Search Dallas CAD for property
        this.log('📍 Step 2: Searching Dallas CAD...');
        return this.searchDallasCAD(address)
          .then(cadResult => {
            result.steps.step2 = {
              name: 'Dallas CAD property search',
              success: cadResult.success,
              data: cadResult
            };

            if (!cadResult.success) {
              result.success = false;
              result.error = 'Failed to search Dallas CAD';
              return result;
            }

            // Step 3: Download deed from public search
            this.log('📥 Step 3: Downloading deed...');
            return this.downloadDeed(cadResult)
              .then(downloadResult => {
                result.steps.step3 = {
                  name: 'Deed download',
                  success: downloadResult.success,
                  data: downloadResult
                };

                if (!downloadResult.success) {
                  result.success = false;
                  result.error = 'Failed to download deed';
                  return result;
                }

                result.success = true;
                result.download = downloadResult;

                this.log('✅ Dallas County deed scrape completed successfully');
                return result;
              });
          });
      })
      .catch(error => {
        this.log(`❌ Error in Dallas County scrape: ${error.message}`);
        return {
          success: false,
          error: error.message
        };
      });
  }

  getPriorDeed(address) {
    return this.scrape(address);
  }

  randomWait(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Parse address into components
   */
  parseAddress(address) {
    const streetPart = address.split(',')[0].trim();
    const numberMatch = streetPart.match(/^(\d+)/);
    const streetNumber = numberMatch ? numberMatch[1] : '';
    let streetName = streetPart.replace(/^\d+\s*/, '').trim();

    // Strip common street type suffixes for Dallas CAD
    const streetTypes = /\s+(St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Cir|Circle|Blvd|Boulevard|Pkwy|Parkway|Way|Pl|Place|Ter|Terrace|Trl|Trail)\.?$/i;
    streetName = streetName.replace(streetTypes, '').trim();

    return { streetNumber, streetName };
  }

  /**
   * Search Dallas CAD for property information
   */
  async searchDallasCAD(address) {
    try {
      this.log(`🔍 Searching Dallas CAD for: ${address}`);

      // Navigate to Dallas CAD property search page
      // Note: Main URL is https://www.dallascad.org/ but search is at a different URL
      const cadUrl = 'https://www.dallascad.org/SearchAddr.aspx';
      this.log(`🌐 Navigating to: ${cadUrl}`);
      await this.page.goto(cadUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      await this.randomWait(3000, 5000);

      // Close any popups
      await this.page.evaluate(() => {
        const closeButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
        for (const btn of closeButtons) {
          const text = (btn.textContent || '').toLowerCase();
          if (text.includes('close') || text === '×' || text === 'x') {
            btn.click();
            return true;
          }
        }
        return false;
      });

      await this.randomWait(1000, 2000);

      // Parse address components
      const { streetNumber, streetName } = this.parseAddress(address);
      this.log(`📝 Parsed - Street Number: "${streetNumber}", Street Name: "${streetName}"`);

      // Dallas CAD uses specific field IDs: txtAddrNum, listStDir, txtStName
      // Fill street number
      this.log('📝 Filling street number field...');
      await this.page.type('#txtAddrNum', streetNumber);
      await this.randomWait(500, 1000);

      // Parse street name to extract direction and name
      const streetParts = streetName.match(/^([NSEW]{1,2})?\s*(.+?)$/i);
      const streetDirection = streetParts && streetParts[1] ? streetParts[1].toUpperCase() : '';
      const streetNameOnly = streetParts ? streetParts[2].trim() : streetName;

      this.log(`📝 Street direction: "${streetDirection}", Name: "${streetNameOnly}"`);

      // Set street direction if present
      if (streetDirection) {
        this.log(`📝 Setting street direction to: ${streetDirection}`);
        await this.page.select('#listStDir', streetDirection);
        await this.randomWait(500, 1000);
      }

      // Fill street name
      this.log('📝 Filling street name field...');
      await this.page.type('#txtStName', streetNameOnly);
      await this.randomWait(500, 1000);

      // Set city to Dallas (if dropdown has Dallas option)
      try {
        const cityOptions = await this.page.evaluate(() => {
          const select = document.querySelector('#listCity');
          if (!select) return [];
          return Array.from(select.options).map(opt => ({
            value: opt.value,
            text: opt.textContent.trim()
          }));
        });

        this.log(`📋 Available cities: ${cityOptions.map(c => c.text).join(', ')}`);

        const dallasOption = cityOptions.find(opt =>
          opt.text.toLowerCase().includes('dallas')
        );

        if (dallasOption) {
          this.log(`📝 Setting city to: ${dallasOption.text}`);
          await this.page.select('#listCity', dallasOption.value);
          await this.randomWait(500, 1000);
        }
      } catch (error) {
        this.log(`⚠️ Could not set city: ${error.message}`);
      }

      // Click the Search button and wait for navigation
      this.log('🔍 Clicking Search button...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click('#cmdSubmit')
      ]);
      this.log('✅ Search submitted and page reloaded');

      await this.randomWait(2000, 3000);

      // Check if we got search results
      this.log('📄 Checking search results...');
      const searchResults = await this.page.evaluate(() => {
        // Look for results table - Dallas CAD shows results in a table at bottom of page
        const tables = Array.from(document.querySelectorAll('table'));
        const links = Array.from(document.querySelectorAll('a'));

        // Find property address links in the results table
        // These links contain the property address and link to AcctDetailRes.aspx
        const propertyLinks = links.filter(link => {
          const href = link.href || '';
          const text = link.textContent || '';
          // Look for links with addresses (start with digits) or links to detail pages
          return href.includes('AcctDetailRes.aspx') ||
                 href.includes('AcctDetailAddrRes.aspx') ||
                 (text.match(/^\d+\s+/) && text.length > 5); // Addresses like "7012 DUFFIELD DR"
        });

        if (propertyLinks.length > 0) {
          return {
            found: true,
            firstLink: propertyLinks[0].href,
            linkText: propertyLinks[0].textContent.trim(),
            totalLinks: propertyLinks.length
          };
        }

        return {
          found: false,
          tableCount: tables.length,
          linkCount: links.length,
          bodyPreview: document.body.innerText.substring(0, 300)
        };
      });

      if (!searchResults.found) {
        this.log('⚠️ No property links found in search results');
        this.log(`Debug info: ${JSON.stringify(searchResults)}`);

        await this.page.screenshot({ path: `/tmp/dallas-cad-search-results-${Date.now()}.png`, fullPage: true });

        return {
          success: false,
          error: 'No property found in search results',
          debugInfo: searchResults
        };
      }

      this.log(`✅ Found ${searchResults.totalLinks} property link(s), clicking first: ${searchResults.linkText}`);

      // Click the first property link to go to details page
      await this.page.goto(searchResults.firstLink, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomWait(2000, 3000);

      // Extract legal description and instrument number from property detail page
      this.log('📄 Extracting property information from detail page...');
      const propertyInfo = await this.page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Match instrument number pattern (e.g., INT202400152203)
        const instMatch = bodyText.match(/INT(\d+)/);

        // Match volume/book/page pattern
        const volMatch = bodyText.match(/Vol(?:ume)?\s*(\d+).*?Page\s*(\d+)/i);

        // Also try to find in table cells
        const cells = Array.from(document.querySelectorAll('td, div'));
        let foundInst = null;
        let foundVol = null;
        let foundPage = null;

        for (const cell of cells) {
          const text = cell.textContent || '';
          if (!foundInst && text.includes('INT')) {
            const match = text.match(/INT(\d+)/);
            if (match) foundInst = match[1];
          }
          if (!foundVol && text.match(/Vol/i)) {
            const match = text.match(/Vol(?:ume)?\s*(\d+)/i);
            if (match) foundVol = match[1];
          }
          if (!foundPage && foundVol && text.match(/Page/i)) {
            const match = text.match(/Page\s*(\d+)/i);
            if (match) foundPage = match[1];
          }
        }

        return {
          instrumentNumber: instMatch ? instMatch[1] : foundInst,
          bookNumber: volMatch ? volMatch[1] : foundVol,
          pageNumber: volMatch ? volMatch[2] : foundPage,
          rawText: bodyText.substring(0, 500)
        };
      });

      if (!propertyInfo.instrumentNumber && !propertyInfo.bookNumber) {
        this.log('⚠️ Could not find instrument number or book/page in property details');
        this.log(`Page content preview: ${propertyInfo.rawText}`);

        await this.page.screenshot({ path: `/tmp/dallas-cad-details-${Date.now()}.png`, fullPage: true });

        return {
          success: false,
          error: 'No instrument number or book/page found in property details',
          debugInfo: propertyInfo
        };
      }

      this.log(`✅ Found - Instrument: ${propertyInfo.instrumentNumber || 'N/A'}, Book/Page: ${propertyInfo.bookNumber}/${propertyInfo.pageNumber || 'N/A'}`);

      // Navigate to deed search page
      this.log('🌐 Navigating to deed search portal...');
      const deedSearchUrl = 'https://dallas.tx.publicsearch.us/';
      await this.page.goto(deedSearchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomWait(2000, 3000);

      // Handle initial overlays on deed search site
      await this.handleInitialOverlays();

      // Search by instrument number
      if (propertyInfo.instrumentNumber) {
        this.log(`🔍 Searching deed records for instrument: ${propertyInfo.instrumentNumber}`);

        // Try to find instrument number search field
        const instFieldFilled = await this.page.evaluate((instNum) => {
          const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));

          for (const input of inputs) {
            const placeholder = (input.placeholder || '').toLowerCase();
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const label = input.labels?.[0]?.textContent?.toLowerCase() || '';

            if (placeholder.includes('instrument') || placeholder.includes('document') ||
                name.includes('instrument') || name.includes('document') ||
                id.includes('instrument') || id.includes('document') ||
                label.includes('instrument') || label.includes('document')) {
              input.value = instNum;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              return { success: true, field: placeholder || name || id };
            }
          }

          return { success: false };
        }, propertyInfo.instrumentNumber);

        if (instFieldFilled.success) {
          this.log(`✅ Filled instrument field: ${instFieldFilled.field}`);
          await this.randomWait(1000, 2000);

          // Submit search
          await this.page.keyboard.press('Enter');
          await this.randomWait(3000, 5000);
          await this.waitForLoading();
        } else {
          this.log('⚠️ Could not find instrument number field');
        }
      }

      return {
        success: true,
        ...propertyInfo
      };

    } catch (error) {
      this.log(`❌ Error searching Dallas CAD: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DallasCountyTexasScraper;
