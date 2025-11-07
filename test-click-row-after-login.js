const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing Click Row After Login\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Go to results page
    console.log('Step 1: Navigate to results page...');
    await page.goto('https://tarrant.tx.publicsearch.us/results?department=RP&documentNumberRange=%5B%22D225045226%22%5D&searchType=advancedSearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we need to login
    const needsLogin = await page.evaluate(() => {
      return document.body.innerText.toLowerCase().includes('sign in');
    });

    if (needsLogin) {
      console.log('\nStep 2: Logging in...');
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent.trim().toLowerCase() === 'sign in') {
            link.click();
            return;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      await page.type('input[type="email"], input[name*="email"], input[name*="username"]', 'ericatl828@gmail.com', { delay: 50 });
      await page.type('input[type="password"]', 'Cdma2000@1', { delay: 50 });

      await new Promise(resolve => setTimeout(resolve, 1000));

      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('login') || text.includes('sign in')) {
            btn.click();
            return;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 7000));
      console.log('✅ Logged in');
    }

    console.log('\nStep 3: Finding and analyzing deed row...');
    const rowInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));
      const results = [];

      for (const row of rows) {
        const text = row.textContent || '';
        if (text.includes('D225045226')) {
          const links = Array.from(row.querySelectorAll('a'));
          results.push({
            rowText: text.substring(0, 200),
            hasLinks: links.length > 0,
            links: links.map(l => ({
              text: l.textContent.trim().substring(0, 50),
              href: l.href
            })),
            rowHtml: row.outerHTML.substring(0, 500)
          });
        }
      }

      return results;
    });

    console.log('Found rows with D225045226:');
    rowInfo.forEach((info, i) => {
      console.log(`\nRow ${i + 1}:`);
      console.log('Text:', info.rowText);
      console.log('Has Links:', info.hasLinks);
      console.log('Links:', info.links);
    });

    console.log('\n\nStep 4: Clicking on deed row...');

    const clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));

      for (const row of rows) {
        const text = row.textContent || '';
        if (text.includes('D225045226')) {
          // Try clicking the row itself
          row.click();
          return { method: 'row-click', text: text.substring(0, 100) };
        }
      }

      return { method: 'none' };
    });

    console.log('Click result:', clicked);

    console.log('\n⏳ Waiting 10 seconds for navigation...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const afterClick = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });

    console.log('\n📄 After clicking row:');
    console.log('URL:', afterClick.url);
    console.log('Title:', afterClick.title);
    console.log('\nPage content:');
    console.log(afterClick.bodyText);

    // Look for download/view buttons
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
      return btns.slice(0, 30).map(btn => ({
        tag: btn.tagName,
        text: (btn.textContent || btn.value || '').trim().substring(0, 100),
        href: btn.href || null
      }));
    });

    console.log('\n🔘 Available buttons/links:');
    buttons.forEach((btn, i) => {
      console.log(`${i + 1}. <${btn.tag}>: "${btn.text}" ${btn.href ? `(${btn.href})` : ''}`);
    });

    console.log('\n⏸️  Browser will stay open for 120 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
