/**
 * Debug HCAD Page Structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugHCAD() {
  console.log('🔍 Debugging HCAD page structure...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('📍 Navigating to HCAD...');
    await page.goto('https://hcad.org/property-search/property-search', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: 'hcad-page.png', fullPage: true });
    console.log('📸 Screenshot saved: hcad-page.png');

    // Get all input fields
    console.log('\n📋 Finding all input fields:');
    const inputs = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll('input'));
      return allInputs.map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        className: input.className,
        outerHTML: input.outerHTML.substring(0, 200)
      }));
    });

    console.log(JSON.stringify(inputs, null, 2));

    // Get all buttons
    console.log('\n🔘 Finding all buttons:');
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      return allButtons.map(btn => ({
        type: btn.type,
        text: btn.textContent?.trim() || btn.value,
        className: btn.className,
        outerHTML: btn.outerHTML.substring(0, 200)
      }));
    });

    console.log(JSON.stringify(buttons, null, 2));

    // Get page HTML structure
    console.log('\n📄 Page structure:');
    const structure = await page.evaluate(() => {
      return {
        title: document.title,
        forms: Array.from(document.querySelectorAll('form')).length,
        inputs: Array.from(document.querySelectorAll('input')).length,
        buttons: Array.from(document.querySelectorAll('button')).length,
        bodyText: document.body.innerText.substring(0, 500)
      };
    });

    console.log(JSON.stringify(structure, null, 2));

    // Save full HTML
    const html = await page.content();
    fs.writeFileSync('hcad-page.html', html);
    console.log('\n💾 Full HTML saved: hcad-page.html');

    console.log('\n⏸️  Pausing for manual inspection (press Ctrl+C when done)...');
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugHCAD().catch(console.error);
