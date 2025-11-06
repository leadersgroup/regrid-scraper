/**
 * Test with screenshots to see what's actually on the page after search
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testWithScreenshot() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();
    scraper.currentAddress = '6241 Del Sol Dr, Whites Creek, TN 37189, USA';

    // Navigate
    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address from dropdown
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2'; // Address option
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Enter address
    await scraper.page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) {
        input.value = '6241 Del Sol Dr';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    console.log('✅ Entered address');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await scraper.page.screenshot({
      path: '/tmp/davidson-before-search.png',
      fullPage: true
    });
    console.log('📸 Screenshot: /tmp/davidson-before-search.png');

    // Press Enter
    await scraper.page.keyboard.press('Enter');

    console.log('⏳ Waiting for results...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    await scraper.page.screenshot({
      path: '/tmp/davidson-after-search.png',
      fullPage: true
    });
    console.log('📸 Screenshot: /tmp/davidson-after-search.png');

    // Get page content
    const pageData = await scraper.page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const links = Array.from(document.querySelectorAll('a'));

      return {
        bodyText: document.body.innerText.substring(0, 2000),
        tableCount: tables.length,
        linkCount: links.length,
        visibleLinks: links
          .filter(l => l.offsetParent !== null)
          .map(l => ({
            text: l.innerText?.trim().substring(0, 100),
            href: l.getAttribute('href'),
            onclick: l.getAttribute('onclick')
          }))
          .filter(l => l.text && l.text.length > 0 && l.text.length < 80)
      };
    });

    console.log('\n📊 Page Data:');
    console.log(JSON.stringify(pageData, null, 2));

    console.log('\n⏸️  Keeping browser open for inspection (60s)...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testWithScreenshot().catch(console.error);
