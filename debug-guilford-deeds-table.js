/**
 * Debug Guilford County Deeds table structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugDeedsTable() {
  console.log('🔍 Debugging Guilford County Deeds table...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate
    console.log('Step 1: Navigate...');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Location Address tab
    console.log('Step 2: Click Location Address tab...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      for (const link of links) {
        if (link.textContent.trim().includes('Location Address')) {
          link.click();
          return true;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill address
    console.log('Step 3: Fill address (1205 Glendale)...');
    await page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', { visible: true });
    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', '1205');
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', 'Glendale');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit search
    console.log('Step 4: Submit search...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click parcel 60312
    console.log('Step 5: Click parcel 60312...');
    const parcelLink = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        if (link.textContent.trim() === '60312') {
          return link.href;
        }
      }
    });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate((href) => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
        if (link) link.click();
      }, parcelLink)
    ]);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Deeds tab
    console.log('Step 6: Click Deeds tab...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"]'));
      for (const el of allElements) {
        const text = el.textContent.trim().toLowerCase();
        if (text === 'deeds') {
          el.click();
          return true;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: 'guilford-deeds-table.png', fullPage: true });
    console.log('📸 Screenshot: guilford-deeds-table.png\n');

    // Analyze Deeds table structure
    console.log('Step 7: Analyzing Deeds table structure...\n');
    const tableAnalysis = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));

      const tableInfo = tables.map((table, tableIdx) => {
        const rows = Array.from(table.querySelectorAll('tr'));

        // Get headers
        const headerRow = rows.find(row => row.querySelectorAll('th').length > 0);
        const headers = headerRow ? Array.from(headerRow.querySelectorAll('th')).map(th => th.textContent.trim()) : [];

        // Find Deed Type column index
        let deedTypeColumnIndex = -1;
        headers.forEach((header, idx) => {
          if (header.toLowerCase().includes('deed') && header.toLowerCase().includes('type')) {
            deedTypeColumnIndex = idx;
          }
        });

        // Get first 5 data rows
        const dataRows = rows
          .filter(row => row.querySelectorAll('td').length > 0)
          .slice(0, 5)
          .map((row, rowIdx) => {
            const cells = Array.from(row.querySelectorAll('td'));
            return {
              rowIndex: rowIdx,
              cells: cells.map((cell, cellIdx) => {
                const link = cell.querySelector('a');
                return {
                  columnIndex: cellIdx,
                  text: cell.textContent.trim(),
                  hasLink: link !== null,
                  linkText: link ? link.textContent.trim() : null,
                  linkHref: link ? link.href : null
                };
              })
            };
          });

        return {
          tableIndex: tableIdx,
          headers,
          deedTypeColumnIndex,
          rowCount: rows.length,
          dataRows
        };
      });

      return {
        currentUrl: window.location.href,
        tableCount: tables.length,
        tables: tableInfo
      };
    });

    console.log('=== DEEDS TABLE ANALYSIS ===');
    console.log('Current URL:', tableAnalysis.currentUrl);
    console.log('\nTable Count:', tableAnalysis.tableCount);
    console.log('\nDetailed Table Info:');
    console.log(JSON.stringify(tableAnalysis.tables, null, 2));

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('guilford-deeds-table.html', html);
    console.log('\n✅ Saved: guilford-deeds-table.html');

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-deeds-table-error.png' });
  }
}

debugDeedsTable().catch(console.error);
