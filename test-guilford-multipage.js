/**
 * Test multi-page deed document handling for Guilford County
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testGuilfordMultipage() {
  console.log('📚 Guilford County Multi-Page Document Test\n');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=AutoupgradeInsecureRequests',
      '--allow-insecure-localhost',
      '--unsafely-treat-insecure-origin-as-secure=http://rdlxweb.guilfordcountync.gov'
    ]
  });

  const page = await browser.newPage();
  await page.setBypassCSP(true);

  // Initialize the scraper
  const scraper = new GuilfordCountyScraper({
    logger: (msg) => console.log(`  ${msg}`)
  });

  // Set page and browser directly
  scraper.page = page;
  scraper.browser = browser;

  try {
    // Test with the same deed URL
    const deedUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8461&bookpage=888';

    console.log('\n📍 TEST: Multi-Page Deed Capture\n');
    console.log(`URL: ${deedUrl}`);

    // Navigate to the deed viewer
    console.log('\n⏳ Navigating to deed viewer...');
    await page.goto(deedUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Navigated successfully');

    // Wait for initial content to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for page navigation elements
    console.log('\n🔍 Checking for multi-page indicators...');

    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const pageMatch = bodyText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);

      // Look for navigation elements
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], [onclick]'));
      const navButtons = buttons.filter(btn => {
        const text = btn.textContent || '';
        const onclick = btn.getAttribute('onclick') || '';
        return text.match(/next|prev|first|last|page/i) || onclick.match(/next|prev|first|last|page/i);
      });

      // Look for page number indicators
      const pageInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], select'))
        .filter(input => {
          const name = input.name || '';
          const id = input.id || '';
          return name.match(/page/i) || id.match(/page/i);
        });

      return {
        pageMatch: pageMatch ? pageMatch[0] : null,
        currentPage: pageMatch ? parseInt(pageMatch[1]) : null,
        totalPages: pageMatch ? parseInt(pageMatch[2]) : null,
        navigationButtons: navButtons.length,
        pageInputs: pageInputs.length,
        hasMultiplePages: !!(pageMatch || navButtons.length > 0 || pageInputs.length > 0)
      };
    });

    console.log('Page Analysis:');
    console.log(`  Page indicator: ${pageInfo.pageMatch || 'Not found'}`);
    console.log(`  Current page: ${pageInfo.currentPage || 'Unknown'}`);
    console.log(`  Total pages: ${pageInfo.totalPages || 'Unknown'}`);
    console.log(`  Navigation buttons found: ${pageInfo.navigationButtons}`);
    console.log(`  Page inputs found: ${pageInfo.pageInputs}`);
    console.log(`  Multi-page detected: ${pageInfo.hasMultiplePages ? 'Yes' : 'No'}`);

    // Now test the download with multi-page support
    console.log('\n📥 Testing multi-page PDF download...\n');

    const startTime = Date.now();
    const downloadResult = await scraper.downloadDeedPdf();
    const duration = Date.now() - startTime;

    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS:\n');

    if (downloadResult.success) {
      console.log('✅ SUCCESS! Multi-page deed PDF downloaded');
      console.log(`  Duration: ${duration}ms`);
      console.log(`  File size: ${downloadResult.fileSize} bytes`);
      console.log(`  Filename: ${downloadResult.filename}`);

      // Save the PDF
      if (downloadResult.pdfBase64) {
        const outputPath = `guilford-multipage-${Date.now()}.pdf`;
        const pdfBuffer = Buffer.from(downloadResult.pdfBase64, 'base64');
        fs.writeFileSync(outputPath, pdfBuffer);
        console.log(`  Saved to: ${outputPath}`);

        // Analyze the PDF to check page count
        try {
          const { PDFDocument } = require('pdf-lib');
          const pdfDoc = await PDFDocument.load(pdfBuffer);
          const pageCount = pdfDoc.getPageCount();
          console.log(`\n📄 PDF Analysis:`);
          console.log(`  Total pages in PDF: ${pageCount}`);

          if (pageCount > 1) {
            console.log('  ✅ Multi-page PDF successfully created!');
          } else {
            console.log('  ⚠️  Single page PDF (multi-page capture may not have worked)');
          }
        } catch (pdfErr) {
          console.log(`  Could not analyze PDF: ${pdfErr.message}`);
        }
      }
    } else {
      console.log('❌ FAILED to download deed PDF');
      console.log(`  Error: ${downloadResult.error}`);

      // Take a debug screenshot
      const screenshot = await page.screenshot({ fullPage: true });
      fs.writeFileSync('guilford-multipage-debug.png', screenshot);
      console.log('  Debug screenshot saved to: guilford-multipage-debug.png');
    }

  } catch (error) {
    console.error('\n❌ Test error:', error.message);
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Test complete. Closing browser...');
    await browser.close();
  }
}

// Run the test
testGuilfordMultipage().catch(console.error);