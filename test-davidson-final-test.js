const DavidsonScraper = require('./county-implementations/davidson-county-tennessee.js');

async function test() {
  const scraper = new DavidsonScraper({ headless: true, verbose: true });

  try {
    const result = await scraper.getPriorDeed('6241 Del Sol Dr, Whites Creek, TN 37189, USA');

    console.log('\n\n═══════════════════════════════════════');
    console.log('FINAL RESULT');
    console.log('═══════════════════════════════════════');
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}`);
    console.log(`Duration: ${result.duration}`);

    if (result.download) {
      console.log(`\nDownload Info:`);
      console.log(`  Filename: ${result.download.filename || 'N/A'}`);
      console.log(`  Size: ${result.download.size || 0} bytes`);
      console.log(`  URL: ${result.download.url || 'N/A'}`);
      console.log(`  Has Base64: ${!!result.download.base64}`);
    }

    console.log('\n✅ TEST PASSED!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

test();
