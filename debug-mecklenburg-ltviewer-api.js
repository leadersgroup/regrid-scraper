/**
 * Debug Mecklenburg - explore LTViewer JavaScript API to find image data source
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
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer for viewer to load
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

    // Explore the LTViewer JavaScript environment
    console.log('\n=== EXPLORING LTVIEWER JAVASCRIPT API ===');

    const viewerInfo = await viewerFrame.evaluate(() => {
      const result = {
        globalVariables: [],
        windowProperties: [],
        ltObjects: [],
        imageHandlerUrls: [],
        ajaxCalls: [],
        canvasElements: []
      };

      // Look for LT-specific global variables
      for (const key in window) {
        if (key.includes('LT') || key.includes('Image') || key.includes('Viewer') || key.includes('Document')) {
          result.globalVariables.push({
            key,
            type: typeof window[key],
            value: typeof window[key] === 'function' ? '[Function]' : String(window[key]).substring(0, 100)
          });
        }
      }

      // Look for any objects with image-related properties
      for (const key in window) {
        try {
          const obj = window[key];
          if (obj && typeof obj === 'object') {
            const objKeys = Object.keys(obj);
            if (objKeys.some(k => k.toLowerCase().includes('image') || k.toLowerCase().includes('page') || k.toLowerCase().includes('url'))) {
              result.ltObjects.push({
                key,
                keys: objKeys.filter(k => k.toLowerCase().includes('image') || k.toLowerCase().includes('page') || k.toLowerCase().includes('url'))
              });
            }
          }
        } catch (e) {
          // Skip properties that throw errors
        }
      }

      // Check for canvas elements (might be used for rendering)
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        result.canvasElements.push({
          id: canvas.id,
          width: canvas.width,
          height: canvas.height,
          dataURL: canvas.toDataURL('image/png').substring(0, 100) + '...'
        });
      });

      // Try to find image handler URLs in the page source
      const scripts = Array.from(document.querySelectorAll('script'));
      scripts.forEach(script => {
        const text = script.textContent || '';
        const matches = text.match(/https?:\/\/[^\s"']+?(ImageHandler|GetImage|\.ashx)/gi);
        if (matches) {
          result.imageHandlerUrls.push(...matches);
        }
      });

      return result;
    }).catch(err => ({
      error: err.message
    }));

    console.log('\n--- Global Variables (LT/Image/Viewer/Document related) ---');
    if (viewerInfo.globalVariables) {
      viewerInfo.globalVariables.forEach(v => {
        console.log(`${v.key}: ${v.type} = ${v.value}`);
      });
    }

    console.log('\n--- Objects with Image/Page/URL properties ---');
    if (viewerInfo.ltObjects) {
      viewerInfo.ltObjects.forEach(obj => {
        console.log(`${obj.key}:`);
        console.log(`  Properties: ${obj.keys.join(', ')}`);
      });
    }

    console.log('\n--- Canvas Elements ---');
    if (viewerInfo.canvasElements) {
      viewerInfo.canvasElements.forEach((c, i) => {
        console.log(`Canvas ${i + 1}: ID="${c.id}", ${c.width}x${c.height}`);
      });
    }

    console.log('\n--- Image Handler URLs found in scripts ---');
    if (viewerInfo.imageHandlerUrls) {
      viewerInfo.imageHandlerUrls.forEach(url => {
        console.log(`  ${url}`);
      });
    }

    // Try to access the iframe's parent window context (ROD page) to see if there's an API
    console.log('\n=== CHECKING ROD PAGE FOR LTVIEWER API ===');
    const rodPageAPI = await rodPage.evaluate(() => {
      const result = {
        ltVariables: [],
        imageUrls: []
      };

      // Look for LT-related variables in parent window
      for (const key in window) {
        if (key.includes('LT') || key.includes('Viewer')) {
          result.ltVariables.push({
            key,
            type: typeof window[key]
          });
        }
      }

      // Look for iframe references
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((iframe, i) => {
        if (iframe.src.includes('LTViewer')) {
          result.imageUrls.push(`Iframe ${i}: ${iframe.src}`);
        }
      });

      return result;
    });

    console.log('\n--- LT Variables in ROD Page ---');
    rodPageAPI.ltVariables.forEach(v => {
      console.log(`${v.key}: ${v.type}`);
    });

    console.log('\n--- LTViewer iframe src ---');
    rodPageAPI.imageUrls.forEach(url => {
      console.log(`  ${url}`);
    });

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    console.log('💡 Check the browser console for any LT API calls or image requests');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
