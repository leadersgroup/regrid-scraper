/**
 * Stay on home page and look for results card below search form
 */

const { chromium } = require('playwright');

async function testStayOnPage() {
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

    const startUrl = 'https://portal.padctn.org/OFS/WP/Home';
    await page.goto(startUrl, {
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
    await page.fill('#streetNumber', '6241');
    await page.fill('#singleSearchCriteria', 'del sol');

    console.log('✅ Entered address: 6241 del sol\n');
    await page.waitForTimeout(2000);

    // Click the search button instead of submitting form
    console.log('🔍 Clicking search button...\n');

    // Find and click the actual search button
    const searchBtn = await page.locator('button[type="submit"]').first();
    await searchBtn.click();

    console.log('✅ Clicked search button\n');

    // Wait for results to appear on the SAME page
    console.log('⏳ Waiting for results card to appear...\n');

    // Wait for the parcel card to appear
    try {
      await page.waitForSelector('text=/049 14 0A 023\\.00/i', { timeout: 10000 });
      console.log('✅ Results card appeared!\n');
    } catch (e) {
      console.log('❌ Results card did not appear within 10 seconds\n');
    }

    // Check current URL
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    console.log(`   Still on home page: ${currentUrl === startUrl}\n`);

    // Get the full page state
    const pageState = await page.evaluate(() => {
      // Look for the parcel card
      const parcelLink = document.querySelector('a[onclick*="OnSearchGridSelectAccount"]');

      // Get all text containing the parcel number
      const parcelElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent || '';
        return /049\s+14\s+0A\s+023\.00/i.test(text);
      });

      return {
        url: window.location.href,
        parcelLinkFound: !!parcelLink,
        parcelLinkInfo: parcelLink ? {
          text: parcelLink.textContent?.trim(),
          onclick: parcelLink.getAttribute('onclick'),
          href: parcelLink.getAttribute('href')
        } : null,
        parcelElementCount: parcelElements.length,
        bodyHas049: document.body.innerText.includes('049 14 0A 023.00')
      };
    });

    console.log('📋 Page state:');
    console.log(JSON.stringify(pageState, null, 2));

    if (pageState.parcelLinkFound) {
      console.log('\n✅ Found parcel link with onclick handler\n');
      console.log('🖱️  Now clicking the parcel number link...\n');

      // Click the parcel link - use the onclick handler
      await page.click('a[onclick*="OnSearchGridSelectAccount"]');

      console.log('✅ Clicked parcel link\n');

      // Wait for property details to load
      await page.waitForTimeout(5000);

      // Check for View Deed button
      console.log('🔍 Looking for View Deed button...\n');

      const deedCheck = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));

        const deedElements = allElements.filter(el => {
          const text = (el.textContent || '').toLowerCase();
          const onclick = (el.getAttribute('onclick') || '').toLowerCase();
          const href = (el.getAttribute('href') || '').toLowerCase();

          return (text.includes('deed') || onclick.includes('deed') || href.includes('deed')) &&
                 el.offsetParent !== null;
        }).map(el => ({
          tag: el.tagName,
          text: (el.textContent || '').trim().substring(0, 100),
          onclick: el.getAttribute('onclick'),
          href: el.getAttribute('href'),
          id: el.id,
          className: typeof el.className === 'string' ? el.className : ''
        }));

        return {
          url: window.location.href,
          deedCount: deedElements.length,
          deedElements: deedElements,
          bodySnippet: document.body.innerText.substring(0, 2000)
        };
      });

      console.log(`   Deed elements found: ${deedCheck.deedCount}`);
      console.log(`   Current URL: ${deedCheck.url}\n`);

      if (deedCheck.deedCount > 0) {
        console.log('🎯 DEED ELEMENTS:');
        deedCheck.deedElements.forEach((el, i) => {
          console.log(`   ${i + 1}. [${el.tag}] "${el.text}"`);
          if (el.onclick) console.log(`      onclick: ${el.onclick}`);
          if (el.href) console.log(`      href: ${el.href}`);
        });
      } else {
        console.log('❌ No deed elements found');
        console.log('\n📄 Body snippet:');
        console.log(deedCheck.bodySnippet);
      }
    }

    await page.screenshot({ path: '/tmp/davidson-stay-on-page.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-stay-on-page.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-stay-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testStayOnPage().catch(console.error);
