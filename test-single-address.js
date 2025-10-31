/**
 * Simple test for a single address
 */

const DeedScraper = require('./deed-scraper');

async function testSingleAddress() {
  // Test with Orange County, Florida address
  const address = '12729 Hawkstone Drive, Windermere, FL 34786';

  console.log(`Testing deed scraper with: ${address}\n`);

  const scraper = new DeedScraper({
    headless: true,
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    const result = await scraper.getPriorDeed(address);

    console.log('\n' + '='.repeat(80));
    console.log('FINAL RESULTS');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

testSingleAddress();
