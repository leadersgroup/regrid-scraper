/**
 * Deep exploration to find Sales History section on King County
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreSalesHistory() {
  console.log('🔍 Deep exploration for Sales History section...\n');

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
    } catch (e) {
      console.log('⚠️  Checkbox not found');
    }

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

    // Check for iframes
    console.log('\n🖼️  Checking for iframes...');
    const iframes = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('iframe'));
      return frames.map((f, i) => ({
        index: i,
        id: f.id || '',
        src: f.src || '',
        name: f.name || ''
      }));
    });

    if (iframes.length > 0) {
      console.log(`Found ${iframes.length} iframes:`);
      iframes.forEach(f => console.log(`  ${f.index}: ${f.id} - ${f.src}`));
    } else {
      console.log('No iframes found');
    }

    // Scroll extensively
    console.log('\n📜 Scrolling thoroughly...');
    await page.evaluate(async () => {
      // Scroll down in chunks
      for (let i = 0; i < 10; i++) {
        window.scrollBy(0, 500);
        await new Promise(r => setTimeout(r, 500));
      }
      // Scroll to bottom
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(r => setTimeout(r, 2000));
      // Scroll back up
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 2000));
    });

    // Look for ALL elements containing "sales" or "history"
    console.log('\n🔍 Searching for Sales/History elements (case-insensitive)...');
    const salesElements = await page.evaluate(() => {
      const results = [];
      const allElements = Array.from(document.querySelectorAll('*'));

      for (const el of allElements) {
        const text = el.textContent.trim();
        const lower = text.toLowerCase();

        if ((lower.includes('sales') || lower.includes('history')) &&
            text.length > 3 && text.length < 200 &&
            el.children.length === 0) { // Only leaf nodes

          results.push({
            tag: el.tagName,
            text: text,
            id: el.id || '',
            className: el.className || '',
            clickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick !== null
          });
        }
      }

      return results.slice(0, 50); // Limit to first 50
    });

    console.log(`Found ${salesElements.length} elements:`);
    salesElements.forEach((el, i) => {
      console.log(`\n  ${i + 1}. <${el.tag}> "${el.text}"`);
      if (el.id) console.log(`     ID: ${el.id}`);
      if (el.className) console.log(`     Class: ${el.className}`);
      if (el.clickable) console.log(`     ⚠️ CLICKABLE`);
    });

    // Look for recording numbers (14+ digit numbers)
    console.log('\n\n🔢 Searching for recording numbers (14+ digits)...');
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
            href: link ? link.href : ''
          });
        }
      }

      return results.slice(0, 20);
    });

    console.log(`Found ${recordingNumbers.length} potential recording numbers:`);
    recordingNumbers.forEach((rec, i) => {
      console.log(`\n  ${i + 1}. ${rec.text}`);
      console.log(`     Tag: ${rec.tag}`);
      if (rec.hasLink) console.log(`     LINK: ${rec.href}`);
    });

    console.log('\n\n⏸️  Browser open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreSalesHistory();
