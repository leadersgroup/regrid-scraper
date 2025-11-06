/**
 * Wait for navigation after clicking parcel card
 */

const { chromium } = require('playwright');

async function testWithNavigation() {
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

    // Enter address using correct IDs
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

    // Find parcel card link
    console.log('🔍 Looking for parcel card link...\n');

    const parcelLink = await page.evaluate(() => {
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
            text: link.textContent.trim()
          };
        }
      }
      return { found: false };
    });

    if (!parcelLink.found) {
      console.log('❌ Parcel link not found');
      return;
    }

    console.log(`✅ Found parcel link: ${parcelLink.parcel}`);
    console.log(`   href: ${parcelLink.href}\n`);

    // Click and wait for navigation
    console.log('🖱️  Clicking and waiting for navigation...\n');

    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
      page.evaluate(() => {
        const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
        const allLinks = Array.from(document.querySelectorAll('a'));

        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const firstLine = text.split('\n')[0].trim();
          if (pattern.test(firstLine)) {
            link.click();
            break;
          }
        }
      })
    ]);

    console.log(`✅ Navigation completed`);
    console.log(`   Status: ${response.status()}`);
    console.log(`   URL: ${response.url()}\n`);

    // Wait for page to fully load
    await page.waitForTimeout(5000);

    // Check what's on the new page
    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Get all clickable elements
      const allElements = Array.from(document.querySelectorAll('*'));

      const clickable = allElements
        .filter(el => {
          const tag = el.tagName.toLowerCase();
          const hasClick = el.onclick || el.getAttribute('onclick');
          const isButton = ['button', 'a', 'input'].includes(tag);

          return (isButton || hasClick) && el.offsetParent !== null;
        })
        .map(el => ({
          tag: el.tagName,
          text: (el.textContent || el.value || '').trim().substring(0, 60)
        }));

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
          onclick: (el.getAttribute('onclick') || '').substring(0, 100),
          href: el.getAttribute('href')
        }));

      return {
        url: window.location.href,
        bodySnippet: bodyText.substring(0, 1500),
        bodyHasDeed: bodyText.toLowerCase().includes('deed'),
        clickableCount: clickable.length,
        clickable: clickable.slice(0, 20),
        deedCount: deedElements.length,
        deedElements: deedElements
      };
    });

    console.log('═'.repeat(80));
    console.log('PAGE INFO AFTER NAVIGATION');
    console.log('═'.repeat(80));

    console.log(`\n📍 URL: ${pageInfo.url}`);
    console.log(`📄 Body has "deed": ${pageInfo.bodyHasDeed}`);
    console.log(`🔍 Clickable elements: ${pageInfo.clickableCount}`);
    console.log(`📜 Deed elements: ${pageInfo.deedCount}\n`);

    if (pageInfo.deedCount > 0) {
      console.log('🎯 DEED ELEMENTS FOUND:');
      pageInfo.deedElements.forEach((el, i) => {
        console.log(`   ${i + 1}. [${el.tag}] "${el.text}"`);
        if (el.onclick) console.log(`      onclick: ${el.onclick}`);
        if (el.href) console.log(`      href: ${el.href}`);
      });
    }

    console.log('\n📋 Clickable elements:');
    pageInfo.clickable.forEach((el, i) => {
      console.log(`   ${i + 1}. [${el.tag}] "${el.text}"`);
    });

    console.log('\n📄 Body snippet:');
    console.log(pageInfo.bodySnippet);

    console.log('\n═'.repeat(80));

    await page.screenshot({ path: '/tmp/davidson-navigation.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-navigation.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-navigation-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testWithNavigation().catch(console.error);
