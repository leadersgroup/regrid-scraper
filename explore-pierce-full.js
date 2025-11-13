/**
 * Full exploration of Pierce County site to understand login requirements
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreFull() {
  console.log('🔍 Full Pierce County site exploration\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📍 Step 1: Navigating to main page...');
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    const url = page.url();
    console.log(`Current URL: ${url}`);

    // Check if redirected to login
    const isLoginPage = await page.evaluate(() => {
      const html = document.documentElement.outerHTML.toLowerCase();
      return html.includes('login') && html.includes('password');
    });

    console.log(`Login page detected: ${isLoginPage}\n`);

    if (isLoginPage) {
      console.log('⚠️  Site requires login/authentication\n');

      // Look for all form elements
      const formInfo = await page.evaluate(() => {
        const forms = Array.from(document.querySelectorAll('form'));
        return forms.map(form => ({
          action: form.action,
          method: form.method,
          inputs: Array.from(form.querySelectorAll('input')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          }))
        }));
      });

      console.log('Form details:');
      console.log(JSON.stringify(formInfo, null, 2));
    } else {
      console.log('✅ No login required, searching for parcel field...\n');

      const allInputs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
          tag: el.tagName,
          type: el.type || el.tagName,
          id: el.id,
          name: el.name,
          placeholder: el.placeholder,
          labels: Array.from(document.querySelectorAll('label')).filter(label =>
            label.htmlFor === el.id ||
            label.textContent.toLowerCase().includes('parcel')
          ).map(l => l.textContent.trim())
        }));
      });

      console.log('All form elements:');
      console.log(JSON.stringify(allInputs, null, 2));
    }

    console.log('\n⏸️  Browser will stay open for 90 seconds - please manually check the page...');
    await new Promise(resolve => setTimeout(resolve, 90000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreFull();
