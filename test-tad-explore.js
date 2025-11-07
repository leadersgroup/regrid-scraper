const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Exploring TAD Website Structure\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Loading TAD homepage...');
    await page.goto('https://www.tad.org/index', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if there's a "Property Search" link that goes to a different page
    const propertySearchLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent.toLowerCase();
        if (text.includes('property search') && !text.includes('protest')) {
          return {
            text: link.textContent.trim(),
            href: link.href
          };
        }
      }
      return null;
    });

    console.log('Property Search Link:', propertySearchLink);

    if (propertySearchLink && propertySearchLink.href && !propertySearchLink.href.includes('#')) {
      console.log('\n🔗 Found property search link, navigating...');
      await page.goto(propertySearchLink.href, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const newPageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasSearchForm: !!document.querySelector('form'),
          hasInputQuery: !!document.querySelector('#query, input[name="query"]'),
          bodyText: document.body.innerText.substring(0, 500)
        };
      });

      console.log('\n📄 Property Search Page Info:');
      console.log(JSON.stringify(newPageInfo, null, 2));
    } else {
      console.log('\n❌ Property Search appears to be on the same page (AJAX-based)');
      console.log('This means we need to wait for results to appear dynamically after clicking search');
    }

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
