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

  // Get iframe
  const frames = page.frames();
  let searchFrame;
  for (const frame of frames) {
    if (frame.url().includes('testsearch.hcad')) {
      searchFrame = frame;
      break;
    }
  }

  console.log('✅ Found search frame');

  // Click Property Address radio
  await searchFrame.evaluate(() => {
    const radios = Array.from(document.querySelectorAll('input[type="radio"]'));
    for (const radio of radios) {
      const label = radio.parentElement?.textContent || '';
      if (label.includes('Property Address')) {
        radio.click();
        return;
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Enter address
  const input = await searchFrame.$('input[type="search"]');
  await input.type('5019 Lymbar Dr', { delay: 50 });

  console.log('✅ Entered address');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Click search button
  await searchFrame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      if (btn.innerHTML.includes('search') || btn.getAttribute('aria-label')?.includes('search')) {
        btn.click();
        return;
      }
    }
  });

  console.log('✅ Clicked search');

  // Wait for results
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('\n🔍 Checking for results...\n');

  // Get all links with text content
  const links = await searchFrame.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim(),
      href: a.href
    })).filter(l => l.text && l.text.length > 0);
  });

  console.log('Total links in results:', links.length);
  console.log('\nLinks with numbers:');
  links.forEach(link => {
    if (/\d/.test(link.text)) {
      console.log(` - "${link.text}" => ${link.href.substring(0, 80)}`);
    }
  });

  // Get page text
  const text = await searchFrame.evaluate(() => document.body.innerText);
  console.log('\n📄 Page text (first 2000 chars):');
  console.log(text.substring(0, 2000));

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
