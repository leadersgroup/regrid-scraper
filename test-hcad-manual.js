const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });
  const page = await browser.newPage();

  console.log('📍 Loading HCAD...');
  await page.goto('https://hcad.org/property-search/property-search', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  console.log('\n⏸️  MANUAL TEST');
  console.log('================================================================================');
  console.log('Please manually:');
  console.log('1. Select "Property Address" radio button');
  console.log('2. Type: 5019 Lymbar Dr');
  console.log('3. Click search');
  console.log('4. Check if results appear');
  console.log('');
  console.log('I will wait 2 minutes for you to test manually...');
  console.log('================================================================================\n');

  await new Promise(resolve => setTimeout(resolve, 120000)); // Wait 2 minutes

  // After manual test, check the iframe
  const frames = page.frames();
  let searchFrame;
  for (const frame of frames) {
    if (frame.url().includes('testsearch.hcad')) {
      searchFrame = frame;
      break;
    }
  }

  if (searchFrame) {
    console.log('\n📊 RESULTS FROM IFRAME:');
    const pageText = await searchFrame.evaluate(() => document.body.innerText);
    console.log(pageText);

    const links = await searchFrame.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => a.textContent?.trim()).filter(t => t);
    });
    console.log('\nLinks found:', links);
  }

  console.log('\n\nClosing browser in 10 seconds...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  await browser.close();
})();
