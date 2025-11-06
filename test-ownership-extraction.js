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
  await input.click({ clickCount: 3 });
  await new Promise(resolve => setTimeout(resolve, 500));
  await input.type('5019 Lymbar Dr', { delay: 100 });

  // Trigger Blazor events
  await searchFrame.evaluate(() => {
    const input = document.querySelector('input[type="search"]');
    if (input) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  console.log('✅ Entered address');
  await new Promise(resolve => setTimeout(resolve, 3000));

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

  console.log('✅ Clicked search, waiting for results...');

  // Wait for table data rows
  await searchFrame.waitForFunction(() => {
    const rows = document.querySelectorAll('tbody tr');
    if (rows.length > 0) {
      for (const row of rows) {
        const text = row.textContent || '';
        if (/\d{13}/.test(text)) {
          return true;
        }
      }
    }
    return false;
  }, { timeout: 30000 });

  console.log('✅ Search results loaded');

  // Click on account number
  await searchFrame.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0) {
        const firstCell = cells[0];
        const cellText = firstCell.textContent?.trim() || '';
        if (/\d{13}/.test(cellText)) {
          const link = firstCell.querySelector('a') || firstCell.querySelector('b') || firstCell;
          link.click();
          return;
        }
      }
    }
  });

  console.log('✅ Clicked on account number, waiting for property details...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get all text from the page
  const pageText = await searchFrame.evaluate(() => document.body.innerText);

  console.log('\n📄 FULL PAGE TEXT:\n');
  console.log('='.repeat(80));
  console.log(pageText);
  console.log('='.repeat(80));

  // Check for specific keywords
  console.log('\n🔍 KEYWORD SEARCH:\n');
  const keywords = ['ownership history', 'owner', 'effective date', 'deed', 'transfer', 'sale'];
  keywords.forEach(keyword => {
    const found = pageText.toLowerCase().includes(keyword);
    console.log(`  ${found ? '✅' : '❌'} "${keyword}": ${found}`);
  });

  // Get HTML structure around ownership info
  const htmlInfo = await searchFrame.evaluate(() => {
    const html = document.body.innerHTML;

    // Search for ownership-related sections
    const patterns = [
      'ownership',
      'owner',
      'effective',
      'deed',
      'transfer'
    ];

    const results = {};
    patterns.forEach(pattern => {
      const regex = new RegExp(`.{0,200}${pattern}.{0,200}`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        results[pattern] = matches.slice(0, 3); // First 3 matches
      }
    });

    return results;
  });

  console.log('\n🔍 HTML SNIPPETS AROUND KEYWORDS:\n');
  Object.entries(htmlInfo).forEach(([keyword, matches]) => {
    console.log(`\n--- "${keyword}" ---`);
    matches.forEach((match, i) => {
      console.log(`[${i}] ${match.substring(0, 300)}...`);
    });
  });

  console.log('\n⏸️  Browser will stay open for 60 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
