/**
 * Final test of Guilford County implementation with all fixes
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testGuilfordFinal() {
  console.log('🚀 Final Guilford County Test - With All Fixes Applied\n');
  console.log('=' .repeat(60));
  console.log('Testing deed viewer screenshot capability');
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

  // Initialize the scraper with proper options
  const scraper = new GuilfordCountyScraper({
    logger: (msg) => console.log(`  ${msg}`)
  });

  // Set the page and browser directly since we're not using initialize()
  scraper.page = page;
  scraper.browser = browser;

  try {
    // Navigate directly to the deed viewer page
    console.log('\n📍 TEST: Direct Deed Viewer Access\n');

    const deedUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8461&bookpage=888';
    console.log(`Navigating to: ${deedUrl}`);

    await page.goto(deedUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Navigated to deed viewer');

    // Let the implementation handle the download
    console.log('\n📥 Attempting deed PDF download with fixed implementation...\n');

    const downloadResult = await scraper.downloadDeedPdf();

    console.log('\n' + '=' .repeat(60));
    console.log('📊 RESULTS:\n');

    if (downloadResult.success) {
      console.log('✅ SUCCESS! Deed PDF downloaded');
      console.log(`  Duration: ${downloadResult.duration}ms`);
      console.log(`  File size: ${downloadResult.fileSize} bytes`);
      console.log(`  Filename: ${downloadResult.filename}`);

      // Save the PDF
      if (downloadResult.pdfBase64) {
        const outputPath = `guilford-deed-final-${Date.now()}.pdf`;
        fs.writeFileSync(outputPath, Buffer.from(downloadResult.pdfBase64, 'base64'));
        console.log(`  Saved to: ${outputPath}`);
      }
    } else {
      console.log('❌ FAILED to download deed PDF');
      console.log(`  Error: ${downloadResult.error}`);

      // Take a debug screenshot
      const screenshot = await page.screenshot({ fullPage: true });
      fs.writeFileSync('guilford-final-debug.png', screenshot);
      console.log('  Debug screenshot saved to: guilford-final-debug.png');
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
testGuilfordFinal().catch(console.error);