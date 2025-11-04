/**
 * Test Broward County scraper
 */

const BrowardCountyFloridaScraper = require('./county-implementations/broward-county-florida');

async function testBroward() {
  const scraper = new BrowardCountyFloridaScraper({
    headless: false,
    timeout: 120000,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Test address in Broward County
    const address = '2611 NE 48 ST, LIGHTHOUSE POINT, FL 33064';
    console.log(`\n🔍 Testing address: ${address}\n`);

    const result = await scraper.getPriorDeed(address);

    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    await scraper.close();
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await scraper.close();
  }
}

testBroward();
