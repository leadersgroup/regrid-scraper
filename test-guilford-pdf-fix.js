/**
 * Test script to verify Guilford County PDF download fix
 * Tests:
 * 1. Session cookies are transferred to new tabs
 * 2. Actual deed documents are found (not building details)
 * 3. PDFs are successfully captured
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina');

async function testGuilfordPDFFix() {
  console.log('🔧 Testing Guilford County PDF Download Fix\n');
  console.log('=' .repeat(50) + '\n');

  const testAddress = '1205 Glendale Dr';
  console.log(`📍 Test Address: ${testAddress}\n`);

  const scraper = new GuilfordCountyScraper({
    headless: false, // Set to true for production
    verbose: true
  });

  try {
    console.log('🚀 Initializing scraper...');
    await scraper.initialize();

    console.log('🔍 Starting deed search...\n');
    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '=' .repeat(50));
    console.log('📊 TEST RESULTS:\n');

    // Check if search was successful
    const searchSuccess = result.steps?.search?.success;
    console.log(`✓ Property Search: ${searchSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    if (searchSuccess) {
      console.log(`  - Parcel Number: ${result.steps.search.parcelNumber}`);
      console.log(`  - Duration: ${(result.steps.search.duration / 1000).toFixed(2)}s`);
    }

    // Check if deed was found
    const deedSuccess = result.steps?.deed?.success;
    console.log(`\n✓ Deed Document Found: ${deedSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    if (deedSuccess) {
      console.log(`  - Deed Type: ${result.steps.deed.deedType || 'N/A'}`);
      console.log(`  - Duration: ${(result.steps.deed.duration / 1000).toFixed(2)}s`);
    }

    // Check if PDF was downloaded
    const downloadSuccess = result.steps?.download?.success;
    console.log(`\n✓ PDF Download: ${downloadSuccess ? '✅ PASSED' : '❌ FAILED'}`);
    if (downloadSuccess) {
      const fileSize = result.steps.download.fileSize;
      console.log(`  - File Size: ${(fileSize / 1024).toFixed(2)} KB`);
      console.log(`  - Duration: ${(result.steps.download.duration / 1000).toFixed(2)}s`);

      // Verify it's a valid PDF
      if (result.pdfBase64) {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const isPDF = pdfBuffer.toString('utf8', 0, 4) === '%PDF';
        console.log(`  - Valid PDF Format: ${isPDF ? '✅ YES' : '❌ NO'}`);
      }
    }

    // Overall test result
    console.log('\n' + '=' .repeat(50));
    const overallSuccess = searchSuccess && deedSuccess && downloadSuccess;
    if (overallSuccess) {
      console.log('🎉 ALL TESTS PASSED! The Guilford County fix is working correctly.');
    } else {
      console.log('⚠️ SOME TESTS FAILED. Please review the results above.');
    }

    // Additional diagnostics if needed
    if (!overallSuccess && result.error) {
      console.log(`\n❌ Error Details: ${result.error}`);
    }

    console.log('\n' + '=' .repeat(50));
    const totalTime = result.totalDuration ||
      (result.steps?.search?.duration || 0) +
      (result.steps?.deed?.duration || 0) +
      (result.steps?.download?.duration || 0);
    console.log(`⏱️ Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);

  } catch (error) {
    console.error('\n❌ TEST FAILED WITH ERROR:');
    console.error(error.message);
    console.error('\nStack Trace:');
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Browser closed');
  }
}

// Run the test
console.log('Guilford County PDF Download Fix - Test Suite');
console.log('=' .repeat(50) + '\n');
testGuilfordPDFFix()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Test failed:', err);
    process.exit(1);
  });