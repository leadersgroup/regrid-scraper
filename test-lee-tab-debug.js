const LeeCountyFloridaScraper = require('./county-implementations/lee-county-florida');

async function testLeeTabDebug() {
  console.log('🧪 Testing Lee County Sales/Transactions tab issue...\n');

  const testAddress = '503 Noridge Dr, Fort Myers, FL 33919';

  const scraper = new LeeCountyFloridaScraper({
    headless: true, // Test in headless mode like Railway
    timeout: 120000,
    verbose: true
  });

  try {
    await scraper.initialize();
    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n✅ RESULT:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

testLeeTabDebug().catch(console.error);
