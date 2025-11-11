/**
 * Debug Mecklenburg - analyze captured generator.leadgen requests per page
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
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    rodPage.off('request', requestHandler);

    console.log(`\n📍 Captured ${imageRequests.length} requests`);

    // Analyze requests by page number
    const pageData = {};

    for (const url of imageRequests) {
      const pnMatch = url.match(/PN=(\d+)/);
      if (!pnMatch) continue;

      const pageNum = parseInt(pnMatch[1], 10);

      const icgMatch = url.match(/ICG=([^&]+)/);
      const oiwMatch = url.match(/OIW=(\d+)/);
      const oihMatch = url.match(/OIH=(\d+)/);
      const tokenMatch = url.match(/leadgen\?([^&]+)&ICG/);
      const wtvMatch = url.match(/WTV=([^&]+)/);
      const dtwMatch = url.match(/DTW=(\d+)/);
      const siwMatch = url.match(/SIW=(\d+)/);

      if (!pageData[pageNum]) {
        pageData[pageNum] = [];
      }

      pageData[pageNum].push({
        icg: icgMatch ? icgMatch[1] : null,
        oiw: oiwMatch ? parseInt(oiwMatch[1]) : null,
        oih: oihMatch ? parseInt(oihMatch[1]) : null,
        token: tokenMatch ? tokenMatch[1] : null,
        wtv: wtvMatch ? wtvMatch[1] : null,
        dtw: dtwMatch ? parseInt(dtwMatch[1]) : null,
        siw: siwMatch ? parseInt(siwMatch[1]) : null
      });
    }

    console.log('\n=== PAGE DATA ANALYSIS ===');
    for (const pageNum of Object.keys(pageData).sort((a, b) => a - b)) {
      console.log(`\n📄 Page ${pageNum}:`);
      console.log(`   Total requests: ${pageData[pageNum].length}`);

      // Find unique ICG/token combinations
      const uniqueCombos = {};
      for (const req of pageData[pageNum]) {
        const key = `${req.icg}|${req.token}`;
        if (!uniqueCombos[key]) {
          uniqueCombos[key] = {
            icg: req.icg,
            token: req.token,
            oiw: req.oiw,
            oih: req.oih,
            count: 0
          };
        }
        uniqueCombos[key].count++;
      }

      console.log(`   Unique ICG/Token combinations: ${Object.keys(uniqueCombos).length}`);
      for (const combo of Object.values(uniqueCombos)) {
        console.log(`     ICG: ${combo.icg}`);
        console.log(`     Token: ${combo.token}`);
        console.log(`     OIW/OIH: ${combo.oiw}x${combo.oih}`);
        console.log(`     Count: ${combo.count} requests`);
        console.log('');
      }

      // Find largest dimensions request
      const largest = pageData[pageNum].reduce((max, req) => {
        if (!max || (req.siw && req.siw > (max.siw || 0))) {
          return req;
        }
        return max;
      }, null);

      console.log(`   Largest SIW request: ${largest ? largest.siw : 'N/A'}`);
      console.log(`   Largest DTW request: ${largest ? largest.dtw : 'N/A'}`);
    }

    console.log('\n\n⏳ Waiting 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
