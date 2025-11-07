const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing Row Click with Different Wait Strategies\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Go to results page
    console.log('Loading results page...');
    await page.goto('https://tarrant.tx.publicsearch.us/results?department=RP&documentNumberRange=%5B%22D225045226%22%5D&searchType=advancedSearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Login if needed
    const needsLogin = await page.evaluate(() => {
      return document.body.innerText.toLowerCase().includes('sign in');
    });

    if (needsLogin) {
      console.log('Logging in...');
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
      console.log('✅ Logged in\n');
    }

    console.log('Setting up navigation listener...');

    // Listen for navigation
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        console.log('📍 Navigation detected:', frame.url());
      }
    });

    console.log('Clicking row...\n');

    // Try clicking the row by finding the correct element
    const clickResult = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');

      for (const row of rows) {
        if (row.textContent.includes('D225045226')) {
          console.log('Found row, clicking...');

          // Try clicking the instrument number column specifically
          const instrumentCol = row.querySelector('.col-7');
          if (instrumentCol) {
            instrumentCol.click();
            return { clicked: true, element: 'col-7' };
          }

          // Fallback to clicking the row
          row.click();
          return { clicked: true, element: 'row' };
        }
      }

      return { clicked: false };
    });

    console.log('Click result:', clickResult);

    // Wait and check for changes
    console.log('\n⏳ Waiting 15 seconds and checking for changes...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check current state
    const currentState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        hasModal: !!document.querySelector('[role="dialog"], .modal, .popup'),
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });

    console.log('Current URL:', currentState.url);
    console.log('Title:', currentState.title);
    console.log('Has Modal:', currentState.hasModal);
    console.log('\nPage content:');
    console.log(currentState.bodyText);

    // Check if there are new pages/tabs
    const pages = await browser.pages();
    console.log('\n📄 Total pages open:', pages.length);

    if (pages.length > 2) {
      console.log('\n✅ New page detected!');
      const newPage = pages[pages.length - 1];
      await newPage.bringToFront();
      await new Promise(resolve => setTimeout(resolve, 3000));

      const newPageInfo = await newPage.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 2000)
        };
      });

      console.log('New page URL:', newPageInfo.url);
      console.log('New page title:', newPageInfo.title);
      console.log('\nNew page content:');
      console.log(newPageInfo.bodyText);
    }

    console.log('\n⏸️  Browser will stay open for 120 seconds...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
