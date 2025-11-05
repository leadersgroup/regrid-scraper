/**
 * Inspect Pinellas County Property Appraiser page to understand structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function inspectPinellasPage() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🔍 Navigating to Pinellas County Property Appraiser...');
    await page.goto('https://www.pcpao.gov/', { waitUntil: 'networkidle2' });
    await wait(3000);

    console.log('\n=== Step 1: Finding Search Input ===\n');

    const searchInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(input => ({
        type: input.type,
        id: input.id,
        name: input.name,
        placeholder: input.placeholder,
        className: input.className
      }));
    });

    console.log('Found inputs:', JSON.stringify(searchInput, null, 2));

    // Type address
    const address = '11074 110TH WAY';
    console.log(`\n=== Step 2: Entering address: ${address} ===\n`);

    const inputSelectors = [
      'input[type="search"]',
      'input[type="text"]',
      'input[placeholder*="Search"]',
      'input[placeholder*="search"]'
    ];

    for (const selector of inputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.click(selector, { clickCount: 3 });
        await page.type(selector, address, { delay: 100 });
        console.log(`✅ Entered address using selector: ${selector}`);
        break;
      } catch (e) {
        console.log(`⚠️ Failed with selector: ${selector}`);
      }
    }

    await wait(3000);

    console.log('\n=== Step 3: Looking for Autocomplete ===\n');

    const autocompleteInfo = await page.evaluate(() => {
      const autocompleteSelectors = [
        '.autocomplete-suggestion',
        '.ui-menu-item',
        '.suggestion',
        '[role="option"]',
        '.search-result',
        '.pac-item',
        '.autocomplete-item'
      ];

      for (const selector of autocompleteSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          return {
            found: true,
            selector: selector,
            count: elements.length,
            samples: elements.slice(0, 3).map(el => ({
              text: el.textContent,
              html: el.innerHTML.substring(0, 100)
            }))
          };
        }
      }

      return { found: false };
    });

    console.log('Autocomplete info:', JSON.stringify(autocompleteInfo, null, 2));

    if (autocompleteInfo.found) {
      console.log('\n✅ Clicking first autocomplete suggestion...\n');

      await page.evaluate((selector) => {
        const suggestions = Array.from(document.querySelectorAll(selector));
        if (suggestions.length > 0) {
          suggestions[0].click();
        }
      }, autocompleteInfo.selector);

      await wait(5000);
    } else {
      console.log('\n⚠️ No autocomplete found, trying Enter key...\n');
      await page.keyboard.press('Enter');
      await wait(5000);
    }

    console.log('\n=== Step 4: Current Page Analysis ===\n');
    console.log('Current URL:', page.url());

    const pageStructure = await page.evaluate(() => {
      return {
        hasParcel: document.body.innerText.toLowerCase().includes('parcel'),
        hasMiscellaneous: document.body.innerText.toLowerCase().includes('miscellaneous'),
        hasDeed: document.body.innerText.toLowerCase().includes('deed'),
        hasLastRecordedDeed: document.body.innerText.toLowerCase().includes('last recorded deed'),
        hasSales: document.body.innerText.toLowerCase().includes('sales'),
        bodyTextPreview: document.body.innerText.substring(0, 500)
      };
    });

    console.log('Page structure:', JSON.stringify(pageStructure, null, 2));

    // Look for all tables
    console.log('\n=== Step 5: Looking for Tables ===\n');

    const tables = await page.evaluate(() => {
      const allTables = Array.from(document.querySelectorAll('table'));
      return allTables.map((table, idx) => {
        const text = table.innerText || '';
        return {
          index: idx,
          hasHeader: !!table.querySelector('th'),
          rowCount: table.querySelectorAll('tr').length,
          textPreview: text.substring(0, 200),
          hasMiscellaneous: text.toLowerCase().includes('miscellaneous'),
          hasDeed: text.toLowerCase().includes('deed'),
          hasLastRecorded: text.toLowerCase().includes('last recorded')
        };
      });
    });

    console.log('Tables found:', tables.length);
    tables.forEach((table, idx) => {
      console.log(`\nTable ${idx + 1}:`, JSON.stringify(table, null, 2));
    });

    // Look for all links with numeric patterns
    console.log('\n=== Step 6: Looking for Book/Page Links ===\n');

    const bookPageLinks = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const patterns = [];

      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        const href = link.href || '';

        // Various book/page patterns
        if (/\d{5}\/\d{4}/.test(text)) {
          patterns.push({ pattern: 'XXXXX/XXXX', text, href: href.substring(0, 100) });
        } else if (/\d{4,5}[-\/]\d{3,5}/.test(text)) {
          patterns.push({ pattern: 'numbers-numbers', text, href: href.substring(0, 100) });
        }
      }

      return patterns;
    });

    console.log('Book/Page links found:', bookPageLinks.length);
    bookPageLinks.forEach((link, idx) => {
      console.log(`${idx + 1}.`, link);
    });

    // Dump all text content with "deed" or "recorded"
    console.log('\n=== Step 7: Text Content with "deed" or "recorded" ===\n');

    const deedText = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText.split('\n');
      const relevantLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.toLowerCase().includes('deed') || line.toLowerCase().includes('recorded')) {
          // Include context (previous and next lines)
          if (i > 0) relevantLines.push(`[${i - 1}] ${lines[i - 1].trim()}`);
          relevantLines.push(`[${i}] ${line}`);
          if (i < lines.length - 1) relevantLines.push(`[${i + 1}] ${lines[i + 1].trim()}`);
          relevantLines.push('---');
        }
      }

      return relevantLines.slice(0, 50); // Limit output
    });

    console.log(deedText.join('\n'));

    console.log('\n\nBrowser will stay open for 5 minutes. Press Ctrl+C to close.\n');
    await wait(300000);

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

inspectPinellasPage();
