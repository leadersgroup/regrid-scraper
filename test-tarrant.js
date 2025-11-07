const TarrantCountyTexas = require('./county-implementations/tarrant-county-texas');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🧪 Testing Tarrant County PDF Download\n');

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
      console.log(`File Size: ${result.fileSize} bytes (${(result.fileSize / 1024).toFixed(2)} KB)`);

      // Save PDF to file
      const pdfBuffer = Buffer.from(result.pdfData, 'base64');
      const filename = `tarrant-${result.instrumentNumber}-${Date.now()}.pdf`;
      const filepath = path.join(__dirname, filename);

      fs.writeFileSync(filepath, pdfBuffer);
      console.log(`\n✅✅✅ PDF SAVED TO: ${filepath}\n`);

      // Verify it's a valid PDF
      const isPDF = pdfBuffer.slice(0, 4).toString() === '%PDF';
      console.log(`PDF validation: ${isPDF ? 'Valid PDF ✅' : 'Invalid PDF ❌'}`);
    } else {
      console.log(`Error: ${result.error || 'Unknown error'}`);
      console.log(`Message: ${result.message || 'N/A'}`);
    }

    console.log('\n📄 Full Result:');
    console.log(JSON.stringify({...result, pdfData: result.pdfData ? `<${result.fileSize} bytes>` : null}, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Test complete');
  }
})();
