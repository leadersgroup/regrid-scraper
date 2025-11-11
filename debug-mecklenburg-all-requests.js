/**
 * Debug Mecklenburg - capture ALL network requests to find image handler
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

  // Capture ALL requests to ROD page
  const rodRequests = [];

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

    // Capture ALL requests on ROD page
    rodPage.on('request', (request) => {
      const url = request.url();
      if (url.includes('meckrod') || url.includes('GetImage') || url.includes('ImageHandler') || url.includes('LT')) {
        rodRequests.push({
          type: 'request',
          url,
          method: request.method(),
          resourceType: request.resourceType()
        });
      }
    });

    rodPage.on('response', async (response) => {
      const url = response.url();
      if (url.includes('meckrod') || url.includes('GetImage') || url.includes('ImageHandler') || url.includes('LT')) {
        const contentType = response.headers()['content-type'] || '';
        rodRequests.push({
          type: 'response',
          url,
          status: response.status(),
          contentType,
          size: response.headers()['content-length'] || 'unknown'
        });
      }
    });

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
      console.log('⏳ Waiting for navigation and ALL images to load...');
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait even longer
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);
    console.log(`\n=== CAPTURED REQUESTS (${rodRequests.length} total) ===`);

    // Filter for likely image data requests
    const imageDataRequests = rodRequests.filter(r =>
      r.url.toLowerCase().includes('getimage') ||
      r.url.toLowerCase().includes('imagehandler') ||
      r.url.toLowerCase().includes('.ashx') ||
      r.url.toLowerCase().includes('callback') ||
      (r.contentType && r.contentType.includes('image/')) ||
      (r.size && parseInt(r.size) > 50000) // Large responses
    );

    console.log(`\n=== LIKELY IMAGE DATA REQUESTS (${imageDataRequests.length}) ===`);
    imageDataRequests.forEach((req, i) => {
      console.log(`\n${i + 1}. ${req.type.toUpperCase()}: ${req.url}`);
      if (req.method) console.log(`   Method: ${req.method}`);
      if (req.status) console.log(`   Status: ${req.status}`);
      if (req.contentType) console.log(`   Content-Type: ${req.contentType}`);
      if (req.size) console.log(`   Size: ${req.size}`);
    });

    // Also look for any ASHX handlers or callbacks
    const handlerRequests = rodRequests.filter(r =>
      r.url.includes('.ashx') || r.url.includes('Callback') || r.url.includes('WebForm')
    );

    console.log(`\n=== HANDLER/CALLBACK REQUESTS (${handlerRequests.length}) ===`);
    handlerRequests.forEach((req, i) => {
      console.log(`\n${i + 1}. ${req.url}`);
    });

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
