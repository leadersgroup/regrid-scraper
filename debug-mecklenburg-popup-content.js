/**
 * Debug the popup content thoroughly
 */

const Meck

lenburgScraper = require('./county-implementations/mecklenburg-county-north-carolina.js');

async function debug() {
  const scraper = new MecklenburgScraper({ headless: false });

  try {
    await scraper.createBrowser();

    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log('🔍 Searching...');
    await scraper.searchProperty(address);

    console.log('📄 Getting deed info...');
    await scraper.getDeedInfo();

    console.log('\n🖼️ Clicking image icon...');

    // Setup listener
    const newPagePromise = new Promise(resolve =>
      scraper.browser.once('targetcreated', target => resolve(target))
    );

    // Click image icon
    await scraper.page.evaluate(() => {
      const tableCells = Array.from(document.querySelectorAll('td, th'));
      for (const cell of tableCells) {
        if (cell.textContent.trim() === 'Image:') {
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

    const popupPage = await exportTarget.page() || (await scraper.browser.pages()).pop();

    console.log(`✅ Popup opened: ${popupPage.url()}`);
    scraper.page = popupPage;

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Thoroughly inspect the page
    const pageInfo = await scraper.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        allButtons: Array.from(document.querySelectorAll('a, button, input')).map(el => ({
          tag: el.tagName,
          type: el.type,
          text: el.textContent?.trim() || el.value,
          id: el.id,
          name: el.name,
          className: el.className
        })),
        iframes: Array.from(document.querySelectorAll('iframe')).length,
        forms: Array.from(document.querySelectorAll('form')).length
      };
    });

    console.log('\n📊 Popup Page Info:');
    console.log(JSON.stringify(pageInfo, null, 2));

    console.log('\n⏸️  Pausing for 60 seconds - please inspect the page manually...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

debug();
