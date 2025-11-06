/**
 * Manual test - just set up the search and wait for manual interaction
 */

const { chromium } = require('playwright');

async function manualTest() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('\n✅ Browser initialized\n');

    await page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');
    await page.waitForTimeout(3000);

    // Select Address mode
    await page.selectOption('#inputGroupSelect01', '2');
    console.log('✅ Selected Address mode\n');
    await page.waitForTimeout(3000);

    // Enter address
    await page.evaluate(() => {
      document.querySelector('#streetNumber').value = '6241';
      document.querySelector('#singleSearchCriteria').value = 'Del Sol';
    });

    console.log('✅ Entered address: 6241 Del Sol\n');
    await page.waitForTimeout(2000);

    // Submit
    await page.evaluate(() => {
      document.querySelector('#frmQuick').submit();
    });

    console.log('✅ Submitted form\n');
    await page.waitForTimeout(5000);

    console.log('═'.repeat(80));
    console.log('READY FOR MANUAL TESTING');
    console.log('═'.repeat(80));
    console.log('\n📋 Instructions:');
    console.log('   1. You should see search results with parcel "049 14 0A 023.00"');
    console.log('   2. Manually click on the parcel card');
    console.log('   3. Look for the "View Deed" button');
    console.log('   4. Click it and see what happens');
    console.log('   5. Browser will stay open for 5 minutes\n');
    console.log('═'.repeat(80));

    // Listen to URL changes
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        console.log(`\n📍 Navigation: ${frame.url()}`);
      }
    });

    // Listen to console messages from the page
    page.on('console', msg => {
      console.log(`🌐 Page console [${msg.type()}]:`, msg.text());
    });

    // Wait 5 minutes
    await page.waitForTimeout(300000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('\n✅ Closing browser...');
    await browser.close();
  }
}

manualTest().catch(console.error);
