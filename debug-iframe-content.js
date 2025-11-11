/**
 * Debug script to inspect the iframe content
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

    console.log('\n🔍 Looking for iframe...');

    const frames = scraper.page.frames();
    console.log(`Found ${frames.length} frames total`);

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      console.log(`\nFrame ${i}:`);
      console.log(`  URL: ${frame.url()}`);
      console.log(`  Name: ${frame.name() || '(no name)'}`);

      if (frame.url().includes('LTViewer')) {
        console.log('\n  📦 This is the LTViewer iframe! Inspecting content...\n');

        try {
          const iframeContent = await frame.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]'));

            return {
              bodyText: document.body.innerText.substring(0, 500),
              buttons: buttons.map((el, index) => ({
                index,
                tag: el.tagName,
                text: (el.textContent || el.value || '').trim(),
                id: el.id,
                name: el.name,
                className: el.className,
                value: el.value
              })),
              totalButtons: buttons.length
            };
          });

          console.log(`  Total buttons in iframe: ${iframeContent.totalButtons}`);
          console.log('\n  Body text:');
          console.log(`  ${iframeContent.bodyText}`);
          console.log('\n  Buttons:');
          iframeContent.buttons.forEach(btn => {
            console.log(`    [${btn.index}] ${btn.tag}: "${btn.text}"`);
            console.log(`        ID: ${btn.id || 'none'}, Class: ${btn.className || 'none'}`);
          });

        } catch (error) {
          console.log(`  ❌ Error accessing iframe content: ${error.message}`);
        }
      }
    }

    console.log('\n⏸️ Pausing for 60 seconds - inspect the page manually...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

debug();
