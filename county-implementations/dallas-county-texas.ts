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

const DeedScraper = require('../base/deed-scraper');

class DallasCountyTexasScraper extends DeedScraper {
  constructor(options = {}) {
    super({ ...options, county: 'dallas', state: 'tx' });
  }

  /**
   * Download deed PDF using instrument number 
   */
  async downloadDeed(searchData) {
    try {
      this.log(`🔍 Finding deed with instrument number: ${searchData.instrumentNumber}`);
      
      // Handle any initial overlays
      await this.handleInitialOverlays();
      
      // Wait for results to load
      await this.waitForLoading();
      
      // Find our deed document
      const findResult = await this.findDeedDocument(searchData.instrumentNumber);
      
      if (!findResult.found) {
        return { success: false, error: findResult.reason };
      }
      
      // Navigate download workflow
      await this.navigateDownloadWorkflow(findResult);
      
      // Wait for download
      await this.page.waitForEvent('download', { timeout: 30000 });
      
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

  /**
   * Handle initial overlays and popups that might appear
   */
  async handleInitialOverlays() {
    // Check if we need to accept terms or handle initial redirect
    const acceptButtonSelectors = [
      'button:has-text("Accept")',
      'button:has-text("I Accept")',
      'button:has-text("Continue")',
      'input[value*="Accept"]',
      '[class*="accept-button"]'
    ];

    for (const selector of acceptButtonSelectors) {
      try {
        const button = await this.page.$(selector);
        if (button) {
          this.log(`✅ Found accept button: ${selector}`);
          await button.click();
          await this.randomWait(1000, 2000);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    await this.randomWait(2000, 3000);

    // Dismiss "Where to start" popup if it appears
    this.log('🔍 Checking for "Where to start" popup...');
    try {
      // Common selectors for popup close buttons
      const popupCloseSelectors = [
        'button:has-text("Close")',
        'button:has-text("Got it")',
        'button:has-text("OK")',
        'button:has-text("Dismiss")',
        'button.close',
        'button[aria-label="Close"]',
        '[class*="close"]',
        '[class*="dismiss"]',
        '.modal button',
        '.popup button'
      ];

      let popupClosed = false;
      for (const selector of popupCloseSelectors) {
        try {
          const closeButton = await this.page.$(selector);
          if (closeButton) {
            this.log(`✅ Found popup close button: ${selector}`);
            await closeButton.click();
            popupClosed = true;
            this.log(`✅ Closed popup`);
            await this.randomWait(500, 1000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!popupClosed) {
        // Try pressing Escape key to close any modals
        await this.page.keyboard.press('Escape');
        this.log(`⚠️ No popup close button found, pressed Escape key`);
        await this.randomWait(500, 1000);
      }
    } catch (error) {
      this.log(`⚠️ Error handling popup: ${error.message}`);
    }
  }

  /**
   * Find deed document in search results
   */
  async findDeedDocument(instrumentNumber) {
    const result = await this.page.evaluate((instNum) => {
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
    }, instrumentNumber);

    return result;
  }

  /**
   * Wait for loading indicators to resolve
   */
  async waitForLoading() {
    // Common loading indicator classes and selectors
    const loadingSelectors = [
      '[class*="loading"]', 
      '[class*="spinner"]',
      '[class*="progress"]',
      '[role="progressbar"]',
      '.loader',
      '.loading'
    ];

    try {
      // Wait for loading indicators to disappear
      for (const selector of loadingSelectors) {
        try {
          await this.page.waitForFunction(
            (sel) => !document.querySelector(sel) || 
              document.querySelector(sel).style.display === 'none' ||
              document.querySelector(sel).classList.contains('hidden'),
            { timeout: 10000 },
            selector
          );
        } catch (e) {
          // Ignore timeout errors for individual selectors
          if (e.name !== 'TimeoutError') throw e;
        }
      }

      // Additional wait for dynamic content
      await this.page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
        { timeout: 5000 }
      ).catch(() => {}); // Ignore timeout

    } catch (error) {
      this.log(`⚠️ Warning: Loading wait error - ${error.message}`);
    }
  }

  /**
   * Navigate through the download workflow
   */
  async navigateDownloadWorkflow(findResult) {
    if (findResult.hasActionMenu) {
      // Click menu button and look for download option
      await this.page.click(findResult.actionSelector);
      await this.randomWait(500, 1000);

      const downloadOptions = [
        'button:has-text("Download")',
        'button:has-text("Save")',
        'button:has-text("Export")',
        '[role="menuitem"]:has-text("Download")',
        '[class*="download"]'
      ];

      let downloadClicked = false;
      for (const option of downloadOptions) {
        try {
          const downloadBtn = await this.page.$(option);
          if (downloadBtn) {
            await downloadBtn.click();
            downloadClicked = true;
            break;
          }
        } catch (e) {
          // Try next option
        }
      }

      if (!downloadClicked) {
        throw new Error('Could not find download option in menu');
      }
    } else if (findResult.hasCheckbox) {
      // Select checkbox and look for batch download button
      await this.page.click(findResult.checkboxSelector);
      await this.randomWait(500, 1000);

      const downloadButtons = [
        'button:has-text("Download Selected")',
        'button:has-text("Download Checked")',
        'button[title*="Download"]'
      ];

      let downloadClicked = false;
      for (const btn of downloadButtons) {
        try {
          const downloadBtn = await this.page.$(btn);
          if (downloadBtn) {
            await downloadBtn.click();
            downloadClicked = true;
            break;
          }
        } catch (e) {
          // Try next button
        }
      }

      if (!downloadClicked) {
        throw new Error('Could not find batch download button');
      }
    } else if (findResult.isClickableRow) {
      // Click the row and wait for details
      await this.page.click(findResult.rowSelector);
      await this.randomWait(1000, 2000);
      await this.waitForLoading();

      // Look for download button in details view
      const downloadButtons = [
        'button:has-text("Download Document")',
        'button:has-text("Download PDF")',
        'a:has-text("Download")',
        '[title*="Download"]',
        '[aria-label*="download"]'
      ];

      let downloadClicked = false;
      for (const btn of downloadButtons) {
        try {
          const downloadBtn = await this.page.$(btn);
          if (downloadBtn) {
            await downloadBtn.click();
            downloadClicked = true;
            break;
          }
        } catch (e) {
          // Try next button
        }
      }

      if (!downloadClicked) {
        throw new Error('Could not find download button in details view');
      }
    } else if (findResult.fallbackMode) {
      throw new Error(
        'Document found but no clear download interaction available. ' +
        `Row data: ${JSON.stringify(findResult.rowData)}`
      );
    }
  }

  /**
   * Main scraping method 
   */
  async scrape(address) {
    try {
      // Your existing scrape implementation
      return { success: true };
    } catch (error) {
      this.log(`❌ Scrape error: ${error.message}`);
      return { 
        success: false, 
        error: `Failed to scrape address: ${error.message}`
      };
    }
  }

  /**
   * Get prior deed record 
   */
  async getPriorDeed(address) {
    try {
      // Your existing getPriorDeed implementation
      return { success: true };
    } catch (error) {
      this.log(`❌ Prior deed error: ${error.message}`);
      return {
        success: false,
        error: `Failed to get prior deed: ${error.message}`
      };
    }
  }

  /**
   * Helper for random waits
   */
  async randomWait(min, max) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

        // No matching row found, return error
        return { found: false, reason: 'Document not found in results' };
      }, searchData.instrumentNumber);

      if (!documentInfo) {
        throw new Error('Failed to evaluate page for document search');
      }

      return documentInfo;
    } catch (error) {
      this.log(`Error finding document: ${error.message}`);
      return {
        found: false,
        reason: 'Document search failed',
        error: error.message
      };
    }

      this.log('📄 Document search result:', JSON.stringify(documentInfo, null, 2));

      if (!documentInfo.found) {
        throw new Error(`Could not find document in search results: ${documentInfo.reason}`);
      }

      // Handle the modern React-based UI interactions
      if (documentInfo.hasActionMenu) {
        this.log('🖱️ Found action menu button, clicking...');
        await this.page.click(documentInfo.actionSelector);
        await this.randomWait(1000, 2000);
        
        // Look for document/view action in the menu
        const menuItemSelectors = [
          'li:has-text("View")',
          'li:has-text("Document")',
          '[role="menuitem"]:has-text("View")',
          '[role="menuitem"]:has-text("Document")',
          'button:has-text("View")',
          'button:has-text("Document")'
        ];

        for (const menuSelector of menuItemSelectors) {
          try {
            const menuItem = await this.page.$(menuSelector);
            if (menuItem) {
              await menuItem.click();
              this.log(`✅ Clicked menu item: ${menuSelector}`);
              break;
            }
          } catch (e) {
            this.log(`⚠️ Menu item not found: ${menuSelector}`);
          }
        }
      } else if (documentInfo.hasCheckbox) {
        this.log('🖱️ Found checkbox, selecting row...');
        await this.page.click(documentInfo.checkboxSelector);
        await this.randomWait(1000, 2000);
        
        // Look for action buttons that appear after selection
        const actionButtonSelectors = [
          'button:has-text("View")',
          'button:has-text("Document")',
          '[role="button"]:has-text("View")',
          '[role="button"]:has-text("Document")'
        ];

        for (const buttonSelector of actionButtonSelectors) {
          try {
            const button = await this.page.$(buttonSelector);
            if (button) {
              await button.click();
              this.log(`✅ Clicked action button: ${buttonSelector}`);
              break;
            }
          } catch (e) {
            this.log(`⚠️ Action button not found: ${buttonSelector}`);
          }
        }
      } else if (documentInfo.isClickableRow) {
        this.log('🖱️ Found clickable row, clicking...');
        await this.page.click(`tbody ${documentInfo.rowSelector}`);
        await this.randomWait(1000, 2000);
      } else if (documentInfo.hasClickableElement) {
        this.log('🖱️ Found clickable element, clicking...');
        await this.page.click(documentInfo.elementSelector);
        await this.randomWait(1000, 2000);
      } else if (documentInfo.fallbackMode) {
        this.log('⚠️ No interactive elements found, trying alternative methods...');
        
        // Try clicking the cell containing the document number
        const cells = await this.page.$$('td');
        for (const cell of cells) {
          const text = await cell.evaluate(el => el.textContent?.trim());
          if (text === searchData.instrumentNumber) {
            await cell.click();
            this.log('✅ Clicked on document number cell');
            await this.randomWait(1000, 2000);
            break;
          }
        }
      }

      // Wait for potential overlay/dialog after clicking
      await this.randomWait(2000, 3000);
      
      // Check for "View Document" or similar buttons that may appear
      const viewButtonSelectors = [
        'button:has-text("View Document")',
        'button:has-text("Download")',
        'button:has-text("View PDF")',
        'a[href*=".pdf"]',
        'a[href*="document"]',
        '[role="button"]:has-text("View")'
      ];

      for (const buttonSelector of viewButtonSelectors) {
        try {
          const button = await this.page.waitForSelector(buttonSelector, { timeout: 2000 });
          if (button) {
            await button.click();
            this.log(`✅ Clicked view button: ${buttonSelector}`);
            break;
          }
        } catch (e) {
          this.log(`⚠️ View button not found: ${buttonSelector}`);
        }
      }      // Check if the link we found is actually a PDF or a detail page
      if (deedLink && deedLinkHref && !deedLinkHref.includes('.pdf')) {
        this.log('⚠️ Link found is not a direct PDF, it may be a detail page link');
        this.log('🔗 Navigating to detail page first...');

        // Navigate to the detail page
        await this.page.goto(deedLinkHref, { waitUntil: 'networkidle2', timeout: 30000 });
        await this.randomWait(2000, 3000);

        // Now search for PDF link on this page
        const detailPagePDF = await this.page.evaluate(() => {
          const pdfLinks = Array.from(document.querySelectorAll('a'))
            .filter(a => a.href.includes('.pdf') || a.textContent?.toLowerCase().includes('view document') || a.textContent?.toLowerCase().includes('download'));

          if (pdfLinks.length > 0) {
            return {
              found: true,
              href: pdfLinks[0].href,
              text: pdfLinks[0].textContent?.trim()
            };
          }
          return { found: false };
        });

        if (detailPagePDF.found) {
          this.log(`✅ Found PDF on detail page: ${detailPagePDF.text}`);
          deedLinkHref = detailPagePDF.href;
          deedLink = `a[href="${detailPagePDF.href}"]`;
        } else {
          this.log('⚠️ No PDF found on detail page, trying alternative approach...');
          deedLink = null; // Reset to trigger the fallback logic below
        }
      }

      if (!deedLink) {
        // Alternative: Look for result table rows that might need to be clicked first
        this.log('⚠️ No direct PDF link found, trying to find result rows...');

          // Enhanced debugging of page content
          const pageContent = await this.page.evaluate(() => {
            const content = {
              url: window.location.href,
              title: document.title,
              rowCount: document.querySelectorAll('table tbody tr').length,
              tableCount: document.querySelectorAll('table').length,
              allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
                href: a.href,
                text: a.textContent?.trim(),
                classes: a.className,
                dataset: Object.keys(a.dataset)
              })),
              tableHTML: document.querySelector('table')?.outerHTML,
              bodyText: document.body.innerText.substring(0, 1000)
            };
            return content;
          });

          this.log(`📊 Current page analysis:
URL: ${pageContent.url}
Title: ${pageContent.title}
Tables found: ${pageContent.tableCount}
Table rows: ${pageContent.rowCount}
Links found: ${pageContent.allLinks.length}
Page text preview: ${pageContent.bodyText}

Table HTML: ${pageContent.tableHTML}

Links:
${JSON.stringify(pageContent.allLinks, null, 2)}
`);

          await this.page.screenshot({ 
            path: `/tmp/dallas-search-${Date.now()}.png`,
            fullPage: true 
          });        const resultRowClick = await this.page.evaluate(() => {
          // Look for table rows in results (skip header rows)
          const rows = Array.from(document.querySelectorAll('table tbody tr'));

          const debugRows = [];

          // Find the first data row (not header) that contains a clickable link
          for (let i = 0; i < rows.length && i < 10; i++) { // Check first 10 rows max
            const row = rows[i];
            const text = row.textContent || '';

            debugRows.push({
              index: i,
              textLength: text.trim().length,
              textPreview: text.trim().substring(0, 100),
              hasLinks: row.querySelectorAll('a').length,
              hasButtons: row.querySelectorAll('button').length,
              hasOnclick: row.hasAttribute('onclick') || row.querySelector('[onclick]') !== null
            });

            // Skip empty or very short rows (likely headers)
            if (text.trim().length < 20) continue;

            // Look for a clickable element in this row
            const links = Array.from(row.querySelectorAll('a, button[onclick], tr[onclick], td[onclick]'));

            for (const clickable of links) {
              const href = clickable.href || clickable.getAttribute('onclick');
              if (href && !href.includes('javascript:void') && !href.includes('#')) {
                return {
                  found: true,
                  href: clickable.href || href,
                  text: text.substring(0, 200),
                  type: clickable.tagName,
                  debugRows
                };
              }
            }

            // Also check if the row itself is clickable
            const rowOnclick = row.getAttribute('onclick');
            if (rowOnclick && !rowOnclick.includes('void')) {
              return {
                found: true,
                href: rowOnclick,
                text: text.substring(0, 200),
                type: 'TR',
                isOnclick: true,
                debugRows
              };
            }
          }

          return { found: false, debugRows };
        });

        // Log debug information about first few rows
        if (resultRowClick.debugRows && resultRowClick.debugRows.length > 0) {
          this.log(`🔍 First 10 rows analysis:`);
          resultRowClick.debugRows.forEach(row => {
            this.log(`  Row ${row.index}: len=${row.textLength}, links=${row.hasLinks}, buttons=${row.hasButtons}, onclick=${row.hasOnclick}`);
            if (row.textPreview) {
              this.log(`    Preview: ${row.textPreview}`);
            }
          });
        }

        if (resultRowClick.found) {
          this.log(`✅ Found result row with link: ${resultRowClick.text}`);
          this.log(`🔗 Clicking: ${resultRowClick.href}`);

          // Navigate to the detail page
          await this.page.goto(resultRowClick.href, { waitUntil: 'networkidle2', timeout: 30000 });
          await this.randomWait(2000, 3000);

          // Now try to find the PDF link on the detail page
          const detailPageInfo = await this.page.evaluate(() => ({
            url: window.location.href,
            title: document.title,
            links: Array.from(document.querySelectorAll('a')).map(a => ({
              href: a.href,
              text: a.textContent?.trim()
            })).filter(l => l.href.includes('.pdf') || l.text?.toLowerCase().includes('view') || l.text?.toLowerCase().includes('download'))
          }));

          this.log(`📍 Detail page: ${detailPageInfo.url}`);
          this.log(`📄 PDF links found: ${JSON.stringify(detailPageInfo.links, null, 2)}`);

          if (detailPageInfo.links.length > 0) {
            // Found PDF link on detail page
            deedLink = `a[href="${detailPageInfo.links[0].href}"]`;
            this.log(`✅ Found PDF link on detail page: ${deedLink}`);
          } else {
            throw new Error('Could not find PDF link on detail page');
          }
        } else {
          throw new Error('Could not find deed document link or result rows in search results');
        }
      }

      // Set up CDP Fetch domain to intercept PDF
      this.log('🔧 Setting up PDF interception...');
      const client = await this.page.target().createCDPSession();

      await client.send('Fetch.enable', {
        patterns: [{ urlPattern: '*', requestStage: 'Response' }]
      });

      let pdfBuffer = null;
      let pdfIntercepted = false;

      client.on('Fetch.requestPaused', async (event) => {
        const { requestId, responseHeaders, responseStatusCode } = event;

        // Check if this is a PDF response
        const contentType = responseHeaders?.find(h => h.name.toLowerCase() === 'content-type');

        if (contentType && contentType.value.includes('pdf') && !pdfIntercepted) {
          this.log('📥 PDF detected, capturing...');
          pdfIntercepted = true;

          try {
            const response = await client.send('Fetch.getResponseBody', { requestId });
            pdfBuffer = Buffer.from(response.body, response.base64Encoded ? 'base64' : 'utf8');
            this.log(`✅ PDF captured: ${pdfBuffer.length} bytes`);
          } catch (error) {
            this.log(`⚠️ Error capturing PDF: ${error.message}`);
          }
        }

        // Continue request
        await client.send('Fetch.continueRequest', { requestId }).catch(() => {});
      });

      // Click on deed link
      this.log(`🖱️ Clicking on deed link: ${deedLink}`);
      await this.page.click(deedLink);
      this.log('✅ Clicked on deed link');

      // Wait for PDF to load/download
      this.log('⏳ Waiting for PDF to load (5-8 seconds)...');
      await this.randomWait(5000, 8000);

      if (!pdfBuffer) {
        this.log('⚠️ PDF not intercepted, trying alternative download method...');

        // Log current page URL to see where we are
        const currentUrl = this.page.url();
        this.log(`📍 Current page URL: ${currentUrl}`);

        // Try to get PDF URL from current page
        const pdfUrl = await this.page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a'));
          const pdfLink = links.find(a => a.href.includes('.pdf'));
          return pdfLink?.href || null;
        });

