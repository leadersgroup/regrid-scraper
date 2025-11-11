/**
 * Debug Mecklenburg - show all request details to understand what we're capturing
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

  const imageRequests = [];

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

    // Set up request capture BEFORE navigation
    const requestHandler = (request) => {
      const url = request.url();
      if (url.includes('generator.leadgen')) {
        imageRequests.push(url);

        const pnMatch = url.match(/PN=(\d+)/);
        if (pnMatch) {
          console.log(`  [${imageRequests.length}] Captured PN=${pnMatch[1]}`);
        }
      }
    };

    rodPage.on('request', requestHandler);
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

    console.log('\n⏳ Waiting 15 more seconds for thumbnail strip...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    rodPage.off('request', requestHandler);

    console.log(`\n📍 Total captured: ${imageRequests.length} requests`);

    // Group by page number
    const byPage = {};
    for (const url of imageRequests) {
      const pnMatch = url.match(/PN=(\d+)/);
      if (pnMatch) {
        const pageNum = parseInt(pnMatch[1]);
        if (!byPage[pageNum]) byPage[pageNum] = [];
        byPage[pageNum].push(url);
      }
    }

    console.log('\n=== REQUESTS BY PAGE ===');
    for (let p = 1; p <= 3; p++) {
      if (byPage[p]) {
        console.log(`\nPage ${p}: ${byPage[p].length} requests`);

        // Show first request for this page
        const firstUrl = byPage[p][0];
        const icgMatch = firstUrl.match(/ICG=([^&]+)/);
        const oiwMatch = firstUrl.match(/OIW=(\d+)/);
        const oihMatch = firstUrl.match(/OIH=(\d+)/);

        console.log(`  ICG: ${icgMatch ? icgMatch[1] : 'N/A'}`);
        console.log(`  OIW/OIH: ${oiwMatch ? oiwMatch[1] : 'N/A'}x${oihMatch ? oihMatch[1] : 'N/A'}`);
      } else {
        console.log(`\nPage ${p}: 0 requests`);
      }
    }

    console.log('\n\n⏳ Waiting 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
