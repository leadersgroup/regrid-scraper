const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  console.log('📍 Loading HCAD...');
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

  if (!searchFrame) {
    console.error('❌ Could not find search iframe');
    await browser.close();
    return;
  }

  console.log('✅ Found search iframe');

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

  // Click search
  await searchFrame.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      if (btn.innerHTML.includes('search') || btn.getAttribute('aria-label')?.includes('search')) {
        btn.click();
        return;
      }
    }
  });

  console.log('✅ Clicked search, waiting 15 seconds...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('\n🔍 DIAGNOSTIC OUTPUT:\n');

  // Get all links
  const links = await searchFrame.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => ({
      text: a.textContent?.trim(),
      href: a.href
    })).filter(l => l.text && l.text.length > 0);
  });

  console.log(`Found ${links.length} links:`);
  links.forEach((link, i) => {
    if (i < 20) {  // Show first 20 links
      console.log(`  [${i}] "${link.text}"`);
    }
  });

  // Get page text
  const pageText = await searchFrame.evaluate(() => document.body.innerText);
  console.log('\n📄 Full page text:');
  console.log(pageText);

  console.log('\n⏸️  Browser will stay open for 60 seconds to inspect...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
