/**
 * Test Mecklenburg County NC Implementation
 */

const MecklenburgCountyNorthCarolinaScraper = require('./county-implementations/mecklenburg-county-north-carolina');

async function test() {
  console.log('🧪 Testing Mecklenburg County NC Scraper\n');

  const scraper = new MecklenburgCountyNorthCarolinaScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Test address from user
    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log(`Testing address: ${address}\n`);

    const result = await scraper.getPriorDeed(address);

    console.log('\n' + '='.repeat(80));
    console.log('RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify({
      success: result.success,
      address: result.address,
      filename: result.filename,
      fileSize: result.fileSize,
      bookPage: result.bookPage,
      pdfBase64: result.pdfBase64 ? result.pdfBase64.substring(0, 100) + '...' : undefined,
      steps: result.steps,
      error: result.error
    }, null, 2));

    if (result.success && result.pdfBase64) {
      // Verify PDF signature
      const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
      const signature = pdfBuffer.toString('utf8', 0, 4);
      console.log(`\nPDF Signature: ${signature}`);
      console.log(`PDF Valid: ${signature === '%PDF' ? '✅ YES' : '❌ NO'}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await scraper.close();
  }
}

test().catch(console.error);