        if (pdfUrl) {
          this.log(`🔗 Found PDF URL: ${pdfUrl}`);
          // Download PDF directly
          const response = await this.page.goto(pdfUrl, { waitUntil: 'networkidle2', timeout: 30000 });
          pdfBuffer = await response.buffer();
        }
      }

      await client.detach();

      if (!pdfBuffer) {
        throw new Error('Could not download deed PDF');
      }

      this.log(`✅ Successfully downloaded deed PDF: ${pdfBuffer.length} bytes`);

      return {
        success: true,
        instrumentNumber: searchData.instrumentNumber,
        bookNumber: searchData.bookNumber,
        pageNumber: searchData.pageNumber,
        pdfData: pdfBuffer.toString('base64'),
        fileSize: pdfBuffer.length,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log(`❌ Error downloading deed: ${error.message}`);
      
      // Collect detailed debug information
      const debugInfo = {
        error: {
          message: error.message,
          stack: error.stack
        },
        page: {
          url: await this.page.url(),
          title: await this.page.title(),
        },
        network: {
          requests: Array.from(requests.entries()),
          failures: Array.from(requestFailed.entries())
        },
        timestamp: new Date().toISOString()
      };
      
      // Save debug info to file
      const fs = require('fs');
      const debugPath = `/tmp/dallas-debug-${Date.now()}.json`;
      fs.writeFileSync(debugPath, JSON.stringify(debugInfo, null, 2));
      
      // Take error screenshot
      const errorScreenshot = `/tmp/dallas-error-${Date.now()}.png`;
      await this.page.screenshot({ 
        path: errorScreenshot,
        fullPage: true 
      });
      
      this.log(`📸 Error screenshot saved to: ${errorScreenshot}`);
      this.log(`📝 Debug info saved to: ${debugPath}`);
      
      return {
        success: false,
        error: error.message,
        debugInfo: {
          screenshotPath: errorScreenshot,
          debugLogPath: debugPath,
          url: debugInfo.page.url,
          timestamp: debugInfo.timestamp
        }
      };
    } finally {
      // Cleanup
      try {
        await this.page.setRequestInterception(false);
        this.page.removeAllListeners('request');
        this.page.removeAllListeners('requestfailed');
      } catch (e) {
        this.log(`⚠️ Cleanup error: ${e.message}`);
      }
    }
  }

  /**
   * Main workflow: Search Dallas CAD and download deed
   */
  async scrape(address) {
    this.log(`🏠 Starting Dallas County deed scrape for: ${address}`);

    const result = {
      address,
      county: this.county,
      state: this.state,
      timestamp: new Date().toISOString(),
      steps: {}
    };

    try {
      if (!this.browser) {
        await this.initialize();
      }

      // Step 1: Skip Regrid (Dallas CAD supports direct address search)
      result.steps.step1 = {
        name: 'Regrid search',
        success: true,
        skipped: true,
        message: 'Dallas County supports direct address search'
      };

      // Step 2: Search Dallas CAD for property
      this.log('📍 Step 2: Searching Dallas CAD...');
      const cadResult = await this.searchDallasCAD(address);
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
      const downloadResult = await this.downloadDeed(cadResult);
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

    } catch (error) {
      this.log(`❌ Error in Dallas County scrape: ${error.message}`);
      result.success = false;
      result.error = error.message;
      return result;
    }
  }

  /**
   * Alias for scrape() to match API interface
   */
  async getPriorDeed(address) {
    return this.scrape(address);
  }

  /**
   * Random wait helper
   */
  async randomWait(min, max) {
    const wait = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, wait));
  }
}

module.exports = DallasCountyTexasScraper;
