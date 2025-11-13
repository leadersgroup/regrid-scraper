/**
 * Simple test for King County - just test Property Detail navigation and Sales History
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testPropertyDetail() {
  console.log('🧪 Simple test for Property Detail navigation\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate
    console.log('📍 Navigating...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Checkbox
    try {
      await page.waitForSelector('#cphContent_checkbox_acknowledge', { timeout: 5000 });
      await page.click('#cphContent_checkbox_acknowledge');
      console.log('✅ Checked checkbox');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('⚠️  No checkbox');
    }

    // Search
    console.log('📝 Searching for 7550 41st Ave NE...');
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

    // Click Property Detail LINK
    console.log('🔗 Looking for Property Detail link (#cphContent_LinkButtonDetail)...');
    const propertyDetailLinkSelector = '#cphContent_LinkButtonDetail';

    try {
      await page.waitForSelector(propertyDetailLinkSelector, { timeout: 10000 });
      console.log('✅ Found Property Detail link');
    } catch (e) {
      console.log('❌ Property Detail link not found');
      throw new Error('Property Detail link not found');
    }

    console.log('📋 Clicking Property Detail link...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click(propertyDetailLinkSelector)
    ]);

    const currentUrl = page.url();
    console.log(`✅ Navigated to: ${currentUrl}`);

    if (!currentUrl.includes('Detail.aspx')) {
      throw new Error(`Expected Detail.aspx, got: ${currentUrl}`);
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for SALES HISTORY
    console.log('\n🔍 Checking for SALES HISTORY...');
    const hasSalesHistory = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      return html.toUpperCase().includes('SALES HISTORY');
    });

    console.log(`Sales History present: ${hasSalesHistory ? '✅ YES' : '❌ NO'}`);

    if (hasSalesHistory) {
      // Look for recording number
      const recordingInfo = await page.evaluate(() => {
        const allCells = Array.from(document.querySelectorAll('td'));

        for (const cell of allCells) {
          const text = cell.textContent.trim();
          if (/^\d{14,}$/.test(text)) {
            const link = cell.querySelector('a');
            return {
              found: true,
              recordingNumber: text,
              isLink: !!link,
              href: link ? link.href : ''
            };
          }
        }

        return { found: false };
      });

      if (recordingInfo.found) {
        console.log(`✅ Found recording number: ${recordingInfo.recordingNumber}`);
        if (recordingInfo.isLink) {
          console.log(`   It's a clickable link: ${recordingInfo.href}`);
        } else {
          console.log(`   It's NOT clickable`);
        }
      } else {
        console.log('❌ No recording number found');
      }
    }

    console.log('\n⏸️  Browser open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

testPropertyDetail();
