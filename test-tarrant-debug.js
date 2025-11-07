const TarrantCountyTexas = require('./county-implementations/tarrant-county-texas');

(async () => {
  console.log('🧪 Testing Tarrant County - Debug Mode\n');

  const scraper = new TarrantCountyTexas({ headless: false });

  try {
    await scraper.initialize();

    const address = '1009 WICKWOOD Ct. FORT WORTH, TX 76131';
    console.log(`🔍 Scraping deed for: ${address}\n`);

    const result = await scraper.scrape(address);

    console.log('\n📊 Result Summary:');
    console.log('='.repeat(60));
    console.log(`Success: ${result.success}`);

    if (result.success && result.pdfData) {
      console.log(`Instrument Number: ${result.instrumentNumber}`);
      console.log(`File Size: ${result.fileSize} bytes`);
      console.log('\n✅✅✅ PDF DOWNLOADED SUCCESSFULLY\n');
    } else {
      console.log(`Error: ${result.error || 'Unknown error'}`);
      console.log(`Message: ${result.message || 'N/A'}`);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Test complete');
  }
})();
