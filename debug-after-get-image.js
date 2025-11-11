/**
 * Debug script to see what happens after clicking "Get Image Now"
 */

const MecklenburgScraper = require('./county-implementations/mecklenburg-county-north-carolina.js');

async function debug() {
  const scraper = new MecklenburgScraper({ headless: false });

  try {
    await scraper.createBrowser();

    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log('🔍 Searching...');
    await scraper.searchProperty(address);

    console.log('📄 Getting deed info...');
    await scraper.getDeedInfo();

    console.log('🖼️ Clicking image icon...');

    const newPagePromise = new Promise(resolve =>
      scraper.browser.once('targetcreated', target => resolve(target))
    );

    await scraper.page.evaluate(() => {
      const tableCells = Array.from(document.querySelectorAll('td, th'));
      for (const cell of tableCells) {
        if (cell.textContent.trim() === 'Image:' || cell.textContent.trim().startsWith('Image:')) {
          const nextCell = cell.nextElementSibling;
          if (nextCell) {
            const link = nextCell.querySelector('a');
            if (link) {
              link.click();
              return;
            }
          }
        }
      }
    });

    const exportTarget = await newPagePromise;
    await new Promise(resolve => setTimeout(resolve, 2000));

    let popupPage = await exportTarget.page();
    if (!popupPage) {
      const pages = await scraper.browser.pages();
      popupPage = pages[pages.length - 1];
    }

    console.log(`✅ Popup opened: ${popupPage.url()}`);
    scraper.page = popupPage;

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click Keep Working if needed
    const keepWorking = await scraper.page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));
      for (const el of allElements) {
        if ((el.textContent || '').toLowerCase().trim() === 'keep working') {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (keepWorking) {
      console.log('✅ Clicked "Keep Working"');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Find iframe and click Get Image Now
    const frames = scraper.page.frames();
    let ltViewerFrame = null;
    for (const frame of frames) {
      if (frame.url().includes('LTViewer')) {
        ltViewerFrame = frame;
        console.log(`✅ Found LTViewer iframe: ${frame.url()}`);
        break;
      }
    }

    if (!ltViewerFrame) {
      console.error('❌ Could not find LTViewer iframe');
      return;
    }

    console.log('🖱️ Clicking "Get Image Now" button...');
    await ltViewerFrame.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));
      for (const el of allElements) {
        const text = (el.textContent || el.value || '').toLowerCase().trim();
        if (text.includes('get image now') || el.id === 'btnProcessNow') {
          el.click();
          return true;
        }
      }
      return false;
    });

    console.log('✅ Clicked "Get Image Now"');
    console.log('\n⏸️ Waiting 10 seconds to see what happens...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check all frames for PDF content
    console.log('\n📊 Checking all frames for PDF content:\n');
    const allFrames = scraper.page.frames();
    console.log(`Total frames: ${allFrames.length}`);

    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      console.log(`\n[Frame ${i}]`);
      console.log(`  URL: ${frame.url()}`);
      console.log(`  Name: ${frame.name() || '(no name)'}`);

      // Check if it's a PDF
      if (frame.url().includes('.pdf') || frame.url().includes('pdf')) {
        console.log(`  🎯 THIS FRAME CONTAINS PDF!`);
      }

      try {
        const frameInfo = await frame.evaluate(() => {
          // Check for PDF embed/object
          const objects = Array.from(document.querySelectorAll('object, embed'));
          const objectInfo = objects.map(obj => ({
            tag: obj.tagName,
            src: obj.src || obj.data,
            type: obj.type
          }));

          // Check for PDF in body
          const bodyText = document.body.innerText.substring(0, 200);
          const isPdfContent = bodyText.startsWith('%PDF');

          return { objectInfo, bodyText, isPdfContent };
        });

        if (frameInfo.isPdfContent) {
          console.log(`  🎯 THIS FRAME HAS PDF CONTENT IN BODY!`);
        }

        if (frameInfo.objectInfo.length > 0) {
          console.log(`  Found ${frameInfo.objectInfo.length} objects/embeds:`);
          frameInfo.objectInfo.forEach((obj, j) => {
            console.log(`    [${j}] ${obj.tag}: ${obj.src || '(no src)'}`);
          });
        }
      } catch (error) {
        console.log(`  (Could not access frame content: ${error.message})`);
      }
    }

    console.log('\n⏸️ Pausing for 60 seconds - inspect the browser manually...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

debug();
