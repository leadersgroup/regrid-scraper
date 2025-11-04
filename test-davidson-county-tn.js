/**
 * Test script for Davidson County, Tennessee deed scraper
 *
 * This script demonstrates how to use the Davidson County scraper
 * to search for property information and deed records.
 *
 * Usage:
 *   node test-davidson-county-tn.js
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee');

async function testDavidsonCountyScraper() {
  console.log('🧪 Testing Davidson County, TN Deed Scraper\n');
  console.log('='.repeat(80));

  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false, // Set to false to see the browser in action
    timeout: 120000,
    verbose: true
  });

  try {
    // Example address in Davidson County (Nashville), TN
    // Replace with a real address for actual testing
    const testAddress = '123 Main St, Nashville, TN 37201';

    console.log(`\n📍 Test Address: ${testAddress}\n`);
    console.log('Starting scraper...\n');

    await scraper.initialize();

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESULTS');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80));

    if (result.success) {
      console.log('\n✅ Successfully retrieved property information!');

      if (result.steps.step2?.transactions?.length > 0) {
        console.log('\n📋 Transaction Records Found:');
        result.steps.step2.transactions.forEach((trans, idx) => {
          console.log(`\n   ${idx + 1}. ${trans.type === 'instrument' ? 'Instrument Number' : 'Book/Page'}:`);
          if (trans.instrumentNumber) {
            console.log(`      Instrument: ${trans.instrumentNumber}`);
          }
          if (trans.bookNumber && trans.pageNumber) {
            console.log(`      Book: ${trans.bookNumber}, Page: ${trans.pageNumber}`);
          }
          if (trans.saleDate) {
            console.log(`      Sale Date: ${trans.saleDate}`);
          }
        });
      }

      if (result.download?.requiresSubscription) {
        console.log('\n⚠️  NOTE: Davidson County Register of Deeds requires subscription for PDF downloads');
        console.log('\nAlternative access methods:');
        console.log('   1. Free Mobile App: "Nashville - Davidson Co. ROD" (iOS/Android)');
        console.log('   2. Subscription: https://davidsonportal.com/ ($50/month)');
        console.log('   3. In Person: 501 Broadway, Suite 301, Nashville, TN 37203');
        console.log('\n   Deed Reference:', result.download.deedReference);
      }
    } else {
      console.log('\n❌ Failed to retrieve property information');
      console.log('Error:', result.error || result.message);
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Browser closed\n');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDavidsonCountyScraper().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = testDavidsonCountyScraper;
