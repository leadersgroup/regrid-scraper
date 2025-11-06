/**
 * Final debug - check exactly what's in the results
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function finalDebug() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter address
    await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const visibleInputs = inputs.filter(i => i.offsetParent !== null);

      if (visibleInputs[0]) {
        visibleInputs[0].value = '6241';
        visibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (visibleInputs[1]) {
        visibleInputs[1].value = 'Del Sol';
        visibleInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    console.log('✅ Entered address: 6241 Del Sol');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Screenshot before search
    await scraper.page.screenshot({ path: '/tmp/final-before.png', fullPage: true });

    // Submit
    await scraper.page.keyboard.press('Enter');

    console.log('⏳ Waiting 10 seconds for results...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Screenshot after search
    await scraper.page.screenshot({ path: '/tmp/final-after.png', fullPage: true });

    // Analyze results
    const analysis = await scraper.page.evaluate(() => {
      const body = document.body.innerText;

      return {
        hasNoData: body.includes('No data to display'),
        bodySnippet: body.substring(0, 1500),
        allTables: Array.from(document.querySelectorAll('table')).map((t, i) => ({
          index: i,
          text: t.innerText?.substring(0, 500),
          hasLinks: t.querySelectorAll('a').length
        })),
        allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.innerText?.trim().substring(0, 100),
          href: a.getAttribute('href'),
          visible: a.offsetParent !== null
        })).filter(l => l.visible && l.text && !l.text.toLowerCase().includes('search') && !l.text.toLowerCase().includes('export'))
      };
    });

    console.log('\n📊 Analysis:');
    console.log(JSON.stringify(analysis, null, 2));

    console.log('\n📸 Screenshots saved to:');
    console.log('   /tmp/final-before.png');
    console.log('   /tmp/final-after.png');

    console.log('\n⏸️  Browser will stay open for 2 minutes...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

finalDebug().catch(console.error);
