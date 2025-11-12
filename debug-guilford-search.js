/**
 * Debug script for Guilford County search
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugGuilfordSearch() {
  console.log('🔍 Debugging Guilford County search...\n');

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
    console.log('📍 Navigating to Guilford County...');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot of initial page
    await page.screenshot({ path: 'guilford-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: guilford-initial.png');

    // Check for Location address option
    console.log('\n🔍 Looking for Location address option...');
    const locationAddressInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const results = [];

      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text.toLowerCase().includes('location') && text.toLowerCase().includes('address')) {
          results.push({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            text: text.substring(0, 100),
            type: el.type,
            name: el.name
          });
        }
      }

      // Also check for radio buttons
      const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
      const radioInfo = radios.map(r => ({
        id: r.id,
        name: r.name,
        value: r.value,
        labelText: document.querySelector(`label[for="${r.id}"]`)?.textContent || ''
      }));

      return { locationElements: results, radios: radioInfo };
    });

    console.log('Location address elements found:', JSON.stringify(locationAddressInfo, null, 2));

    // Check for input fields
    console.log('\n🔍 Looking for input fields...');
    const inputFields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return inputs.map(input => ({
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        className: input.className,
        labelText: input.labels?.[0]?.textContent || ''
      }));
    });

    console.log('Input fields found:', JSON.stringify(inputFields, null, 2));

    // Get page HTML for inspection
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    console.log('\n📄 Saving page HTML...');
    require('fs').writeFileSync('guilford-page.html', bodyHTML);
    console.log('✅ HTML saved: guilford-page.html');

    console.log('\n⏸️  Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close');

    // Keep browser open for manual inspection
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugGuilfordSearch().catch(console.error);
