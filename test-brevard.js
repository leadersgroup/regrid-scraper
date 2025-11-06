/**
 * Test script for Brevard County, Florida deed scraper
 * Example address: 100 ECHO CT, Melbourne, FL 32901
 */

const BrevardCountyFloridaScraper = require('./county-implementations/brevard-county-florida');

async function test() {
  console.log('🧪 Testing Brevard County FL deed scraper...\n');

  // Test address from user's example
  const testAddress = '100 ECHO CT, Melbourne, FL 32901';
  console.log(`📍 Test address: ${testAddress}\n`);

  const scraper = new BrevardCountyFloridaScraper({
    headless: false, // Set to true for production
    verbose: true
  });

  console.log('🚀 Initializing browser with stealth mode...');
  await scraper.initialize();
  console.log('✅ Scraper initialized\n');

  try {
    console.log('🏁 Starting deed download...\n');

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80));

    if (result.success) {
      console.log('\n✅ SUCCESS: Deed downloaded successfully');
      if (result.download && result.download.filepath) {
        console.log(`📄 PDF saved to: ${result.download.filepath}`);
      }
    } else {
      console.log('\n❌ FAILED: Could not download deed');
      console.log(`Error: ${result.message || result.error}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Scraper closed\n');
  }

  console.log('\n✅ Test completed successfully');
}

// Run the test
test().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
