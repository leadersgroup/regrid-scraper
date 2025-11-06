/**
 * Try entering full address in single field
 */

const { chromium } = require('playwright');

async function testFullAddress() {
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

    // Get all visible input fields and log them
    const fieldInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return inputs
        .filter(i => i.offsetParent !== null)
        .map(i => ({
          id: i.id,
          name: i.name,
          placeholder: i.placeholder,
          value: i.value
        }));
    });

    console.log('📋 Visible input fields:');
    fieldInfo.forEach((f, i) => {
      console.log(`   ${i + 1}. id: ${f.id}, name: ${f.name}, placeholder: ${f.placeholder}`);
    });

    // Method 1: Try entering full address in first visible field
    console.log('\n🔍 Method 1: Full address in first field\n');

    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const visibleInputs = inputs.filter(i => i.offsetParent !== null);

      if (visibleInputs[0]) {
        visibleInputs[0].value = '6241 Del Sol Dr';
        visibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
        visibleInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    console.log('✅ Entered "6241 Del Sol Dr" in first field\n');
    await page.waitForTimeout(2000);

    // Submit
    await page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) {
        form.submit();
      }
    });

    console.log('✅ Submitted form\n');
    await page.waitForTimeout(5000);

    // Check for results
    const check1 = await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          return { found: true, parcel: firstLine };
        }
      }

      const hasNoData = document.body.innerText.includes('No data to display');
      return { found: false, hasNoData };
    });

    console.log('📊 Result:', JSON.stringify(check1));

    if (check1.found) {
      console.log('\n✅ SUCCESS! Found parcel card\n');
    } else {
      console.log('\n❌ Method 1 failed, trying Method 2...\n');

      //Go back and try different approach
      await page.goto('https://portal.padctn.org/OFS/WP/Home', {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      await page.waitForTimeout(3000);

      // Select Address mode again
      await page.selectOption('#inputGroupSelect01', '2');
      await page.waitForTimeout(3000);

      // Method 2: Number in streetNumber, street in singleSearchCriteria by ID
      console.log('🔍 Method 2: Using specific field IDs\n');

      await page.evaluate(() => {
        const numField = document.querySelector('#streetNumber');
        const streetField = document.querySelector('#singleSearchCriteria');

        if (numField) {
          numField.value = '6241';
          numField.dispatchEvent(new Event('input', { bubbles: true }));
          numField.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Set #streetNumber to 6241');
        } else {
          console.log('⚠️ #streetNumber not found');
        }

        if (streetField) {
          streetField.value = 'Del Sol';
          streetField.dispatchEvent(new Event('input', { bubbles: true }));
          streetField.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Set #singleSearchCriteria to Del Sol');
        } else {
          console.log('⚠️ #singleSearchCriteria not found');
        }
      });

      await page.waitForTimeout(2000);

      // Check field values before submit
      const fieldValues = await page.evaluate(() => {
        const numField = document.querySelector('#streetNumber');
        const streetField = document.querySelector('#singleSearchCriteria');

        return {
          streetNumber: numField ? numField.value : 'NOT FOUND',
          singleSearchCriteria: streetField ? streetField.value : 'NOT FOUND'
        };
      });

      console.log('📋 Field values before submit:');
      console.log(JSON.stringify(fieldValues, null, 2));

      // Submit
      await page.evaluate(() => {
        const form = document.querySelector('#frmQuick');
        if (form) {
          form.submit();
        }
      });

      console.log('\n✅ Submitted form\n');
      await page.waitForTimeout(5000);

      // Check for results again
      const check2 = await page.evaluate(() => {
        const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

        for (const el of allElements) {
          const text = (el.textContent || '').trim();
          const firstLine = text.split('\n')[0].trim();
          if (pattern.test(firstLine)) {
            return { found: true, parcel: firstLine };
          }
        }

        const hasNoData = document.body.innerText.includes('No data to display');
        return { found: false, hasNoData, bodySnippet: document.body.innerText.substring(0, 500) };
      });

      console.log('📊 Result:', JSON.stringify(check2, null, 2));
    }

    await page.screenshot({ path: '/tmp/davidson-full-address.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-full-address.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testFullAddress().catch(console.error);
