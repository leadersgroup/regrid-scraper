/**
 * Debug Mecklenburg - find and click "Get image now" button on export page
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

    console.log('⏳ Waiting for property page...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Setup new tab listener
    const newPagePromise = new Promise(resolve =>
      browser.once('targetcreated', target => resolve(target.page()))
    );

    // Click deed link
    await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (/^\d{4,5}-\d{1,5}$/.test(text)) {
          link.click();
          return;
        }
      }
    });

    console.log('⏳ Waiting for ROD tab...');
    const rodPage = await newPagePromise;
    await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    console.log(`✅ ROD tab: ${rodPage.url()}`);

    // Accept disclaimer
    await new Promise(resolve => setTimeout(resolve, 3000));

    const disclaimerClicked = await rodPage.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));
      for (const el of allElements) {
        const text = el.textContent.toLowerCase();
        if (text.includes('click here to acknowledge') ||
            text.includes('acknowledge the disclaimer') ||
            text.includes('enter the site')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (disclaimerClicked) {
      console.log('✅ Clicked disclaimer');
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Setup listener for export page
    const exportPagePromise = new Promise(resolve =>
      browser.once('targetcreated', target => resolve(target.page()))
    );

    // Click Image button
    console.log('\n🖼️ Clicking "Image" button...');
    const imageButtonClicked = await rodPage.evaluate(() => {
      const buttonIds = [
        'cphNoMargin_OptionsBar1_lnkImage',
        'cphNoMargin_OptionsBar1_lnkDld'
      ];

      for (const id of buttonIds) {
        const button = document.getElementById(id);
        if (button) {
          button.click();
          return { success: true, text: button.textContent.trim() };
        }
      }

      return { success: false };
    });

    if (!imageButtonClicked.success) {
      console.log('❌ Could not find Image button');
      return;
    }

    console.log(`✅ Clicked: ${imageButtonClicked.text}`);

    // Wait for export page to open
    console.log('⏳ Waiting for export page...');
    const exportPage = await exportPagePromise;
    await exportPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    console.log(`✅ Export page: ${exportPage.url()}`);

    // Wait for page to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze the export page structure
    console.log('\n=== ANALYZING EXPORT PAGE ===');

    // Check for iframes
    const iframeInfo = await exportPage.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map((iframe, idx) => ({
        index: idx,
        id: iframe.id,
        name: iframe.name,
        src: iframe.src,
        className: iframe.className
      }));
    });

    console.log(`\nFound ${iframeInfo.length} iframes:`);
    iframeInfo.forEach(info => {
      console.log(`\n  [${info.index}]`);
      console.log(`    ID: ${info.id}`);
      console.log(`    Name: ${info.name}`);
      console.log(`    Src: ${info.src}`);
      console.log(`    Class: ${info.className}`);
    });

    // Search for all buttons on main page
    console.log('\n=== BUTTONS ON MAIN PAGE ===');
    const mainPageButtons = await exportPage.evaluate(() => {
      const result = [];
      const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

      elements.forEach((el, idx) => {
        const text = (el.textContent || el.value || '').trim();
        if (text) {
          result.push({
            index: idx,
            tag: el.tagName,
            id: el.id,
            className: el.className,
            text: text.substring(0, 100),
            onclick: el.getAttribute('onclick') || ''
          });
        }
      });

      return result;
    });

    console.log(`\nFound ${mainPageButtons.length} buttons on main page:`);
    mainPageButtons.forEach(btn => {
      console.log(`\n[${btn.index}] ${btn.tag}`);
      if (btn.id) console.log(`  ID: ${btn.id}`);
      if (btn.className) console.log(`  Class: ${btn.className}`);
      if (btn.text) console.log(`  Text: ${btn.text}`);
      if (btn.onclick) console.log(`  OnClick: ${btn.onclick.substring(0, 100)}`);
    });

    // Search for buttons in each iframe
    for (let i = 0; i < iframeInfo.length; i++) {
      console.log(`\n=== BUTTONS IN IFRAME ${i} ===`);

      const frames = exportPage.frames();
      const targetFrame = frames.find(f => f.url() === iframeInfo[i].src || f.name() === iframeInfo[i].name);

      if (targetFrame) {
        const iframeButtons = await targetFrame.evaluate(() => {
          const result = [];
          const elements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

          elements.forEach((el, idx) => {
            const text = (el.textContent || el.value || '').trim();
            if (text) {
              result.push({
                index: idx,
                tag: el.tagName,
                id: el.id,
                className: el.className,
                text: text.substring(0, 100),
                onclick: el.getAttribute('onclick') || ''
              });
            }
          });

          return result;
        }).catch(err => {
          console.log(`  ⚠️ Could not access iframe: ${err.message}`);
          return [];
        });

        console.log(`Found ${iframeButtons.length} buttons in iframe ${i}:`);
        iframeButtons.forEach(btn => {
          console.log(`\n[${btn.index}] ${btn.tag}`);
          if (btn.id) console.log(`  ID: ${btn.id}`);
          if (btn.className) console.log(`  Class: ${btn.className}`);
          if (btn.text) console.log(`  Text: ${btn.text}`);
          if (btn.onclick) console.log(`  OnClick: ${btn.onclick.substring(0, 100)}`);
        });
      } else {
        console.log('  ⚠️ Could not find frame');
      }
    }

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    console.log('💡 Look for the "Get image now" button');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
