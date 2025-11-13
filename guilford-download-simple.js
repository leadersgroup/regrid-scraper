/**
 * Simplified downloadDeedPdf method for Guilford County
 * Based on Forsyth County's proven approach
 */

async function downloadDeedPdf() {
  const startTime = Date.now();

  try {
    this.log('🔍 Looking for PDF...');

    // Wait longer for PDF to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check current URL
    const currentUrl = this.page.url();
    this.log(`Current URL: ${currentUrl}`);

    // Strategy 1: Check if current page is PDF or serves PDF with export parameter
    this.log('📥 Strategy 1: Trying direct PDF export with &export=pdf parameter...');

    // Try adding export=pdf parameter to current URL if it's a deed viewer
    if (currentUrl.includes('gis_viewimage.php')) {
      const url = new URL(currentUrl);
      url.searchParams.set('export', 'pdf');
      const pdfExportUrl = url.toString();

      this.log(`  Attempting: ${pdfExportUrl}`);

      const pdfData = await this.page.evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            credentials: 'include',
            headers: {
              'Accept': 'application/pdf,*/*'
            }
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
          return {
            success: false,
            error: err.message
          };
        }
      }, pdfExportUrl);

      if (pdfData.success) {
        this.log(`  📦 Received ${(pdfData.size / 1024).toFixed(2)} KB from server`);
        let pdfBuffer = Buffer.from(pdfData.base64, 'base64');
        const signature = pdfBuffer.toString('utf8', 0, 4);

        // Handle PHP errors prepended to PDF
        if (signature !== '%PDF') {
          this.log('  ⚠️ PDF has prepended content, searching for PDF signature...');
          const searchLimit = Math.min(pdfBuffer.length, 5000);
          const searchText = pdfBuffer.toString('utf8', 0, searchLimit);
          const pdfIndex = searchText.indexOf('%PDF');

          if (pdfIndex > 0) {
            this.log(`  ✅ Found PDF signature at byte ${pdfIndex} - stripping errors`);
            pdfBuffer = pdfBuffer.slice(pdfIndex);
          }
        }

        // Verify we have a valid PDF now
        const finalSignature = pdfBuffer.toString('utf8', 0, 4);
        if (finalSignature === '%PDF') {
          this.log(`  ✅ PDF downloaded successfully: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
          return {
            success: true,
            duration: Date.now() - startTime,
            pdfBase64: pdfBuffer.toString('base64'),
            filename: `guilford_deed_${Date.now()}.pdf`,
            fileSize: pdfBuffer.length,
            downloadPath: ''
          };
        }
      } else {
        this.log(`  ⚠️ Export PDF failed: ${pdfData.error}`);
      }
    }

    // Strategy 2: Look for iframe with PDF
    this.log('📥 Strategy 2: Checking for PDF in iframe...');
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
      this.log(`  ✅ Found PDF in iframe: ${iframeInfo.src}`);
      const pdfBase64 = await this.downloadPdfFromUrl(iframeInfo.src);

      return {
        success: true,
        duration: Date.now() - startTime,
        pdfBase64,
        filename: `guilford_deed_${Date.now()}.pdf`,
        fileSize: Buffer.from(pdfBase64, 'base64').length,
        downloadPath: ''
      };
    }

    // Strategy 3: Look for embed or object tags
    this.log('📥 Strategy 3: Checking for PDF embed/object...');
    const embedInfo = await this.page.evaluate(() => {
      const embeds = Array.from(document.querySelectorAll('embed, object'));
      for (const embed of embeds) {
        const src = embed.src || embed.data;
        if (src && (src.includes('.pdf') || src.includes('pdf') || src.includes('.tif') || src.includes('viewimage'))) {
          return { found: true, src };
        }
      }
      return { found: false };
    });

    if (embedInfo.found) {
      this.log(`  ✅ Found content in embed: ${embedInfo.src}`);
      const pdfBase64 = await this.downloadPdfFromUrl(embedInfo.src);

      return {
        success: true,
        duration: Date.now() - startTime,
        pdfBase64,
        filename: `guilford_deed_${Date.now()}.pdf`,
        fileSize: Buffer.from(pdfBase64, 'base64').length,
        downloadPath: ''
      };
    }

    // Strategy 4: Look for download button or link
    this.log('📥 Strategy 4: Looking for download button/link...');
    const downloadUrl = await this.page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));

      for (const el of allElements) {
        const text = el.textContent.toLowerCase();
        const href = el.href || '';

        if ((text.includes('download') || text.includes('pdf') || text.includes('view') || href.includes('.pdf') || href.includes('viewimage')) &&
            el.offsetParent !== null) {
          return el.href || null;
        }
      }

      return null;
    });

    if (downloadUrl) {
      this.log(`  ✅ Found download URL: ${downloadUrl}`);

      // Try with export=pdf parameter
      const url = new URL(downloadUrl);
      url.searchParams.set('export', 'pdf');
      const pdfExportUrl = url.toString();
      this.log(`  Trying with export parameter: ${pdfExportUrl}`);

      const pdfBase64 = await this.downloadPdfFromUrl(pdfExportUrl);

      return {
        success: true,
        duration: Date.now() - startTime,
        pdfBase64,
        filename: `guilford_deed_${Date.now()}.pdf`,
        fileSize: Buffer.from(pdfBase64, 'base64').length,
        downloadPath: ''
      };
    }

    // Strategy 5: Try to construct PDF URL from current page parameters
    this.log('📥 Strategy 5: Attempting to construct PDF URL from page...');
    const constructedUrl = await this.page.evaluate(() => {
      // Look for any URL patterns in the page that might lead to PDF
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        if (link.href.includes('ShowDocument') ||
            link.href.includes('ViewDocument') ||
            link.href.includes('GetDocument') ||
            link.href.includes('viewimage') ||
            link.href.includes('.pdf')) {
          return link.href;
        }
      }
      return null;
    });

    if (constructedUrl) {
      this.log(`  ✅ Found document URL: ${constructedUrl}`);

      // Try with export=pdf parameter
      const url = new URL(constructedUrl);
      url.searchParams.set('export', 'pdf');
      const pdfExportUrl = url.toString();
      this.log(`  Trying with export parameter: ${pdfExportUrl}`);

      const pdfBase64 = await this.downloadPdfFromUrl(pdfExportUrl);

      return {
        success: true,
        duration: Date.now() - startTime,
        pdfBase64,
        filename: `guilford_deed_${Date.now()}.pdf`,
        fileSize: Buffer.from(pdfBase64, 'base64').length,
        downloadPath: ''
      };
    }

    throw new Error('Could not find PDF to download using any strategy');

  } catch (error) {
    this.log(`❌ PDF download failed: ${error.message}`);
    return {
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

// Export for testing
module.exports = { downloadDeedPdf };
