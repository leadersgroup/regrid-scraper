/**
 * Try the old www.ocpafl.org property search
 */

const puppeteer = require('puppeteer');

async function debugOldSearch() {
  console.log('🔍 Testing old OCPA property search\n');

  const parcelId = '27-23-24-5428-03-770';
  const parcelIdNoDashes = '272324542803770';

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {
    // Try the old parcel search page
    console.log('Navigating to old parcel search...');
    await page.goto('https://www.ocpafl.org/searches/ParcelSearch.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get page info
    const formInfo = await page.evaluate(() => {
      // Find all inputs
      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        value: i.value
      }));

      // Find all buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(b => ({
        id: b.id,
        name: b.name,
        value: b.value,
        text: b.textContent?.trim()
      }));

      return {
        inputs,
        buttons,
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });

    console.log('='.repeat(80));
    console.log('FORM INPUTS:');
    console.log('='.repeat(80));
    formInfo.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. ID: ${input.id}, Name: ${input.name}, Type: ${input.type}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('BUTTONS:');
    console.log('='.repeat(80));
    formInfo.buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. ID: ${btn.id}, Name: ${btn.name}, Value: ${btn.value}, Text: ${btn.text}`);
    });

    // Try to submit parcel ID - try both with and without dashes
    for (const pid of [parcelIdNoDashes, parcelId]) {
      console.log('\n' + '='.repeat(80));
      console.log(`Trying Parcel ID: ${pid}`);
      console.log('='.repeat(80));

      // Fill the parcel ID field
      const filled = await page.evaluate((pidToTry) => {
        // Look for parcel ID input
        const parcelInput = document.querySelector('input[name*="Parcel"]') ||
                           document.querySelector('input[id*="Parcel"]') ||
                           document.querySelector('input[name*="parcel"]') ||
                           document.querySelector('input[id*="parcel"]');

        if (parcelInput) {
          parcelInput.value = pidToTry;
          parcelInput.focus();
          parcelInput.dispatchEvent(new Event('input', { bubbles: true }));
          parcelInput.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, pid);

      if (!filled) {
        console.log('Could not find parcel input field');
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Click search button
      const clicked = await page.evaluate(() => {
        const searchBtn = document.querySelector('input[value*="Search"]') ||
                         document.querySelector('button[type="submit"]') ||
                         document.querySelector('input[type="submit"]');

        if (searchBtn) {
          searchBtn.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        console.log('Could not find search button');
        continue;
      }

      console.log('Waiting for results...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const resultInfo = await page.evaluate((pidToCheck) => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 3000),
          hasParcelId: document.body.innerText.includes(pidToCheck.replace(/-/g, ''))
        };
      }, pid);

      console.log(`URL: ${resultInfo.url}`);
      console.log(`Title: ${resultInfo.title}`);
      console.log(`Has Parcel ID: ${resultInfo.hasParcelId ? 'YES ✓' : 'NO'}`);

      if (resultInfo.hasParcelId) {
        console.log('\n✓✓✓ FOUND PROPERTY! ✓✓✓');
        console.log('\nPage Content:');
        console.log(resultInfo.bodyText);
        break;
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugOldSearch();
