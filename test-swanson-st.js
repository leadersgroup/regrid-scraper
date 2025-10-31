/**
 * Test script for Orange County, Florida deed scraper with new address
 */

const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');

async function testSwansonSt() {
  console.log('🧪 Testing Orange County, Florida Deed Scraper\n');

  const address = '6431 Swanson St, Windermere, FL 34786';

  console.log(`Testing address: ${address}\n`);
  console.log('='.repeat(80));

  const scraper = new OrangeCountyFloridaScraper({
    headless: true,
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Run the complete workflow
    const result = await scraper.getPriorDeed(address);

    console.log('\n' + '='.repeat(80));
    console.log('FINAL RESULTS');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Success: ${result.success ? 'YES ✓' : 'NO ✗'}`);
    console.log(`Parcel ID: ${result.steps?.step1?.parcelId || 'Not found'}`);
    console.log(`County: ${result.steps?.step1?.county || 'Not found'}`);
    console.log(`Owner: ${result.steps?.step1?.ownerName || 'Not found'}`);

    if (result.steps?.step2?.transactions) {
      console.log(`\nTransactions found: ${result.steps.step2.transactions.length}`);
      result.steps.step2.transactions.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.type}: ${t.documentId || `Book ${t.bookNumber} Page ${t.pageNumber}`}`);
        if (t.saleDate) console.log(`     Date: ${t.saleDate}, Price: $${t.salePrice}`);
      });
    }

    if (result.download) {
      console.log(`\nDeed downloaded: ${result.download.filename}`);
      console.log(`Download successful: ${result.download.success ? 'YES ✓' : 'NO ✗'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('\n✅ Test completed');
  }
}

// Run test
if (require.main === module) {
  testSwansonSt().catch(console.error);
}

module.exports = testSwansonSt;
