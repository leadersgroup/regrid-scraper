#!/usr/bin/env node

/**
 * Test Lee County scraper with improvements
 */

const LeeCountyFloridaScraper = require('./county-implementations/lee-county-florida');

async function testLeeCounty() {
  console.log('🧪 Testing Lee County scraper with improvements...\n');

  const scraper = new LeeCountyFloridaScraper({
    headless: false,  // Run in non-headless mode to see what's happening
    verbose: true,
    timeout: 120000
  });

  try {
    // Test address from Railway logs
    const testAddress = '503 Noridge Dr, Lehigh Acres, FL 33936, USA';
    console.log(`Testing address: ${testAddress}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n📊 RESULT:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ TEST PASSED!');
      console.log(`   Downloaded: ${result.download?.filename}`);
      console.log(`   Clerk File Number: ${result.download?.clerkFileNumber}`);
    } else {
      console.log('\n❌ TEST FAILED');
      console.log(`   Message: ${result.message}`);
      console.log(`   Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n🏁 Test complete');
  }
}

// Run the test
testLeeCounty().catch(console.error);
