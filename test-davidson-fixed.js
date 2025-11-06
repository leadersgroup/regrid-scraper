/**
 * Test the fixed Davidson County scraper
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testFixed() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    const address = '6241 Del Sol Dr, Whites Creek, TN 37189, USA';
    console.log(`\n🧪 Testing fixed scraper with address: ${address}\n`);

    const result = await scraper.getPriorDeed(address);

    console.log('\n📊 Final Result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testFixed().catch(console.error);
