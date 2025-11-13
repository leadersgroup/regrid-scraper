/**
 * Debug: Find what text is in cells that might be "View" links
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugViewCells() {
  const parcelId = '2158020070';
  console.log(`🔍 Debugging View cell detection for parcel: ${parcelId}\n`);

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

    console.log('✅ At results page\n');

    // Scroll and wait
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 });

    console.log('✅ Table loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Look at ALL cells in rows with 100+ cells that contain "view" (case insensitive)
    const viewCells = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const results = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 100) continue;

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const text = cell.textContent.trim();

          // Look for anything with "view" in it
          if (text.toLowerCase().includes('view')) {
            const links = Array.from(cell.querySelectorAll('a'));
            const linksInfo = links.map(l => ({
              text: l.textContent.trim().substring(0, 30),
              href: l.href.substring(0, 80)
            }));

            results.push({
              cellIndex: i,
              text: text.substring(0, 50),
              textLength: text.length,
              hasLinks: links.length > 0,
              linkCount: links.length,
              links: linksInfo,
              innerHTML: cell.innerHTML.substring(0, 200)
            });
          }
        }
      }

      return results;
    });

    console.log(`Found ${viewCells.length} cells containing "view":\n`);
    viewCells.forEach((cell, i) => {
      console.log(`${i + 1}. Cell ${cell.cellIndex}:`);
      console.log(`   Text: "${cell.text}" (length: ${cell.textLength})`);
      console.log(`   Has Links: ${cell.hasLinks} (count: ${cell.linkCount})`);
      if (cell.links.length > 0) {
        cell.links.forEach((link, j) => {
          console.log(`   Link ${j + 1}: "${link.text}" → ${link.href}`);
        });
      }
      console.log(`   HTML: ${cell.innerHTML}`);
      console.log('');
    });

    console.log('\n⏸️  Browser staying open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

debugViewCells();
