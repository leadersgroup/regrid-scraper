/**
 * Test what network requests the search makes
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testNetworkRequests() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Listen to network requests
    await scraper.page.setRequestInterception(true);
    scraper.page.on('request', request => {
      const url = request.url();
      if (url.includes('Search') || url.includes('Property') || url.includes('WP')) {
        console.log(`→ REQUEST: ${request.method()} ${url}`);
        const postData = request.postData();
        if (postData) {
          console.log(`   POST DATA: ${postData}`);
        }
      }
      request.continue();
    });

    scraper.page.on('response', async response => {
      const url = response.url();
      if (url.includes('Search') || url.includes('Property')) {
        console.log(`← RESPONSE: ${response.status()} ${url}`);
      }
    });

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address
    console.log('Selecting Address mode...\n');
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter address
    console.log('Entering address...\n');
    await scraper.page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) {
        input.value = '100 Main';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit
    console.log('Submitting search...\n');
    await scraper.page.keyboard.press('Enter');

    // Wait and watch network
    console.log('Watching network for 15 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n✅ Done');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testNetworkRequests().catch(console.error);
