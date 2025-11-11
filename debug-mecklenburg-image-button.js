/**
 * Debug Mecklenburg - find the "Image" button on the ROD page that opens "Get image now"
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

    console.log('⏳ Waiting for new tab...');
    const rodPage = await newPagePromise;
    await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    console.log(`✅ New tab: ${rodPage.url()}`);

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

    // Search for "Image" button on the ROD page (NOT in iframe)
    console.log('\n=== SEARCHING FOR IMAGE BUTTON ON ROD PAGE ===');

    const imageButtons = await rodPage.evaluate(() => {
      const result = [];

      // Look for elements with "image" in text, title, alt, or src
      const allElements = Array.from(document.querySelectorAll('a, button, img, input[type="button"], input[type="image"], div[onclick], span[onclick]'));

      allElements.forEach((el, idx) => {
        const text = (el.innerText || el.textContent || '').toLowerCase();
        const title = (el.title || '').toLowerCase();
        const alt = (el.alt || '').toLowerCase();
        const src = (el.src || '').toLowerCase();
        const onclick = (el.getAttribute('onclick') || '').toLowerCase();

        if (text.includes('image') || title.includes('image') || alt.includes('image') ||
            src.includes('image') || onclick.includes('image')) {
          result.push({
            index: idx,
            tag: el.tagName,
            id: el.id || '',
            className: el.className || '',
            text: (el.innerText || el.textContent || '').substring(0, 50),
            title: el.title || '',
            alt: el.alt || '',
            src: el.src ? el.src.substring(el.src.lastIndexOf('/') + 1) : '',
            onclick: onclick.substring(0, 100)
          });
        }
      });

      return result;
    });

    console.log(`\nFound ${imageButtons.length} elements with "image":`);
    imageButtons.forEach(btn => {
      console.log(`\n[${btn.index}] ${btn.tag}`);
      if (btn.id) console.log(`    ID: ${btn.id}`);
      if (btn.className) console.log(`    Class: ${btn.className}`);
      if (btn.text) console.log(`    Text: ${btn.text}`);
      if (btn.title) console.log(`    Title: ${btn.title}`);
      if (btn.alt) console.log(`    Alt: ${btn.alt}`);
      if (btn.src) console.log(`    Src: ${btn.src}`);
      if (btn.onclick) console.log(`    OnClick: ${btn.onclick}`);
    });

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    console.log('💡 Look for the "Image" button that opens "Get image now"');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
