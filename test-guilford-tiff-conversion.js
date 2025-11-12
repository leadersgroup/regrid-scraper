/**
 * Test script for Guilford County TIFF to PDF conversion
 *
 * This script tests the conversion of TIFF images to PDF format
 * for deed documents from Guilford County, NC
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina');

async function testGuilfordTiffConversion() {
  console.log('🧪 Testing Guilford County TIFF to PDF conversion...\n');

  const scraper = new GuilfordCountyScraper({
    headless: false,  // Show browser for debugging
    debug: true
  });

  try {
    // Initialize the scraper
    await scraper.initialize();

    // Test with a known address that returns TIFF images
    const testAddress = '1637 NW 59TH ST';
    console.log(`📍 Testing with address: ${testAddress}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    if (result.success && result.pdfBase64) {
      console.log('\n✅ SUCCESS!');
      console.log(`📄 PDF Base64 length: ${result.pdfBase64.length}`);
      console.log(`📊 File size: ${(result.fileSize / 1024).toFixed(2)} KB`);
      console.log(`⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`);

      // Verify it's a valid PDF by checking the signature
      const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
      const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

      if (pdfSignature === '%PDF') {
        console.log('✅ Converted file is a valid PDF');
      } else {
        console.log(`⚠️  File signature: ${pdfSignature}`);
      }

      // Optionally save to file for manual inspection
      const fs = require('fs');
      const outputPath = './test-guilford-converted.pdf';
      fs.writeFileSync(outputPath, pdfBuffer);
      console.log(`💾 Saved to: ${outputPath}`);
    } else {
      console.log('\n❌ FAILED!');
      console.log(`Error: ${result.error || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
  }
}

// Run the test
testGuilfordTiffConversion().catch(console.error);
