const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🧪 Testing Grantee field detection and entry...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  console.log('📍 Loading Clerk Records...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Test grantee field detection
  const granteeInputSelectors = [
    'input[name*="txtEE"]',
    'input[id*="txtEE"]',
    'input[name*="Grantee"]',
    'input[name*="grantee"]',
    'input[id*="Grantee"]',
    'input[id*="grantee"]'
  ];

  let granteeInput = null;
  for (const selector of granteeInputSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      granteeInput = selector;
      console.log(`✅ Found Grantee input: ${selector}`);
      break;
    } catch (e) {
      console.log(`❌ Selector not found: ${selector}`);
    }
  }

  if (!granteeInput) {
    console.error('\n❌ FAILED: Could not find grantee field!');
    await browser.close();
    return;
  }

  // Test entering grantee name
  const testOwner = 'TRAN HOANG BINH';

  console.log(`\n📝 Entering grantee name: ${testOwner}`);
  await page.click(granteeInput);
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (input) input.value = '';
  }, granteeInput);
  await page.type(granteeInput, testOwner, { delay: 50 });

  // Verify the value was entered
  const enteredValue = await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    return input ? input.value : null;
  }, granteeInput);

  console.log(`📋 Value in field: "${enteredValue}"`);

  if (enteredValue === testOwner) {
    console.log('\n✅✅✅ SUCCESS! Grantee field found and populated correctly\n');
  } else {
    console.log('\n❌ ERROR: Value mismatch\n');
  }

  // Also test the date fields
  console.log('📅 Testing date fields...');

  const fromDate = '07/25/2023';
  const fromDateObj = new Date('2023-07-25');
  const toDateObj = new Date(fromDateObj);
  toDateObj.setDate(toDateObj.getDate() + 30);
  const toDate = `${String(toDateObj.getMonth() + 1).padStart(2, '0')}/${String(toDateObj.getDate()).padStart(2, '0')}/${toDateObj.getFullYear()}`;

  await page.type('input[name*="From"]', fromDate);
  await page.type('input[name*="To"]', toDate);

  console.log(`   From: ${fromDate}`);
  console.log(`   To: ${toDate}`);

  console.log('\n⏸️  Browser will stay open for 20 seconds to inspect the form...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  await browser.close();
  console.log('\n✅ Test complete');
})();
