/**
 * Test script for Polk County, Florida deed scraper
 *
 * Usage:
 *   node test-polk.js
 */

const PolkCountyFloridaScraper = require('./county-implementations/polk-county-florida');

async function testPolkCountyScraper() {
  console.log('🧪 Testing Polk County, Florida Deed Scraper\n');
  console.log('='.repeat(80));

  // Test address in Polk County
  const testAddress = '1402 Avenue K NE, Winter Haven, FL 33881';

  const scraper = new PolkCountyFloridaScraper({
    headless: false, // Set to true for Railway deployment
    timeout: 120000,
    verbose: true
  });

  try {
    console.log(`\n📍 Test Address: ${testAddress}`);
    console.log('='.repeat(80) + '\n');

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80) + '\n');

    if (result.success) {
      console.log('✅ TEST PASSED: Successfully downloaded deed');
      console.log(`📄 PDF File: ${result.download?.filename}`);
      console.log(`📁 Location: ${result.download?.downloadPath}`);
      console.log(`📦 Size: ${result.download?.fileSize} bytes`);
    } else {
      console.log('❌ TEST FAILED: Could not download deed');
      console.log(`   Error: ${result.error || result.message}`);
    }

  } catch (error) {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  } finally {
    await scraper.close();
  }

  console.log('\n✅ Test completed\n');
}

// Run the test
testPolkCountyScraper().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
