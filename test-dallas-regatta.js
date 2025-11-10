const DallasCountyTexas = require('./county-implementations/dallas-county-texas');

async function testRegattaPlace() {
  const scraper = new DallasCountyTexas({
    headless: false,
    verbose: true,
    timeout: 90000
  });

  try {
    console.log('=== Testing Dallas County: 1308 REGATTA PL ===\n');

    const result = await scraper.getPriorDeed('1308 REGATTA PL, DALLAS, TX');

    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ Test completed successfully!');
      if (result.download) {
        console.log('File:', result.download.filename || 'N/A');
        console.log('Location:', result.download.downloadPath || 'N/A');
        console.log('Size:', result.download.fileSize || 'N/A', 'bytes');
      }
      if (result.steps && result.steps.step2 && result.steps.step2.data) {
        const data = result.steps.step2.data;
        console.log('Instrument Number:', data.instrumentNumber || 'N/A');
        console.log('Book/Page:', data.bookNumber || 'N/A', '/', data.pageNumber || 'N/A');
      }
    } else {
      console.log('\n❌ Test failed!');
      console.log('Error:', result.message || result.error);

      if (result.steps) {
        console.log('\nSteps:');
        Object.entries(result.steps).forEach(([key, step]) => {
          const status = step.success ? 'PASS' : 'FAIL';
          console.log('  ', status, step.name);
          if (!step.success && step.data) {
            console.log('     Details:', JSON.stringify(step.data, null, 2));
          }
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Test error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.close();
      console.log('Browser closed');
    }
  }
}

testRegattaPlace().catch(console.error);
