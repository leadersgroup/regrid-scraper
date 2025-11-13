/**
 * Find ALL "Property Detail" elements to see if there's a navigation vs tab click
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function findPropertyDetailLinks() {
  console.log('🔍 Finding all Property Detail elements...\n');

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

    // Find ALL elements with "Property Detail" text
    console.log('🔍 Finding ALL elements containing "Property Detail"...\n');
    const propertyDetailElements = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const matches = [];

      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.includes('Property Detail')) {
          // Check if it's a link
          const isLink = el.tagName === 'A';
          const href = isLink ? el.href : '';

          // Check if it's a button or has onclick
          const isButton = el.tagName === 'BUTTON' || el.onclick !== null;

          // Get parent info
          const parent = el.parentElement;

          matches.push({
            tag: el.tagName,
            text: text.length > 100 ? text.substring(0, 100) + '...' : text,
            id: el.id || '',
            className: el.className || '',
            isLink: isLink,
            href: href,
            isButton: isButton,
            parentTag: parent ? parent.tagName : '',
            hasChildren: el.children.length > 0,
            childCount: el.children.length
          });
        }
      }

      return matches;
    });

    console.log(`Found ${propertyDetailElements.length} elements with "Property Detail":\n`);
    propertyDetailElements.forEach((el, i) => {
      console.log(`${i + 1}. <${el.tag}> "${el.text}"`);
      if (el.id) console.log(`   ID: ${el.id}`);
      if (el.className) console.log(`   Class: ${el.className}`);
      if (el.isLink) console.log(`   LINK -> ${el.href}`);
      if (el.isButton) console.log(`   BUTTON/CLICKABLE`);
      console.log(`   Parent: <${el.parentTag}>, Children: ${el.childCount}`);
      console.log('');
    });

    // Try clicking the first one that's a link and see where it goes
    if (propertyDetailElements.some(el => el.isLink)) {
      console.log('\n🔗 Found a Property Detail LINK - clicking it...\n');

      const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(e => {
        console.log('No navigation occurred (might be same-page tab)');
        return null;
      });

      await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a'));
        for (const el of allElements) {
          if (el.textContent.trim().includes('Property Detail') && el.href) {
            console.log(`Clicking link: ${el.href}`);
            el.click();
            return true;
          }
        }
      });

      await navigationPromise;
      await new Promise(resolve => setTimeout(resolve, 3000));

      console.log(`Current URL after click: ${page.url()}\n`);

      // Check for Sales History now
      console.log('🔍 Checking for SALES HISTORY after clicking link...');
      const hasSalesHistory = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        return html.toUpperCase().includes('SALES HISTORY');
      });

      console.log(`Has SALES HISTORY: ${hasSalesHistory}`);

      if (hasSalesHistory) {
        console.log('\n✅ FOUND IT! Sales History appears after clicking the Property Detail LINK!\n');
        await page.screenshot({ path: 'king-found-sales-history.png', fullPage: true });
        console.log('📸 Screenshot saved: king-found-sales-history.png');
      }
    } else {
      console.log('\n⚠️  No Property Detail links found, only tabs/buttons');
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

findPropertyDetailLinks();
