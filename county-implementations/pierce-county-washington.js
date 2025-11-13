/**
 * Pierce County, Washington - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Records: https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx
 *
 * Search Method: Parcel ID search
 *
 * Workflow:
 * 1. Navigate to Pierce County Real Estate search
 * 2. Enter parcel ID in 'Parcel #' field
 * 3. Find first document that is NOT 'excise tax affidavit'
 * 4. Click on 'View' button - new window opens
 * 5. Click 'Get Image Now' button directly (no need to click image icon)
 * 6. Download PDF
 */

const DeedScraper = require('../deed-scraper');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
puppeteer.use(StealthPlugin());

class PierceCountyWashingtonScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Pierce';
    this.state = 'WA';
    this.debugLogs = [];
    this.parcelId = null;
    this.instrumentNumber = null;
  }

  /**
   * API-compatible entry point - uses Regrid to get parcel ID
   * This method is called by the API server
   */
  async getPriorDeed(address) {
    const startTime = Date.now();

    try {
      this.log(`🏁 Starting prior deed download for: ${address}`);

      // Step 1: Get property data from Regrid to extract parcel ID
      this.log(`📍 Step 1: Getting property data from Regrid...`);
      const regridData = await this.getPropertyDataFromRegrid(address);

      if (!regridData.success || !regridData.parcelId) {
        throw new Error('Failed to get parcel ID from Regrid');
      }

      this.log(`✅ Step 1 Complete: Parcel ID: ${regridData.parcelId}`);

      // Step 2-4: Use Pierce County's specific workflow
      const result = await this.downloadPriorDeed(address, regridData.parcelId);

      // Return in API-compatible format
      return {
        success: result.success,
        address: address,
        parcelId: regridData.parcelId,
        instrumentNumber: result.instrumentNumber,
        pdfBase64: result.pdfBase64,
        filename: result.filename,
        fileSize: result.fileSize,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        error: result.error
      };

    } catch (error) {
      this.log(`❌ ERROR: ${error.message}`);
      return {
        success: false,
        address: address,
        error: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Direct entry point when parcel ID is already known
   * This method is called by getPriorDeed() or can be called directly for testing
   */
  async downloadPriorDeed(address, parcelId = null) {
    const startTime = Date.now();

    try {
      this.log(`🏁 Starting prior deed download for: ${address}`);

      // Store parcel ID if provided
      if (parcelId) {
        this.parcelId = parcelId;
        this.log(`📍 Using provided parcel ID: ${parcelId}`);
      } else {
        throw new Error('Parcel ID is required for Pierce County. Please provide parcelId parameter.');
      }

      // Step 1: Search by parcel ID
      await this.searchByParcelId();

      // Step 2: Find first non-excise-tax document
      await this.findPriorDeed();

      // Step 3: Download PDF
      const pdfResult = await this.downloadDeedPdf();

      if (!pdfResult.success) {
        throw new Error(pdfResult.error || 'PDF download failed');
      }

      return {
        success: true,
        address: address,
        parcelId: this.parcelId,
        instrumentNumber: this.instrumentNumber,
        pdfBase64: pdfResult.pdfBase64,
        filename: pdfResult.filename,
        fileSize: pdfResult.fileSize,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.log(`❌ ERROR: ${error.message}`);
      return {
        success: false,
        address: address,
        error: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Step 1: Search by parcel ID
   */
  async searchByParcelId() {
    this.log(`📍 STEP 1: Searching by parcel ID...`);

    // Navigate to Pierce County search page
    this.log(`🌐 Navigating to Pierce County Real Estate search...`);
    await this.page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await this.randomWait(2000, 3000);

    // Handle disclaimer if present
    try {
      this.log(`✅ Checking for disclaimer page...`);
      const disclaimerClicked = await this.page.evaluate(() => {
        // Look for "click here to acknowledge" link
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          const text = link.textContent.toLowerCase();
          if (text.includes('click here to acknowledge') ||
              (text.includes('acknowledge') && text.includes('disclaimer'))) {
            link.click();
            return true;
          }
        }
        return false;
      });

      if (disclaimerClicked) {
        this.log(`✅ Clicked disclaimer acknowledgment`);
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
        await this.randomWait(2000, 3000);
      } else {
        this.log(`   No disclaimer found, continuing...`);
      }
    } catch (e) {
      this.log(`   No disclaimer or already acknowledged`);
    }

    // Find and fill the Parcel # field
    this.log(`📝 Entering parcel ID: ${this.parcelId}`);

    // Look for the Parcel # input field
    // Based on exploration, the field is: cphNoMargin_f_Datatextedit28p
    const parcelField = await this.page.evaluate(() => {
      // Strategy 1: Direct ID (most reliable based on exploration)
      let input = document.querySelector('#cphNoMargin_f_Datatextedit28p');
      if (input) {
        return {
          id: input.id,
          name: input.name,
          type: input.type,
          found: 'direct-id'
        };
      }

      // Strategy 2: Find by label text "Parcel #:"
      const allElements = Array.from(document.querySelectorAll('span, label, td, th'));
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text === 'Parcel #:' || text === 'Parcel #' || text.includes('Parcel #')) {
          // Found label, look for input in same table row
          const row = el.closest('tr');
          if (row) {
            const input = row.querySelector('input[type="text"]:not([type="hidden"])');
            if (input) {
              return {
                id: input.id,
                name: input.name,
                type: input.type,
                found: 'by-label'
              };
            }
          }
        }
      }

      return null;
    });

    if (!parcelField) {
      throw new Error('Could not find Parcel # input field');
    }

    this.log(`   Found parcel field: ${parcelField.id || parcelField.name}`);

    // Fill the parcel ID field
    const selector = parcelField.id ? `#${parcelField.id}` : `input[name="${parcelField.name}"]`;
    await this.page.waitForSelector(selector, { timeout: 10000 });
    await this.page.click(selector, { clickCount: 3 });
    await this.page.type(selector, this.parcelId);
    await this.randomWait(1000, 1500);

    // Press Enter or click search button
    this.log(`🔍 Submitting search...`);
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      this.page.keyboard.press('Enter')
    ]);

    this.log(`✅ Search submitted, results page loaded`);
    await this.randomWait(2000, 3000);
  }

  /**
   * Step 2: Find first document that is NOT 'excise tax affidavit'
   */
  async findPriorDeed() {
    this.log(`📄 STEP 2: Finding prior deed document...`);

    // Scroll to load all content
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.randomWait(1000, 2000);

    // **CRITICAL**: Wait for the table data to load (it loads via AJAX)
    // The data appears in a row with 100+ cells
    this.log(`⏳ Waiting for document table to load...`);

    await this.page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 });

    this.log(`✅ Document table loaded`);
    await this.randomWait(2000, 3000); // Extra wait for stability

    // Find the document table and locate first non-excise-tax document
    // Pierce County uses a grid-based table where all documents are in one row with 200+ cells
    const documentInfo = await this.page.evaluate(() => {
      // Find the data row (has many cells - typically 200+)
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));

        // Look for the data row (has many cells)
        if (cells.length < 100) continue;

        // Each document is a group of cells. Look for "View" cells which mark document starts
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();

          // Found a "View" cell - this marks the start of a document
          // Note: The cell contains a <div> with an image, not an <a> link
          if (cellText === 'View') {
            // Look ahead for instrument number (typically 2-3 cells later)
            let instrumentNumber = null;
            for (let j = i + 1; j < Math.min(i + 5, cells.length); j++) {
              const text = cells[j].textContent.trim();
              if (text.match(/^\d{7,}$/)) {
                instrumentNumber = text;
                break;
              }
            }

            // Look ahead for document type (typically 8-9 cells after "View")
            let documentType = null;
            for (let j = i + 5; j < Math.min(i + 15, cells.length); j++) {
              const text = cells[j].textContent.trim();
              if (text.match(/^(STATUTORY\s+)?WARRANTY\s+DEED$/i) ||
                  text.match(/^QUIT\s*CLAIM\s+DEED$/i) ||
                  text.match(/^DEED$/i) ||
                  text.match(/^EXCISE\s+TAX\s+AFFIDAVIT$/i)) {
                documentType = text;
                break;
              }
            }

            // If we found both instrument number and document type
            if (instrumentNumber && documentType) {
              // Skip excise tax affidavits
              if (documentType.toUpperCase().includes('EXCISE TAX AFFIDAVIT')) {
                continue;
              }

              // Found a valid deed! Return info to click the View cell
              return {
                found: true,
                documentType: documentType,
                instrumentNumber: instrumentNumber,
                viewCellIndex: i,
                rowIndex: rows.indexOf(row)
              };
            }
          }
        }
      }

      return { found: false };
    });

    if (!documentInfo.found) {
      throw new Error('No prior deed document found (all documents are excise tax affidavits)');
    }

    this.log(`✅ Found prior deed document:`);
    this.log(`   Document Type: ${documentInfo.documentType}`);
    this.log(`   Instrument #: ${documentInfo.instrumentNumber}`);

    this.instrumentNumber = documentInfo.instrumentNumber;

    // Click on the "View" cell to open the document
    this.log(`🔗 Clicking on "View" cell for instrument ${documentInfo.instrumentNumber}...`);
    console.log('[Pierce DEBUG] Clicking View cell...');

    // Click the View cell
    await this.page.evaluate((rowIdx, cellIdx) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows[rowIdx];
      if (row) {
        const cells = Array.from(row.querySelectorAll('td'));
        const cell = cells[cellIdx];
        if (cell) {
          // Click the cell (the div inside is clickable)
          cell.click();
        }
      }
    }, documentInfo.rowIndex, documentInfo.viewCellIndex);

    // Wait for new page/tab to potentially open
    console.log('[Pierce DEBUG] Waiting 5 seconds for any new tabs...');
    await this.randomWait(4000, 5000);

    // Check all pages to see if a new one opened
    const pages = await this.browser.pages();
    console.log(`[Pierce DEBUG] Total pages: ${pages.length}`);

    // Look for the newest page (not the original search page)
    let documentPage = null;
    if (pages.length > 1) {
      // Get the last page (usually the newest)
      documentPage = pages[pages.length - 1];

      const newURL = documentPage.url();
      console.log(`[Pierce DEBUG] Found new page at: ${newURL}`);

      // Make sure it's not the search page
      if (!newURL.includes('SearchEntry') && !newURL.includes('SearchResults')) {
        this.log(`✅ Document page opened in new tab: ${newURL}`);

        // Switch context to the new page for the next step
        this.page = documentPage;
        console.log('[Pierce DEBUG] Switched context to new page');
      } else {
        console.log('[Pierce DEBUG] New page is still a search page, might not have opened correctly');
        // Try using the current page
        documentPage = null;
      }
    } else {
      console.log('[Pierce DEBUG] No new pages detected, checking if current page navigated...');

      // Check if current page URL changed
      const currentURL = this.page.url();
      console.log(`[Pierce DEBUG] Current page URL: ${currentURL}`);

      if (currentURL.includes('Search')) {
        this.log(`⚠️  No new page detected and still on search page`);
      }
    }

    await this.randomWait(1000, 2000);
  }

  /**
   * Step 3: Download PDF - Click 'Get Image Now' directly
   * After clicking View button, a new window opens - we go directly to "Get Image Now"
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      this.log(`📥 STEP 3: Downloading PDF...`);

      // Check if we're already on a new window/page from clicking View
      // If so, we can skip the image icon click and go directly to "Get Image Now"
      const currentUrl = this.page.url();
      this.log(`Current page URL: ${currentUrl}`);

      let popupPage = this.page; // Use current page (which was set in findPriorDeed)

      // If we're still on search page, we need to find the popup manually
      if (currentUrl.includes('Search')) {
        this.log('⚠️  Still on search page, looking for popup window...');
        const pages = await this.browser.pages();

        // Find the document page (not search page)
        for (const page of pages) {
          const url = page.url();
          if (!url.includes('SearchEntry') && !url.includes('SearchResults')) {
            popupPage = page;
            this.page = page;
            this.log(`✅ Found document page: ${url}`);
            break;
          }
        }
      }

      this.log(`✅ Using page: ${popupPage.url()}`);
      await this.randomWait(3000, 4000);

      // Look for LTViewer iframe (common in deed systems)
      this.log('🔍 Looking for viewer iframe...');
      let frames = popupPage.frames();
      this.log(`  Found ${frames.length} frames in popup`);

      let viewerFrame = null;
      for (const frame of frames) {
        const url = frame.url();
        if (url.includes('LTViewer') || url.includes('Viewer') || url.includes('Image')) {
          viewerFrame = frame;
          this.log(`  ✓ Found viewer iframe: ${url}`);
          break;
        }
      }

      // If iframe exists, click "Get Image Now" inside it
      if (viewerFrame) {
        this.log(`📥 Clicking "Get Image Now" inside iframe...`);

        const getImageClicked = await viewerFrame.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

          for (const el of allElements) {
            const text = (el.textContent || el.value || '').toLowerCase().trim();
            if (text.includes('get image now') || text.includes('get item') || el.id === 'btnProcessNow') {
              el.click();
              return { success: true, text: el.textContent || el.value || 'Get Image Now' };
            }
          }

          return { success: false };
        });

        if (!getImageClicked.success) {
          throw new Error('Could not find "Get Image Now" button in iframe');
        }

        this.log(`✅ Clicked: ${getImageClicked.text}`);
      } else {
        // No iframe, look for "Get Image Now" button on main popup page
        this.log(`📥 Clicking "Get Image Now" on popup page...`);

        const getImageClicked = await popupPage.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

          for (const el of allElements) {
            const text = (el.textContent || el.value || '').toLowerCase().trim();
            if (text.includes('get image now') || text.includes('get image')) {
              el.click();
              return { success: true, text: el.textContent || el.value || 'Get Image Now' };
            }
          }

          return { success: false };
        });

        if (!getImageClicked.success) {
          throw new Error('Could not find "Get Image Now" button');
        }

        this.log(`✅ Clicked: ${getImageClicked.text}`);
      }

      // Wait for PDF to load
      this.log('⏳ Waiting for PDF to load...');
      await this.randomWait(8000, 10000);

      // Look for PDF in frames (use popup page or main page)
      this.log('📥 Looking for PDF in frames...');
      let pdfUrl = null;

      const allFrames = (popupPage || this.page).frames();
      this.log(`  Checking ${allFrames.length} frames for PDF...`);

      for (let i = 0; i < allFrames.length; i++) {
        const frame = allFrames[i];
        const frameUrl = frame.url();

        this.log(`  Frame ${i}: ${frameUrl.substring(0, 80)}...`);

        // Check if frame URL is a PDF
        if (frameUrl.includes('.pdf') || frameUrl.includes('GetFile') || frameUrl.includes('ViewImage') || frameUrl.includes('GetImage')) {
          this.log(`  ✓ Found PDF URL in frame: ${frameUrl}`);
          pdfUrl = frameUrl;
          break;
        }

        // Check if frame contains PDF content
        try {
          const hasPdf = await frame.evaluate(() => {
            // Check for embed/object with PDF
            const pdfEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]');
            if (pdfEmbed) {
              return { hasPdf: true, src: pdfEmbed.src || pdfEmbed.data };
            }

            // Check if body starts with PDF signature
            const bodyText = document.body?.textContent || '';
            if (bodyText.startsWith('%PDF')) {
              return { hasPdf: true, src: window.location.href };
            }

            return { hasPdf: false };
          });

          if (hasPdf.hasPdf) {
            this.log(`  ✓ Found PDF content in frame ${i}: ${hasPdf.src}`);
            pdfUrl = hasPdf.src;
            break;
          }
        } catch (e) {
          // Frame might be cross-origin, skip
        }
      }

      if (!pdfUrl) {
        throw new Error('Could not find PDF URL in any frame');
      }

      // Download the PDF
      this.log(`📥 Downloading PDF from: ${pdfUrl}`);

      const pdfData = await (popupPage || this.page).evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Accept': 'application/pdf,*/*' }
          });

          if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
          }

          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Convert to base64
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }

          return {
            success: true,
            base64: btoa(binary),
            size: uint8Array.length
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }, pdfUrl);

      if (!pdfData.success) {
        throw new Error(`PDF download failed: ${pdfData.error}`);
      }

      this.log(`✅ Downloaded ${(pdfData.size / 1024).toFixed(2)} KB`);

      // Verify it's a PDF
      const pdfBuffer = Buffer.from(pdfData.base64, 'base64');
      const signature = pdfBuffer.toString('utf8', 0, 4);

      if (!signature.startsWith('%PDF')) {
        throw new Error(`Downloaded file is not a PDF (signature: ${signature})`);
      }

      const filename = `pierce_deed_${this.instrumentNumber || this.parcelId}.pdf`;

      return {
        success: true,
        duration: Date.now() - startTime,
        pdfBase64: pdfData.base64,
        filename: filename,
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
}

module.exports = PierceCountyWashingtonScraper;
