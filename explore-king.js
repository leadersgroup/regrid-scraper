/**
 * Quick exploration of King County website structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function explore() {
  console.log('🔍 Exploring King County website...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📍 Navigating to King County Property Search...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n📋 Page Structure:');

    // Get all input fields
    const inputs = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll('input'));
      return allInputs.map(input => ({
        type: input.type,
        name: input.name || '',
        id: input.id || '',
        placeholder: input.placeholder || '',
        value: input.value || '',
        className: input.className || ''
      }));
    });

    console.log('\n🔤 Input Fields:');
    inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}`);
      if (input.name) console.log(`     Name: ${input.name}`);
      if (input.id) console.log(`     ID: ${input.id}`);
      if (input.placeholder) console.log(`     Placeholder: ${input.placeholder}`);
      if (input.className) console.log(`     Class: ${input.className}`);
      console.log('');
    });

    // Get all buttons
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      return allButtons.map(btn => ({
        text: btn.textContent || btn.value || '',
        type: btn.type || '',
        id: btn.id || '',
        name: btn.name || ''
      }));
    });

    console.log('\n🔘 Buttons:');
    buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. Text: "${btn.text}"`);
      if (btn.type) console.log(`     Type: ${btn.type}`);
      if (btn.id) console.log(`     ID: ${btn.id}`);
      if (btn.name) console.log(`     Name: ${btn.name}`);
      console.log('');
    });

    // Get all tabs
    const tabs = await page.evaluate(() => {
      const allTabs = Array.from(document.querySelectorAll('[role="tab"], a.tab, li.tab, div.tab'));
      return allTabs.map(tab => ({
        text: tab.textContent.trim(),
        role: tab.getAttribute('role') || '',
        className: tab.className || ''
      }));
    });

    console.log('\n📑 Tabs/Navigation:');
    tabs.forEach((tab, i) => {
      console.log(`  ${i + 1}. "${tab.text}"`);
      if (tab.role) console.log(`     Role: ${tab.role}`);
      if (tab.className) console.log(`     Class: ${tab.className}`);
      console.log('');
    });

    console.log('\n⏸️  Keeping browser open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

explore();
