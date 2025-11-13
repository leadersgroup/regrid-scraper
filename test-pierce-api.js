/**
 * Test Pierce County API-compatible getPriorDeed method
 */

const PierceCountyWashingtonScraper = require('./county-implementations/pierce-county-washington');

async function testPierceCountyAPI() {
  const address = '2413 S Cedar Street #207, Tacoma, WA 98405';

  console.log('🧪 Testing Pierce County API-compatible method\n');
  console.log(`Address: ${address}`);
  console.log('This test will use the getPriorDeed() method (API-compatible)');
  console.log('which internally calls Regrid to get the parcel ID\n');

  const scraper = new PierceCountyWashingtonScraper({
    headless: false,
    debugMode: true
  });

  try {
    console.log('🚀 Initializing browser...');
    await scraper.initialize();
    console.log('✅ Browser initialized\n');

    // Call the API-compatible method (doesn't require parcel ID)
    const result = await scraper.getPriorDeed(address);

    console.log('\n📊 RESULTS:');
    console.log('============================================');
    console.log(`Success: ${result.success}`);
    console.log(`Address: ${result.address}`);
    if (result.parcelId) {
      console.log(`Parcel ID: ${result.parcelId}`);
    }
    if (result.instrumentNumber) {
      console.log(`Instrument #: ${result.instrumentNumber}`);
    }
    console.log(`Timestamp: ${result.timestamp}`);

    if (result.success) {
      console.log(`\n✅ PDF downloaded successfully!`);
      console.log(`   Filename: ${result.filename}`);
      console.log(`   Size: ${(result.fileSize / 1024).toFixed(2)} KB`);
      console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);

      // Optionally save to file
      if (result.pdfBase64) {
        const fs = require('fs');
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        fs.writeFileSync(result.filename, pdfBuffer);
        console.log(`\n💾 Saved to: ${result.filename}`);
      }
    } else {
      console.log(`\n❌ Failed: ${result.error}`);
    }
    console.log('============================================');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Browser closed');
  }
}

// Run if called directly
if (require.main === module) {
  testPierceCountyAPI().catch(console.error);
}

module.exports = testPierceCountyAPI;
