/**
 * Try clicking without navigation - maybe there's JS that loads content
 */

const { chromium } = require('playwright');

async function testPreventNavigation() {
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

    // Get parcel link info
    const linkInfo = await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allLinks = Array.from(document.querySelectorAll('a'));

      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          return {
            found: true,
            parcel: firstLine,
            href: link.href,
            onclick: link.getAttribute('onclick'),
            outerHTML: link.outerHTML.substring(0, 300)
          };
        }
      }
      return { found: false };
    });

    console.log('📋 Parcel link info:');
    console.log(JSON.stringify(linkInfo, null, 2));

    if (!linkInfo.found) {
      console.log('\n❌ Parcel link not found');
      return;
    }

    // Instead of clicking, let's look at the page's JavaScript to see how it handles clicks
    console.log('\n🔍 Checking page scripts for click handlers...\n');

    const scripts = await page.evaluate(() => {
      const allScripts = Array.from(document.querySelectorAll('script'));
      return allScripts.map(s => s.textContent || s.src).filter(Boolean);
    });

    // Look for jQuery event handlers or DataTables handlers
    const relevantScripts = scripts.filter(s =>
      s.includes('click') || s.includes('QuickPropertySearchAsync') || s.includes('PropertySearch')
    );

    console.log(`Found ${relevantScripts.length} relevant scripts\n`);

    // Try clicking without following the link - use evaluate to click element directly
    console.log('🖱️  Clicking parcel link (without navigation)...\n');

    // DON'T use await page.click() which waits for navigation
    // Instead, dispatchEvent directly in the page context
    await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allLinks = Array.from(document.querySelectorAll('a'));

      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          // Try dispatching click event without following href
          const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          link.dispatchEvent(event);
          break;
        }
      }
    });

    console.log('✅ Clicked (without navigation)\n');

    // Wait and check for content changes on the SAME page
    console.log('⏳ Checking for content changes...\n');

    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(1000);

      const pageState = await page.evaluate(() => {
        // Check if any new content appeared
        const allElements = Array.from(document.querySelectorAll('*'));

        const deedElements = allElements
          .filter(el => {
            const text = (el.textContent || el.value || '').toLowerCase();
            const onclick = (el.getAttribute('onclick') || '').toLowerCase();
            const href = (el.getAttribute('href') || '').toLowerCase();

            return (text.includes('deed') || onclick.includes('deed') || href.includes('deed')) && el.offsetParent !== null;
          })
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.value || '').trim().substring(0, 100)
          }));

        // Check for modals or panels
        const modals = allElements.filter(el => {
          const className = (el.className || '').toString().toLowerCase();
          const id = (el.id || '').toLowerCase();
          return (className.includes('modal') || className.includes('dialog') || className.includes('panel') ||
                  id.includes('modal') || id.includes('dialog') || id.includes('panel')) && el.offsetParent !== null;
        });

        return {
          url: window.location.href,
          bodyHasDeed: document.body.innerText.toLowerCase().includes('deed'),
          deedCount: deedElements.length,
          deedElements: deedElements.slice(0, 5),
          modalCount: modals.length
        };
      });

      console.log(`   Check ${i}:`);
      console.log(`      URL: ${pageState.url}`);
      console.log(`      Deed elements: ${pageState.deedCount}`);
      console.log(`      Modals: ${pageState.modalCount}`);

      if (pageState.deedCount > 0) {
        console.log('\n      🎯 DEED ELEMENTS:');
        pageState.deedElements.forEach((el, idx) => {
          console.log(`         ${idx + 1}. [${el.tag}] "${el.text}"`);
        });
      }

      if (pageState.deedCount > 0 || i === 10) {
        break;
      }
    }

    await page.screenshot({ path: '/tmp/davidson-prevent-nav.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-prevent-nav.png');

    console.log('\n⏸️  Keeping browser open (2 min) for manual inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-prevent-nav-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testPreventNavigation().catch(console.error);
