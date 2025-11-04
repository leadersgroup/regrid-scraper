/**
 * Debug script to diagnose Miami-Dade property search issues
 * Address: 1637 NW 59th St, Miami, FL 33142, USA
 */

const MiamiDadeCountyFloridaScraper = require('./county-implementations/miami-dade-county-florida');
const fs = require('fs');
const path = require('path');

async function debugMiamiDadeSearch() {
  console.log('🔍 Debugging Miami-Dade County property search...\n');

  const testAddress = '1637 NW 59th St, Miami, FL 33142, USA';

  const scraper = new MiamiDadeCountyFloridaScraper({
    headless: false, // Run in visible mode to see what happens
    timeout: 120000,
    verbose: true
  });

  try {
    console.log(`📍 Test address: ${testAddress}\n`);

    // Initialize scraper
    await scraper.initialize();
    console.log('✅ Browser initialized\n');

    // Navigate to property search
    console.log('🌐 Navigating to Miami-Dade Property Search...');
    await scraper.page.goto('https://apps.miamidadepa.gov/propertysearch/', {
      waitUntil: 'networkidle2',
      timeout: scraper.timeout
    });

    // Wait for page to load
    await scraper.randomWait(3000, 5000);

    // Take screenshot of initial page
    const screenshotsDir = path.join(__dirname, 'debug-screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    await scraper.page.screenshot({
      path: path.join(screenshotsDir, '01-miami-initial-page.png'),
      fullPage: true
    });
    console.log('📸 Screenshot saved: 01-miami-initial-page.png');

    // Debug: Get page structure
    const pageInfo = await scraper.page.evaluate(() => {
      return {
        title: document.title,
        url: window.location.href,
        inputFields: Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          id: input.id,
          name: input.name,
          placeholder: input.placeholder,
          className: input.className
        })),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim().substring(0, 50),
          id: btn.id,
          className: btn.className,
          type: btn.type
        }))
      };
    });

    console.log('\n📋 Page Information:');
    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   URL: ${pageInfo.url}`);
    console.log(`\n🔤 Input Fields Found (${pageInfo.inputFields.length}):`);
    pageInfo.inputFields.forEach((input, idx) => {
      console.log(`   ${idx + 1}. Type: ${input.type}, ID: ${input.id}, Name: ${input.name}, Placeholder: ${input.placeholder}`);
    });
    console.log(`\n🔘 Buttons Found (${pageInfo.buttons.length}):`);
    pageInfo.buttons.forEach((btn, idx) => {
      console.log(`   ${idx + 1}. Text: "${btn.text}", Type: ${btn.type}, ID: ${btn.id}`);
    });

    // Extract street address
    const streetAddress = testAddress.split(',')[0].trim();
    console.log(`\n🏠 Street address to search: "${streetAddress}"`);

    // Try to find the address input field
    console.log('\n🔍 Looking for address input field...');

    const addressInputSelectors = [
      'input#propertyAddressInput',
      'input[name*="address"]',
      'input[placeholder*="Address"]',
      'input[placeholder*="address"]',
      'input[id*="address"]',
      'input[id*="Address"]',
      'input[type="text"]'
    ];

    let addressInput = null;
    for (const selector of addressInputSelectors) {
      try {
        await scraper.page.waitForSelector(selector, { timeout: 3000 });
        addressInput = selector;
        console.log(`✅ Found address input with selector: ${selector}`);

        // Get more details about this input
        const inputDetails = await scraper.page.evaluate((sel) => {
          const elem = document.querySelector(sel);
          return {
            visible: elem.offsetParent !== null,
            disabled: elem.disabled,
            readonly: elem.readOnly,
            value: elem.value,
            outerHTML: elem.outerHTML.substring(0, 200)
          };
        }, selector);
        console.log(`   Details:`, inputDetails);
        break;
      } catch (e) {
        console.log(`   ❌ Selector "${selector}" not found`);
      }
    }

    if (!addressInput) {
      console.log('\n❌ ERROR: Could not find address input field!');
      await scraper.page.screenshot({
        path: path.join(screenshotsDir, '02-miami-no-input-found.png'),
        fullPage: true
      });
      console.log('📸 Screenshot saved: 02-miami-no-input-found.png');

      // Save HTML for debugging
      const html = await scraper.page.content();
      fs.writeFileSync(path.join(screenshotsDir, 'page-source.html'), html);
      console.log('💾 Page HTML saved: page-source.html');

      await scraper.close();
      return;
    }

    // Type in the address
    console.log(`\n⌨️  Typing address: "${streetAddress}"`);
    await scraper.page.click(addressInput);
    await scraper.randomWait(500, 1000);
    await scraper.page.type(addressInput, streetAddress, { delay: 100 });

    await scraper.randomWait(2000, 3000);

    // Take screenshot after typing
    await scraper.page.screenshot({
      path: path.join(screenshotsDir, '03-miami-after-typing.png'),
      fullPage: true
    });
    console.log('📸 Screenshot saved: 03-miami-after-typing.png');

    // Check for autocomplete dropdown
    console.log('\n🔍 Checking for autocomplete dropdown...');
    const autocompleteInfo = await scraper.page.evaluate(() => {
      const dropdownSelectors = [
        'ul.ui-autocomplete',
        'ul.autocomplete-results',
        '.dropdown-menu',
        '[role="listbox"]',
        'ul li',
        '.ui-menu-item'
      ];

      for (const selector of dropdownSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return {
            found: true,
            selector: selector,
            count: elements.length,
            items: Array.from(elements).slice(0, 5).map(el => ({
              text: (el.textContent || '').trim().substring(0, 100),
              visible: el.offsetParent !== null
            }))
          };
        }
      }

      return { found: false };
    });

    if (autocompleteInfo.found) {
      console.log(`✅ Found autocomplete dropdown: ${autocompleteInfo.selector}`);
      console.log(`   Items (${autocompleteInfo.count}):`);
      autocompleteInfo.items.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.text} (visible: ${item.visible})`);
      });

      // Try to click first visible item
      console.log('\n🖱️  Attempting to click first autocomplete item...');
      const clicked = await scraper.page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('ul li, .autocomplete-item, .dropdown-item, .ui-menu-item, div[role="option"]'));
        for (const item of items) {
          if (item.offsetParent !== null) { // is visible
            const text = (item.textContent || '').trim();
            if (text.length > 5) {
              item.click();
              return { clicked: true, text: text.substring(0, 100) };
            }
          }
        }
        return { clicked: false };
      });

      if (clicked.clicked) {
        console.log(`✅ Clicked: "${clicked.text}"`);
        await scraper.randomWait(3000, 5000);

        await scraper.page.screenshot({
          path: path.join(screenshotsDir, '04-miami-after-autocomplete.png'),
          fullPage: true
        });
        console.log('📸 Screenshot saved: 04-miami-after-autocomplete.png');
      } else {
        console.log('❌ Could not click autocomplete item');
      }
    } else {
      console.log('ℹ️  No autocomplete dropdown found - will try search button');

      // Try to find and click search button
      console.log('\n🔍 Looking for search button...');
      const searchButtonSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button.btn-primary',
        'button:contains("Search")',
        'input[value*="Search"]'
      ];

      let searchClicked = false;
      for (const selector of searchButtonSelectors) {
        try {
          await scraper.page.waitForSelector(selector, { timeout: 2000 });
          await scraper.page.click(selector);
          console.log(`✅ Clicked search button: ${selector}`);
          searchClicked = true;
          break;
        } catch (e) {
          console.log(`   ❌ Search button "${selector}" not found or not clickable`);
        }
      }

      if (!searchClicked) {
        console.log('ℹ️  No search button clicked, trying Enter key...');
        await scraper.page.keyboard.press('Enter');
        console.log('⌨️  Pressed Enter');
      }

      await scraper.randomWait(3000, 5000);

      await scraper.page.screenshot({
        path: path.join(screenshotsDir, '05-miami-after-search.png'),
        fullPage: true
      });
      console.log('📸 Screenshot saved: 05-miami-after-search.png');
    }

    // Wait for results to load
    console.log('\n⏳ Waiting for property details to load...');
    await scraper.randomWait(5000, 7000);

    // Check what's on the page now
    const propertyInfo = await scraper.page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return {
        url: window.location.href,
        title: document.title,
        hasPropertyInfo: bodyText.includes('folio') ||
                        bodyText.includes('property information') ||
                        bodyText.includes('owner name') ||
                        bodyText.includes('sales information'),
        hasError: bodyText.includes('no results') ||
                 bodyText.includes('not found') ||
                 bodyText.includes('no matches'),
        bodyTextSample: document.body.innerText.substring(0, 500)
      };
    });

    console.log('\n📊 Property Page Check:');
    console.log(`   URL: ${propertyInfo.url}`);
    console.log(`   Title: ${propertyInfo.title}`);
    console.log(`   Has Property Info: ${propertyInfo.hasPropertyInfo}`);
    console.log(`   Has Error: ${propertyInfo.hasError}`);
    console.log(`\n   Page Text Sample:`);
    console.log(`   "${propertyInfo.bodyTextSample}"`);

    await scraper.page.screenshot({
      path: path.join(screenshotsDir, '06-miami-final-page.png'),
      fullPage: true
    });
    console.log('\n📸 Final screenshot saved: 06-miami-final-page.png');

    // Save final HTML
    const finalHtml = await scraper.page.content();
    fs.writeFileSync(path.join(screenshotsDir, 'final-page-source.html'), finalHtml);
    console.log('💾 Final page HTML saved: final-page-source.html');

    console.log('\n' + '='.repeat(80));
    if (propertyInfo.hasPropertyInfo) {
      console.log('✅ SUCCESS: Property information found on page!');
    } else {
      console.log('❌ FAILURE: Property information NOT found on page');
    }
    console.log('='.repeat(80));

    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will stay open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    await scraper.close();

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await scraper.close();
    process.exit(1);
  }
}

// Run debug
debugMiamiDadeSearch()
  .then(() => {
    console.log('\n✅ Debug completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Debug failed:', error);
    process.exit(1);
  });
