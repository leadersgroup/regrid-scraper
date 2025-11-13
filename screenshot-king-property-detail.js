/**
 * Take screenshots of the Property Detail page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function screenshotPropertyDetail() {
  console.log('📸 Taking screenshots of Property Detail page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
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

    // Take screenshot of initial page
    await page.screenshot({ path: 'king-screenshot-1-initial.png', fullPage: true });
    console.log('📸 Screenshot 1: Initial property page');

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

    // Take screenshot of Property Detail
    await page.screenshot({ path: 'king-screenshot-2-property-detail.png', fullPage: true });
    console.log('📸 Screenshot 2: Property Detail (top)');

    // Scroll down progressively and take screenshots
    console.log('📜 Scrolling and taking screenshots...');

    for (let i = 0; i < 5; i++) {
      await page.evaluate((scrollAmount) => {
        window.scrollBy(0, scrollAmount);
      }, 800);
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.screenshot({ path: `king-screenshot-3-scroll-${i + 1}.png`, fullPage: false });
      console.log(`📸 Screenshot 3-${i + 1}: After scrolling ${(i + 1) * 800}px`);
    }

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.screenshot({ path: 'king-screenshot-4-bottom.png', fullPage: true });
    console.log('📸 Screenshot 4: Scrolled to bottom (full page)');

    // Get page dimensions
    const dimensions = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      windowHeight: window.innerHeight
    }));

    console.log(`\n📏 Page dimensions:`);
    console.log(`  Scroll height: ${dimensions.scrollHeight}px`);
    console.log(`  Client height: ${dimensions.clientHeight}px`);
    console.log(`  Window height: ${dimensions.windowHeight}px`);

    console.log('\n✅ Screenshots saved! Check the files:');
    console.log('  - king-screenshot-1-initial.png');
    console.log('  - king-screenshot-2-property-detail.png');
    console.log('  - king-screenshot-3-scroll-*.png');
    console.log('  - king-screenshot-4-bottom.png');

    console.log('\n⏸️  Keeping browser open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

screenshotPropertyDetail();
