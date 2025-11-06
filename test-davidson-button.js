/**
 * Find and test the actual search button
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testButton() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Watch network
    scraper.page.on('request', req => {
      const url = req.url();
      if (url.includes('Search') || url.includes('Property')) {
        console.log(`→ ${req.method()} ${url}`);
      }
    });

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\n✅ Page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address mode
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

    console.log('✅ Entered address: 6241 Del Sol\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find all buttons
    const buttons = await scraper.page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a[onclick]'));
      return btns.map((btn, i) => ({
        index: i,
        tag: btn.tagName,
        type: btn.type,
        text: (btn.textContent || btn.value || '').trim().substring(0, 50),
        id: btn.id,
        className: btn.className,
        onclick: btn.getAttribute('onclick'),
        visible: btn.offsetParent !== null
      })).filter(b => b.visible);
    });

    console.log('🔍 All visible buttons/clickable elements:');
    buttons.forEach(b => {
      console.log(`  [${b.index}] ${b.tag} - "${b.text}" (id: ${b.id || 'none'})`);
      if (b.onclick) console.log(`       onclick: ${b.onclick.substring(0, 80)}`);
    });

    // Find the search button specifically
    const searchButton = buttons.find(b =>
      b.text.toLowerCase().includes('search') &&
      !b.text.toLowerCase().includes('advanced')
    );

    if (searchButton) {
      console.log(`\n✅ Found search button at index ${searchButton.index}: "${searchButton.text}"`);
      console.log(`   Clicking it...\n`);

      await scraper.page.evaluate((idx) => {
        const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a[onclick]'));
        const btn = btns.filter(b => b.offsetParent !== null)[idx];
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      }, searchButton.index);

      console.log('⏳ Waiting for search results (10s)...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const results = await scraper.page.evaluate(() => {
        return {
          hasNoData: document.body.innerText.includes('No data to display'),
          url: window.location.href
        };
      });

      console.log('📊 Results:');
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log('\n❌ No search button found');
    }

    await scraper.page.screenshot({ path: '/tmp/button-test.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/button-test.png');

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

testButton().catch(console.error);
