/**
 * Diagnostic script to inspect buttons on Lee County Property Appraiser after entering address
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function inspectButtons() {
  console.log('🔍 Inspecting Lee County Property Appraiser buttons...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'https://www.leepa.org/Search/PropertySearch.aspx';
  console.log(`📍 Navigating to: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log(`✅ Page loaded\n`);

  // Wait a bit
  await new Promise(r => setTimeout(r, 3000));

  // Find address input
  const addressInputSelectors = [
    'input[id*="txtStreetAddress"]',
    'input[name*="txtStreetAddress"]',
    'input[id*="StreetAddress"]',
    'input[placeholder*="Street"]',
    'input[name*="Address"]',
    'input[type="text"]'
  ];

  let addressInput = null;
  for (const selector of addressInputSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000, visible: true });
      addressInput = selector;
      console.log(`✅ Found street address input: ${selector}`);
      break;
    } catch (e) {
      console.log(`⚠️  Selector not found: ${selector}`);
    }
  }

  if (!addressInput) {
    console.log('❌ Could not find address input');
    await browser.close();
    return;
  }

  // Enter test address
  const testAddress = '503 NORIDGE DR';
  console.log(`\n📝 Entering address: ${testAddress}\n`);

  await page.click(addressInput);
  await new Promise(r => setTimeout(r, 500));

  await page.evaluate((selector) => {
    const input = document.querySelector(selector);
    if (input) input.value = '';
  }, addressInput);

  await page.type(addressInput, testAddress, { delay: 100 });

  console.log(`✅ Address entered\n`);
  await new Promise(r => setTimeout(r, 2000));

  // Inspect all buttons
  const buttonInfo = await page.evaluate(() => {
    const info = {
      submitInputs: [],
      buttons: [],
      allInteractive: []
    };

    // Get all input[type="submit"]
    const submitInputs = Array.from(document.querySelectorAll('input[type="submit"]'));
    submitInputs.forEach(btn => {
      const style = window.getComputedStyle(btn);
      info.submitInputs.push({
        value: btn.value,
        id: btn.id,
        name: btn.name,
        className: btn.className,
        visible: style.display !== 'none' && style.visibility !== 'hidden',
        display: style.display,
        visibility: style.visibility
      });
    });

    // Get all buttons
    const buttons = Array.from(document.querySelectorAll('button'));
    buttons.forEach(btn => {
      const style = window.getComputedStyle(btn);
      info.buttons.push({
        text: btn.textContent?.trim(),
        type: btn.type,
        id: btn.id,
        name: btn.name,
        className: btn.className,
        visible: style.display !== 'none' && style.visibility !== 'hidden',
        display: style.display,
        visibility: style.visibility
      });
    });

    // Get all potentially interactive elements
    const allElements = document.querySelectorAll('input, button, a');
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const text = (el.textContent || el.value || '').trim().toLowerCase();
      const id = (el.id || '').toLowerCase();
      const name = (el.name || '').toLowerCase();

      if (text.includes('search') || id.includes('search') || name.includes('search') ||
          text.includes('submit') || id.includes('submit') || name.includes('submit')) {
        info.allInteractive.push({
          tag: el.tagName,
          type: el.type,
          text: el.textContent?.trim() || el.value || '',
          id: el.id,
          name: el.name,
          className: el.className,
          visible: style.display !== 'none' && style.visibility !== 'hidden',
          display: style.display,
          visibility: style.visibility
        });
      }
    });

    return info;
  });

  console.log('📊 Button Detection Results:');
  console.log('='.repeat(80));

  console.log('\n📋 Submit Inputs (input[type="submit"]):');
  if (buttonInfo.submitInputs.length > 0) {
    buttonInfo.submitInputs.forEach((btn, i) => {
      console.log(`  [${i + 1}] ${btn.value}`);
      console.log(`      ID: ${btn.id}`);
      console.log(`      Name: ${btn.name}`);
      console.log(`      Class: ${btn.className}`);
      console.log(`      Visible: ${btn.visible}`);
      console.log(`      Display: ${btn.display}`);
      console.log(`      Visibility: ${btn.visibility}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🔘 Buttons (button elements):');
  if (buttonInfo.buttons.length > 0) {
    buttonInfo.buttons.forEach((btn, i) => {
      console.log(`  [${i + 1}] "${btn.text}"`);
      console.log(`      Type: ${btn.type}`);
      console.log(`      ID: ${btn.id}`);
      console.log(`      Name: ${btn.name}`);
      console.log(`      Class: ${btn.className}`);
      console.log(`      Visible: ${btn.visible}`);
      console.log(`      Display: ${btn.display}`);
      console.log(`      Visibility: ${btn.visibility}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🔍 All Search/Submit Related Elements:');
  if (buttonInfo.allInteractive.length > 0) {
    buttonInfo.allInteractive.forEach((el, i) => {
      console.log(`  [${i + 1}] <${el.tag.toLowerCase()}${el.type ? ` type="${el.type}"` : ''}>`);
      console.log(`      Text/Value: "${el.text}"`);
      console.log(`      ID: ${el.id}`);
      console.log(`      Name: ${el.name}`);
      console.log(`      Class: ${el.className}`);
      console.log(`      Visible: ${el.visible}`);
      console.log(`      Display: ${el.display}`);
      console.log(`      Visibility: ${el.visibility}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n⏸️  Keeping browser open for manual inspection...');
  console.log('Press Ctrl+C to exit\n');

  // Keep browser open
  await new Promise(() => {});
}

inspectButtons().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
