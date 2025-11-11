/**
 * Debug Mecklenburg PDF Page - analyze what's on the page after disclaimer
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

    // Accept disclaimer if present
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
      console.log('⏳ Waiting for navigation after disclaimer...');
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // NOW ANALYZE THE PAGE
    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    const analysis = await rodPage.evaluate(() => {
      return {
        // Look for iframes
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          name: iframe.name
        })),

        // Look for embeds/objects
        embeds: Array.from(document.querySelectorAll('embed, object')).map(el => ({
          tag: el.tagName,
          src: el.src || el.data,
          type: el.type
        })),

        // Look for ALL links
        allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent.trim().substring(0, 50),
          href: a.href
        })),

        // Look for buttons
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent || btn.value,
          type: btn.type,
          onclick: btn.getAttribute('onclick')
        })),

        // Check page title and body text
        title: document.title,
        bodyTextPreview: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('\n=== PAGE ANALYSIS ===');
    console.log('Title:', analysis.title);
    console.log('\nIframes:', JSON.stringify(analysis.iframes, null, 2));
    console.log('\nEmbeds/Objects:', JSON.stringify(analysis.embeds, null, 2));
    console.log('\nButtons:', JSON.stringify(analysis.buttons, null, 2));
    console.log('\nAll Links (first 10):', JSON.stringify(analysis.allLinks.slice(0, 10), null, 2));
    console.log('\nBody Text Preview:');
    console.log(analysis.bodyTextPreview);

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
