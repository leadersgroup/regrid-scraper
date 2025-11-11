/**
 * Debug Mecklenburg - capture image URLs from LTViewer
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

  const imageUrls = [];

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

    // Set up request interception on ROD page BEFORE navigation
    rodPage.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Look for actual deed page images (TIFF, JPEG, PNG served by LTViewer)
      if ((contentType.includes('image/') && url.includes('meckrod')) ||
          url.includes('ImageHandler') ||
          url.includes('GetImage') ||
          url.includes('.ashx') ||
          url.includes('LTImage')) {
        const size = response.headers()['content-length'];
        console.log(`📸 IMAGE URL: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Size: ${size ? (parseInt(size) / 1024).toFixed(2) + ' KB' : 'unknown'}`);
        imageUrls.push({ url, contentType, size });
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
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait for images to load
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Check the img src attributes inside the LTViewer iframe
    const frames = rodPage.frames();
    for (const frame of frames) {
      if (frame.url().includes('LTViewer')) {
        console.log('\n🔍 Found LTViewer iframe, checking image sources...');

        const imgSrcs = await frame.evaluate(() => {
          const images = document.querySelectorAll('img');
          return Array.from(images).map(img => ({
            src: img.src,
            width: img.width,
            height: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            id: img.id,
            className: img.className
          }));
        }).catch(err => {
          console.log(`  Error reading frame: ${err.message}`);
          return [];
        });

        console.log(`\n=== IMAGES IN LTVIEWER IFRAME (${imgSrcs.length}) ===`);
        imgSrcs.forEach((img, i) => {
          console.log(`\n${i + 1}. ${img.src.substring(0, 150)}...`);
          console.log(`   Size: ${img.width}x${img.height}, Natural: ${img.naturalWidth}x${img.naturalHeight}`);
          console.log(`   ID: ${img.id}, Class: ${img.className}`);
        });
      }
    }

    console.log(`\n\n=== CAPTURED IMAGE URLS FROM NETWORK (${imageUrls.length}) ===`);
    imageUrls.forEach((img, i) => {
      console.log(`\n${i + 1}. ${img.url}`);
      console.log(`   Type: ${img.contentType}`);
      console.log(`   Size: ${img.size ? (parseInt(img.size) / 1024).toFixed(2) + ' KB' : 'unknown'}`);
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
