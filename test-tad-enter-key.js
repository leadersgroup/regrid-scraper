const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing TAD with Enter Key\n');

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
            return;
          }
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Step 3: Typing address...');
    await page.type('#query', '1009 WICKWOOD Ct', { delay: 50 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('Step 4: Pressing Enter...');

    // Set up navigation listener
    const navigationPromise = page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(e => {
      console.log('⚠️ No navigation occurred');
      return null;
    });

    await page.keyboard.press('Enter');

    await navigationPromise;
    await new Promise(resolve => setTimeout(resolve, 5000));

    const result = await page.evaluate(() => {
      return {
        url: window.location.href,
        has8Digit: /\b\d{8}\b/.test(document.body.innerText),
        accountNumbers: (document.body.innerText.match(/\b\d{8}\b/g) || []).slice(0, 10),
        bodyText: document.body.innerText.substring(0, 800)
      };
    });

    console.log('\n📊 Results:');
    console.log('URL:', result.url);
    console.log('Has 8-digit numbers:', result.has8Digit);
    console.log('Account numbers found:', result.accountNumbers);
    console.log('\nBody text:');
    console.log(result.bodyText);

    if (result.has8Digit) {
      console.log('\n✅✅✅ SUCCESS! Found account numbers!');
    } else {
      console.log('\n❌ No account numbers found');
    }

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
