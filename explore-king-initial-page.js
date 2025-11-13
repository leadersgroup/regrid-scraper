/**
 * Check if Sales History is on the initial property page (before clicking Property Detail)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreInitialPage() {
  console.log('🔍 Checking initial property page for Sales History...\n');

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

    // DON'T click Property Detail - check initial page first
    console.log('📜 Scrolling on initial property page...');

    // Scroll down progressively
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Look for SALES HISTORY
    console.log('\n🔍 Looking for SALES HISTORY on initial page...');
    const salesHistoryCheck = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));

      for (const el of allElements) {
        const text = el.textContent.trim().toUpperCase();
        if (text === 'SALES HISTORY' || text === 'SALES HISTORY:') {
          // Found it! Get more context
          const parent = el.parentElement;
          const nextSibling = el.nextElementSibling;

          return {
            found: true,
            elementTag: el.tagName,
            elementText: el.textContent.trim(),
            parentTag: parent ? parent.tagName : '',
            hasTable: !!document.querySelector('table')
          };
        }
      }

      return { found: false };
    });

    if (salesHistoryCheck.found) {
      console.log('✅ FOUND Sales History on initial page!');
      console.log(`   Element: <${salesHistoryCheck.elementTag}> "${salesHistoryCheck.elementText}"`);
      console.log(`   Parent: <${salesHistoryCheck.parentTag}>`);
      console.log(`   Has tables: ${salesHistoryCheck.hasTable}`);

      // Look for recording numbers
      const recordingNumbers = await page.evaluate(() => {
        const allCells = Array.from(document.querySelectorAll('td, th, span, div'));
        const numbers = [];

        for (const cell of allCells) {
          const text = cell.textContent.trim();
          if (/\b\d{14,}\b/.test(text)) {
            const link = cell.querySelector('a') || (cell.tagName === 'A' ? cell : null);
            numbers.push({
              text: text,
              tag: cell.tagName,
              isLink: !!link,
              href: link ? link.href : ''
            });
          }
        }

        return numbers;
      });

      console.log(`\n📞 Found ${recordingNumbers.length} recording numbers:`);
      recordingNumbers.forEach((num, i) => {
        console.log(`  ${i + 1}. ${num.text} <${num.tag}>${num.isLink ? ` [LINK: ${num.href}]` : ''}`);
      });

      // Take screenshot
      await page.screenshot({ path: 'king-sales-history-initial-page.png', fullPage: true });
      console.log('\n📸 Screenshot saved: king-sales-history-initial-page.png');

    } else {
      console.log('❌ Sales History NOT found on initial page');

      // List all headings we can see
      const headings = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, th'))
          .map(h => h.textContent.trim())
          .filter(t => t.length > 0 && t.length < 100)
          .slice(0, 30);
      });

      console.log('\n📋 Headings found on page:');
      headings.forEach(h => console.log(`  - ${h}`));
    }

    console.log('\n⏸️  Browser open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreInitialPage();
