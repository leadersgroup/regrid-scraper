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

  // Enter address - try different formats
  const addresses = [
    '5019 LYMBAR DR',
    '5019 Lymbar',
    '5019 LYMBAR',
    '5019 Lymbar Drive'
  ];

  for (const addr of addresses) {
    console.log(`\n🔍 Trying address: "${addr}"`);

    const input = await searchFrame.$('input[type="search"]');
    await input.click({ clickCount: 3 }); // Select all
    await input.type(addr, { delay: 50 });

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

    console.log('   Waiting 15 seconds for results...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check for results
    const hasResults = await searchFrame.evaluate(() => {
      const text = document.body.innerText;
      // Look for account numbers or "results" text
      return /\d{13}/.test(text) || text.toLowerCase().includes('account number');
    });

    const text = await searchFrame.evaluate(() => document.body.innerText);

    if (hasResults || text.includes('0901540000007')) {
      console.log('   ✅ Found results!');
      console.log(text.substring(0, 1000));
      break;
    } else {
      console.log('   ❌ No results found');
      if (text.includes('0 results') || text.includes('No results')) {
        console.log('   Page says: No results');
      }
    }
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
