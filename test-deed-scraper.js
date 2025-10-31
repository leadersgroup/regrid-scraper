/**
 * Test script for Prior Deed Scraper
 *
 * This script demonstrates how to use the DeedScraper class to download
 * prior recorded deeds from property addresses.
 */

const DeedScraper = require('./deed-scraper');

async function testDeedScraper() {
  console.log('🧪 Starting Deed Scraper Test\n');

  // Test addresses
  const testAddresses = [
    '1600 Amphitheatre Parkway, Mountain View, CA',
    '1 Apple Park Way, Cupertino, CA',
    '350 5th Ave, New York, NY'
  ];

  const scraper = new DeedScraper({
    headless: true,
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    for (const address of testAddresses) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`Testing address: ${address}`);
      console.log('='.repeat(80));

      const result = await scraper.getPriorDeed(address);

      console.log('\n📊 Results:');
      console.log(JSON.stringify(result, null, 2));

      // Wait between tests to avoid rate limiting
      if (testAddresses.indexOf(address) < testAddresses.length - 1) {
        console.log('\n⏸️ Waiting 10 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
    console.log('\n✅ Test completed');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testDeedScraper().catch(console.error);
}

module.exports = testDeedScraper;
