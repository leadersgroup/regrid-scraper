/**
 * Debug Mecklenburg - find the next page button in LTViewer
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
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Find the LTViewer iframe
    const frames = rodPage.frames();
    let viewerFrame = null;

    for (const frame of frames) {
      if (frame.url().includes('LTViewer')) {
        viewerFrame = frame;
        break;
      }
    }

    if (!viewerFrame) {
      console.log('❌ Could not find LTViewer iframe');
      return;
    }

    console.log('✅ Found LTViewer iframe');
    console.log(`   URL: ${viewerFrame.url()}`);

    // Find ALL buttons/links/images in the viewer
    console.log('\n=== ANALYZING ALL CLICKABLE ELEMENTS ===');
    const elements = await viewerFrame.evaluate(() => {
      const result = [];
      const clickables = Array.from(document.querySelectorAll('img, input, a, button, div[onclick], span[onclick]'));

      clickables.forEach((el, idx) => {
        result.push({
          index: idx,
          tag: el.tagName,
          id: el.id || '',
          className: el.className || '',
          title: el.title || '',
          alt: el.alt || '',
          src: el.src || '',
          onclick: el.getAttribute('onclick') || '',
          innerText: (el.innerText || '').substring(0, 50)
        });
      });

      return result;
    });

    console.log(`\nFound ${elements.length} clickable elements:`);
    elements.forEach(el => {
      console.log(`\n[${el.index}] ${el.tag}`);
      if (el.id) console.log(`    ID: ${el.id}`);
      if (el.className) console.log(`    Class: ${el.className}`);
      if (el.title) console.log(`    Title: ${el.title}`);
      if (el.alt) console.log(`    Alt: ${el.alt}`);
      if (el.src) console.log(`    Src: ${el.src.substring(el.src.lastIndexOf('/') + 1)}`);
      if (el.onclick) console.log(`    OnClick: ${el.onclick.substring(0, 100)}`);
      if (el.innerText) console.log(`    Text: ${el.innerText}`);
    });

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    console.log('💡 Look for buttons with "next", "page", navigation arrows, etc.');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
