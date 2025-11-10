const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasNoCity() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Dallas CAD...');
    await page.goto('https://www.dallascad.org/SearchAddr.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Filling form without setting city...');
    await page.type('#txtAddrNum', '7012');
    await new Promise(resolve => setTimeout(resolve, 500));

    await page.type('#txtStName', 'Duffield');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check current city value
    const cityValue = await page.evaluate(() => {
      const select = document.querySelector('#listCity');
      return {
        value: select?.value,
        text: select?.options[select?.selectedIndex]?.text
      };
    });
    console.log('Current city dropdown value:', cityValue);

    console.log('Clicking submit button...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('#cmdSubmit')
    ]);

    console.log('Navigation completed');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Analyze results
    const results = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const propertyLinks = links.filter(link => {
        const text = link.textContent.trim();
        return text.includes('DUFFIELD') || text.includes('Duffield');
      });

      return {
        url: window.location.href,
        propertyCount: propertyLinks.length,
        properties: propertyLinks.map(link => ({
          text: link.textContent.trim(),
          href: link.href
        }))
      };
    });

    console.log('\n=== SEARCH RESULTS ===');
    console.log('URL:', results.url);
    console.log('Found properties:', results.propertyCount);
    console.log('Properties:');
    results.properties.forEach((prop, idx) => {
      console.log(`  ${idx + 1}. ${prop.text}`);
    });

    await page.screenshot({ path: '/tmp/dallas-nocity-results.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/dallas-nocity-results.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasNoCity().catch(console.error);
