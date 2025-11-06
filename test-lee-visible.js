const LeeCountyFloridaScraper = require('./county-implementations/lee-county-florida');

async function testLeeVisible() {
  console.log('🧪 Testing Lee County with VISIBLE browser...\n');

  const testAddress = '503 Noridge Dr, Fort Myers, FL 33919';

  const scraper = new LeeCountyFloridaScraper({
    headless: false, // Make browser visible
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
    // Don't close browser immediately so we can inspect
    console.log('\n⏸️  Waiting 30 seconds before closing browser...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    await scraper.close();
  }
}

testLeeVisible().catch(console.error);
