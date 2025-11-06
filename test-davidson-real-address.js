const DavidsonScraper = require('./county-implementations/davidson-county-tennessee.js');

async function test() {
  const scraper = new DavidsonScraper({ headless: true, verbose: true });

  const testAddress = '1209 Tyne Blvd, Nashville, TN 37215';

  try {
    console.log(`\n🧪 Testing with real address: ${testAddress}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n\n═══════════════════════════════════════');
    console.log('FINAL RESULT');
    console.log('═══════════════════════════════════════');
    console.log(`Address: ${testAddress}`);
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Duration: ${result.duration}`);

    if (result.download) {
      console.log(`\nDownload Info:`);
      console.log(`  Filename: ${result.download.filename || 'N/A'}`);
      console.log(`  Size: ${result.download.size || 0} bytes`);
      console.log(`  URL: ${result.download.url || 'N/A'}`);
      console.log(`  Filepath: ${result.download.filepath || 'N/A'}`);
    }

    if (result.success) {
      console.log('\n✅ TEST PASSED!\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  TEST COMPLETED WITH ERRORS\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test();
