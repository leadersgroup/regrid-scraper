/**
 * Test Durham County, North Carolina Scraper
 *
 * Test address: 6409 Winding Arch Dr, Durham, NC 27713
 */

const DurhamCountyNorthCarolinaScraper = require('./county-implementations/durham-county-north-carolina');

async function testDurhamCounty() {
  console.log('Testing Durham County, North Carolina Scraper');
  console.log('=' .repeat(80));

  const scraper = new DurhamCountyNorthCarolinaScraper({
    headless: false,
    verbose: true,
    timeout: 90000
  });

  const testAddress = '6409 Winding Arch Dr, Durham, NC 27713';

  try {
    console.log('Test Address:', testAddress);
    console.log('Start Time:', new Date().toLocaleString());

    const result = await scraper.getPriorDeed(testAddress);

    console.log('='.repeat(80));
    console.log('FINAL RESULT');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('SUCCESS: Deed scrape completed successfully!');
      if (result.download) {
        console.log('File:', result.download.filename || 'N/A');
        console.log('Location:', result.download.downloadPath || 'N/A');
        console.log('Size:', result.download.fileSize || 'N/A', 'bytes');
      }
      if (result.steps && result.steps.step2 && result.steps.step2.data) {
        const data = result.steps.step2.data;
        console.log('Book:', data.bookNumber || 'N/A');
        console.log('Page:', data.pageNumber || 'N/A');
      }
    } else {
      console.log('FAILED: Could not complete deed scrape');
      console.log('Error:', result.message || result.error);

      if (result.steps) {
        console.log('Steps:');
        Object.entries(result.steps).forEach(([key, step]) => {
          const status = step.success ? 'PASS' : 'FAIL';
          console.log('  ', status, step.name);
          if (!step.success && step.data) {
            console.log('     Details:', JSON.stringify(step.data, null, 2));
          }
        });
      }
    }

    if (result.duration) {
      console.log('Duration:', result.duration);
    }
    console.log('End Time:', new Date().toLocaleString());

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    if (scraper.browser) {
      await scraper.close();
      console.log('Browser closed');
    }
  }
}

testDurhamCounty().catch(console.error);
