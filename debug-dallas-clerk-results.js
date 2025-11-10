const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasClerkResults() {
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
    const searchInput = await page.$('input[placeholder*="grantor"]') ||
                        await page.$('input[placeholder*="doc"]') ||
                        await page.$('input[type="text"]');

    if (searchInput) {
      await searchInput.click({ clickCount: 3 });
      await new Promise(resolve => setTimeout(resolve, 300));
      await searchInput.type('202500009427');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Search completed. Analyzing results...');

      // Analyze the search results page
      const resultsInfo = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        const allCells = Array.from(document.querySelectorAll('td'));

        return {
          totalLinks: allLinks.length,
          totalCells: allCells.length,
          links: allLinks.map((link, idx) => ({
            index: idx,
            href: link.href,
            text: link.textContent.trim().substring(0, 100),
            classes: link.className
          })),
          cells: allCells.map((cell, idx) => ({
            index: idx,
            text: cell.textContent.trim(),
            innerHTML: cell.innerHTML.substring(0, 200),
            hasLink: !!cell.querySelector('a')
          })),
          documentNumberCells: allCells.filter(cell => {
            const text = cell.textContent.trim();
            return text.includes('202500009427');
          }).map(cell => ({
            text: cell.textContent.trim(),
            innerHTML: cell.innerHTML,
            hasLink: !!cell.querySelector('a'),
            linkHref: cell.querySelector('a')?.href || null
          }))
        };
      });

      console.log('\n=== SEARCH RESULTS ANALYSIS ===');
      console.log(`Total links: ${resultsInfo.totalLinks}`);
      console.log(`Total cells: ${resultsInfo.totalCells}`);
      console.log('\nDocument number cells:');
      console.log(JSON.stringify(resultsInfo.documentNumberCells, null, 2));

      console.log('\nAll links (first 20):');
      console.log(JSON.stringify(resultsInfo.links.slice(0, 20), null, 2));

      await page.screenshot({ path: '/tmp/dallas-clerk-results-debug.png', fullPage: true });
      console.log('\nScreenshot saved to /tmp/dallas-clerk-results-debug.png');

      console.log('\nWaiting 30 seconds for inspection...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasClerkResults().catch(console.error);
