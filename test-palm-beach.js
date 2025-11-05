/**
 * Test script for Palm Beach County FL deed download
 * Test address: 6205 S Dixie Hwy, West Palm Beach, FL 33405, USA
 */

const PalmBeachCountyFloridaScraper = require('./county-implementations/palm-beach-county-florida');

async function testPalmBeachCounty() {
  console.log('🧪 Testing Palm Beach County FL deed scraper...\n');

  // Real Palm Beach County residential property address
  const testAddress = '6205 S Dixie Hwy, West Palm Beach, FL 33405, USA';

  const scraper = new PalmBeachCountyFloridaScraper({
    headless: false, // Set to true for headless testing
    timeout: 120000,
    verbose: true
  });

  try {
    console.log(`📍 Test address: ${testAddress}\n`);

    // Initialize scraper
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    // Download the prior deed
    console.log('🏁 Starting deed download...\n');
    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80) + '\n');

    if (result.success) {
      console.log('✅ SUCCESS: Deed downloaded successfully!');
      if (result.download?.filename) {
        console.log(`📄 File: ${result.download.filename}`);
        console.log(`📁 Path: ${result.download.downloadPath}`);
        console.log(`📏 Size: ${(result.download.fileSize / 1024).toFixed(2)} KB`);
      }
    } else {
      console.log('❌ FAILED: Could not download deed');
      console.log(`Error: ${result.error || result.message}`);
    }

    // Close scraper
    await scraper.close();
    console.log('\n✅ Scraper closed\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    await scraper.close();
    process.exit(1);
  }
}

// Run test
testPalmBeachCounty()
  .then(() => {
    console.log('\n✅ Test completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
