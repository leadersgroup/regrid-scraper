#!/usr/bin/env node

/**
 * Test Shelby County, Tennessee scraper
 */

const ShelbyCountyTennesseeScraper = require('./county-implementations/shelby-county-tennessee');

async function testShelbyCounty() {
  console.log('🧪 Testing Shelby County scraper...\n');

  const scraper = new ShelbyCountyTennesseeScraper({
    headless: false,  // Run in non-headless mode to see what's happening
    verbose: true,
    timeout: 120000
  });

  try {
    // Test address from user
    const testAddress = '809 Harbor Isle Cir W, Memphis, TN 38103, USA';
    console.log(`Testing address: ${testAddress}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n📊 RESULT:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ TEST PASSED!');
      console.log(`   Downloaded: ${result.download?.filename}`);
      console.log(`   Deed Number: ${result.deedNumber}`);
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
testShelbyCounty().catch(console.error);
