/**
 * Debug Mecklenburg - examine the LTViewer iframe URL to find document parameters
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

  // Intercept ALL requests to see what the viewer is requesting
  const allRequests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('meckrod') || url.includes('ImageHandler') || url.includes('.ashx')) {
      allRequests.push({
        type: 'request',
        method: req.method(),
        url,
        postData: req.postData()
      });
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('meckrod') || url.includes('ImageHandler') || url.includes('.ashx')) {
      allRequests.push({
        type: 'response',
        status: res.status(),
        url,
        contentType: res.headers()['content-type']
      });
    }
  });

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

    // Setup listeners on the new page too
    rodPage.on('request', req => {
      const url = req.url();
      if (url.includes('meckrod') || url.includes('ImageHandler') || url.includes('.ashx') || url.includes('GetImage')) {
        console.log(`📤 REQUEST: ${req.method()} ${url}`);
        if (req.postData()) {
          console.log(`   POST DATA: ${req.postData().substring(0, 200)}`);
        }
        allRequests.push({
          type: 'request',
          method: req.method(),
          url,
          postData: req.postData()
        });
      }
    });

    rodPage.on('response', async (res) => {
      const url = res.url();
      if (url.includes('meckrod') || url.includes('ImageHandler') || url.includes('.ashx') || url.includes('GetImage')) {
        const contentType = res.headers()['content-type'] || '';
        const size = res.headers()['content-length'] || 'unknown';
        console.log(`📥 RESPONSE: ${res.status()} ${url}`);
        console.log(`   Type: ${contentType}, Size: ${size}`);
        allRequests.push({
          type: 'response',
          status: res.status(),
          url,
          contentType,
          size
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
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait even longer for viewer
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Find ALL iframes and their URLs
    console.log('\n=== FINDING IFRAMES ===');
    const iframeURLs = await rodPage.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map((iframe, i) => ({
        index: i,
        src: iframe.src,
        id: iframe.id,
        name: iframe.name
      }));
    });

    iframeURLs.forEach(iframe => {
      console.log(`\nIframe ${iframe.index}:`);
      console.log(`  ID: ${iframe.id}`);
      console.log(`  Name: ${iframe.name}`);
      console.log(`  SRC: ${iframe.src}`);
    });

    // Parse the LTViewer iframe URL to extract parameters
    const ltViewerIframe = iframeURLs.find(f => f.src.includes('LTViewer'));
    if (ltViewerIframe) {
      console.log('\n=== LTVIEWER IFRAME URL ANALYSIS ===');
      const url = new URL(ltViewerIframe.src);
      console.log(`Base URL: ${url.origin}${url.pathname}`);
      console.log(`\nQuery Parameters:`);
      url.searchParams.forEach((value, key) => {
        console.log(`  ${key} = ${value}`);
      });
    }

    console.log('\n\n=== ALL CAPTURED REQUESTS ===');
    allRequests.forEach((req, i) => {
      console.log(`\n${i + 1}. ${req.type.toUpperCase()}: ${req.url}`);
      if (req.method) console.log(`   Method: ${req.method}`);
      if (req.postData) console.log(`   POST: ${req.postData.substring(0, 100)}`);
      if (req.status) console.log(`   Status: ${req.status}`);
      if (req.contentType) console.log(`   Type: ${req.contentType}`);
    });

    console.log('\n\n⏳ Waiting 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
