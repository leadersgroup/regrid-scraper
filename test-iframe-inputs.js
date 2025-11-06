const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.goto('https://hcad.org/property-search/property-search', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  const frameHandle = await page.$('iframe#parentIframe');
  const frame = await frameHandle.contentFrame();

  console.log('\n🔍 All input elements in iframe:\n');
  const inputs = await frame.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      value: input.value,
      placeholder: input.placeholder,
      visible: input.offsetParent !== null
    }));
  });

  console.log('Inputs:', JSON.stringify(inputs, null, 2));

  console.log('\n🎯 Clicking Property Address radio...\n');
  await frame.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    for (const radio of radios) {
      const label = radio.parentElement?.textContent || '';
      if (label.includes('Property Address')) {
        radio.click();
        return;
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('\n🔍 After clicking radio:\n');
  const inputsAfter = await frame.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      value: input.value,
      placeholder: input.placeholder,
      visible: input.offsetParent !== null
    }));
  });

  console.log('Inputs after:', JSON.stringify(inputsAfter, null, 2));

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
