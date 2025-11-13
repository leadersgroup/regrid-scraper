/**
 * Debug: Examine the exact structure of the View cell
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugViewCellStructure() {
  const parcelId = '2158020070';
  console.log(`🔍 Examining View cell structure for parcel: ${parcelId}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
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

    // Wait for table
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 });

    console.log('✅ Table loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Examine the View cell structure
    const viewCellInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 100) continue;

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();

          if (cellText === 'View') {
            // Examine the cell structure in detail
            return {
              found: true,
              cellIndex: i,
              innerHTML: cell.innerHTML,
              outerHTML: cell.outerHTML.substring(0, 1000),
              hasDiv: cell.querySelector('div') !== null,
              hasImg: cell.querySelector('img') !== null,
              hasLink: cell.querySelector('a') !== null,
              hasOnclick: cell.hasAttribute('onclick'),
              onclick: cell.getAttribute('onclick'),
              divCount: cell.querySelectorAll('div').length,
              imgCount: cell.querySelectorAll('img').length,
              linkCount: cell.querySelectorAll('a').length,
              // Get attributes of first div
              divInfo: cell.querySelector('div') ? {
                id: cell.querySelector('div').id,
                className: cell.querySelector('div').className,
                onclick: cell.querySelector('div').getAttribute('onclick'),
                innerHTML: cell.querySelector('div').innerHTML.substring(0, 500)
              } : null
            };
          }
        }
      }

      return { found: false };
    });

    if (!viewCellInfo.found) {
      console.log('❌ View cell not found');
      return;
    }

    console.log('📋 View cell structure:');
    console.log('  Cell Index:', viewCellInfo.cellIndex);
    console.log('  Has Div:', viewCellInfo.hasDiv);
    console.log('  Has Img:', viewCellInfo.hasImg);
    console.log('  Has Link:', viewCellInfo.hasLink);
    console.log('  Has Onclick:', viewCellInfo.hasOnclick);
    console.log('  Onclick Attr:', viewCellInfo.onclick);
    console.log('  Div Count:', viewCellInfo.divCount);
    console.log('  Img Count:', viewCellInfo.imgCount);
    console.log('  Link Count:', viewCellInfo.linkCount);
    console.log('\n📦 Div Info:');
    console.log(viewCellInfo.divInfo);
    console.log('\n📝 HTML:');
    console.log(viewCellInfo.innerHTML);
    console.log('\n✅ Debug complete - browser will stay open for 30 seconds');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugViewCellStructure();
