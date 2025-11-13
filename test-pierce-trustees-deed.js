/**
 * Test Pierce County scraper with Trustee's Deed
 */

const PierceCountyWashingtonScraper = require('./county-implementations/pierce-county-washington');

async function testTrusteesDeed() {
  const scraper = new PierceCountyWashingtonScraper({
    headless: false,
    debugMode: true,
    verbose: true
  });

  try {
    // Initialize browser
    await scraper.initialize();

    console.log('🚀 Testing Pierce County scraper for Trustee\'s Deed...');
    console.log('Address: 5507 N 45th St, Tacoma, WA 98407');
    console.log('Parcel ID: 4105000390\n');

    const result = await scraper.downloadPriorDeed(
      '5507 N 45th St, Tacoma, WA 98407',
      '4105000390'
    );

    console.log('\n📊 RESULT:');
    console.log('Success:', result.success);
    console.log('Parcel ID:', result.parcelId);
    console.log('Instrument #:', result.instrumentNumber);
    console.log('Filename:', result.filename);
    console.log('File Size:', result.fileSize ? `${(result.fileSize / 1024).toFixed(2)} KB` : 'N/A');
    console.log('Duration:', result.duration ? `${(result.duration / 1000).toFixed(2)}s` : 'N/A');

    if (result.error) {
      console.log('Error:', result.error);
    }

    if (result.success && result.pdfBase64) {
      console.log('\n✅ PDF downloaded successfully!');
      console.log('Base64 length:', result.pdfBase64.length);

      // Save PDF to file
      const fs = require('fs');
      const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
      fs.writeFileSync(result.filename, pdfBuffer);
      console.log(`💾 Saved to: ${result.filename}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n🏁 Test complete');
  }
}

testTrusteesDeed();
