const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDurhamSelectors() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Durham County property search...');
    await page.goto('https://property.spatialest.com/nc/durham-tax/#/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== Analyzing page for search inputs ===');
    const inputAnalysis = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll('input'));
      const textInputs = allInputs.filter(i => i.type === 'text' || i.type === 'search');
      
      return {
        url: window.location.href,
        totalInputs: allInputs.length,
        textInputs: textInputs.map(input => ({
          type: input.type,
          placeholder: input.placeholder,
          id: input.id,
          name: input.name,
          className: input.className,
          visible: input.offsetParent !== null
        })),
        possibleSearchElements: Array.from(document.querySelectorAll('[class*="search"], [id*="search"]')).map(el => ({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          visible: el.offsetParent !== null
        }))
      };
    });

    console.log(JSON.stringify(inputAnalysis, null, 2));

    await page.screenshot({ path: '/tmp/durham-page.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/durham-page.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDurhamSelectors().catch(console.error);
