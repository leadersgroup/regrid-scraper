const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugClickSubmit() {
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
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const advLink = links.find(link => {
        const text = link.textContent.toLowerCase();
        return text.includes('advanced') && text.includes('search');
      });
      if (advLink) advLink.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Type into volume and page fields
    console.log('\n=== Typing volume and page ===');
    const volumeField = await page.$('#volume');
    await volumeField.click({ clickCount: 3 });
    await volumeField.type('99081');
    console.log('Typed volume: 99081');

    await new Promise(resolve => setTimeout(resolve, 500));

    const pageField = await page.$('#page');
    await pageField.click({ clickCount: 3 });
    await pageField.type('972');
    console.log('Typed page: 972');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify values
    const values = await page.evaluate(() => ({
      volume: document.querySelector('#volume')?.value,
      page: document.querySelector('#page')?.value
    }));
    console.log('Values before submit:', values);

    // Click submit button using Puppeteer's click (not evaluate)
    console.log('\n=== Clicking Search Button (using Puppeteer click) ===');
    const submitBtn = await page.$('button[type="submit"].css-1bcpd2');
    if (submitBtn) {
      await submitBtn.click();
      console.log('✓ Clicked submit button with Puppeteer');
    } else {
      console.log('❌ Submit button not found');
    }

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {
      console.log('⚠️ Navigation timeout or no navigation occurred');
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const url = page.url();
    console.log('\n=== Result URL ===');
    console.log(url);

    // Check results
    const results = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return {
        rowCount: rows.length,
        firstRow: rows[0]?.textContent?.substring(0, 200) || 'No rows'
      };
    });

    console.log('\n=== Results ===');
    console.log('Row count:', results.rowCount);
    console.log('First row:', results.firstRow);

    await page.screenshot({ path: '/tmp/dallas-click-submit-results.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/dallas-click-submit-results.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugClickSubmit().catch(console.error);
