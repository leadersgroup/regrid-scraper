/**
 * Test Harris County, Texas Scraper
 *
 * Test address: 5019 Lymbar Dr Houston TX 77096
 * Expected: Owner: Xu Huiping, Effective Date: 07/25/2023
 * Expected Film Code: RP-2023-278675
 */

const HarrisCountyTexasScraper = require('./county-implementations/harris-county-texas');

async function testHarrisCounty() {
  console.log('🧪 Testing Harris County, Texas Scraper\n');
  console.log('=' .repeat(80));

  const scraper = new HarrisCountyTexasScraper({
    headless: false,  // Set to true for production
    verbose: true,
    timeout: 90000
  });

  const testAddress = '5019 Lymbar Dr Houston TX 77096';

  try {
    console.log(`\n📍 Test Address: ${testAddress}`);
    console.log(`⏰ Start Time: ${new Date().toLocaleString()}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ SUCCESS: Deed downloaded successfully!');
      console.log(`📁 File: ${result.download.filename}`);
      console.log(`📍 Location: ${result.download.downloadPath}`);
      console.log(`📏 Size: ${result.download.fileSize} bytes`);
      console.log(`🎬 Film Code: ${result.download.filmCode}`);
    } else {
      console.log('\n❌ FAILED: Could not download deed');
      console.log(`Error: ${result.message || result.error}`);
    }

    console.log(`\n⏱️  Duration: ${result.duration}`);
    console.log(`⏰ End Time: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Browser closed');
  }
}

// Run the test
testHarrisCounty().catch(console.error);
