/**
 * Simplified Davidson County debug - test simple search
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testSimpleSearch() {
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

    console.log('✅ Page loaded, waiting...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Type in the simple search and see what happens
    console.log('\n🔍 Testing simple search with: "6241 Del Sol"');

    const typed = await scraper.page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) {
        input.value = '6241 Del Sol';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    });

    if (!typed) {
      console.log('❌ Could not type into search field');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    await scraper.page.keyboard.press('Enter');

    console.log('⏳ Waiting for results (10s)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check what's on the page
    const pageInfo = await scraper.page.evaluate(() => {
      const body = document.body.innerText;

      // Look for "no data" messages
      const hasNoData = body.toLowerCase().includes('no data');

      // Count tables
      const tables = document.querySelectorAll('table');

      // Look for parcel links (various formats)
      const parcelPatterns = [
        /\d{3}\s+\d{2}\s+\w+\s+\d+/,  // "049 14 0a 023"
        /\d{3}-\d{2}-\d+-\d+/,          // "049-14-0-023"
        /\d{8,}/                         // Long parcel numbers
      ];

      const potentialParcels = [];
      const links = Array.from(document.querySelectorAll('a'));
      links.forEach(link => {
        const text = link.innerText?.trim();
        if (text && parcelPatterns.some(p => p.test(text))) {
          potentialParcels.push({
            text,
            href: link.href,
            onclick: link.getAttribute('onclick')
          });
        }
      });

      return {
        hasNoData,
        tableCount: tables.length,
        potentialParcels,
        bodySnippet: body.substring(0, 500)
      };
    });

    console.log('\n📊 Page Analysis:');
    console.log(JSON.stringify(pageInfo, null, 2));

    // If no results, maybe we need to check if there are dropdown options
    if (pageInfo.hasNoData) {
      console.log('\n⚠️  "No data" message found. Checking search form options...');

      const formInfo = await scraper.page.evaluate(() => {
        // Check for dropdowns/selects
        const selects = Array.from(document.querySelectorAll('select'));
        const selectInfo = selects.map(s => ({
          name: s.name,
          id: s.id,
          options: Array.from(s.options).map(o => ({
            value: o.value,
            text: o.text
          }))
        }));

        // Check for radio buttons
        const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
        const radioInfo = radios.map(r => ({
          name: r.name,
          value: r.value,
          checked: r.checked,
          label: r.nextElementSibling?.innerText || r.parentElement?.innerText
        }));

        return { selects: selectInfo, radios: radioInfo };
      });

      console.log('\n📋 Form Controls:');
      console.log(JSON.stringify(formInfo, null, 2));
    }

    // Keep browser open
    console.log('\n⏸️  Keeping browser open for 2 minutes...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testSimpleSearch().catch(console.error);
