const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasClerk() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Dallas County Clerk records...');
    await page.goto('https://dallas.tx.publicsearch.us/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot of homepage
    await page.screenshot({ path: '/tmp/dallas-clerk-home.png', fullPage: true });
    console.log('Screenshot saved to /tmp/dallas-clerk-home.png');

    // Analyze page structure
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          action: form.action,
          method: form.method
        })),
        searchFields: Array.from(document.querySelectorAll('input[type="text"], input[type="search"]')).map(input => ({
          id: input.id,
          name: input.name,
          placeholder: input.placeholder,
          value: input.value
        })),
        buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
          id: btn.id,
          text: btn.textContent || btn.value,
          type: btn.type
        })),
        links: Array.from(document.querySelectorAll('a')).slice(0, 20).map(link => ({
          href: link.href,
          text: link.textContent.trim()
        }))
      };
    });

    console.log('\n=== DALLAS CLERK PAGE INFO ===');
    console.log('Title:', pageInfo.title);
    console.log('URL:', pageInfo.url);
    console.log('\nForms:', JSON.stringify(pageInfo.forms, null, 2));
    console.log('\nSearch Fields:', JSON.stringify(pageInfo.searchFields, null, 2));
    console.log('\nButtons:', JSON.stringify(pageInfo.buttons, null, 2));
    console.log('\nFirst 20 links:', JSON.stringify(pageInfo.links, null, 2));

    console.log('\nWaiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasClerk().catch(console.error);
