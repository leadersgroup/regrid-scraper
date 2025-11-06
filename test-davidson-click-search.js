/**
 * Try clicking the search button instead of form.submit()
 */

const { chromium } = require('playwright');

async function testClickSearch() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('\n✅ Browser initialized\n');

    await page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');
    await page.waitForTimeout(3000);

    // Select Address mode
    await page.selectOption('#inputGroupSelect01', '2');
    console.log('✅ Selected Address mode\n');
    await page.waitForTimeout(3000);

    // Enter address
    const visibleInputs = await page.locator('input[type="text"]:visible').all();
    if (visibleInputs[0]) {
      await visibleInputs[0].fill('6241');
      console.log('✅ Entered number: 6241');
    }
    if (visibleInputs[1]) {
      await visibleInputs[1].fill('Del Sol');
      console.log('✅ Entered street: Del Sol\n');
    }

    await page.waitForTimeout(2000);

    // Look for all buttons
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
      return allButtons.map((btn, i) => ({
        index: i,
        tag: btn.tagName,
        type: btn.type,
        text: (btn.textContent || btn.value || '').trim(),
        id: btn.id,
        className: btn.className,
        visible: btn.offsetParent !== null
      })).filter(b => b.visible);
    });

    console.log('📋 All visible buttons:');
    buttons.forEach(b => {
      console.log(`   [${b.index}] ${b.tag}:${b.type} - "${b.text}" (id: ${b.id})`);
    });

    // Find search button
    const searchButton = buttons.find(b =>
      b.text.toLowerCase().includes('search') &&
      !b.text.toLowerCase().includes('advanced')
    );

    if (searchButton) {
      console.log(`\n✅ Found search button: "${searchButton.text}"\n`);

      // Try multiple methods to click it
      console.log('🔍 Method 1: Using Playwright .click()');
      try {
        await page.locator(`button:has-text("${searchButton.text}")`).click();
        console.log('   ✅ Clicked with Playwright\n');
      } catch (e) {
        console.log('   ❌ Failed:', e.message);

        // Try with evaluate
        console.log('🔍 Method 2: Using .click() in evaluate');
        await page.evaluate((idx) => {
          const btns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
          const visibleBtns = btns.filter(b => b.offsetParent !== null);
          if (visibleBtns[idx]) {
            visibleBtns[idx].click();
          }
        }, searchButton.index);
        console.log('   ✅ Clicked with evaluate\n');
      }
    } else {
      console.log('\n❌ No search button found, trying form.submit()');
      await page.evaluate(() => {
        const form = document.querySelector('#frmQuick');
        if (form) {
          form.submit();
        }
      });
    }

    // Wait and check for results
    console.log('⏳ Waiting for search results...\n');

    for (let i = 1; i <= 15; i++) {
      await page.waitForTimeout(1000);

      const check = await page.evaluate(() => {
        const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          const firstLine = text.split('\n')[0].trim();
          if (pattern.test(firstLine)) {
            return { found: true, parcel: firstLine };
          }
        }

        const hasNoData = document.body.innerText.includes('No data to display');
        const tables = document.querySelectorAll('table');
        const hasTableData = tables.length > 0;

        return { found: false, hasNoData, hasTableData, tableCount: tables.length };
      });

      console.log(`   Check ${i}: ${JSON.stringify(check)}`);

      if (check.found) {
        console.log(`\n✅ Results appeared after ${i} seconds!`);
        console.log(`   Parcel: ${check.parcel}\n`);

        // Click parcel card
        const parcelClicked = await page.evaluate(() => {
          const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
          const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

          for (const el of allElements) {
            const text = (el.textContent || '').trim();
            const firstLine = text.split('\n')[0].trim();
            if (pattern.test(firstLine)) {
              el.click();
              return { clicked: true, parcel: firstLine };
            }
          }
          return { clicked: false };
        });

        console.log('✅ Clicked parcel card\n');

        // Wait for deed button
        console.log('⏳ Waiting for View Deed button...\n');

        for (let j = 1; j <= 10; j++) {
          await page.waitForTimeout(1000);

          const deedCheck = await page.evaluate(() => {
            const allButtons = Array.from(document.querySelectorAll('button, input, a, div[onclick], span[onclick]'));
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

          console.log(`   Check ${j}: ${deedCheck.buttonCount} buttons, ${deedCheck.deedButtons.length} deed buttons`);

          if (deedCheck.deedButtons.length > 0) {
            console.log('\n✅ Found deed button(s):');
            deedCheck.deedButtons.forEach((btn, idx) => {
              console.log(`   ${idx + 1}. [${btn.tag}] "${btn.text}"`);
            });
            break;
          }

          if (j === 10) {
            console.log('\n❌ No deed button found');
            console.log('\n📋 All visible buttons:');
            deedCheck.buttons.forEach((btn, idx) => {
              console.log(`   ${idx + 1}. [${btn.tag}] "${btn.text}"`);
            });
          }
        }

        break;
      }

      if (check.hasNoData) {
        console.log('\n❌ "No data to display" message appeared');
        break;
      }
    }

    await page.screenshot({ path: '/tmp/davidson-click-search.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-click-search.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-click-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testClickSearch().catch(console.error);
