const HarrisCountyTexas = require('./county-implementations/harris-county-texas');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🧪 Testing Full Harris County PDF Download Implementation\n');

  const scraper = new HarrisCountyTexas();

  try {
    await scraper.initialize();

    console.log('🔍 Searching for property owner: HOANG BINH TRAN\n');

    const result = await scraper.scrapeProperty('HOANG BINH TRAN');

    console.log('\n📊 Result Summary:');
    console.log('='.repeat(60));
    console.log(`Success: ${result.success}`);
    console.log(`Film Code: ${result.filmCode || 'N/A'}`);
    console.log(`Message: ${result.message}`);

    if (result.pdfData) {
      console.log(`\n✅ PDF Data Received!`);
      console.log(`   Size: ${result.pdfData.length} bytes (${(result.pdfData.length / 1024 / 1024).toFixed(2)} MB)`);

      const isPDF = result.pdfData.slice(0, 4).toString() === '%PDF';
      console.log(`   Is PDF: ${isPDF}`);

      if (isPDF) {
        const filename = `harris-${result.filmCode || 'test'}-${Date.now()}.pdf`;
        const filepath = path.join(__dirname, filename);
        fs.writeFileSync(filepath, result.pdfData);
        console.log(`   ✅✅✅ SAVED TO: ${filepath}\n`);
      }
    } else if (result.requiresManualDownload) {
      console.log(`\n⚠️ Manual Download Required`);
      console.log(`   PDF Viewer URL: ${result.pdfViewerUrl}`);
      console.log(`   Error: ${result.error || 'Unknown'}`);
    } else if (result.requiresAuth) {
      console.log(`\n🔐 Authentication Required`);
      console.log(`   Login URL: ${result.loginUrl || 'N/A'}`);
    } else {
      console.log(`\n❌ No PDF data received`);
    }

    console.log('\n📄 Full Result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n✅ Scraper closed');
  }
})();
