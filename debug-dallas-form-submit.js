const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugFormSubmit() {
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

    // Fill and check values
    console.log('\n=== Filling and checking values ===');
    const fillResult = await page.evaluate(() => {
      let volumeInput = document.querySelector('#volume');
      let pageInput = document.querySelector('#page');

      if (volumeInput) {
        volumeInput.value = '99081';
        volumeInput.dispatchEvent(new Event('input', { bubbles: true }));
        volumeInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (pageInput) {
        pageInput.value = '0972';
        pageInput.dispatchEvent(new Event('input', { bubbles: true }));
        pageInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Wait a bit for React to process
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            volumeValue: volumeInput?.value,
            pageValue: pageInput?.value,
            volumeId: volumeInput?.id,
            pageId: pageInput?.id
          });
        }, 1000);
      });
    });

    console.log('Fill result:', JSON.stringify(fillResult, null, 2));

    // Wait and check again
    await new Promise(resolve => setTimeout(resolve, 2000));

    const valueCheck = await page.evaluate(() => {
      const volumeInput = document.querySelector('#volume');
      const pageInput = document.querySelector('#page');
      return {
        volumeValue: volumeInput?.value,
        pageValue: pageInput?.value
      };
    });

    console.log('Value check after 2 seconds:', JSON.stringify(valueCheck, null, 2));

    // Take screenshot before submitting
    await page.screenshot({ path: '/tmp/dallas-before-submit.png', fullPage: true });
    console.log('Screenshot saved: /tmp/dallas-before-submit.png');

    //  Check the form before clicking
    const formInfo = await page.evaluate(() => {
      const form = document.querySelector('form');
      if (!form) return { found: false };

      const formData = new FormData(form);
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }

      return {
        found: true,
        action: form.action,
        method: form.method,
        formData: data
      };
    });

    console.log('\nForm info:', JSON.stringify(formInfo, null, 2));

    console.log('\n=== Clicking Search ===');
    await page.click('button[type="submit"]');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const url = page.url();
    console.log('\nResult URL:', url);

    await page.screenshot({ path: '/tmp/dallas-after-submit.png', fullPage: true });
    console.log('Screenshot saved: /tmp/dallas-after-submit.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugFormSubmit().catch(console.error);
