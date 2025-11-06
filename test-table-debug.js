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

  console.log('✅ Clicked search, waiting 20 seconds for results...');
  await new Promise(resolve => setTimeout(resolve, 20000));

  console.log('\n🔍 TABLE DIAGNOSTICS:\n');

  // Check for tables
  const tableInfo = await searchFrame.evaluate(() => {
    const tables = document.querySelectorAll('table');
    const tbodies = document.querySelectorAll('tbody');
    const allRows = document.querySelectorAll('tr');
    const tbodyRows = document.querySelectorAll('tbody tr');

    const rowDetails = Array.from(tbodyRows).map((row, i) => {
      const cells = row.querySelectorAll('td');
      return {
        index: i,
        cellCount: cells.length,
        firstCellText: cells[0]?.textContent?.trim().substring(0, 50),
        rowText: row.textContent?.trim().substring(0, 100)
      };
    });

    return {
      tables: tables.length,
      tbodies: tbodies.length,
      allRows: allRows.length,
      tbodyRows: tbodyRows.length,
      rowDetails: rowDetails
    };
  });

  console.log('Tables found:', tableInfo.tables);
  console.log('Tbody elements:', tableInfo.tbodies);
  console.log('All rows:', tableInfo.allRows);
  console.log('Tbody rows:', tableInfo.tbodyRows);
  console.log('\nRow details:');
  tableInfo.rowDetails.forEach(row => {
    console.log(`  Row ${row.index}: ${row.cellCount} cells, first="${row.firstCellText}"`);
    console.log(`    Full text: ${row.rowText}`);
  });

  // Get full page HTML
  const html = await searchFrame.evaluate(() => document.body.innerHTML);
  console.log('\n📄 Searching for 0901540000007 in HTML:');
  if (html.includes('0901540000007')) {
    console.log('✅ FOUND account number in HTML!');
    const index = html.indexOf('0901540000007');
    console.log('Context:', html.substring(Math.max(0, index - 100), index + 100));
  } else {
    console.log('❌ Account number NOT found in HTML');
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
