const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugInstrumentSearch() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track image requests
  const imageUrls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/files/documents/') && url.includes('/images/') && url.endsWith('.png')) {
      imageUrls.push(url);
      console.log(`📷 Found image: ${url}`);
    }
  });

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

    // Type instrument number in quick search
    console.log('\n=== Typing instrument number: 202500009427 ===');
    const searchInput = await page.$('input[placeholder*="grantor"]') ||
                        await page.$('input[placeholder*="doc"]') ||
                        await page.$('input[type="text"]');

    if (!searchInput) {
      console.log('❌ Search input not found');
      return;
    }

    await searchInput.click({ clickCount: 3 });
    await new Promise(resolve => setTimeout(resolve, 300));
    await searchInput.type('202500009427');
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✓ Typed instrument number, pressing Enter...');
    await page.keyboard.press('Enter');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze results
    console.log('\n=== Analyzing Results ===');
    const results = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return {
        url: window.location.href,
        rowCount: rows.length,
        rows: rows.map((row, idx) => {
          const cells = Array.from(row.querySelectorAll('td'));
          const links = Array.from(row.querySelectorAll('a'));
          return {
            index: idx,
            cellCount: cells.length,
            linkCount: links.length,
            linkTexts: links.map(l => l.textContent.trim().substring(0, 100)),
            linkHrefs: links.map(l => l.href),
            fullText: row.textContent.trim().substring(0, 400)
          };
        })
      };
    });

    console.log(JSON.stringify(results, null, 2));

    if (results.rowCount === 0) {
      console.log('\n❌ NO RESULTS FOUND');
      await page.screenshot({ path: '/tmp/dallas-instrument-no-results.png', fullPage: true });
      return;
    }

    console.log(`\n=== Found ${results.rowCount} result(s) ===`);
    console.log('First row links:', results.rows[0].linkTexts);
    console.log('First row hrefs:', results.rows[0].linkHrefs);

    // Try clicking the first link in the first row
    console.log('\n=== Clicking first link in first row ===');
    const clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length === 0) return { success: false, reason: 'No rows' };

      const firstRow = rows[0];
      const firstLink = firstRow.querySelector('a');

      if (firstLink) {
        const linkText = firstLink.textContent;
        const linkHref = firstLink.href;
        firstLink.click();
        return { success: true, linkText, linkHref };
      }

      // Fallback: click the row
      firstRow.click();
      return { success: true, clickedRow: true };
    });

    console.log('Click result:', JSON.stringify(clicked, null, 2));

    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== Images found so far:', imageUrls.length);
    imageUrls.forEach((url, idx) => {
      console.log(`${idx + 1}. ${url}`);
    });

    // Check for document viewer
    const viewerInfo = await page.evaluate(() => {
      const selectors = [
        '.css-1wvt4ep',
        '[class*="document"]',
        '[class*="viewer"]',
        '[class*="preview"]',
        'iframe',
        'canvas'
      ];

      const found = [];
      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          found.push({
            selector,
            count: elements.length,
            visible: elements.filter(el => el.offsetParent !== null).length
          });
        }
      }

      return {
        found,
        url: window.location.href
      };
    });

    console.log('\n=== Viewer Info ===');
    console.log(JSON.stringify(viewerInfo, null, 2));

    await page.screenshot({ path: '/tmp/dallas-instrument-after-click.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/dallas-instrument-after-click.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugInstrumentSearch().catch(console.error);
