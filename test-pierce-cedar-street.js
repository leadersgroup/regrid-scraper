/**
 * Test Pierce County scraper with 2413 S Cedar Street #207, Tacoma, WA
 */

const PierceCountyWashingtonScraper = require('./county-implementations/pierce-county-washington');

async function testPierceCedarStreet() {
  const scraper = new PierceCountyWashingtonScraper({
    headless: false,
    debugMode: true
  });

  try {
    console.log('🚀 Testing Pierce County scraper...');
    console.log('Address: 2413 S Cedar Street #207, Tacoma, WA\n');

    const result = await scraper.getPriorDeed('2413 S Cedar Street #207, Tacoma, WA');

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
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n🏁 Test complete');
  }
}

testPierceCedarStreet();
