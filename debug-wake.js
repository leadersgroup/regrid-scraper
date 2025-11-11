/**
 * Debug Wake County real estate website
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Wake County Real Estate Search...');
    await page.goto('https://services.wake.gov/realestate/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Analyze the page structure
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 500),

        // Find all input fields
        inputs: Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          className: input.className,
          visible: input.offsetParent !== null
        })),

        // Find all labels
        labels: Array.from(document.querySelectorAll('label')).map(label => ({
          text: label.textContent.trim(),
          for: label.getAttribute('for'),
          innerHTML: label.innerHTML
        })),

        // Find form elements
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          action: form.action,
          method: form.method
        }))
      };
    });

    console.log('\n=== PAGE ANALYSIS ===');
    console.log('URL:', analysis.url);
    console.log('Title:', analysis.title);
    console.log('\nBody preview:');
    console.log(analysis.bodyPreview);
    console.log('\n=== INPUT FIELDS ===');
    console.log(JSON.stringify(analysis.inputs, null, 2));
    console.log('\n=== LABELS ===');
    console.log(JSON.stringify(analysis.labels, null, 2));
    console.log('\n=== FORMS ===');
    console.log(JSON.stringify(analysis.forms, null, 2));

    console.log('\n\nWaiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
