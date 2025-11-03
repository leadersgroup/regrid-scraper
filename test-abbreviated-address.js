/**
 * Test abbreviated street suffix normalization
 * Address: "13109 Tollcross Wy, Winter Garden, FL 34787, USA"
 */

require('dotenv').config();
const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');

async function testAbbreviatedAddress() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING ABBREVIATED ADDRESS NORMALIZATION');
  console.log('='.repeat(80));
  console.log('Address: "13109 Tollcross Wy, Winter Garden, FL 34787, USA"');
  console.log('Expected: Normalize "Wy" to "Way" before searching');
  console.log('='.repeat(80) + '\n');

  const scraper = new OrangeCountyFloridaScraper({
    headless: false,
    timeout: 120000,
    verbose: true
  });

  try {
    // Initialize scraper
    await scraper.initialize();

    // Test address with abbreviation
    const address = '13109 Tollcross Wy, Winter Garden, FL 34787, USA';
    console.log(`\n📥 Testing address: ${address}\n`);

    const result = await scraper.getPriorDeed(address);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80) + '\n');

    if (result.success && result.download?.success) {
      console.log('✅ SUCCESS! Deed downloaded successfully');
      console.log(`📄 File: ${result.download.filename}`);
      console.log(`📦 Size: ${result.download.fileSize} bytes`);
      console.log(`📋 Document ID: ${result.download.documentId}`);
    } else {
      console.log('❌ FAILED! Could not download deed');
      if (result.steps?.step2?.message) {
        console.log(`   Step 2 Error: ${result.steps.step2.message}`);
      }
      if (result.steps?.step3?.error) {
        console.log(`   Step 3 Error: ${result.steps.step3.error}`);
      }
    }

    await scraper.close();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await scraper.close();
    process.exit(1);
  }
}

testAbbreviatedAddress();
