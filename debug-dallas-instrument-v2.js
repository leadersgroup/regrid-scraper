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

    // Analyze ALL clickable elements in the row
    console.log('\n=== Analyzing ALL elements in first row ===');
    const rowAnalysis = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length === 0) return { error: 'No rows found' };

      const firstRow = rows[0];
      const cells = Array.from(firstRow.querySelectorAll('td'));

      return {
        rowHTML: firstRow.innerHTML.substring(0, 1000),
        cells: cells.map((cell, idx) => ({
          index: idx,
          text: cell.textContent.trim().substring(0, 100),
          innerHTML: cell.innerHTML.substring(0, 300),
          hasButton: !!cell.querySelector('button'),
          hasLink: !!cell.querySelector('a'),
          hasSpan: !!cell.querySelector('span')
        }))
      };
    });

    console.log(JSON.stringify(rowAnalysis, null, 2));

    // Try different click strategies
    console.log('\n=== Trying different click strategies ===');

    // Strategy 1: Look for the document number cell and try to click inside it
    console.log('Strategy 1: Click on document number cell content...');
    const strategy1 = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length === 0) return { success: false, reason: 'No rows' };

      const firstRow = rows[0];
      const cells = Array.from(firstRow.querySelectorAll('td'));

      // Find cell containing the instrument number (202500009427)
      for (const cell of cells) {
        const text = cell.textContent.trim();
        if (text.includes('202500009427')) {
          // Try to find a clickable element inside
          const button = cell.querySelector('button');
          const link = cell.querySelector('a');
          const span = cell.querySelector('span');

          if (button) {
            button.click();
            return { success: true, clicked: 'button-in-docnum-cell' };
          }
          if (link) {
            link.click();
            return { success: true, clicked: 'link-in-docnum-cell' };
          }
          if (span && span.onclick) {
            span.click();
            return { success: true, clicked: 'span-in-docnum-cell' };
          }

          // Try clicking the cell itself
          cell.click();
          return { success: true, clicked: 'docnum-cell' };
        }
      }

      return { success: false, reason: 'Could not find document number cell' };
    });

    console.log('Strategy 1 result:', JSON.stringify(strategy1, null, 2));

    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n=== Images found so far:', imageUrls.length);
    imageUrls.forEach((url, idx) => {
      console.log(`${idx + 1}. ${url}`);
    });

    // Check for document viewer
    const viewerInfo = await page.evaluate(() => {
      const pageText = document.body.innerText;
      const hasPageOf = pageText.includes(' of ');

      return {
        url: window.location.href,
        urlChanged: !window.location.href.includes('results'),
        hasPageIndicator: hasPageOf,
        viewerClasses: Array.from(document.querySelectorAll('[class*="viewer"], [class*="document"]')).map(el => ({
          className: el.className,
          visible: el.offsetParent !== null
        }))
      };
    });

    console.log('\n=== Viewer/Navigation Info ===');
    console.log(JSON.stringify(viewerInfo, null, 2));

    await page.screenshot({ path: '/tmp/dallas-instrument-v2-after-click.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/dallas-instrument-v2-after-click.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugInstrumentSearch().catch(console.error);
