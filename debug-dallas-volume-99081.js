const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugVolume99081() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Dallas County Clerk...');
    await page.goto('https://dallas.tx.publicsearch.us/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Close popup
    try {
      const closeButton = await page.$('button[aria-label="Close"]');
      if (closeButton) {
        console.log('Closing popup...');
        await closeButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log('No popup to close');
    }

    // Click advanced search
    console.log('\n=== Clicking Advanced Search ===');
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const advLink = links.find(link => {
        const text = link.textContent.toLowerCase();
        return text.includes('advanced') && text.includes('search');
      });
      if (advLink) {
        advLink.click();
        return true;
      }
      return false;
    });

    if (!clicked) {
      console.log('❌ Could not find advanced search link');
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fill volume and page
    console.log('\n=== Filling volume 99081 and page 0972 ===');
    const filled = await page.evaluate((volume, page) => {
      let volumeInput = document.querySelector('#volume');
      let pageInput = document.querySelector('#page');

      if (volumeInput) {
        volumeInput.value = volume;
        volumeInput.dispatchEvent(new Event('input', { bubbles: true }));
        volumeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (pageInput) {
        pageInput.value = page;
        pageInput.dispatchEvent(new Event('input', { bubbles: true }));
        pageInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return {
        volumeFilled: !!volumeInput,
        pageFilled: !!pageInput
      };
    }, '99081', '0972');

    console.log('Fields filled:', JSON.stringify(filled, null, 2));

    // Click search button
    console.log('\n=== Clicking search button ===');
    const searchClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const searchBtn = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('search') && !text.includes('clear') && !text.includes('advanced');
      });
      if (searchBtn) {
        searchBtn.click();
        return true;
      }
      return false;
    });

    console.log('Search button clicked:', searchClicked);

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze results in detail
    const results = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));

      return {
        url: window.location.href,
        rowCount: rows.length,
        rows: rows.slice(0, 10).map(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          return {
            cellCount: cells.length,
            cells: cells.map(cell => cell.textContent.trim().substring(0, 100)),
            fullText: row.textContent.trim().substring(0, 300),
            onClick: !!row.onclick,
            clickable: row.style.cursor === 'pointer' || !!row.onclick
          };
        })
      };
    });

    console.log('\n=== Search Results ===');
    console.log('URL:', results.url);
    console.log('Total rows found:', results.rowCount);
    console.log('\nFirst 10 rows:');
    results.rows.forEach((row, idx) => {
      console.log(`\nRow ${idx + 1}:`);
      console.log(`  Cells: ${row.cellCount}`);
      console.log(`  Clickable: ${row.clickable}`);
      console.log(`  Full text: ${row.fullText}`);
      console.log(`  Cell values:`, row.cells);
    });

    await page.screenshot({ path: '/tmp/dallas-volume-99081-results.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/dallas-volume-99081-results.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugVolume99081().catch(console.error);
