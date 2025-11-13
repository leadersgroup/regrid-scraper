/**
 * Test Pierce County scraper with direct parcel ID
 * Bypasses Regrid and tests directly with a known parcel ID
 */

const PierceCountyWashingtonScraper = require('./county-implementations/pierce-county-washington');

async function testPierceWithParcel() {
  const scraper = new PierceCountyWashingtonScraper({
    headless: false,
    debugMode: true,
    verbose: true
  });

  try {
    // Initialize browser
    await scraper.initialize();

    console.log('🚀 Testing Pierce County scraper with direct parcel ID...');
    console.log('Address: 2413 S Cedar Street #207, Tacoma, WA');

    // For testing, we need a valid parcel ID for this address
    // Using a test parcel ID from debug files
    // If you have the actual parcel ID for 2413 S Cedar Street, replace it here
    const testParcelId = '2158020070'; // Test parcel ID from debug files

    console.log('Parcel ID:', testParcelId);
    console.log('');

    const result = await scraper.downloadPriorDeed(
      '2413 S Cedar Street #207, Tacoma, WA',
      testParcelId
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

      // Optionally save to file for inspection
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

testPierceWithParcel();
