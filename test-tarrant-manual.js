const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Manual Tarrant County TAD Test\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Step 1: Load TAD
    console.log('Step 1: Loading TAD...');
    await page.goto('https://www.tad.org/index', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ TAD loaded\n');

    // Step 2: Set dropdown to Property Address
    console.log('Step 2: Setting dropdown to Property Address...');
    const dropdownSet = await page.evaluate(() => {
      // Find select element
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.options);
        for (const option of options) {
          if (option.textContent.toLowerCase().includes('property address')) {
            console.log('Found option:', option.textContent);
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, value: option.value, text: option.textContent };
          }
        }
      }
      return { success: false };
    });
    console.log('Dropdown result:', dropdownSet);
    console.log('✅ Dropdown set\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Enter address
    console.log('Step 3: Entering address "1009 WICKWOOD Ct"...');
    const inputSet = await page.evaluate(() => {
      const input = document.querySelector('#query');
      if (input) {
        input.value = '1009 WICKWOOD Ct';
        input.focus();
        return true;
      }
      return false;
    });
    console.log('Input set:', inputSet);
    console.log('✅ Address entered\n');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Click search button and wait for navigation
    console.log('Step 4: Clicking search button...');

    // Set up navigation promise BEFORE clicking
    const navigationPromise = page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(e => {
      console.log('⚠️ Navigation timeout or error:', e.message);
      return null;
    });

    // Click the button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const button of buttons) {
        const text = (button.textContent || button.value || '').toLowerCase();
        if (text.includes('search') || text.includes('find')) {
          console.log('Clicking button:', text);
          button.click();
          return;
        }
      }
    });

    // Wait for navigation
    console.log('⏳ Waiting for navigation...');
    await navigationPromise;

    console.log('✅ Navigation complete\n');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 5: Check results
    console.log('Step 5: Checking results page...');
    const resultsInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        has8Digit: /\b\d{8}\b/.test(document.body.innerText),
        accountNumbers: (document.body.innerText.match(/\b\d{8}\b/g) || []).slice(0, 5)
      };
    });

    console.log('URL:', resultsInfo.url);
    console.log('Title:', resultsInfo.title);
    console.log('Has 8-digit numbers:', resultsInfo.has8Digit);
    console.log('Account numbers found:', resultsInfo.accountNumbers);
    console.log('\nPage text:');
    console.log(resultsInfo.bodyText);

    console.log('\n⏸️ Browser will stay open for 120 seconds...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
