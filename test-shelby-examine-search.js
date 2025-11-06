#!/usr/bin/env node

/**
 * Examine the Shelby County search page to find correct selectors
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function examineSearchPage() {
  console.log('🔍 Examining Shelby County search page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    console.log('📍 Navigating to Property Assessor...');
    await page.goto('https://www.assessormelvinburgess.com/propertySearch', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    await page.screenshot({ path: 'shelby-search-page.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-search-page.png\n');

    // Examine page structure
    const pageInfo = await page.evaluate(() => {
      const results = {
        allInputs: [],
        allButtons: [],
        allForms: [],
        bodyText: document.body.innerText.substring(0, 500)
      };

      // Find all input fields
      document.querySelectorAll('input').forEach(input => {
        results.allInputs.push({
          type: input.type,
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          label: input.labels?.[0]?.textContent?.trim() || ''
        });
      });

      // Find all buttons
      document.querySelectorAll('button').forEach(btn => {
        results.allButtons.push({
          type: btn.type,
          text: btn.textContent.trim(),
          onclick: !!btn.onclick
        });
      });

      // Find all forms
      document.querySelectorAll('form').forEach(form => {
        results.allForms.push({
          action: form.action,
          method: form.method,
          inputCount: form.querySelectorAll('input').length
        });
      });

      return results;
    });

    console.log('📊 Search Page Analysis:\n');

    console.log('1️⃣  Input fields found:');
    pageInfo.allInputs.forEach((input, i) => {
      console.log(`   ${i + 1}. type="${input.type}" name="${input.name}" id="${input.id}"`);
      if (input.placeholder) console.log(`      placeholder="${input.placeholder}"`);
      if (input.label) console.log(`      label="${input.label}"`);
    });
    console.log(`   Total: ${pageInfo.allInputs.length}\n`);

    console.log('2️⃣  Buttons found:');
    pageInfo.allButtons.forEach((btn, i) => {
      console.log(`   ${i + 1}. "${btn.text}" (type: ${btn.type})`);
    });
    console.log(`   Total: ${pageInfo.allButtons.length}\n`);

    console.log('3️⃣  Forms found:');
    pageInfo.allForms.forEach((form, i) => {
      console.log(`   ${i + 1}. action="${form.action}" method="${form.method}" (${form.inputCount} inputs)`);
    });
    console.log(`   Total: ${pageInfo.allForms.length}\n`);

    console.log('4️⃣  Page text preview:');
    console.log(pageInfo.bodyText);
    console.log('\n');

    console.log('✅ Analysis complete! Check shelby-search-page.png');
    console.log('\n⏸️  Keeping browser open for 2 minutes for manual inspection...');

    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await browser.close();
    console.log('\n🏁 Done');
  }
}

examineSearchPage().catch(console.error);
