/**
 * Explore Pierce County page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function explorePierce() {
  console.log('🔍 Exploring Pierce County page structure\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📍 Navigating to Pierce County search page...');
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n🔍 Looking for input fields...\n');

    const fields = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return inputs.map(input => ({
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        value: input.value,
        // Get preceding label text
        label: (() => {
          let label = input.previousElementSibling;
          while (label && label.tagName !== 'LABEL' && label.tagName !== 'TD' && label.tagName !== 'SPAN') {
            label = label.previousElementSibling;
          }
          return label ? label.textContent.trim() : '';
        })(),
        // Get parent context
        parentText: input.parentElement ? input.parentElement.textContent.substring(0, 100) : ''
      }));
    });

    console.log(`Found ${fields.length} input fields:\n`);
    fields.forEach((field, i) => {
      console.log(`${i + 1}. ID: ${field.id || '(none)'}`);
      console.log(`   Name: ${field.name || '(none)'}`);
      console.log(`   Label: ${field.label || '(none)'}`);
      console.log(`   Placeholder: ${field.placeholder || '(none)'}`);
      console.log(`   Parent text: ${field.parentText.substring(0, 50)}...`);
      console.log('');
    });

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

explorePierce();
