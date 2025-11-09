/**
 * Test script for Dallas County deed scraper
 * Usage: node test-dallas.js
 */

const DallasCountyTexasScraper = require('./county-implementations/dallas-county-texas');

async function testDallasCounty() {
  const address = '7012 Duffield Ct, Dallas, TX 75248';

  console.log('================================================================================');
  console.log('🧪 Testing Dallas County Scraper');
  console.log('================================================================================');
  console.log(`📍 Address: ${address}`);
  console.log('');

  const scraper = new DallasCountyTexasScraper({
    headless: false, // Set to true for headless mode
    debug: true
  });

  try {
    const result = await scraper.getPriorDeed(address);

    console.log('');
    console.log('================================================================================');
    console.log('📊 RESULT');
    console.log('================================================================================');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.download && result.download.pdfData) {
      // Save PDF to file for verification
      const fs = require('fs');
      const pdfPath = `./test-output-dallas-${Date.now()}.pdf`;
      fs.writeFileSync(pdfPath, Buffer.from(result.download.pdfData, 'base64'));
      console.log('');
      console.log(`✅ PDF saved to: ${pdfPath}`);
    }

    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('');
    console.error('================================================================================');
    console.error('❌ ERROR');
    console.error('================================================================================');
    console.error(error);
    process.exit(1);
  }
}

testDallasCounty();
