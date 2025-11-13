/**
 * Test script for Forsyth County, NC deed scraper
 *
 * Tests the scraper with the example address: 3170 Butterfield Dr
 */

require('dotenv').config();
const ForsythCountyNorthCarolinaScraper = require('./county-implementations/forsyth-county-north-carolina');
const fs = require('fs');
const path = require('path');

async function testForsythCounty() {
  console.log('🧪 Testing Forsyth County Scraper');
  console.log('=====================================\n');

  const testAddress = '3170 Butterfield Dr';
  console.log(`📍 Test Address: ${testAddress}\n`);

  const scraper = new ForsythCountyNorthCarolinaScraper({
    headless: false,  // Set to true for headless mode
    verbose: true,
    timeout: 120000
  });

  try {
    console.log('🚀 Initializing scraper...');
    await scraper.initialize();

    console.log('✅ Scraper initialized\n');
    console.log('📥 Starting deed download...\n');

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n=====================================');
    console.log('📊 RESULTS');
    console.log('=====================================\n');

    console.log(`Success: ${result.success}`);
    console.log(`Address: ${result.address}`);
    console.log(`Timestamp: ${result.timestamp}`);

    if (result.success) {
      console.log(`\n✅ SUCCESS!`);
      console.log(`Filename: ${result.filename}`);
      console.log(`File Size: ${(result.fileSize / 1024).toFixed(2)} KB`);
      console.log(`Total Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);

      // Save PDF to file for verification
      if (result.pdfBase64) {
        const outputDir = path.join(__dirname, 'test-output');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, result.filename);
        fs.writeFileSync(outputPath, Buffer.from(result.pdfBase64, 'base64'));
        console.log(`\n📄 PDF saved to: ${outputPath}`);
      }

      // Print step details
      console.log('\n📝 Step Details:');
      console.log('  Search:', result.steps.search);
      console.log('  Deed Info:', result.steps.deed);
      console.log('  Download:', result.steps.download);
    } else {
      console.log(`\n❌ FAILED`);
      console.log(`Error: ${result.error}`);
      console.log(`Total Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);

      // Print step details to help debug
      if (result.steps) {
        console.log('\n📝 Step Details:');
        console.log('  Search:', result.steps.search);
        console.log('  Deed Info:', result.steps.deed);
        console.log('  Download:', result.steps.download);
      }
    }

    await scraper.close();
    console.log('\n🔒 Scraper closed');

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);

    try {
      await scraper.close();
    } catch (closeError) {
      console.error('Error closing scraper:', closeError.message);
    }

    process.exit(1);
  }
}

// Run the test
testForsythCounty()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
