const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDurhamSearch() {
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

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== Typing search term ===');
    const searchInput = await page.$('#searchTerm');
    await searchInput.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    await searchInput.type('6409 winding arch dr');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('✓ Typed search term');

    console.log('\n=== Pressing Enter ===');
    await page.keyboard.press('Enter');
    
    console.log('✓ Pressed Enter, waiting 5 seconds for results...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze what happened after Enter
    const afterEnter = await page.evaluate(() => {
      return {
        url: window.location.href,
        urlChanged: !window.location.href.endsWith('#/'),
        bodyText: document.body.innerText.substring(0, 500),
        resultElements: {
          tables: document.querySelectorAll('table').length,
          rows: document.querySelectorAll('tr').length,
          links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
            text: a.textContent.trim().substring(0, 50),
            href: a.href
          })),
          parcelLike: Array.from(document.querySelectorAll('*')).filter(el => {
            const text = el.textContent;
            return text && /parcel/i.test(text) && text.length < 100;
          }).slice(0, 5).map(el => ({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 80)
          }))
        }
      };
    });

    console.log('\n=== After Enter Analysis ===');
    console.log(JSON.stringify(afterEnter, null, 2));

    await page.screenshot({ path: '/tmp/durham-after-search.png', fullPage: true });
    console.log('\nScreenshot: /tmp/durham-after-search.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDurhamSearch().catch(console.error);
