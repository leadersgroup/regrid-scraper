/**
 * Debug script for Miami-Dade County FL - runs in non-headless mode
 */

const MiamiDadeCountyFloridaScraper = require('./county-implementations/miami-dade-county-florida');

async function debugMiamiDadeCounty() {
  console.log('🐛 Debugging Miami-Dade County FL deed scraper (non-headless)...\n');

  const testAddress = '1637 NW 59th St, Miami, FL 33142, USA';

  const scraper = new MiamiDadeCountyFloridaScraper({
    headless: false, // Run in visible mode
    timeout: 120000,
    verbose: true
  });

  try {
    console.log(`📍 Test address: ${testAddress}\n`);

    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    console.log('🏁 Starting deed download...\n');
    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80) + '\n');

    // Don't close immediately so you can see the result
    console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    await scraper.close();
    console.log('\n✅ Scraper closed\n');

  } catch (error) {
    console.error('\n❌ DEBUG FAILED:', error.message);
    console.error(error.stack);

    // Keep browser open to see the error state
    console.log('\n⏸️  Browser will stay open for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    await scraper.close();
    process.exit(1);
  }
}

debugMiamiDadeCounty()
  .then(() => {
    console.log('\n✅ Debug session completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug session failed:', error);
    process.exit(1);
  });
