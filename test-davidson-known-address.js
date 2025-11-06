/**
 * Test with well-known Nashville addresses
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testKnownAddress() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  const testAddresses = [
    '1 Public Square',  // Nashville City Hall
    '100 Main St',      // Example from their search
    '123 Main St',      // Common address
    'Del Sol',          // Just street name
    '6241'              // Just house number
  ];

  try {
    await scraper.initialize();

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');

    for (const testAddr of testAddresses) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Testing: "${testAddr}"`);
      console.log('='.repeat(60));

      // Select Address from dropdown
      await scraper.page.evaluate(() => {
        const select = document.querySelector('#inputGroupSelect01');
        if (select) {
          select.value = '2';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Clear and enter new address
      await scraper.page.evaluate((addr) => {
        const input = document.querySelector('input[type="text"]');
        if (input) {
          input.value = addr;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, testAddr);

      await new Promise(resolve => setTimeout(resolve, 500));

      // Submit
      await scraper.page.keyboard.press('Enter');

      // Wait for results
      console.log('⏳ Waiting for results...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Check results
      const results = await scraper.page.evaluate(() => {
        const body = document.body.innerText;
        const hasNoData = body.includes('No data to display');

        // Look for result rows or links
        const resultLinks = Array.from(document.querySelectorAll('a'))
          .filter(l => {
            const text = l.innerText?.trim() || '';
            const href = l.getAttribute('href') || '';
            return text.length > 0 &&
                   text.length < 50 &&
                   !text.toLowerCase().includes('search') &&
                   !text.toLowerCase().includes('export') &&
                   !text.toLowerCase().includes('home') &&
                   href && href.includes('/OFS/') &&
                   l.offsetParent !== null;
          })
          .map(l => ({
            text: l.innerText?.trim(),
            href: l.getAttribute('href')
          }));

        return {
          hasNoData,
          resultCount: resultLinks.length,
          results: resultLinks.slice(0, 5)
        };
      });

      if (results.hasNoData) {
        console.log('❌ No results found');
      } else {
        console.log(`✅ Found ${results.resultCount} potential results:`);
        results.results.forEach((r, i) => {
          console.log(`   ${i + 1}. ${r.text} -> ${r.href}`);
        });
      }

      // Small delay before next test
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n⏸️  Keeping browser open (60s)...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testKnownAddress().catch(console.error);
