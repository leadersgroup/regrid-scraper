const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing After Login Flow\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  try {
    // Go directly to the deed detail URL (after all the navigation steps)
    console.log('Step 1: Navigate to publicsearch deed results...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    await page.goto('https://tarrant.tx.publicsearch.us/results?department=RP&documentNumberRange=%5B%22D225045226%22%5D&searchType=advancedSearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\nStep 2: Click on deed row...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const row of rows) {
        if (row.textContent.includes('D225045226')) {
          row.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\nStep 3: Check current state...');
    const beforeLogin = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        hasSignIn: document.body.innerText.toLowerCase().includes('sign in'),
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });

    console.log('URL:', beforeLogin.url);
    console.log('Has Sign In:', beforeLogin.hasSignIn);
    console.log('\nPage content:');
    console.log(beforeLogin.bodyText);

    if (beforeLogin.hasSignIn) {
      console.log('\n\nStep 4: Click Sign In...');
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent.trim().toLowerCase() === 'sign in') {
            link.click();
            return;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('\nStep 5: Fill login form...');
      await page.type('input[type="email"], input[name*="email"], input[name*="username"]', 'ericatl828@gmail.com', { delay: 50 });
      await page.type('input[type="password"]', 'Cdma2000@1', { delay: 50 });

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('\nStep 6: Click login button...');
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

      await new Promise(resolve => setTimeout(resolve, 10000));

      console.log('\n\nStep 7: Check page after login...');
      const afterLogin = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
        const buttonInfo = buttons.slice(0, 30).map(btn => ({
          tag: btn.tagName,
          text: (btn.textContent || btn.value || '').trim().substring(0, 50),
          href: btn.href || null
        }));

        return {
          url: window.location.href,
          title: document.title,
          buttons: buttonInfo,
          bodyText: document.body.innerText.substring(0, 2000)
        };
      });

      console.log('URL:', afterLogin.url);
      console.log('Title:', afterLogin.title);
      console.log('\n🔘 Buttons/Links available:');
      afterLogin.buttons.forEach((btn, i) => {
        console.log(`${i + 1}. <${btn.tag}>: "${btn.text}" ${btn.href ? `(${btn.href})` : ''}`);
      });
      console.log('\n📄 Page content:');
      console.log(afterLogin.bodyText);
    }

    console.log('\n⏸️  Browser will stay open for 120 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
