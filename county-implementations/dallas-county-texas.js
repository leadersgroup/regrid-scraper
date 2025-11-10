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

      // Handle any initial overlays
      await this.handleInitialOverlays();
      await this.waitForLoading();

      // Find the deed document
      const findResult = await this.findDeedDocument(searchData.instrumentNumber);

      if (!findResult.found) {
        return { success: false, error: findResult.reason };
      }

      // Navigate download workflow
      await this.navigateDownloadWorkflow(findResult);

      // Wait for download to start
      await this.randomWait(5000, 7000);
      this.log('✅ Download initiated successfully');
      return { success: true };
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
   * Search Dallas CAD for property information
   */
  async searchDallasCAD(address) {
    try {
      this.log(`🔍 Searching Dallas CAD for: ${address}`);

      // Navigate to Dallas CAD search page
      const cadUrl = 'https://www.dallascad.org/';
      await this.page.goto(cadUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomWait(2000, 3000);

      // Search for property by address
      // This is a placeholder - actual implementation depends on the CAD website structure
      const searchSelector = 'input[name="search"], input[type="search"], #search';
      await this.page.waitForSelector(searchSelector, { timeout: 10000 });
      await this.page.type(searchSelector, address);
      await this.randomWait(500, 1000);

      // Submit search
      await Promise.race([
        this.page.keyboard.press('Enter'),
        this.page.click('button[type="submit"], input[type="submit"]').catch(() => {})
      ]);

      await this.randomWait(3000, 5000);
      await this.waitForLoading();

      // Extract legal description and instrument number
      const propertyInfo = await this.page.evaluate(() => {
        // Look for legal description or instrument number
        const bodyText = document.body.innerText;

        // Match instrument number pattern (e.g., INT202400152203)
        const instMatch = bodyText.match(/INT(\d+)/);

        // Match volume/book/page pattern
        const volMatch = bodyText.match(/Vol(?:ume)?\s*(\d+).*?Page\s*(\d+)/i);

        return {
          instrumentNumber: instMatch ? instMatch[1] : null,
          bookNumber: volMatch ? volMatch[1] : null,
          pageNumber: volMatch ? volMatch[2] : null,
          rawText: bodyText.substring(0, 500)
        };
      });

      if (!propertyInfo.instrumentNumber && !propertyInfo.bookNumber) {
        this.log('⚠️ Could not find instrument number or book/page in CAD results');
        return {
          success: false,
          error: 'No instrument number or book/page found',
          debugInfo: propertyInfo
        };
      }

      // Navigate to deed search page
      const deedSearchUrl = 'https://dallas.tx.publicsearch.us/';
      await this.page.goto(deedSearchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomWait(2000, 3000);

      // Handle initial overlays on deed search site
      await this.handleInitialOverlays();

      // Search by instrument number
      if (propertyInfo.instrumentNumber) {
        this.log(`🔍 Searching deed records for instrument: ${propertyInfo.instrumentNumber}`);

        const instSearchSelector = 'input[name="instrument"], input[placeholder*="Instrument"]';
        await this.page.waitForSelector(instSearchSelector, { timeout: 10000 });
        await this.page.type(instSearchSelector, propertyInfo.instrumentNumber);
        await this.randomWait(500, 1000);

        // Submit search
        await Promise.race([
          this.page.keyboard.press('Enter'),
          this.page.click('button[type="submit"], input[type="submit"]').catch(() => {})
        ]);

        await this.randomWait(3000, 5000);
        await this.waitForLoading();
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
