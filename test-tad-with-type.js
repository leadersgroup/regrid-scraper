const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing TAD with Property Type Selection\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Step 1: Loading TAD...');
    await page.goto('https://www.tad.org/index', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 2: Setting dropdown to Property Address...');
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.options);
        for (const option of options) {
          if (option.textContent.toLowerCase().includes('property address')) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Step 3: Selecting Residential property type...');
    const typeSelected = await page.evaluate(() => {
      // Look for residential checkbox or radio
      const inputs = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      for (const input of inputs) {
        const label = input.parentElement?.textContent || input.nextSibling?.textContent || '';
        if (label.toLowerCase().includes('residential')) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          input.click();
          return true;
        }
      }
      return false;
    });
    console.log('Residential selected:', typeSelected);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Step 4: Entering address...');
    await page.evaluate(() => {
      const input = document.querySelector('#query');
      if (input) {
        input.value = '1009 WICKWOOD Ct';
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Step 5: Clicking search and monitoring page changes...');

    // Monitor for DOM changes
    let resultsAppeared = false;
    await page.exposeFunction('resultsDetected', () => {
      resultsAppeared = true;
      console.log('✅ Results appeared!');
    });

    await page.evaluate(() => {
      // Set up mutation observer to detect results
      const observer = new MutationObserver(() => {
        const bodyText = document.body.innerText;
        if (/\b\d{8}\b/.test(bodyText) && !bodyText.includes('Account Number\nAgent Name')) {
          window.resultsDetected();
          observer.disconnect();
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });

    // Click search
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const button of buttons) {
        const text = (button.textContent || button.value || '').toLowerCase();
        if (text.includes('search')) {
          console.log('Clicking:', text);
          button.click();
          break;
        }
      }
    });

    console.log('Waiting for results (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    const finalState = await page.evaluate(() => {
      return {
        url: window.location.href,
        has8Digit: /\b\d{8}\b/.test(document.body.innerText),
        accountNumbers: (document.body.innerText.match(/\b\d{8}\b/g) || []).slice(0, 5),
        bodyText: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('\n📊 Final State:');
    console.log('URL:', finalState.url);
    console.log('Has 8-digit numbers:', finalState.has8Digit);
    console.log('Account numbers:', finalState.accountNumbers);
    console.log('Results appeared during wait:', resultsAppeared);
    console.log('\nBody text:');
    console.log(finalState.bodyText);

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
