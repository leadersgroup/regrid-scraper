const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasSearch() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    console.log('Navigating to Dallas CAD search...');
    await page.goto('https://www.dallascad.org/SearchAddr.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Filling form...');
    await page.type('#txtAddrNum', '7012');
    await new Promise(resolve => setTimeout(resolve, 500));

    await page.type('#txtStName', 'Duffield');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await page.select('#listCity', 'DALLAS');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Form filled. Getting page state before submit...');
    const beforeSubmit = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title
    }));
    console.log('Before submit:', beforeSubmit);

    console.log('Clicking submit button...');

    // Dallas CAD uses form postback - need to wait for page reload
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click('#cmdSubmit')
    ]);

    console.log('Navigation completed');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Getting page state after submit...');
    const afterSubmit = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body.innerText.substring(0, 500),
      tables: document.querySelectorAll('table').length,
      links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
        href: a.href,
        text: a.textContent.trim()
      }))
    }));
    
    console.log('\n=== AFTER SUBMIT ===');
    console.log('URL:', afterSubmit.url);
    console.log('Title:', afterSubmit.title);
    console.log('Tables:', afterSubmit.tables);
    console.log('First 10 links:', JSON.stringify(afterSubmit.links, null, 2));
    console.log('Body preview:', afterSubmit.bodyText);

    await page.screenshot({ path: '/tmp/dallas-search-debug.png', fullPage: true });
    console.log('Screenshot saved to /tmp/dallas-search-debug.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasSearch().catch(console.error);
