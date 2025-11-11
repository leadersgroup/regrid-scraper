/**
 * Debug Mecklenburg Image URLs - capture what images the viewer loads
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

  // Capture all image requests
  const imageUrls = [];
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('image/') || url.includes('GetImage') || url.includes('ImageHandler')) {
      console.log(`📸 Image request: ${url}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Status: ${response.status()}`);
      imageUrls.push({ url, contentType, status: response.status() });
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

    // Set up image listener for the ROD page too
    rodPage.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('image/') || url.includes('GetImage') || url.includes('ImageHandler')) {
        console.log(`📸 [ROD Page] Image request: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Status: ${response.status()}`);
        imageUrls.push({ url, contentType, status: response.status() });
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
      console.log('⏳ Waiting for navigation and images to load...');
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer for images
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);
    console.log(`\n=== CAPTURED IMAGE URLS (${imageUrls.length} total) ===`);
    imageUrls.forEach((img, i) => {
      console.log(`\n${i + 1}. ${img.url}`);
      console.log(`   Type: ${img.contentType}, Status: ${img.status}`);
    });

    // Try to get page number info from the viewer
    console.log('\n🔍 Checking for page count in viewer...');
    const frames = rodPage.frames();
    for (const frame of frames) {
      if (frame.url().includes('LTViewer')) {
        const pageInfo = await frame.evaluate(() => {
          // Look for any page count indicators
          const bodyText = document.body ? document.body.innerText : '';
          const pageMatch = bodyText.match(/(\d+)\s*pages?/i) || bodyText.match(/page\s*(\d+)\s*of\s*(\d+)/i);

          return {
            bodyText: bodyText.substring(0, 500),
            pageMatch: pageMatch ? pageMatch[0] : null
          };
        }).catch(() => null);

        if (pageInfo) {
          console.log('Page info from viewer:');
          console.log(pageInfo);
        }
      }
    }

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
