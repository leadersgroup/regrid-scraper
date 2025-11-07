const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing HCAD Ownership History Extraction...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate to HCAD
  console.log('📍 Loading HCAD...');
  await page.goto('https://hcad.org/property-search/property-search', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Search for address
  console.log('🔍 Searching for: 5019 Lymbar Dr\n');
  const searchInput = 'input[name="q"]';
  await page.waitForSelector(searchInput, { timeout: 10000 });
  await page.click(searchInput);
  await page.type(searchInput, '5019 Lymbar Dr', { delay: 100 });
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('⏎ Pressing Enter...');
  await page.keyboard.press('Enter');

  console.log('⏳ Waiting for results...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Click on first result
  console.log('🖱️ Clicking on first account...');
  const accountClicked = await page.evaluate(() => {
    // Try multiple selectors
    const selectors = [
      'a.account-number',
      'a[href*="account"]',
      'td a',
      'table a'
    ];

    for (const selector of selectors) {
      const links = Array.from(document.querySelectorAll(selector));
      if (links.length > 0) {
        console.log(`Found ${links.length} links with selector: ${selector}`);
        links[0].click();
        return true;
      }
    }
    return false;
  });

  if (!accountClicked) {
    console.error('❌ Could not click on account link');
    await browser.close();
    return;
  }

  console.log('⏳ Waiting for property detail page...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Check page structure
  console.log('\n📊 Analyzing page structure...\n');

  const pageInfo = await page.evaluate(() => {
    // Look for ownership section
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5'));
    const ownershipHeading = headings.find(h =>
      h.textContent.toLowerCase().includes('owner') ||
      h.textContent.toLowerCase().includes('history')
    );

    // Look for tables
    const tables = Array.from(document.querySelectorAll('table'));

    // Look for specific text patterns
    const bodyText = document.body.innerText;
    const hasOwnershipText = bodyText.toLowerCase().includes('ownership') ||
                             bodyText.toLowerCase().includes('owner history') ||
                             bodyText.toLowerCase().includes('deed date');

    return {
      url: window.location.href,
      title: document.title,
      hasOwnershipHeading: !!ownershipHeading,
      ownershipHeadingText: ownershipHeading ? ownershipHeading.textContent : null,
      tableCount: tables.length,
      hasOwnershipText: hasOwnershipText,
      bodyTextSample: bodyText.substring(0, 500)
    };
  });

  console.log('URL:', pageInfo.url);
  console.log('Title:', pageInfo.title);
  console.log('Has ownership heading:', pageInfo.hasOwnershipHeading);
  console.log('Ownership heading text:', pageInfo.ownershipHeadingText);
  console.log('Table count:', pageInfo.tableCount);
  console.log('Has ownership text:', pageInfo.hasOwnershipText);
  console.log('\nBody text sample:');
  console.log(pageInfo.bodyTextSample);

  // Try to extract ownership data
  console.log('\n📋 Attempting to extract ownership data...\n');

  const ownershipData = await page.evaluate(() => {
    // Strategy 1: Look for ownership table
    const tables = Array.from(document.querySelectorAll('table'));

    for (const table of tables) {
      const tableText = table.innerText.toLowerCase();
      if (tableText.includes('owner') || tableText.includes('deed')) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const data = rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          return cells.map(cell => cell.textContent.trim());
        });

        if (data.length > 0) {
          return {
            strategy: 'table',
            data: data,
            rawHTML: table.innerHTML.substring(0, 500)
          };
        }
      }
    }

    // Strategy 2: Look for specific divs or sections
    const sections = Array.from(document.querySelectorAll('div, section'));
    for (const section of sections) {
      const sectionText = section.textContent.toLowerCase();
      if (sectionText.includes('ownership history') && section.children.length > 0) {
        return {
          strategy: 'section',
          innerHTML: section.innerHTML.substring(0, 1000),
          textContent: section.textContent.substring(0, 500)
        };
      }
    }

    return null;
  });

  if (ownershipData) {
    console.log('✅ Found ownership data!');
    console.log('Strategy:', ownershipData.strategy);
    console.log('Data:', JSON.stringify(ownershipData, null, 2).substring(0, 1000));
  } else {
    console.log('❌ Could not find ownership data');

    // Take a screenshot
    const screenshotPath = '/Users/ll/Documents/regrid-scraper/hcad-property-page.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n📸 Screenshot saved: ${screenshotPath}`);
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
