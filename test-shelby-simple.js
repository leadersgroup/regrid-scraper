const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Navigating to search page...');
  await page.goto('https://www.assessormelvinburgess.com/propertySearch', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Entering street number...');
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const numberLabel = labels.find(l => l.textContent.toLowerCase().includes('street number'));
    if (numberLabel && numberLabel.htmlFor) {
      const input = document.getElementById(numberLabel.htmlFor);
      if (input) {
        input.value = '1330';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Entering street name...');
  await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('label'));
    const streetLabel = labels.find(l => l.textContent.toLowerCase().includes('street name'));
    if (streetLabel && streetLabel.htmlFor) {
      const input = document.getElementById(streetLabel.htmlFor);
      if (input) {
        input.value = 'poplar';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('Submitting form...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || btn.value || '').toLowerCase().trim();
      if (text.includes('submit') || text.includes('search')) {
        btn.click();
        break;
      }
    }
  });

  console.log('Waiting for results...');
  await new Promise(resolve => setTimeout(resolve, 7000));

  console.log('Current URL:', page.url());

  // Check for view buttons
  const viewButtons = await page.evaluate(() => {
    const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
    return allElements
      .filter(el => {
        const text = (el.textContent || el.value || '').toLowerCase().trim();
        return text === 'view' || (text.includes('view') && !text.includes('review'));
      })
      .map(el => ({
        tag: el.tagName,
        text: el.textContent || el.value,
        href: el.href || null
      }));
  });

  console.log(`Found ${viewButtons.length} view buttons:`, viewButtons);

  if (viewButtons.length > 0) {
    console.log('Clicking first view button...');
    const currentUrl = page.url();

    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
      const viewBtn = allElements.find(el => {
        const text = (el.textContent || el.value || '').toLowerCase().trim();
        return text === 'view' || (text.includes('view') && !text.includes('review'));
      });
      if (viewBtn) {
        viewBtn.click();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('URL after click:', page.url());
    console.log('Did URL change?', page.url() !== currentUrl);

    // Capture page structure
    const pageStructure = await page.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('div[class*="card"], section, article'));
      return sections.slice(0, 10).map(s => ({
        tag: s.tagName,
        class: s.className,
        text: s.textContent.substring(0, 200).trim()
      }));
    });

    console.log('\nPage sections:', JSON.stringify(pageStructure, null, 2));

    // Look for Sales History
    const salesHistory = await page.evaluate(() => {
      const allText = Array.from(document.querySelectorAll('*'));
      const salesElements = allText.filter(el => {
        const text = el.textContent || '';
        return text.includes('Sales History') || text.includes('sales history');
      });
      return salesElements.map(el => ({
        tag: el.tagName,
        text: el.textContent.substring(0, 100),
        clickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick || el.getAttribute('onclick')
      }));
    });

    console.log('\nSales History elements:', JSON.stringify(salesHistory, null, 2));
  }

  console.log('\nKeeping browser open for 60 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
