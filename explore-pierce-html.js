/**
 * Explore Pierce County HTML structure to find Parcel field
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreHTML() {
  console.log('🔍 Exploring Pierce County HTML structure\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📍 Navigating and acknowledging disclaimer...');
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click disclaimer
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent.toLowerCase();
        if (text.includes('click here to acknowledge')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (clicked) {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`✅ At: ${page.url()}\n`);

    // Get ALL table cells and look for "Parcel #:"
    const parcelInfo = await page.evaluate(() => {
      // Look for any text that says "Parcel #" or "Parcel #:"
      const allElements = Array.from(document.querySelectorAll('*'));

      for (const el of allElements) {
        // Get direct text content (not including children)
        const text = Array.from(el.childNodes)
          .filter(node => node.nodeType === Node.TEXT_NODE)
          .map(node => node.textContent.trim())
          .join(' ');

        if (text.includes('Parcel #') || text.includes('Parcel#')) {
          // Found element with "Parcel #" text
          // Look for nearby input field
          const parent = el.parentElement;
          const row = el.closest('tr');

          let input = null;

          // Try to find input in same table row
          if (row) {
            input = row.querySelector('input[type="text"], input:not([type="hidden"])');
          }

          // Try next sibling
          if (!input && el.nextElementSibling) {
            input = el.nextElementSibling.querySelector ?
                   el.nextElementSibling.querySelector('input') :
                   (el.nextElementSibling.tagName === 'INPUT' ? el.nextElementSibling : null);
          }

          // Try parent's next sibling
          if (!input && parent && parent.nextElementSibling) {
            input = parent.nextElementSibling.querySelector('input');
          }

          if (input) {
            return {
              found: true,
              labelText: text,
              labelTag: el.tagName,
              inputId: input.id || '',
              inputName: input.name || '',
              inputType: input.type || '',
              rowHTML: row ? row.outerHTML.substring(0, 500) : 'N/A'
            };
          }
        }
      }

      return { found: false };
    });

    if (parcelInfo.found) {
      console.log('✅ Found Parcel # field!');
      console.log(`   Label Text: "${parcelInfo.labelText}"`);
      console.log(`   Label Tag: ${parcelInfo.labelTag}`);
      console.log(`   Input ID: ${parcelInfo.inputId || '(none)'}`);
      console.log(`   Input Name: ${parcelInfo.inputName || '(none)'}`);
      console.log(`   Input Type: ${parcelInfo.inputType}`);
      console.log(`\n   Row HTML (first 500 chars):`);
      console.log(`   ${parcelInfo.rowHTML}`);
    } else {
      console.log('❌ Could not find "Parcel #" text on page');

      // Print ALL visible text to help debug
      console.log('\n📝 All visible text on page (first 2000 chars):');
      const pageText = await page.evaluate(() => {
        return document.body.innerText.substring(0, 2000);
      });
      console.log(pageText);
    }

    console.log('\n⏸️  Browser staying open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreHTML();
