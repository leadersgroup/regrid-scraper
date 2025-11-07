const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing Instrument Number Click with New Tab\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate through the workflow to get to property page
    console.log('Step 1: Loading TAD...');
    await page.goto('https://www.tad.org/index', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Set dropdown
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

    // Type and search
    await page.type('#query', '1009 WICKWOOD Ct', { delay: 50 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const navPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await page.keyboard.press('Enter');
    await navPromise;
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click account number
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (/\b\d{8}\b/.test(link.textContent)) {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 7000));

    console.log('\n🎯 Now on property page, clicking instrument number...\n');

    // Listen for new page/tab
    const newPagePromise = new Promise(resolve => {
      browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
          const newPage = await target.page();
          resolve(newPage);
        }
      });
    });

    // Click instrument link
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (/\b(D\d{9})\b/.test(link.textContent.trim())) {
          console.log('Clicking instrument link:', link.href);
          link.click();
          return true;
        }
      }
      return false;
    });

    console.log('⏳ Waiting for new tab to open...');

    const newPage = await Promise.race([
      newPagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for new tab')), 15000))
    ]);

    if (newPage) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const newPageInfo = await newPage.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 2000)
        };
      });

      console.log('\n✅ New tab opened!');
      console.log('URL:', newPageInfo.url);
      console.log('Title:', newPageInfo.title);
      console.log('\nPage content:');
      console.log(newPageInfo.bodyText);

      // Check for login or download options
      const needsLogin = await newPage.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('login') || text.includes('sign in') || text.includes('log in');
      });

      const hasDownload = await newPage.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return text.includes('download') || text.includes('view') || text.includes('pdf');
      });

      console.log('\n📊 Analysis:');
      console.log('Needs Login:', needsLogin);
      console.log('Has Download Option:', hasDownload);

      // Look for specific elements
      const elements = await newPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a[href], input[type="button"], input[type="submit"]'));
        return buttons.slice(0, 20).map(btn => ({
          tag: btn.tagName,
          text: (btn.textContent || btn.value || '').substring(0, 50),
          href: btn.href || null
        }));
      });

      console.log('\n🔘 Interactive elements found:');
      elements.forEach((el, i) => {
        console.log(`${i + 1}. <${el.tag}>: "${el.text}" ${el.href ? `(${el.href})` : ''}`);
      });
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
