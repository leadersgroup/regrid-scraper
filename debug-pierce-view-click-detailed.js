/**
 * Debug what happens when clicking the View cell - detailed version
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugViewClick() {
  const parcelId = '2158020070';
  console.log(`🔍 Debugging View cell click for parcel: ${parcelId}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Set up listener for new targets/pages
    browser.on('targetcreated', async (target) => {
      console.log(`\n[EVENT] New target created:`);
      console.log(`  Type: ${target.type()}`);
      console.log(`  URL: ${target.url()}`);

      if (target.type() === 'page') {
        const newPage = await target.page();
        if (newPage) {
          console.log(`  New page object created`);

          newPage.on('load', () => {
            console.log(`  [PAGE LOADED] ${newPage.url()}`);
          });
        }
      }
    });

    // Navigate and search
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click disclaimer
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.toLowerCase().includes('click here to acknowledge')) {
          link.click();
          return;
        }
      }
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter parcel and search
    const input = await page.$('#cphNoMargin_f_Datatextedit28p');
    await input.click({ clickCount: 3 });
    await input.type(parcelId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log('✅ Search completed\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for table to load
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 });

    console.log('✅ Table loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find and examine the View cell
    const cellInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 100) continue;

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();

          if (cellText === 'View') {
            // Examine the cell structure
            const innerHTML = cell.innerHTML;
            const hasLink = cell.querySelector('a') !== null;
            const hasDiv = cell.querySelector('div') !== null;
            const hasOnclick = cell.hasAttribute('onclick') || cell.querySelector('[onclick]') !== null;

            // Get onclick if it exists
            let onclickAttr = cell.getAttribute('onclick');
            if (!onclickAttr && cell.querySelector('[onclick]')) {
              onclickAttr = cell.querySelector('[onclick]').getAttribute('onclick');
            }

            return {
              found: true,
              cellIndex: i,
              rowIndex: rows.indexOf(row),
              innerHTML: innerHTML.substring(0, 500),
              hasLink,
              hasDiv,
              hasOnclick,
              onclickAttr
            };
          }
        }
      }

      return { found: false };
    });

    if (!cellInfo.found) {
      console.log('❌ View cell not found');
      return;
    }

    console.log('📋 View cell info:');
    console.log('  Cell Index:', cellInfo.cellIndex);
    console.log('  Row Index:', cellInfo.rowIndex);
    console.log('  Has Link:', cellInfo.hasLink);
    console.log('  Has Div:', cellInfo.hasDiv);
    console.log('  Has Onclick:', cellInfo.hasOnclick);
    console.log('  Onclick Attr:', cellInfo.onclickAttr);
    console.log('  InnerHTML:', cellInfo.innerHTML);
    console.log('');

    // Count current pages before click
    const pagesBefore = (await browser.pages()).length;
    console.log(`Pages before click: ${pagesBefore}\n`);

    // Try clicking with different strategies
    console.log('🖱️  Clicking View cell...');

    await page.evaluate((rowIdx, cellIdx) => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const row = rows[rowIdx];
      const cells = Array.from(row.querySelectorAll('td'));
      const cell = cells[cellIdx];

      console.log('Clicking cell:', cell);
      cell.click();
    }, cellInfo.rowIndex, cellInfo.cellIndex);

    console.log('✅ Click executed, waiting 10 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check pages after click
    const pagesAfter = await browser.pages();
    console.log(`\nPages after click: ${pagesAfter.length}`);

    for (let i = 0; i < pagesAfter.length; i++) {
      console.log(`  Page ${i}: ${pagesAfter[i].url()}`);
    }

    console.log('\n✅ Debug complete - browser will stay open for inspection');
    await new Promise(resolve => setTimeout(resolve, 60000)); // Keep open for 1 minute

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

debugViewClick();
