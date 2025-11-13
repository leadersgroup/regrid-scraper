/**
 * Click the History link and see what appears
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreHistoryLink() {
  console.log('🔍 Exploring History link...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate and search
    console.log('📍 Navigating and searching...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Checkbox
    try {
      await page.waitForSelector('#cphContent_checkbox_acknowledge', { timeout: 5000 });
      await page.click('#cphContent_checkbox_acknowledge');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {}

    // Search
    const addressField = 'input[id="cphContent_txtAddress"]';
    await page.waitForSelector(addressField, { timeout: 10000 });
    await page.click(addressField, { clickCount: 3 });
    await page.type(addressField, '7550 41st Ave NE');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log(`✅ At: ${page.url()}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Property Detail tab
    console.log('📋 Clicking Property Detail tab...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"], li'));
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.includes('Property Detail') || text === 'Property Detail') {
          el.click();
          return true;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click the History link
    console.log('🔗 Looking for and clicking History link...');
    const historyClicked = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (text === 'History' || text.toLowerCase() === 'history') {
          console.log(`Clicking History link: ${link.href}`);
          link.click();
          return { clicked: true, href: link.href, text: text };
        }
      }
      return { clicked: false };
    });

    if (historyClicked.clicked) {
      console.log(`✅ Clicked History link: ${historyClicked.href}`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`Current URL: ${page.url()}\n`);

      // Now look for Sales History
      console.log('🔍 Looking for Sales History after clicking History...');

      await page.evaluate(async () => {
        // Scroll down
        for (let i = 0; i < 10; i++) {
          window.scrollBy(0, 500);
          await new Promise(r => setTimeout(r, 500));
        }
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 2000));
      });

      // Look for sales-related content
      const salesContent = await page.evaluate(() => {
        const results = [];
        const allElements = Array.from(document.querySelectorAll('*'));

        for (const el of allElements) {
          const text = el.textContent.trim();
          const lower = text.toLowerCase();

          if ((lower.includes('sales') || lower.includes('recording')) &&
              text.length > 3 && text.length < 200 &&
              el.children.length === 0) {

            results.push({
              tag: el.tagName,
              text: text,
              clickable: el.tagName === 'A' || el.tagName === 'BUTTON'
            });
          }
        }

        return results.slice(0, 30);
      });

      console.log(`Found ${salesContent.length} sales/recording elements:`);
      salesContent.forEach((el, i) => {
        console.log(`  ${i + 1}. <${el.tag}> "${el.text}"${el.clickable ? ' [CLICKABLE]' : ''}`);
      });

      // Look for recording numbers
      console.log('\n🔢 Looking for recording numbers...');
      const recordingNumbers = await page.evaluate(() => {
        const results = [];
        const allElements = Array.from(document.querySelectorAll('*'));

        for (const el of allElements) {
          const text = el.textContent.trim();

          if (/\b\d{14,}\b/.test(text) && text.length < 100 && el.children.length === 0) {
            const link = el.querySelector('a') || (el.tagName === 'A' ? el : null);
            results.push({
              text: text,
              tag: el.tagName,
              hasLink: !!link,
              href: link ? link.href : '',
              parent: el.parentElement ? el.parentElement.tagName : ''
            });
          }
        }

        return results.slice(0, 20);
      });

      console.log(`Found ${recordingNumbers.length} recording numbers:`);
      recordingNumbers.forEach((rec, i) => {
        console.log(`\n  ${i + 1}. ${rec.text}`);
        console.log(`     Tag: ${rec.tag}, Parent: ${rec.parent}`);
        if (rec.hasLink) console.log(`     LINK: ${rec.href}`);
      });

      // Get all tables
      console.log('\n📊 Tables on page:');
      const tables = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('table')).map((table, i) => {
          const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
          const rowCount = table.querySelectorAll('tr').length;
          return `Table ${i + 1}: ${headers.length} cols, ${rowCount} rows, Headers: ${headers.join(', ')}`;
        });
      });
      tables.forEach(t => console.log(`  ${t}`));

    } else {
      console.log('❌ Could not find History link');
    }

    console.log('\n⏸️  Browser open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreHistoryLink();
