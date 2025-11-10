/**
 * Test script for Durham County NC implementation
 */

const DurhamCountyNorthCarolinaScraper = require('./county-implementations/durham-county-north-carolina');

async function test() {
  const scraper = new DurhamCountyNorthCarolinaScraper({
    headless: false, // Set to false to see the browser
    outputDir: './output'
  });

  try {
    const address = '6409 Winding Arch Dr Durham NC 27713';
    console.log(`\n🧪 Testing Durham County scraper with address: ${address}\n`);

    const result = await scraper.getPriorDeed(address);

    console.log('\n========================================');
    console.log('TEST RESULT');
    console.log('========================================');
    console.log(JSON.stringify(result, null, 2));
    console.log('========================================\n');

    if (result.success) {
      console.log('✅ TEST PASSED - Deed downloaded successfully!');
      if (result.steps.step3?.data?.pdfBase64) {
        const pdfSize = result.steps.step3.data.pdfBase64.length;
        console.log(`📄 PDF size: ${pdfSize} characters (base64)`);
      }
    } else {
      console.log('❌ TEST FAILED');
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ TEST ERROR:', error);
  } finally {
    await scraper.close();
  }
}

test().catch(console.error);
