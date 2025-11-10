const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugTypeMethod() {
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

    // Type into volume field
    console.log('\n=== Typing into volume field ===');
    const volumeField = await page.$('#volume');
    if (volumeField) {
      await volumeField.click({ clickCount: 3 });
      await volumeField.type('99081');
      console.log('✓ Typed volume: 99081');
    } else {
      console.log('❌ Volume field not found');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Type into page field
    console.log('\n=== Typing into page field ===');
    const pageField = await page.$('#page');
    if (pageField) {
      await pageField.click({ clickCount: 3 });
      await pageField.type('0972');
      console.log('✓ Typed page: 0972');
    } else {
      console.log('❌ Page field not found');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check values before submit
    const beforeValues = await page.evaluate(() => {
      return {
        volume: document.querySelector('#volume')?.value,
        page: document.querySelector('#page')?.value
      };
    });

    console.log('\nValues before submit:', JSON.stringify(beforeValues, null, 2));

    await page.screenshot({ path: '/tmp/dallas-type-before-submit.png', fullPage: true });
    console.log('Screenshot saved: /tmp/dallas-type-before-submit.png');

    // Click search
    console.log('\n=== Clicking Search ===');
    await page.click('button[type="submit"]');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const url = page.url();
    console.log('\nResult URL:', url);

    // Check if volume/page params are in the URL
    if (url.includes('volume=') || url.includes('page=')) {
      console.log('✅ Volume/page parameters ARE in the URL!');
    } else {
      console.log('❌ Volume/page parameters are NOT in the URL');
    }

    await page.screenshot({ path: '/tmp/dallas-type-after-submit.png', fullPage: true });
    console.log('Screenshot saved: /tmp/dallas-type-after-submit.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugTypeMethod().catch(console.error);
