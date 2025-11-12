/**
 * Test Guilford County with verbose logging
 */

const GuilfordCountyNorthCarolinaScraper = require('./county-implementations/guilford-county-north-carolina');

async function test() {
  const scraper = new GuilfordCountyNorthCarolinaScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();
    const result = await scraper.getPriorDeed('1205 Glendale Dr');

    console.log('\n\n=== FINAL RESULT ===');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

test();
