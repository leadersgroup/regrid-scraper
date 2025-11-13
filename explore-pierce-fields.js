/**
 * Explore Pierce County search fields AFTER disclaimer
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreAfterDisclaimer() {
  console.log('🔍 Exploring Pierce County fields after disclaimer\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📍 Step 1: Navigate to Pierce County...');
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`Current URL: ${page.url()}`);

    // Check if there's a disclaimer
    console.log('\n📍 Step 2: Looking for disclaimer...');
    const disclaimerFound = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent.toLowerCase();
        if (text.includes('click here to acknowledge') ||
            (text.includes('acknowledge') && text.includes('disclaimer'))) {
          console.log(`Found disclaimer link: "${link.textContent.trim()}"`);
          link.click();
          return true;
        }
      }
      return false;
    });

    if (disclaimerFound) {
      console.log('✅ Clicked disclaimer, waiting for page to load...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`New URL: ${page.url()}`);
    } else {
      console.log('⚠️  No disclaimer found');
    }

    // Now look for ALL input fields
    console.log('\n📍 Step 3: Looking for input fields on search page...\n');
    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      return inputs.map(input => {
        // Get label by looking at surrounding elements
        let label = '';

        // Check for label element
        const labelEl = document.querySelector(`label[for="${input.id}"]`);
        if (labelEl) {
          label = labelEl.textContent.trim();
        }

        // Check parent or preceding siblings
        if (!label) {
          const parent = input.parentElement;
          const prevSibling = input.previousElementSibling;

          if (prevSibling && prevSibling.textContent) {
            label = prevSibling.textContent.trim().substring(0, 50);
          } else if (parent && parent.textContent) {
            // Get parent text but remove this input's value
            const parentText = parent.textContent.replace(input.value, '').trim();
            label = parentText.substring(0, 50);
          }
        }

        return {
          id: input.id,
          name: input.name,
          type: input.type,
          value: input.value,
          label: label,
          placeholder: input.placeholder || ''
        };
      });
    });

    console.log(`Found ${fields.length} text input fields:\n`);
    fields.forEach((field, i) => {
      console.log(`${i + 1}. "${field.label}"`);
      console.log(`   ID: ${field.id || '(none)'}`);
      console.log(`   Name: ${field.name || '(none)'}`);
      console.log(`   Type: ${field.type}`);
      console.log(`   Placeholder: ${field.placeholder || '(none)'}`);
      console.log('');
    });

    // Look specifically for parcel-related fields
    console.log('\n📍 Step 4: Looking specifically for Parcel field...\n');
    const parcelField = await page.evaluate(() => {
      // Strategy 1: Look for input with "parcel" in id or name
      let input = document.querySelector('input[id*="arcel" i], input[name*="arcel" i]');

      if (input) {
        return {
          found: true,
          selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
          id: input.id,
          name: input.name,
          type: input.type
        };
      }

      // Strategy 2: Look for label with "Parcel" text and find associated input
      const labels = Array.from(document.querySelectorAll('label, span, td, th'));
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes('parcel')) {
          // Look for input in same row or nearby
          const row = label.closest('tr');
          if (row) {
            const input = row.querySelector('input[type="text"], input:not([type])');
            if (input) {
              return {
                found: true,
                selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
                id: input.id,
                name: input.name,
                type: input.type,
                labelText: label.textContent.trim()
              };
            }
          }
        }
      }

      return { found: false };
    });

    if (parcelField.found) {
      console.log('✅ Found Parcel field!');
      console.log(`   Selector: ${parcelField.selector}`);
      console.log(`   ID: ${parcelField.id}`);
      console.log(`   Name: ${parcelField.name}`);
      console.log(`   Type: ${parcelField.type}`);
      if (parcelField.labelText) {
        console.log(`   Label: ${parcelField.labelText}`);
      }
    } else {
      console.log('❌ Could not find Parcel field');
    }

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreAfterDisclaimer();
