/**
 * Manual test: Navigate, search, wait, then pause for manual inspection
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function manualTest() {
  const parcelId = '2158020070';
  console.log(`\n🔍 Manual test for parcel: ${parcelId}`);
  console.log('Browser will open and navigate. You can manually click View to see what happens.\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate
    console.log('1. Navigating to Pierce County...');
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click disclaimer
    console.log('2. Clicking disclaimer...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.toLowerCase().includes('click here to acknowledge')) {
          link.click();
          return;
        }
      }
    });
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter parcel and search
    console.log('3. Entering parcel ID...');
    const input = await page.$('#cphNoMargin_f_Datatextedit28p');
    await input.click({ clickCount: 3 });
    await input.type(parcelId);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('4. Submitting search...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log('5. At results page');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll down
    console.log('6. Scrolling to load content...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n✅ Ready! Browser will stay open for 2 minutes.');
    console.log('   Manually click the View button and see what happens.');
    console.log('   Watch for new tabs/windows opening.\n');

    // Set up listener for new pages
    browser.on('targetcreated', async (target) => {
      console.log(`[EVENT] New target created: ${target.type()} - ${target.url()}`);
      if (target.type() === 'page') {
        const newPage = await target.page();
        if (newPage) {
          console.log(`[EVENT] New page object available: ${newPage.url()}`);
        }
      }
    });

    // Wait 2 minutes for manual testing
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n✅ Closing browser...');
    await browser.close();
  }
}

manualTest();
