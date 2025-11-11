/**
 * Manual inspection debug script
 * Opens browser and pauses at each step so you can see what's happening
 */

const MecklenburgScraper = require('./county-implementations/mecklenburg-county-north-carolina.js');

async function debug() {
  const scraper = new MecklenburgScraper({ headless: false });

  try {
    await scraper.createBrowser();

    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log('🔍 Step 1: Searching for property...');
    await scraper.searchProperty(address);
    console.log('✅ Search complete. Press Ctrl+C when ready to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('📄 Step 2: Getting deed info...');
    await scraper.getDeedInfo();
    console.log('✅ Deed info retrieved. Press Ctrl+C when ready to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('🖼️ Step 3: Setting up popup listener...');
    const newPagePromise = new Promise(resolve =>
      scraper.browser.once('targetcreated', target => resolve(target))
    );

    console.log('🖱️ Step 4: Clicking image icon...');
    const clicked = await scraper.page.evaluate(() => {
      const tableCells = Array.from(document.querySelectorAll('td, th'));
      for (const cell of tableCells) {
        const text = cell.textContent.trim();
        if (text === 'Image:' || text.startsWith('Image:')) {
          const nextCell = cell.nextElementSibling;
          if (nextCell) {
            const link = nextCell.querySelector('a');
            if (link) {
              link.click();
              return true;
            }
          }
        }
      }
      return false;
    });

    if (!clicked) {
      console.error('❌ Could not find image icon to click');
      return;
    }

    console.log('✅ Clicked image icon');

    console.log('⏳ Step 5: Waiting for popup window...');
    const exportTarget = await Promise.race([
      newPagePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Popup timeout')), 15000)
      )
    ]);

    let popupPage = await exportTarget.page();
    if (!popupPage) {
      const pages = await scraper.browser.pages();
      popupPage = pages[pages.length - 1];
    }

    console.log(`✅ Popup opened: ${popupPage.url()}`);
    scraper.page = popupPage;

    console.log('\n⏸️ PAUSING - Popup is now open. Manually inspect the page.');
    console.log('   Look for:');
    console.log('   - Is there a "Keep Working" button?');
    console.log('   - Is there a "Get image now" or "Get item(s) now" button?');
    console.log('   - Are there any iframes?');
    console.log('   - What does the page actually show?');
    console.log('\n   Browser will stay open for 2 minutes...\n');

    await new Promise(resolve => setTimeout(resolve, 120000));

    console.log('\n🔍 Step 6: Looking for "Keep Working" button...');
    const keepWorkingFound = await scraper.page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));
      for (const el of allElements) {
        const text = (el.textContent || '').toLowerCase().trim();
        if (text === 'keep working') {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (keepWorkingFound) {
      console.log('✅ Clicked "Keep Working"');
      console.log('\n⏸️ PAUSING AGAIN - Just clicked "Keep Working"');
      console.log('   Now check what changed:');
      console.log('   - Did the page content change?');
      console.log('   - Did any new elements appear?');
      console.log('   - Is there now a "Get image now" button?');
      console.log('\n   Browser will stay open for 2 minutes...\n');

      await new Promise(resolve => setTimeout(resolve, 120000));
    } else {
      console.log('ℹ️ No "Keep Working" button found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n🛑 Closing browser...');
    await scraper.close();
  }
}

debug();
