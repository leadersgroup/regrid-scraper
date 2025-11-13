/**
 * Debug: Check the actual structure of "View" cells
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugViewStructure() {
  const parcelId = '2158020070';
  console.log(`🔍 Checking structure of "View" cells for parcel: ${parcelId}\n`);

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
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait extra time

    // Scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Look at ALL cells that contain "View" (case-insensitive, no link requirement)
    const viewCells = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const results = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const text = cell.textContent.trim();

          // Look for cells with text "View" (case-insensitive)
          if (text.toLowerCase() === 'view') {
            // Check for links
            const links = Array.from(cell.querySelectorAll('a'));
            const hasLink = links.length > 0;

            // Look ahead to see what's nearby
            const nearby = [];
            for (let j = i; j < Math.min(i + 20, cells.length); j++) {
              const cellText = cells[j].textContent.trim();
              if (cellText) {
                nearby.push({
                  offset: j - i,
                  text: cellText.substring(0, 50)
                });
              }
            }

            results.push({
              rowCellCount: cells.length,
              cellIndex: i,
              exactText: `"${text}"`,
              hasLink: hasLink,
              linkCount: links.length,
              innerHTML: cell.innerHTML.substring(0, 300),
              nearby: nearby.slice(0, 10)
            });
          }
        }
      }

      return results;
    });

    console.log(`Found ${viewCells.length} cells with text "View":\n`);

    viewCells.forEach((cell, i) => {
      console.log(`${i + 1}. Row has ${cell.rowCellCount} cells, "View" at cell ${cell.cellIndex}:`);
      console.log(`   Exact text: ${cell.exactText}`);
      console.log(`   Has <a> link: ${cell.hasLink} (count: ${cell.linkCount})`);
      console.log(`   HTML: ${cell.innerHTML}`);
      console.log(`   Nearby cells:`);
      cell.nearby.forEach(n => {
        console.log(`     +${n.offset}: "${n.text}"`);
      });
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

debugViewStructure();
