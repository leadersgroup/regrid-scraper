/**
 * Full workflow test for Harris County scraper
 * Tests all steps: HCAD search -> Account number -> Ownership data -> Clerk records -> Deed download
 */

const HarrisCountyTexasScraper = require('./county-implementations/harris-county-texas');

(async () => {
  console.log('🚀 Testing Harris County full workflow...\n');

  const scraper = new HarrisCountyTexasScraper({
    headless: false,
    timeout: 120000,
    verbose: true
  });

  try {
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');

    // Test address from user
    const testAddress = '5019 Lymbar Dr Houston TX 77096';
    console.log(`📍 Testing with address: ${testAddress}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80));

    if (result.success) {
      console.log('\n✅ SUCCESS! Full workflow completed');
      console.log(`   Duration: ${result.duration}`);
      if (result.download?.pdfPath) {
        console.log(`   PDF saved to: ${result.download.pdfPath}`);
      }
    } else {
      console.log('\n❌ FAILED:', result.error || result.message);
      if (result.debug) {
        console.log('   Debug info:', result.debug);
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Browser closed');
  }
})();
