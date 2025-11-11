/**
 * Debug Mecklenburg County Deed Click
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating...');
    await page.goto('https://polaris3g.mecklenburgcountync.gov/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter search
    const searchInput = await page.$('input[placeholder*="address"], input[placeholder*="Address"], input[type="text"]');
    await searchInput.click();
    await searchInput.type('17209 island view', { delay: 100 });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click autocomplete
    await page.evaluate(() => {
      const listItems = Array.from(document.querySelectorAll('ul.bg-lienzo li'));
      if (listItems.length > 0) {
        const clickableDiv = listItems[0].querySelector('div.hover\\:cursor-pointer');
        if (clickableDiv) clickableDiv.click();
      }
    });

    console.log('⏳ Waiting for property page to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Find the deed link
    console.log('🔍 Looking for deed link...');
    const deedLinkInfo = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));

      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (/^\d{4,5}-\d{1,5}$/.test(text)) {
          return {
            success: true,
            bookPage: text,
            href: link.href,
            target: link.target,
            onclick: link.getAttribute('onclick')
          };
        }
      }

      return { success: false };
    });

    console.log('Deed link info:', deedLinkInfo);

    if (deedLinkInfo.success) {
      console.log(`\n✅ Found deed link: ${deedLinkInfo.bookPage}`);
      console.log(`   href: ${deedLinkInfo.href}`);
      console.log(`   target: ${deedLinkInfo.target}`);
      console.log(`   onclick: ${deedLinkInfo.onclick}`);

      // Click the deed link
      console.log('\n🖱️  Clicking deed link...');
      await page.evaluate((href) => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        for (const link of allLinks) {
          if (link.href === href) {
            link.click();
            return;
          }
        }
      }, deedLinkInfo.href);

      console.log('⏳ Waiting 10 seconds after click...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const currentUrl = page.url();
      console.log(`\n📍 Current URL after click: ${currentUrl}`);

      // Check for any new tabs
      const pages = await browser.pages();
      console.log(`\n📄 Number of pages: ${pages.length}`);
      if (pages.length > 1) {
        console.log('   New tab detected!');
        const newPage = pages[pages.length - 1];
        console.log(`   New tab URL: ${newPage.url()}`);
      }

      console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 60000));

    } else {
      console.log('❌ Could not find deed link');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
