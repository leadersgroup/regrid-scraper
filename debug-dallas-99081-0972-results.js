const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugResults() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate directly to the search results URL with volume/page params
    const url = 'https://dallas.tx.publicsearch.us/results?department=RP&page=0972&recordedDateRange=18000101%2C20251106&searchType=advancedSearch&volume=99081';
    console.log('Navigating to search results...');
    console.log(url);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze results
    const results = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));

      return {
        url: window.location.href,
        rowCount: rows.length,
        rows: rows.map((row, idx) => {
          const cells = Array.from(row.querySelectorAll('td'));
          return {
            index: idx,
            cellCount: cells.length,
            cells: cells.map(cell => cell.textContent.trim().substring(0, 150)),
            fullText: row.textContent.trim().substring(0, 400),
            onClick: !!row.onclick,
            clickable: row.style.cursor === 'pointer' || !!row.onclick
          };
        })
      };
    });

    console.log('\n=== Search Results ===');
    console.log('URL:', results.url);
    console.log('Total rows found:', results.rowCount);

    if (results.rowCount === 0) {
      console.log('\n❌ NO RESULTS FOUND for volume 99081, page 0972');
      console.log('This volume/page combination may not exist in the database.');
    } else {
      console.log(`\n✅ Found ${results.rowCount} result(s):\n`);
      results.rows.forEach((row, idx) => {
        console.log(`Row ${idx + 1}:`);
        console.log(`  Cells: ${row.cellCount}`);
        console.log(`  Clickable: ${row.clickable}`);
        console.log(`  Full text: ${row.fullText}`);
        console.log(`  Cell values:`, row.cells);
        console.log('');
      });
    }

    await page.screenshot({ path: '/tmp/dallas-99081-0972-results.png', fullPage: true });
    console.log('Screenshot saved: /tmp/dallas-99081-0972-results.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugResults().catch(console.error);
