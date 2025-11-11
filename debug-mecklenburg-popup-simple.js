/**
 * Simple debug for Mecklenburg - test popup window handling on a deed page
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
    // Navigate directly to a deed page (skipping search)
    console.log('🌐 Navigating to ROD page...');
    await page.goto('https://rodcrpi.mecklenburgcountync.gov/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('⏳ Waiting 60 seconds for you to manually navigate to a deed...');
    console.log('💡 Please manually search for "17209 island view" and click on a deed link');
    await new Promise(resolve => setTimeout(resolve, 60000));

    console.log('\n🖼️ Now testing Image button click and popup handling...');

    // Setup popup listener
    const newPagePromise = new Promise(resolve =>
      browser.once('targetcreated', target => resolve(target))
    );

    // Click Image button
    const imageButtonClicked = await page.evaluate(() => {
      const buttonIds = [
        'cphNoMargin_OptionsBar1_lnkImage',
        'cphNoMargin_OptionsBar1_lnkDld'
      ];

      for (const id of buttonIds) {
        const button = document.getElementById(id);
        if (button) {
          button.click();
          return { success: true, id, text: button.textContent.trim() };
        }
      }

      return { success: false };
    });

    if (!imageButtonClicked.success) {
      console.log('❌ Could not find Image button');
      return;
    }

    console.log(`✅ Clicked: ${imageButtonClicked.text}`);

    // Wait for popup
    console.log('⏳ Waiting for popup...');
    const exportTarget = await newPagePromise;

    let exportPage = await exportTarget.page();

    if (!exportPage) {
      console.log('  Popup detected (page() returned null), finding page...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const pages = await browser.pages();
      console.log(`  Total pages: ${pages.length}`);

      pages.forEach((p, idx) => {
        console.log(`    [${idx}] ${p.url()}`);
      });

      exportPage = pages.find(p =>
        p.url().includes('SearchImage.aspx') &&
        p !== page
      );

      if (!exportPage) {
        exportPage = pages[pages.length - 1];
      }
    }

    console.log(`✅ Export page: ${exportPage.url()}`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find "Get item(s) now" button
    console.log('\n🔍 Looking for "Get item(s) now" button...');
    const buttons = await exportPage.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
      return allElements.map(el => ({
        tag: el.tagName,
        text: (el.textContent || el.value || '').trim(),
        id: el.id,
        className: el.className
      }));
    });

    console.log(`Found ${buttons.length} buttons:`);
    buttons.forEach((btn, idx) => {
      console.log(`  [${idx}] ${btn.tag} - "${btn.text}"`);
      if (btn.id) console.log(`      ID: ${btn.id}`);
    });

    console.log('\n⏳ Waiting 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
