/**
 * Debug Mecklenburg - find how to capture FULL page images from LTViewer
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
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Find the LTViewer iframe
    console.log('\n🔍 Analyzing LTViewer iframe...');
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

    // Detailed analysis of the viewer
    const analysis = await viewerFrame.evaluate(() => {
      const result = {
        allImages: [],
        allCanvases: [],
        divs: [],
        iframeInfo: {},
        documentDimensions: {
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          clientWidth: document.documentElement.clientWidth,
          clientHeight: document.documentElement.clientHeight
        }
      };

      // Find all images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        result.allImages.push({
          id: img.id,
          src: img.src.substring(0, 200),
          width: img.width,
          height: img.height,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          style: img.style.cssText,
          display: window.getComputedStyle(img).display,
          visibility: window.getComputedStyle(img).visibility
        });
      });

      // Find all canvases
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        result.allCanvases.push({
          id: canvas.id,
          width: canvas.width,
          height: canvas.height,
          style: canvas.style.cssText
        });
      });

      // Find divs with specific IDs or classes that might contain the viewer
      const divs = document.querySelectorAll('div[id], div[class*="viewer"], div[class*="image"], div[class*="page"]');
      divs.forEach(div => {
        result.divs.push({
          id: div.id,
          className: div.className,
          scrollWidth: div.scrollWidth,
          scrollHeight: div.scrollHeight,
          clientWidth: div.clientWidth,
          clientHeight: div.clientHeight,
          hasChildren: div.children.length
        });
      });

      // Check for any nested iframes
      const nestedIframes = document.querySelectorAll('iframe');
      result.iframeInfo.count = nestedIframes.length;
      result.iframeInfo.srcs = Array.from(nestedIframes).map(f => f.src);

      return result;
    });

    console.log('\n=== VIEWER ANALYSIS ===');
    console.log('\nDocument Dimensions:');
    console.log(JSON.stringify(analysis.documentDimensions, null, 2));

    console.log('\nAll Images Found:');
    analysis.allImages.forEach((img, i) => {
      console.log(`\nImage ${i + 1}:`);
      console.log(`  ID: ${img.id}`);
      console.log(`  Dimensions: ${img.width}x${img.height}`);
      console.log(`  Natural: ${img.naturalWidth}x${img.naturalHeight}`);
      console.log(`  Display: ${img.display}, Visibility: ${img.visibility}`);
      console.log(`  Src: ${img.src}`);
    });

    console.log('\nAll Canvases Found:');
    analysis.allCanvases.forEach((canvas, i) => {
      console.log(`\nCanvas ${i + 1}:`);
      console.log(`  ID: ${canvas.id}`);
      console.log(`  Dimensions: ${canvas.width}x${canvas.height}`);
    });

    console.log('\nRelevant Divs:');
    analysis.divs.slice(0, 10).forEach((div, i) => {
      console.log(`\nDiv ${i + 1}:`);
      console.log(`  ID: ${div.id}`);
      console.log(`  Class: ${div.className}`);
      console.log(`  Scroll: ${div.scrollWidth}x${div.scrollHeight}`);
      console.log(`  Client: ${div.clientWidth}x${div.clientHeight}`);
    });

    console.log('\nNested Iframes:', analysis.iframeInfo);

    // Try to get the actual image URL being loaded
    console.log('\n🔍 Looking for image URLs in network requests...');
    const imageUrls = [];

    rodPage.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('image/') && url.includes('meckrod')) {
        console.log(`📸 Image URL: ${url}`);
        console.log(`   Size: ${response.headers()['content-length']}`);
        imageUrls.push(url);
      }
    });

    // Try to trigger next page to see if new image loads
    console.log('\n🔄 Trying to navigate to next page in viewer...');
    const nextClicked = await viewerFrame.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('img, a, button, input'));
      for (const btn of buttons) {
        const title = btn.title || btn.alt || '';
        const onclick = btn.getAttribute('onclick') || '';
        const src = btn.src || '';

        if (title.toLowerCase().includes('next') ||
            onclick.includes('Next') ||
            onclick.includes('nextPage') ||
            src.includes('next')) {
          console.log('Found next button:', { title, onclick, src });
          btn.click();
          return true;
        }
      }
      return false;
    });

    console.log(nextClicked ? '✅ Clicked next page' : '❌ Could not find next page button');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if iframe dimensions can be expanded
    console.log('\n🔍 Checking iframe element dimensions...');
    const iframeElement = await viewerFrame.frameElement();
    if (iframeElement) {
      const iframeDims = await iframeElement.evaluate(el => ({
        offsetWidth: el.offsetWidth,
        offsetHeight: el.offsetHeight,
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        style: el.style.cssText
      }));
      console.log('Iframe element dimensions:', iframeDims);
    }

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    console.log('💡 Try scrolling within the iframe to see if the image extends beyond viewport');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
