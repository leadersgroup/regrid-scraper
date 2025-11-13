/**
 * Test Pierce County, Washington scraper
 */

const PierceCountyWashingtonScraper = require('./county-implementations/pierce-county-washington');

async function testPierceCounty() {
  const address = process.argv[2] || '2413 S Cedar Street #207, Tacoma, WA 98405';
  const parcelId = process.argv[3] || '2158020070';

  console.log('🧪 Testing Pierce County, Washington Scraper\n');

  const scraper = new PierceCountyWashingtonScraper({
    headless: false,
    debugMode: true
  });

  try {
    console.log('🚀 Initializing browser with stealth mode...');
    await scraper.initialize();
    console.log('✅ Browser initialized with stealth mode');
    console.log(`Testing address: ${address}`);
    console.log(`Parcel ID: ${parcelId}\n`);

    const result = await scraper.downloadPriorDeed(address, parcelId);

    console.log('\n📊 RESULTS:');
    console.log('============================================');
    console.log(`Success: ${result.success}`);
    console.log(`Address: ${result.address}`);
    console.log(`Parcel ID: ${result.parcelId}`);
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
  testPierceCounty().catch(console.error);
}

module.exports = testPierceCounty;
