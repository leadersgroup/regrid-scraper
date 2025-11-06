/**
 * Call the OnSearchGridSelectAccount function directly
 */

const { chromium } = require('playwright');

async function testCallFunction() {
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
    await page.evaluate(() => {
      document.querySelector('#streetNumber').value = '6241';
      document.querySelector('#singleSearchCriteria').value = 'Del Sol';
    });

    console.log('✅ Entered address\n');
    await page.waitForTimeout(2000);

    // Submit
    await page.evaluate(() => {
      document.querySelector('#frmQuick').submit();
    });

    console.log('✅ Submitted form\n');
    await page.waitForTimeout(5000);

    // Get the account ID from the onclick attribute
    const accountInfo = await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allLinks = Array.from(document.querySelectorAll('a'));

      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          const onclick = link.getAttribute('onclick') || '';
          // Extract account ID from onclick="OnSearchGridSelectAccount(262804,false);return false;"
          const match = onclick.match(/OnSearchGridSelectAccount\((\d+),/);
          return {
            found: true,
            parcel: firstLine,
            onclick: onclick,
            accountId: match ? match[1] : null
          };
        }
      }
      return { found: false };
    });

    console.log('📋 Account info:');
    console.log(JSON.stringify(accountInfo, null, 2));

    if (!accountInfo.found || !accountInfo.accountId) {
      console.log('\n❌ Could not find account ID');
      return;
    }

    // Call the function directly
    console.log(`\n🔍 Calling OnSearchGridSelectAccount(${accountInfo.accountId}, false)...\n`);

    const result = await page.evaluate((accountId) => {
      if (typeof window.OnSearchGridSelectAccount === 'function') {
        window.OnSearchGridSelectAccount(accountId, false);
        return { called: true };
      }
      return { called: false, error: 'Function not found' };
    }, accountInfo.accountId);

    console.log('Function call result:', JSON.stringify(result));

    // Wait for changes
    console.log('\n⏳ Watching for changes...\n');

    for (let i = 1; i <= 15; i++) {
      await page.waitForTimeout(1000);

      const pageState = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));

        // Look for deed elements
        const deedElements = allElements
          .filter(el => {
            const text = (el.textContent || el.value || '').toLowerCase();
            const onclick = (el.getAttribute('onclick') || '').toLowerCase();
            const href = (el.getAttribute('href') || '').toLowerCase();

            return (text.includes('deed') || onclick.includes('deed') || href.includes('deed')) && el.offsetParent !== null;
          })
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.value || '').trim().substring(0, 100),
            href: el.getAttribute('href')
          }));

        // Check for new panels or containers
        const panels = allElements.filter(el => {
          const id = (el.id || '').toLowerCase();
          const className = (el.className || '').toString().toLowerCase();
          return (id.includes('property') || id.includes('detail') || id.includes('info') ||
                  className.includes('property') || className.includes('detail') || className.includes('panel')) &&
                 el.offsetParent !== null && el.innerText && el.innerText.trim().length > 50;
        }).length;

        // Get all visible clickable elements
        const clickable = allElements
          .filter(el => {
            const tag = el.tagName.toLowerCase();
            return (['button', 'a', 'input'].includes(tag) && el.offsetParent !== null);
          })
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.value || '').trim().substring(0, 60)
          }));

        return {
          url: window.location.href,
          bodyHasDeed: document.body.innerText.toLowerCase().includes('deed'),
          deedCount: deedElements.length,
          deedElements: deedElements.slice(0, 5),
          panelCount: panels,
          clickableCount: clickable.length,
          clickable: clickable.slice(0, 15)
        };
      });

      console.log(`   Check ${i}:`);
      console.log(`      URL: ${pageState.url}`);
      console.log(`      Deed elements: ${pageState.deedCount}`);
      console.log(`      Panels with content: ${pageState.panelCount}`);
      console.log(`      Clickable elements: ${pageState.clickableCount}`);

      if (pageState.deedCount > 0) {
        console.log('\n      🎯 DEED ELEMENTS:');
        pageState.deedElements.forEach((el, idx) => {
          console.log(`         ${idx + 1}. [${el.tag}] "${el.text}"`);
          if (el.href) console.log(`            href: ${el.href}`);
        });
      }

      if (i === 1 || i === 5 || i === 10 || i === 15) {
        console.log(`\n      Clickable elements:`);
        pageState.clickable.forEach((el, idx) => {
          console.log(`         ${idx + 1}. [${el.tag}] "${el.text}"`);
        });
      }

      if (pageState.deedCount > 0) {
        console.log('\n✅ Found deed elements!');
        break;
      }

      console.log('');
    }

    await page.screenshot({ path: '/tmp/davidson-call-function.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-call-function.png');

    console.log('\n⏸️  Keeping browser open (2 min) for manual inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-call-function-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testCallFunction().catch(console.error);
