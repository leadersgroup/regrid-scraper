/**
 * Debug Mecklenburg - test calling navigation functions directly
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

    // Set up request capture
    rodPage.on('request', (request) => {
      const url = request.url();
      if (url.includes('generator.leadgen')) {
        const pnMatch = url.match(/PN=(\d+)/);
        if (pnMatch) {
          imageRequests.push({ url, page: parseInt(pnMatch[1]) });
          console.log(`  📸 Captured request for page ${pnMatch[1]}`);
        }
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
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);
    console.log(`📊 Captured ${imageRequests.filter(r => r.page === 1).length} requests for page 1`);

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

    // Try calling selectPageClick function with page 2
    console.log('\n🔄 Attempting to navigate to page 2...');

    const page2Result = await viewerFrame.evaluate(() => {
      // Check if function exists
      if (typeof selectPageClick === 'function') {
        console.log('Found selectPageClick function');
        try {
          // Try calling with page index 1 (0-based, so page 2)
          selectPageClick(1);
          return { success: true, method: 'selectPageClick(1)' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      // Try alternative approaches
      if (typeof thumbSelectClick === 'function') {
        try {
          thumbSelectClick(1);
          return { success: true, method: 'thumbSelectClick(1)' };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      // Try finding and clicking thumbnail directly
      const thumbs = document.querySelectorAll('[id^="WTV1_tsi"]');
      if (thumbs.length > 1) {
        thumbs[1].click();
        return { success: true, method: 'clicked thumbnail element' };
      }

      return { success: false, error: 'No navigation method found' };
    }).catch(err => ({ success: false, error: err.message }));

    console.log(`  Result: ${JSON.stringify(page2Result)}`);

    if (page2Result.success) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`  📊 After navigation: ${imageRequests.filter(r => r.page === 2).length} requests for page 2`);

      // Try page 3
      console.log('\n🔄 Attempting to navigate to page 3...');

      const page3Result = await viewerFrame.evaluate(() => {
        if (typeof selectPageClick === 'function') {
          try {
            selectPageClick(2);
            return { success: true, method: 'selectPageClick(2)' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }

        const thumbs = document.querySelectorAll('[id^="WTV1_tsi"]');
        if (thumbs.length > 2) {
          thumbs[2].click();
          return { success: true, method: 'clicked thumbnail element' };
        }

        return { success: false, error: 'No navigation method found' };
      }).catch(err => ({ success: false, error: err.message }));

      console.log(`  Result: ${JSON.stringify(page3Result)}`);

      if (page3Result.success) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log(`  📊 After navigation: ${imageRequests.filter(r => r.page === 3).length} requests for page 3`);
      }
    }

    // Summary
    console.log('\n=== SUMMARY ===');
    for (let p = 1; p <= 3; p++) {
      const count = imageRequests.filter(r => r.page === p).length;
      console.log(`Page ${p}: ${count} requests`);
    }

    console.log('\n⏳ Waiting 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
