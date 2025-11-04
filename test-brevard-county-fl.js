/**
 * Test script for Brevard County, Florida deed scraper
 *
 * Usage:
 *   node test-brevard-county-fl.js
 */

const BrevardCountyFloridaScraper = require('./county-implementations/brevard-county-florida');

async function testBrevardCounty() {
  // Test address in Brevard County
  const testAddress = '1515 Sarno Rd, Melbourne, FL 32935';

  console.log('🚀 Testing Brevard County, Florida Deed Scraper');
  console.log(`📍 Test Address: ${testAddress}`);
  console.log('');

  const scraper = new BrevardCountyFloridaScraper({
    headless: false,  // Set to true for production
    verbose: true,
    timeout: 120000   // 2 minute timeout
  });

  try {
    const result = await scraper.getPriorDeed(testAddress);

    console.log('');
    console.log('='.repeat(60));
    console.log('📊 RESULT');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('');
      console.log('✅ SUCCESS!');
      if (result.download && result.download.downloadPath) {
        console.log(`📄 PDF saved to: ${result.download.downloadPath}/${result.download.filename}`);
      }
    } else {
      console.log('');
      console.log('❌ FAILED');
      console.log(`Error: ${result.error || result.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

// Run the test
testBrevardCounty();
