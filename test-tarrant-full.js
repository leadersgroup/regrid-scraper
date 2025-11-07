const TarrantCountyTexas = require('./county-implementations/tarrant-county-texas');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing Tarrant County Full Workflow\n');

  const scraper = new TarrantCountyTexas({ headless: false });

  try {
    await scraper.initialize();

    const address = '1009 WICKWOOD Ct. FORT WORTH, TX 76131';
    console.log(`Testing address: ${address}\n`);

    const result = await scraper.scrape(address);

    console.log('\n✅ Scrape completed!');
    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.pdfPath) {
      const stats = fs.statSync(result.pdfPath);
      console.log(`\n📄 PDF saved: ${result.pdfPath}`);
      console.log(`📊 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    } else {
      console.log('\n⚠️ No PDF was downloaded');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n🧹 Cleaning up...');
    await scraper.close();
    console.log('✅ Done!');
  }
})();
