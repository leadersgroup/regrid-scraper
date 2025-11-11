/**
 * Debug Mecklenburg LTViewer iframe - see what's inside
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
      console.log('⏳ Waiting for navigation...');
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Find the LTViewer iframe
    console.log('\n🔍 Looking for LTViewer iframe...');
    const frames = rodPage.frames();
    console.log(`Found ${frames.length} frames total`);

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const url = frame.url();
      console.log(`\nFrame ${i}: ${url}`);

      if (url.includes('LTViewer')) {
        console.log('  ✅ Found LTViewer frame!');

        // Wait for frame to load
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Analyze frame content
        const frameAnalysis = await frame.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body ? document.body.innerText.substring(0, 500) : 'No body',

            // Look for images
            images: Array.from(document.querySelectorAll('img')).map(img => ({
              src: img.src,
              alt: img.alt,
              width: img.width,
              height: img.height
            })),

            // Look for canvas elements (PDF renderers often use canvas)
            canvases: Array.from(document.querySelectorAll('canvas')).map(c => ({
              width: c.width,
              height: c.height
            })),

            // Look for any links or scripts that might contain PDF URL
            links: Array.from(document.querySelectorAll('a')).map(a => ({
              text: a.textContent.trim(),
              href: a.href
            })),

            // Check for any elements with data attributes
            dataElements: Array.from(document.querySelectorAll('[data-src], [data-url], [data-path]')).map(el => ({
              tag: el.tagName,
              dataSrc: el.getAttribute('data-src'),
              dataUrl: el.getAttribute('data-url'),
              dataPath: el.getAttribute('data-path')
            })),

            // Look for scripts that might have PDF URLs
            scripts: Array.from(document.querySelectorAll('script')).map(s => ({
              src: s.src,
              hasInlineCode: s.textContent.length > 0,
              codePreview: s.textContent.substring(0, 200)
            }))
          };
        }).catch(err => ({ error: err.message }));

        console.log('\n=== LTVIEWER FRAME ANALYSIS ===');
        console.log(JSON.stringify(frameAnalysis, null, 2));
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
