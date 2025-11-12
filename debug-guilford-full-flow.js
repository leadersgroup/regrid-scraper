/**
 * Debug full flow for Guilford County
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugFullFlow() {
  console.log('🔍 Debugging Guilford County full flow...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Step 1: Navigate
    console.log('Step 1: Navigate to Guilford County...');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Page loaded\n');

    // Step 2: Click Location Address tab
    console.log('Step 2: Click Location Address tab...');
    const tabClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.trim() === 'Location Address') {
          link.click();
          return true;
        }
      }
      return false;
    });
    console.log(`✅ Tab clicked: ${tabClicked}\n`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Fill street number
    console.log('Step 3: Fill street number (1205)...');
    const streetNumField = await page.$('#ctl00_ContentPlaceHolder1_StreetNumberTextBox');
    if (!streetNumField) {
      console.log('❌ Street number field not found!');
    } else {
      await streetNumField.click({ clickCount: 3 });
      await streetNumField.type('1205');
      console.log('✅ Street number filled\n');
    }
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Fill street name
    console.log('Step 4: Fill street name (Glendale)...');
    const streetNameField = await page.$('#ctl00_ContentPlaceHolder1_StreetNameTextBox');
    if (!streetNameField) {
      console.log('❌ Street name field not found!');
    } else {
      await streetNameField.click({ clickCount: 3 });
      await streetNameField.type('Glendale');
      console.log('✅ Street name filled\n');
    }
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Take screenshot before search
    await page.screenshot({ path: 'guilford-before-search.png' });
    console.log('📸 Screenshot: guilford-before-search.png\n');

    // Step 5: Press Enter
    console.log('Step 5: Press Enter to search...');
    await page.keyboard.press('Enter');
    console.log('✅ Enter pressed\n');

    // Wait for results
    console.log('Step 6: Waiting for results (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Take screenshot after search
    await page.screenshot({ path: 'guilford-after-search.png', fullPage: true });
    console.log('📸 Screenshot: guilford-after-search.png\n');

    // Check current URL
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}\n`);

    // Look for parcel links
    console.log('Step 7: Looking for parcel links...');
    const parcelInfo = await page.evaluate(() => {
      // Look for all links
      const allLinks = Array.from(document.querySelectorAll('a'));
      const linkInfo = allLinks.map(link => ({
        text: link.textContent.trim(),
        href: link.href,
        visible: link.offsetParent !== null
      })).filter(l => l.text && l.visible);

      // Look for tables
      const tables = Array.from(document.querySelectorAll('table'));
      const tableInfo = tables.map((table, i) => ({
        index: i,
        rows: table.querySelectorAll('tr').length,
        headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim())
      }));

      return { links: linkInfo.slice(0, 20), tables: tableInfo };
    });

    console.log('Links found:', JSON.stringify(parcelInfo.links, null, 2));
    console.log('\nTables found:', JSON.stringify(parcelInfo.tables, null, 2));

    console.log('\n⏸️  Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close');

    // Keep browser open
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await page.screenshot({ path: 'guilford-error.png' });
  }
}

debugFullFlow().catch(console.error);
