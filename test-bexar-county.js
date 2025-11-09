/**
 * Test script for Bexar County, Texas scraper
 *
 * Usage:
 *   node test-bexar-county.js "123 Main St, San Antonio, TX 78201"
 */

const BexarCountyTexasScraper = require('./county-implementations/bexar-county-texas');

async function testBexarCountyScraper() {
  // Get address from command line or use default
  const testAddress = process.argv[2] || '123 Main St, San Antonio, TX 78201';

  console.log('\n' + '='.repeat(80));
  console.log('🧪 BEXAR COUNTY SCRAPER TEST');
  console.log('='.repeat(80));
  console.log(`📍 Test Address: ${testAddress}`);
  console.log('='.repeat(80) + '\n');

  const scraper = new BexarCountyTexasScraper({
    headless: false,  // Set to false to see browser actions
    verbose: true,    // Enable detailed logging
    timeout: 120000
  });

  try {
    // Initialize browser
    console.log('🚀 Initializing scraper...');
    await scraper.initialize();

    // Test address parsing
    console.log('\n📝 Testing address parser...');
    const parsed = scraper.parseAddress(testAddress);
    console.log(`   Street Number: "${parsed.streetNumber}"`);
    console.log(`   Street Name: "${parsed.streetName}"`);

    // Run the full scrape
    console.log('\n🔍 Starting scrape...\n');
    const result = await scraper.scrape(testAddress);

    // Display results
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80) + '\n');

    if (result.success) {
      console.log('✅ TEST PASSED - Deed downloaded successfully!');
      if (result.pdfData) {
        console.log(`📄 PDF Size: ${Buffer.from(result.pdfData, 'base64').length} bytes`);
      }
    } else {
      console.log('❌ TEST FAILED');
      console.log(`Error: ${result.error}`);
    }

    // Close browser
    await scraper.close();

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('❌ TEST ERROR');
    console.error('='.repeat(80));
    console.error(error);
    console.error('='.repeat(80) + '\n');

    // Make sure to close browser on error
    await scraper.close();
    process.exit(1);
  }
}

// Run test
testBexarCountyScraper().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
