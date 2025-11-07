const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Inspecting Table HTML After Login\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Go to results page
    console.log('Loading results page...');
    await page.goto('https://tarrant.tx.publicsearch.us/results?department=RP&documentNumberRange=%5B%22D225045226%22%5D&searchType=advancedSearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we need to login
    const needsLogin = await page.evaluate(() => {
      return document.body.innerText.toLowerCase().includes('sign in');
    });

    if (needsLogin) {
      console.log('Logging in...');
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent.trim().toLowerCase() === 'sign in') {
            link.click();
            return;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      await page.type('input[type="email"], input[name*="email"], input[name*="username"]', 'ericatl828@gmail.com', { delay: 50 });
      await page.type('input[type="password"]', 'Cdma2000@1', { delay: 50 });

      await new Promise(resolve => setTimeout(resolve, 1000));

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('login') || text.includes('sign in')) {
            btn.click();
            return;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 7000));
      console.log('✅ Logged in\n');
    }

    console.log('Extracting full table HTML...\n');
    const tableHtml = await page.evaluate(() => {
      // Find the table or container with the deed row
      const tables = document.querySelectorAll('table, [role="table"], tbody, .results-table, .results-container');

      for (const table of tables) {
        if (table.textContent.includes('D225045226')) {
          return table.outerHTML;
        }
      }

      // If not in a table, look for the row directly
      const rows = document.querySelectorAll('tr, [role="row"], div[class*="row"]');
      for (const row of rows) {
        if (row.textContent.includes('D225045226')) {
          return row.outerHTML;
        }
      }

      return 'Not found';
    });

    console.log('=== FULL HTML ===');
    console.log(tableHtml);
    console.log('\n=== END HTML ===\n');

    // Also check if there's any JavaScript that handles row clicks
    const jsInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr, [role="row"]');
      const info = [];

      for (const row of rows) {
        if (row.textContent.includes('D225045226')) {
          info.push({
            hasOnClick: !!row.onclick,
            onClickStr: row.onclick ? row.onclick.toString() : null,
            hasDataAttrs: Object.keys(row.dataset).length > 0,
            dataAttrs: { ...row.dataset },
            classList: Array.from(row.classList),
            role: row.getAttribute('role'),
            allAttrs: Array.from(row.attributes).map(attr => ({
              name: attr.name,
              value: attr.value
            }))
          });
        }
      }

      return info;
    });

    console.log('Row JavaScript/Attributes:');
    console.log(JSON.stringify(jsInfo, null, 2));

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
