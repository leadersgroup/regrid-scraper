/**
 * Test Dallas County Deed Scraper - Full Workflow
 *
 * This script tests the complete Dallas County workflow:
 * 1. Search Dallas CAD by address
 * 2. Extract legal description with instrument number or book/page
 * 3. Search dallas.tx.publicsearch.us
 * 4. Download deed PDF
 */

const DallasCountyTexasScraper = require('./county-implementations/dallas-county-texas');

async function testDallasCounty() {
  console.log('🏠 Testing Dallas County Deed Scraper - Full Workflow');
  console.log('=' .repeat(60));

  const scraper = new DallasCountyTexasScraper({
    headless: false, // Set to true for production
    timeout: 120000,
    verbose: true
  });

  try {
    // Test address - replace with actual Dallas County address
    const testAddress = '123 Main St, Dallas, TX';

    console.log(`\n📍 Test Address: ${testAddress}`);
    console.log('-'.repeat(60));

    // Initialize browser
    await scraper.initialize();
    console.log('✅ Browser initialized\n');

    // Run complete workflow
    const result = await scraper.scrape(testAddress);

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULTS');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ SUCCESS - Deed downloaded successfully!');
      console.log(`📄 PDF Size: ${result.download.fileSize} bytes`);

      if (result.download.instrumentNumber) {
        console.log(`📋 Instrument Number: ${result.download.instrumentNumber}`);
      }
      if (result.download.bookNumber && result.download.pageNumber) {
        console.log(`📖 Book/Page: ${result.download.bookNumber}/${result.download.pageNumber}`);
      }

      // Optionally save PDF to file for verification
      const fs = require('fs');
      const pdfBuffer = Buffer.from(result.download.pdfData, 'base64');
      const filename = `dallas-deed-${Date.now()}.pdf`;
      fs.writeFileSync(filename, pdfBuffer);
      console.log(`💾 PDF saved to: ${filename}`);
    } else {
      console.log('\n❌ FAILURE - Deed download failed');
      console.log(`Error: ${result.error}`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n🔒 Browser closed');
  }
}

// Run test
testDallasCounty().catch(console.error);
