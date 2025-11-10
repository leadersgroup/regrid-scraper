const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasClerkClick() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Dallas County Clerk records...');
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

    // Search for document
    console.log('Searching for document 202500009427...');
    const searchInput = await page.$('input[placeholder*="grantor"]');

    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await new Promise(resolve => setTimeout(resolve, 300));
      await searchInput.type('202500009427');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Search completed. Looking for clickable row...');

      // Find clickable rows or elements
      const rowInfo = await page.evaluate(() => {
        // Look for rows in tbody
        const rows = Array.from(document.querySelectorAll('tbody tr'));

        return rows.map((row, idx) => {
          const cells = Array.from(row.querySelectorAll('td'));
          const hasDocNumber = cells.some(cell =>
            cell.textContent.includes('202500009427')
          );

          if (hasDocNumber) {
            // Check for clickable elements in this row
            const buttons = Array.from(row.querySelectorAll('button'));
            const links = Array.from(row.querySelectorAll('a'));
            const clickables = Array.from(row.querySelectorAll('[onclick], [role="button"]'));

            return {
              index: idx,
              isDocRow: true,
              cellsText: cells.map(c => c.textContent.trim()),
              hasButtons: buttons.length > 0,
              buttons: buttons.map(b => ({
                text: b.textContent.trim(),
                ariaLabel: b.getAttribute('aria-label'),
                title: b.getAttribute('title'),
                className: b.className
              })),
              hasLinks: links.length > 0,
              links: links.map(l => ({
                href: l.href,
                text: l.textContent.trim()
              })),
              clickables: clickables.map(c => ({
                tagName: c.tagName,
                text: c.textContent.trim().substring(0, 50),
                onclick: c.getAttribute('onclick')?.substring(0, 100)
              })),
              rowClickable: row.hasAttribute('onclick') || row.getAttribute('role') === 'button',
              rowClasses: row.className
            };
          }
          return null;
        }).filter(r => r !== null);
      });

      console.log('\n=== DOCUMENT ROW INFO ===');
      console.log(JSON.stringify(rowInfo, null, 2));

      // Try clicking on the row
      if (rowInfo.length > 0) {
        console.log('\nAttempting to click on document row...');
        const clicked = await page.evaluate(() => {
          const rows = Array.from(document.querySelectorAll('tbody tr'));
          const docRow = rows.find(row => {
            return row.textContent.includes('202500009427');
          });

          if (docRow) {
            // Try clicking the row itself
            docRow.click();
            return { clicked: true, method: 'row' };
          }

          return { clicked: false };
        });

        console.log('Click result:', clicked);

        if (clicked.clicked) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          console.log('Current URL after click:', page.url());

          await page.screenshot({ path: '/tmp/dallas-clerk-after-click.png', fullPage: true });
          console.log('Screenshot saved to /tmp/dallas-clerk-after-click.png');
        }
      }

      console.log('\nWaiting 30 seconds for inspection...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasClerkClick().catch(console.error);
