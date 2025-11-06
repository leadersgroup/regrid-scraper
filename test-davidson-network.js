/**
 * Check network requests to see what's happening with the search
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function debugNetwork() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Listen to all requests
    scraper.page.on('request', request => {
      const url = request.url();
      if (!url.includes('google') && !url.includes('gstatic') && !url.includes('.png') && !url.includes('.jpg')) {
        console.log(`→ ${request.method()} ${url}`);
      }
    });

    scraper.page.on('response', async response => {
      const url = response.url();
      if (url.includes('Search') || url.includes('Property') || url.includes('WP')) {
        console.log(`← ${response.status()} ${url}`);
      }
    });

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\n✅ Page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address mode
    console.log('📋 Selecting Address mode...');
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check what fields are visible now
    const fieldsInfo = await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return inputs.map(input => ({
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        value: input.value,
        visible: input.offsetParent !== null
      }));
    });

    console.log('\n📋 Visible input fields after selecting Address:');
    console.log(JSON.stringify(fieldsInfo.filter(f => f.visible), null, 2));

    // Enter the address
    console.log('\n⌨️  Entering address...');
    await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const visibleInputs = inputs.filter(i => i.offsetParent !== null);

      if (visibleInputs[0]) {
        visibleInputs[0].value = '6241';
        visibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        visibleInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        console.log('Set first field to: 6241');
      }

      if (visibleInputs[1]) {
        visibleInputs[1].value = 'Del Sol';
        visibleInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
        visibleInputs[1].dispatchEvent(new Event('change', { bubbles: true }));
        console.log('Set second field to: Del Sol');
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check field values
    const fieldValues = await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return inputs
        .filter(i => i.offsetParent !== null)
        .map(i => ({
          name: i.name,
          id: i.id,
          value: i.value
        }));
    });

    console.log('\n📋 Field values before submit:');
    console.log(JSON.stringify(fieldValues, null, 2));

    // Submit
    console.log('\n🔍 Clicking search button...\n');
    await scraper.page.click('button:has-text("Search"), input[value*="Search"]').catch(() => {
      console.log('Button click failed, trying Enter key...');
    });

    await scraper.page.keyboard.press('Enter');

    console.log('\n⏳ Watching network for 15 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check for results
    const resultsCheck = await scraper.page.evaluate(() => {
      return {
        bodyText: document.body.innerText.substring(0, 1000),
        hasNoData: document.body.innerText.includes('No data to display'),
        tableCount: document.querySelectorAll('table').length,
        url: window.location.href
      };
    });

    console.log('\n📊 Results check:');
    console.log(JSON.stringify(resultsCheck, null, 2));

    await scraper.page.screenshot({ path: '/tmp/network-debug.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/network-debug.png');

    console.log('\n⏸️  Keeping browser open (2 min)...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

debugNetwork().catch(console.error);
