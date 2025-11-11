/**
 * Simple test for Mecklenburg County NC scraper
 */

const MecklenburgCountyNorthCarolinaScraper = require('./county-implementations/mecklenburg-county-north-carolina');

async function test() {
  console.log('🧪 Testing Mecklenburg County NC Scraper\n');

  const scraper = new MecklenburgCountyNorthCarolinaScraper({
    headless: false
  });

  const testAddress = '17209 ISLAND VIEW DR CORNELIUS NC';
  console.log(`Testing address: ${testAddress}\n`);

  try {
    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n================================================================================');
    console.log('RESULT:');
    console.log('================================================================================');
    console.log(JSON.stringify({
      success: result.success,
      address: result.address,
      bookPage: result.bookPage,
      fileSize: result.fileSize,
      steps: {
        search: result.steps?.search,
        deed: result.steps?.deed,
        download: { success: result.steps?.download?.success, error: result.steps?.download?.error }
      },
      error: result.error
    }, null, 2));

    if (result.success && result.pdfBase64) {
      const fs = require('fs');
      const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
      const filename = `/tmp/mecklenburg_test_${Date.now()}.pdf`;
      fs.writeFileSync(filename, pdfBuffer);
      console.log(`\n✅ PDF saved to: ${filename}`);
      console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

test().catch(console.error);
