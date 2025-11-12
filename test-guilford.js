/**
 * Test script for Guilford County, North Carolina scraper
 *
 * Test Address: 1205 Glendale Dr, Guilford County, NC
 */

const GuilfordCountyNorthCarolinaScraper = require('./county-implementations/guilford-county-north-carolina');

async function testGuilfordCounty() {
  console.log('🧪 Testing Guilford County, North Carolina Scraper\n');

  const scraper = new GuilfordCountyNorthCarolinaScraper({
    headless: false, // Set to false to see browser
    outputDir: './downloads',
    verbose: true // Enable detailed logging
  });

  try {
    // Initialize the scraper
    await scraper.initialize();

    // Test address from user
    const address = '1205 Glendale Dr';

    console.log(`Testing address: ${address}\n`);

    const result = await scraper.getPriorDeed(address);

    console.log('\n📊 RESULTS:');
    console.log('============================================');
    console.log(`Success: ${result.success}`);
    console.log(`Address: ${result.address}`);
    console.log(`Timestamp: ${result.timestamp}`);

    if (result.success) {
      console.log(`\n✅ PDF Downloaded Successfully!`);
      console.log(`Filename: ${result.filename}`);
      console.log(`File Size: ${(result.fileSize / 1024).toFixed(2)} KB`);
      console.log(`Total Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);

      if (result.downloadPath) {
        console.log(`Download Path: ${result.downloadPath}`);
      }

      // Show step details
      console.log('\n📋 Step Details:');
      if (result.steps.search) {
        console.log(`  Search: ${result.steps.search.success ? '✅' : '❌'} (${(result.steps.search.duration / 1000).toFixed(1)}s)`);
        if (result.steps.search.parcelNumber) {
          console.log(`    Parcel: ${result.steps.search.parcelNumber}`);
        }
      }
      if (result.steps.deed) {
        console.log(`  Deed Info: ${result.steps.deed.success ? '✅' : '❌'} (${(result.steps.deed.duration / 1000).toFixed(1)}s)`);
      }
      if (result.steps.download) {
        console.log(`  Download: ${result.steps.download.success ? '✅' : '❌'} (${(result.steps.download.duration / 1000).toFixed(1)}s)`);
      }
    } else {
      console.log(`\n❌ Failed: ${result.error}`);
    }

    console.log('\n============================================');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await scraper.close();
    console.log('\n✅ Browser closed');
  }
}

// Run the test
testGuilfordCounty().catch(console.error);
