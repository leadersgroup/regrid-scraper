/**
 * Test with proper waiting for search results to load
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testSearchWait() {
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

    console.log('✅ Entered address\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Submit form
    await scraper.page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) {
        form.submit();
      }
    });

    console.log('✅ Submitted form\n');

    // Wait for results to appear - check every second for up to 15 seconds
    console.log('⏳ Waiting for search results...\n');

    let resultsAppeared = false;
    for (let i = 1; i <= 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const check = await scraper.page.evaluate(() => {
        const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          const firstLine = text.split('\n')[0].trim();
          if (pattern.test(firstLine)) {
            return { found: true, parcel: firstLine };
          }
        }

        // Check for "No data" message
        const hasNoData = document.body.innerText.includes('No data to display');

        // Check for any table rows
        const tables = document.querySelectorAll('table');
        const hasTableData = tables.length > 0 && Array.from(tables).some(t => t.querySelectorAll('tr').length > 1);

        return { found: false, hasNoData, hasTableData, tableCount: tables.length };
      });

      console.log(`   Check ${i}: ${JSON.stringify(check)}`);

      if (check.found) {
        console.log(`\n✅ Results appeared after ${i} seconds!`);
        resultsAppeared = true;
        break;
      }

      if (check.hasNoData) {
        console.log('\n❌ "No data to display" message appeared');
        break;
      }
    }

    if (!resultsAppeared) {
      console.log('\n❌ Results did not appear within 15 seconds');

      // Take screenshot and dump page content
      await scraper.page.screenshot({ path: '/tmp/davidson-no-results.png', fullPage: true });
      console.log('📸 Screenshot: /tmp/davidson-no-results.png');

      const pageContent = await scraper.page.evaluate(() => {
        return {
          bodySnippet: document.body.innerText.substring(0, 1000),
          url: window.location.href,
          tableCount: document.querySelectorAll('table').length
        };
      });

      console.log('\n📄 Page content:');
      console.log(JSON.stringify(pageContent, null, 2));

      console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
      await new Promise(resolve => setTimeout(resolve, 120000));

      return;
    }

    // If results appeared, click the parcel card
    const parcelCardClicked = await scraper.page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          console.log('Clicking parcel card:', firstLine);
          el.click();
          return { clicked: true, parcel: firstLine };
        }
      }
      return { clicked: false };
    });

    console.log('\n✅ Parcel card clicked:', parcelCardClicked.parcel);

    // Now wait for deed button to appear
    console.log('\n⏳ Waiting for View Deed button...\n');

    for (let i = 1; i <= 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const deedCheck = await scraper.page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, div[onclick], span[onclick]'));
        const visibleButtons = allButtons
          .filter(btn => {
            const style = window.getComputedStyle(btn);
            return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
          })
          .map(btn => ({
            tag: btn.tagName,
            text: (btn.textContent || btn.value || '').trim().substring(0, 60),
            onclick: (btn.getAttribute('onclick') || '').substring(0, 60)
          }))
          .filter(b => b.text.length > 0 || b.onclick.length > 0);

        const deedButtons = visibleButtons.filter(b =>
          b.text.toLowerCase().includes('deed') ||
          b.onclick.toLowerCase().includes('deed')
        );

        return {
          buttonCount: visibleButtons.length,
          buttons: visibleButtons.slice(0, 10),
          deedButtons: deedButtons
        };
      });

      console.log(`   Check ${i}: ${deedCheck.buttonCount} buttons, ${deedCheck.deedButtons.length} deed buttons`);

      if (deedCheck.deedButtons.length > 0) {
        console.log('\n✅ Found deed button(s):');
        deedCheck.deedButtons.forEach((btn, idx) => {
          console.log(`   ${idx + 1}. [${btn.tag}] "${btn.text}"`);
        });
        break;
      }

      if (i === 10) {
        console.log('\n❌ No deed button found after 10 seconds');
        console.log('\n📋 All visible buttons:');
        deedCheck.buttons.forEach((btn, idx) => {
          console.log(`   ${idx + 1}. [${btn.tag}] "${btn.text}"`);
        });
      }
    }

    await scraper.page.screenshot({ path: '/tmp/davidson-search-wait.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-search-wait.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testSearchWait().catch(console.error);
