/**
 * End-to-end test for Guilford County implementation
 * Tests the complete flow from property search to deed download
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina.js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testGuilfordEndToEnd() {
  console.log('🚀 Guilford County End-to-End Test\n');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=AutoupgradeInsecureRequests'
    ]
  });

  const page = await browser.newPage();

  // Initialize the scraper
  const scraper = new GuilfordCountyScraper(page, (msg) => console.log(`  ${msg}`));

  let searchResult = null;
  let deedInfo = null;

  try {
    // Test 1: Initialize the scraper
    console.log('\n📍 TEST 1: Initialize Scraper\n');
    await scraper.initialize();
    console.log('✅ Successfully initialized scraper');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Search for a property
    console.log('\n📍 TEST 2: Search for Property\n');
    const searchQuery = '1205 Glendale Dr';
    console.log(`Searching for: ${searchQuery}`);

    // Parse the address - searchProperty expects streetNumber and streetName separately
    const [streetNumber, ...streetNameParts] = searchQuery.split(' ');
    const streetName = streetNameParts.join(' ');

    searchResult = await scraper.searchProperty(streetNumber, streetName);

    if (searchResult && searchResult.success) {
      console.log('✅ Property search successful');
      console.log(`  Parcel Number: ${searchResult.parcelNumber || 'N/A'}`);

      // Test 3: Get deed information
      console.log('\n📍 TEST 3: Get Deed Information\n');

      deedInfo = await scraper.getDeedInfo();

      if (deedInfo && deedInfo.deeds && deedInfo.deeds.length > 0) {
        console.log(`Found ${deedInfo.deeds.length} deed(s):`);

        deedInfo.deeds.slice(0, 3).forEach((deed, index) => {
          console.log(`\n  Deed ${index + 1}:`);
          console.log(`    Type: ${deed.type || 'N/A'}`);
          console.log(`    Date: ${deed.date || 'N/A'}`);
          console.log(`    Book: ${deed.book || 'N/A'}`);
          console.log(`    Page: ${deed.page || 'N/A'}`);
          console.log(`    URL: ${deed.url || 'N/A'}`);
        });

        // Test 4: Navigate to deed viewer
        console.log('\n📍 TEST 4: Navigate to Deed Viewer\n');

        const firstDeed = deedInfo.deeds[0];
        if (firstDeed && firstDeed.url) {
          console.log(`Navigating to deed: ${firstDeed.type || 'First deed'}`);
          console.log(`URL: ${firstDeed.url}`);

          // Navigate directly to the deed URL
          try {
            await page.goto(firstDeed.url, {
              waitUntil: 'networkidle2',
              timeout: 30000
            });
            console.log('✅ Successfully navigated to deed viewer');

            // Wait for deed content to load
            console.log('⏳ Waiting for deed content to render...');
            await new Promise(resolve => setTimeout(resolve, 15000));

            // Test 5: Download deed PDF
            console.log('\n📍 TEST 5: Download Deed PDF\n');

            const downloadResult = await scraper.downloadDeedPdf();

            if (downloadResult.success) {
              console.log('✅ Deed PDF download successful!');
              console.log(`  Duration: ${downloadResult.duration}ms`);
              console.log(`  File size: ${downloadResult.fileSize} bytes`);
              console.log(`  Filename: ${downloadResult.filename}`);

              // Save the PDF for inspection
              if (downloadResult.pdfBase64) {
                const outputPath = `guilford-test-deed-${Date.now()}.pdf`;
                fs.writeFileSync(outputPath, Buffer.from(downloadResult.pdfBase64, 'base64'));
                console.log(`  Saved to: ${outputPath}`);
              }
            } else {
              console.log('❌ Deed PDF download failed');
              console.log(`  Error: ${downloadResult.error}`);

              // Take a screenshot for debugging
              const screenshot = await page.screenshot({ fullPage: true });
              fs.writeFileSync('guilford-debug-screenshot.png', screenshot);
              console.log('  Debug screenshot saved to: guilford-debug-screenshot.png');
            }
          } catch (navError) {
            console.log('❌ Failed to navigate to deed viewer');
            console.log(`  Error: ${navError.message}`);
          }
        } else {
          console.log('⚠️  No deed URL available to test');
        }
      } else {
        console.log('⚠️  No deeds found for property');
      }
    } else {
      console.log('❌ Property search failed');
      if (searchResult) {
        console.log(`  Error: ${searchResult.error}`);
      }
    }

    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST SUMMARY\n');

    const tests = [
      { name: 'Initialize scraper', passed: true },
      { name: 'Search for property', passed: searchResult && searchResult.success },
      { name: 'Get deed information', passed: deedInfo && deedInfo.deeds && deedInfo.deeds.length > 0 },
      { name: 'Navigate to deed viewer', passed: false }, // Will be updated in actual test
      { name: 'Download deed PDF', passed: false } // Will be updated in actual test
    ];

    tests.forEach(test => {
      console.log(`  ${test.passed ? '✅' : '❌'} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    console.log(`\n  Passed: ${passedCount}/${tests.length}`);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);

    // Take a screenshot for debugging
    try {
      const screenshot = await page.screenshot({ fullPage: true });
      fs.writeFileSync('guilford-error-screenshot.png', screenshot);
      console.log('\nDebug screenshot saved to: guilford-error-screenshot.png');
    } catch (e) {
      // Ignore screenshot errors
    }
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Test complete. Browser will remain open for inspection.');
    console.log('Press Ctrl+C to exit.');

    // Keep browser open for debugging
    await new Promise(() => {});
  }
}

// Run the test
testGuilfordEndToEnd().catch(console.error);