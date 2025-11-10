const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugAfterRowClick() {
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
    // Navigate directly to search results
    const url = 'https://dallas.tx.publicsearch.us/results?department=RP&page=972&recordedDateRange=18000101%2C20251106&searchType=advancedSearch&volume=99081';
    console.log('Navigating to search results...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== Finding and clicking row ===');
    const clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      if (rows.length === 0) return { success: false, reason: 'No rows' };

      const row = rows[0];
      const button = row.querySelector('button.a11y-menu__control');
      if (button) {
        button.click();
        return { success: true, clickedButton: true };
      }

      row.click();
      return { success: true, clickedRow: true };
    });

    console.log('Click result:', JSON.stringify(clicked, null, 2));

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== Images found so far:', imageUrls.length);
    imageUrls.forEach((url, idx) => {
      console.log(`${idx + 1}. ${url}`);
    });

    // Look for document viewer/preview
    const viewerInfo = await page.evaluate(() => {
      // Check for various viewer containers
      const selectors = [
        '.css-1wvt4ep',  // Known viewer class
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

    await page.screenshot({ path: '/tmp/dallas-after-row-click.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/dallas-after-row-click.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugAfterRowClick().catch(console.error);
