const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Testing Harris County scraper with latest fix...\n');

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

  // Wait for table data rows with account numbers
  try {
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
  } catch (e) {
    console.error('❌ Timeout waiting for results');
    await browser.close();
    return;
  }

  // NEW FIX: Click on account number in table cell
  console.log('\n🎯 Attempting to click account number...');

  const clickResult = await searchFrame.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    for (const row of rows) {
      const cells = row.querySelectorAll('td');
      if (cells.length > 0) {
        const firstCell = cells[0];
        const cellText = firstCell.textContent?.trim() || '';

        // Check if this cell contains a 13-digit account number
        if (/\d{13}/.test(cellText)) {
          const accountNumber = cellText.match(/\d{13}/)[0];

          // Try to find clickable element: <a>, <b>, or the cell itself
          const link = firstCell.querySelector('a') || firstCell.querySelector('b') || firstCell;

          if (link.click) {
            link.click();
            return {
              clicked: true,
              accountNumber: accountNumber,
              method: link.tagName
            };
          }
        }
      }
    }
    return { clicked: false };
  });

  if (clickResult.clicked) {
    console.log(`✅ Clicked on account number: ${clickResult.accountNumber} (via ${clickResult.method} element)`);

    // Wait for property details page to load
    console.log('⏳ Waiting for property details page...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check what page we're on now
    const currentUrl = searchFrame.url();
    console.log('📍 Current iframe URL:', currentUrl);

    const pageText = await searchFrame.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('\n📄 Page content preview:');
    console.log(pageText);

  } else {
    console.error('❌ Could not click account number');
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
