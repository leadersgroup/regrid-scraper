/**
 * Debug script to inspect the export page after clicking image icon
 */

const MecklenburgScraper = require('./county-implementations/mecklenburg-county-north-carolina.js');

async function debug() {
  const scraper = new MecklenburgScraper({ headless: false });

  try {
    await scraper.createBrowser();

    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log('🔍 Searching for property...');
    await scraper.searchProperty(address);

    console.log('📄 Getting deed info...');
    await scraper.getDeedInfo();

    console.log('\n🖼️ Clicking image icon...');

    // Setup new page listener
    const newPagePromise = new Promise(resolve =>
      scraper.browser.once('targetcreated', target => resolve(target))
    );

    // Click image icon
    const clicked = await scraper.page.evaluate(() => {
      const tableCells = Array.from(document.querySelectorAll('td, th'));
      for (const cell of tableCells) {
        if (cell.textContent.trim() === 'Image:') {
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

    if (clicked) {
      console.log('✅ Clicked image icon');

      // Wait for export page
      const exportTarget = await newPagePromise;
      const exportPage = await exportTarget.page();

      console.log(`✅ Export page opened: ${exportPage.url()}`);

      // Switch to export page
      scraper.page = exportPage;
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Click "Keep Working" if it appears
      const keepWorking = await scraper.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button'));
        for (const el of allElements) {
          if (el.textContent.toLowerCase().trim() === 'keep working') {
            el.click();
            return true;
          }
        }
        return false;
      });

      if (keepWorking) {
        console.log('✅ Clicked "Keep Working"');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Inspect the page content
      console.log('\n📋 Inspecting export page content...');
      const pageContent = await scraper.page.evaluate(() => {
        // Get all buttons
        const buttons = Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"]')).map(el => ({
          tag: el.tagName,
          text: (el.textContent || el.value || '').trim(),
          id: el.id,
          name: el.name
        }));

        // Get page text
        const bodyText = document.body.innerText;

        // Check for forms
        const forms = Array.from(document.querySelectorAll('form')).map(f => ({
          action: f.action,
          method: f.method,
          inputs: Array.from(f.querySelectorAll('input, select')).map(i => ({
            type: i.type,
            name: i.name,
            value: i.value
          }))
        }));

        return {
          buttons,
          bodyText: bodyText.substring(0, 1000),
          forms
        };
      });

      console.log('\n📊 Export Page Analysis:');
      console.log(JSON.stringify(pageContent, null, 2));

      console.log('\n⏸️  Pausing for 60 seconds so you can inspect...');
      await new Promise(resolve => setTimeout(resolve, 60000));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

debug();
