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

  console.log('\n🔍 Checking all frames...\n');
  const frames = page.frames();
  console.log('Total frames:', frames.length);

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const url = frame.url();
    console.log(`\nFrame [${i}]: ${url.substring(0, 80)}`);

    if (url.includes('testsearch.hcad')) {
      console.log('  📍 This is the testsearch frame!');

      // Get HTML content
      const html = await frame.evaluate(() => document.body.innerHTML);
      console.log('  HTML length:', html.length);
      console.log('  First 500 chars:', html.substring(0, 500));

      // Check for nested iframes
      const nestedIframes = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id
        }));
      });

      console.log('  Nested iframes:', nestedIframes.length);
      nestedIframes.forEach(iframe => {
        console.log(`    - ${iframe.src} (id: ${iframe.id})`);
      });

      // Check for radio buttons
      const radios = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('input[type="radio"]')).map(r => ({
          value: r.value,
          name: r.name,
          label: r.parentElement?.textContent?.trim().substring(0, 30)
        }));
      });

      console.log('  Radio buttons:', radios.length);
      radios.forEach(r => console.log(`    - ${r.label} (value: ${r.value})`));

      // Check all inputs
      const allInputs = await frame.evaluate(() => {
        return Array.from(document.querySelectorAll('input, textarea, select')).map(el => ({
          tag: el.tagName,
          type: el.type,
          name: el.name,
          id: el.id
        }));
      });

      console.log('  All form elements:', allInputs.length);
      allInputs.forEach(el => console.log(`    - ${el.tag} type=${el.type} name=${el.name} id=${el.id}`));
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
