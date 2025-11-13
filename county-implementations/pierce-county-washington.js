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
 * 4. Click on 'Instrument # Book-Page' to view document
 * 5. Click on 'image:' icon
 * 6. Click 'Get Image Now' button
 * 7. Download PDF
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

    // Find the document table and locate first non-excise-tax document
    // Pierce County uses a grid-based table where all documents are in one row with 200+ cells
    const documentInfo = await this.page.evaluate(() => {
      // Find the data row (has many cells - typically 200+)
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));

        // Look for the data row (has many cells)
        if (cells.length < 100) continue;

        // Each document is a group of cells. Look for "View" links which mark document starts
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();

          // Found a "View" link - this marks the start of a document
          if (cellText === 'View' && cell.querySelector('a')) {
            const viewLink = cell.querySelector('a');

            // Look ahead for instrument number (typically 2-3 cells later)
            let instrumentNumber = null;
            let instrumentLink = null;
            for (let j = i + 1; j < Math.min(i + 5, cells.length); j++) {
              const text = cells[j].textContent.trim();
              if (text.match(/^\d{7,}$/)) {
                instrumentNumber = text;
                const link = cells[j].querySelector('a');
                if (link) {
                  instrumentLink = link;
                }
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

              // Found a valid deed! Return the instrument link or view link
              return {
                found: true,
                documentType: documentType,
                instrumentNumber: instrumentNumber,
                viewLink: viewLink ? viewLink.href : null,
                instrumentLink: instrumentLink ? instrumentLink.href : null
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

    // Click on the instrument link (prefer instrumentLink, fallback to viewLink)
    const linkToClick = documentInfo.instrumentLink || documentInfo.viewLink;
    if (!linkToClick) {
      throw new Error('No clickable link found for the document');
    }

    this.log(`🔗 Clicking on instrument link...`);
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      this.page.goto(linkToClick, { waitUntil: 'networkidle2' })
    ]);

    this.log(`✅ Navigated to document details page`);
    await this.randomWait(2000, 3000);
  }

  /**
   * Step 3: Download PDF - Click 'image:' icon, then 'Get Image Now'
   * Based on Mecklenburg County's pattern
   */
  async downloadDeedPdf() {
    const startTime = Date.now();

    try {
      this.log(`📥 STEP 3: Downloading PDF...`);
      this.log(`🖼️  Clicking "Image" icon to open PDF export page...`);

      // Setup new page listener BEFORE clicking the button
      const newPagePromise = new Promise(resolve =>
        this.browser.once('targetcreated', target => resolve(target))
      );

      // Click the image icon (multiple strategies like Mecklenburg)
      const imageButtonClicked = await this.page.evaluate(() => {
        // Strategy 1: Look for "Image:" text in table cells and find the icon next to it
        const tableCells = Array.from(document.querySelectorAll('td, th'));

        for (const cell of tableCells) {
          const text = cell.textContent.trim();
          if (text === 'Image:' || text.startsWith('Image:')) {
            // Found the "Image:" label, look for icon in next cell or within same row
            const row = cell.parentElement;
            const nextCell = cell.nextElementSibling;

            // Check next cell for a link with an image
            if (nextCell) {
              const link = nextCell.querySelector('a');
              if (link) {
                link.click();
                return { success: true, text: 'Image icon (in next cell)' };
              }

              // Or check if there's an image that's clickable
              const img = nextCell.querySelector('img');
              if (img && img.parentElement.tagName === 'A') {
                img.parentElement.click();
                return { success: true, text: 'Image icon (img in next cell)' };
              }
            }

            // Check in the same row for any clickable images
            if (row) {
              const links = row.querySelectorAll('a');
              for (const link of links) {
                const img = link.querySelector('img');
                if (img) {
                  link.click();
                  return { success: true, text: 'Image icon (in same row)' };
                }
              }
            }
          }
        }

        // Strategy 2: Look for small document/image icons in the main document
        const imageIcons = Array.from(document.querySelectorAll('a img'));
        for (const icon of imageIcons) {
          const src = icon.src || '';
          const alt = (icon.alt || '').toLowerCase();
          const title = (icon.title || '').toLowerCase();

          // Look for document/image icons
          if (src.includes('doc') || src.includes('image') || src.includes('icon') ||
              alt.includes('image') || title.includes('image')) {
            const parent = icon.parentElement;
            if (parent && parent.tagName === 'A') {
              parent.click();
              return { success: true, text: `Image icon (${src.split('/').pop()})` };
            }
          }
        }

        // Strategy 3: Look for any link with "image" in attributes
        const clickables = Array.from(document.querySelectorAll('a'));
        for (const el of clickables) {
          const title = (el.title || '').toLowerCase();
          const href = (el.href || '').toLowerCase();

          if (title.includes('image') || href.includes('image')) {
            el.click();
            return { success: true, text: el.title || 'Image link' };
          }
        }

        return { success: false };
      });

      if (!imageButtonClicked.success) {
        throw new Error('Could not find "Image" icon on document page');
      }

      this.log(`✅ Clicked: ${imageButtonClicked.text}`);

      // Wait for the new popup window to open
      this.log('⏳ Waiting for popup window to open...');

      const exportTarget = await Promise.race([
        newPagePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Popup timeout after 15 seconds')), 15000)
        )
      ]);

      await this.randomWait(2000, 3000);

      // Get the popup page
      let popupPage = await exportTarget.page();

      // If page() returns null, find it manually
      if (!popupPage) {
        this.log('  Finding popup manually...');
        await this.randomWait(2000, 3000);
        const pages = await this.browser.pages();
        popupPage = pages[pages.length - 1];
      }

      this.log(`✅ Popup opened: ${popupPage.url()}`);
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
