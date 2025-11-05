/**
 * Inspect the Duval County Property Appraiser page to find correct form selectors
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function inspectPage() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Navigating to Duval County Property Appraiser search page...');
    await page.goto('https://paopropertysearch.coj.net/Basic/Search.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\nPage loaded successfully!\n');
    await wait(3000);

    // Inspect all form fields
    const formFields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], select'));
      return inputs.map(el => ({
        tag: el.tagName,
        type: el.type,
        id: el.id,
        name: el.name,
        placeholder: el.placeholder || '',
        label: el.labels && el.labels[0] ? el.labels[0].textContent : ''
      }));
    });

    console.log('=== FORM FIELDS FOUND ===\n');
    formFields.forEach((field, index) => {
      console.log((index + 1) + '. ' + field.tag);
      console.log('   ID: ' + (field.id || '(none)'));
      console.log('   Name: ' + (field.name || '(none)'));
      console.log('   Type: ' + field.type);
      console.log('   Placeholder: ' + field.placeholder);
      console.log('   Label: ' + (field.label || '(none)'));
      console.log('');
    });

    // Look for buttons
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      return btns.map(el => ({
        tag: el.tagName,
        type: el.type,
        id: el.id,
        name: el.name,
        value: el.value || '',
        text: el.textContent || ''
      }));
    });

    console.log('\n=== BUTTONS FOUND ===\n');
    buttons.forEach((btn, index) => {
      console.log((index + 1) + '. ' + btn.tag);
      console.log('   ID: ' + (btn.id || '(none)'));
      console.log('   Name: ' + (btn.name || '(none)'));
      console.log('   Type: ' + btn.type);
      console.log('   Value: ' + btn.value);
      console.log('   Text: ' + btn.text.trim());
      console.log('');
    });

    console.log('\n\nBrowser will stay open for 5 minutes. Press Ctrl+C to close.\n');
    await wait(300000);

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

inspectPage();
