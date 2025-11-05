/**
 * Inspect the Pinellas County property detail page to understand deed structure
 * This will help debug why deed download is failing
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function inspectPropertyPage() {
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

    console.log('\n=== Step 1: Finding Property Search Input ===\n');

    // Use the CORRECT property search input (not website search!)
    const searchInputSelectors = [
      '#txtSearchProperty-selectized',
      '#txtSearchProperty',
      'input[placeholder*="Address or Street"]',
      'input[placeholder*="Capri"]'
    ];

    let searchInput = null;
    for (const selector of searchInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        searchInput = selector;
        console.log(`✅ Found property search input: ${selector}`);
        break;
      } catch (e) {
        console.log(`⚠️ Failed with selector: ${selector}`);
      }
    }

    if (!searchInput) {
      console.log('❌ Could not find property search input!');
      await browser.close();
      return;
    }

    // Type address WITHOUT city/state
    const address = '11074 110TH WAY';
    console.log(`\n=== Step 2: Entering address: ${address} ===\n`);

    await page.click(searchInput, { clickCount: 3 });
    await page.type(searchInput, address, { delay: 100 });
    console.log(`✅ Entered address using selector: ${searchInput}`);

    await wait(3000);

    console.log('\n=== Step 3: Looking for Autocomplete ===\n');

    const autocompleteInfo = await page.evaluate(() => {
      const autocompleteSelectors = [
        '.selectize-dropdown-content .option',
        '.selectize-dropdown .option',
        '.autocomplete-suggestion',
        '.ui-menu-item',
        '[role="option"]',
        '.pac-item'
      ];

      for (const selector of autocompleteSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        if (elements.length > 0) {
          return {
            found: true,
            selector: selector,
            count: elements.length,
            samples: elements.slice(0, 5).map(el => ({
              text: el.textContent.trim(),
              innerHTML: el.innerHTML.substring(0, 150)
            }))
          };
        }
      }

      return { found: false };
    });

    console.log('Autocomplete info:', JSON.stringify(autocompleteInfo, null, 2));

    if (autocompleteInfo.found) {
      console.log('\n✅ Clicking first autocomplete suggestion...\\n');

      await page.evaluate((selector) => {
        const suggestions = Array.from(document.querySelectorAll(selector));
        if (suggestions.length > 0) {
          console.log('Clicking:', suggestions[0].textContent.trim());
          suggestions[0].click();
        }
      }, autocompleteInfo.selector);

      await wait(5000);
    } else {
      console.log('\n⚠️ No autocomplete found, trying Enter key...\\n');
      await page.keyboard.press('Enter');
      await wait(5000);
    }

    console.log('\n=== Step 4: Current Page Analysis ===\n');
    console.log('Current URL:', page.url());

    // Check if we're on the right page
    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      return {
        url: window.location.href,
        hasParcel: bodyText.includes('parcel'),
        hasMiscellaneous: bodyText.includes('miscellaneous'),
        hasMiscellaneousParcel: bodyText.includes('miscellaneous') && bodyText.includes('parcel'),
        hasDeed: bodyText.includes('deed'),
        hasLastRecordedDeed: bodyText.includes('last recorded deed'),
        hasSales: bodyText.includes('sales'),
        bodyTextPreview: document.body.innerText.substring(0, 600)
      };
    });

    console.log('Page info:', JSON.stringify(pageInfo, null, 2));

    console.log('\n=== Step 5: Looking for "Miscellaneous Parcel Info" Table ===\n');

    const miscTableInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').map(l => l.trim());

      let foundMiscSection = false;
      let miscSectionLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Start capturing when we find "Miscellaneous Parcel Info"
        if (line.toLowerCase().includes('miscellaneous') && line.toLowerCase().includes('parcel')) {
          foundMiscSection = true;
          miscSectionLines.push(`[${i}] ${line}`);
          continue;
        }

        // If we found the section, capture next 20 lines
        if (foundMiscSection && miscSectionLines.length < 25) {
          miscSectionLines.push(`[${i}] ${line}`);
        }

        // Stop if we hit another section
        if (foundMiscSection && miscSectionLines.length > 3 &&
            (line.toLowerCase().includes('property info') ||
             line.toLowerCase().includes('sales') ||
             line.toLowerCase().includes('building'))) {
          break;
        }
      }

      return {
        found: foundMiscSection,
        lines: miscSectionLines
      };
    });

    console.log('Miscellaneous Section Found:', miscTableInfo.found);
    if (miscTableInfo.found) {
      console.log('\nMiscellaneous Section Content:');
      console.log(miscTableInfo.lines.join('\n'));
    }

    console.log('\n=== Step 6: Looking for All Book/Page Patterns ===\n');

    const bookPageLinks = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const allText = document.body.innerText;
      const results = {
        links: [],
        textMatches: []
      };

      // Check all links
      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        const href = link.href || '';

        // Look for book/page pattern XXXXX/XXXX (5 digits / 4 digits)
        const bookPageMatch = text.match(/(\d{5})\/(\d{4})/);
        if (bookPageMatch) {
          results.links.push({
            text: text,
            href: href.substring(0, 150),
            bookNumber: bookPageMatch[1],
            pageNumber: bookPageMatch[2]
          });
        }
      }

      // Check all text for book/page patterns
      const lines = allText.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const bookPageMatch = line.match(/(\d{5})\/(\d{4})/);
        if (bookPageMatch) {
          results.textMatches.push({
            lineNumber: i,
            line: line,
            bookNumber: bookPageMatch[1],
            pageNumber: bookPageMatch[2],
            context: [
              lines[i - 1]?.trim() || '',
              line,
              lines[i + 1]?.trim() || ''
            ]
          });
        }
      }

      return results;
    });

    console.log('Book/Page Links Found:', bookPageLinks.links.length);
    bookPageLinks.links.forEach((link, i) => {
      console.log(`\n${i + 1}. Link:`);
      console.log(`   Text: ${link.text}`);
      console.log(`   Book: ${link.bookNumber}, Page: ${link.pageNumber}`);
      console.log(`   Href: ${link.href}`);
    });

    console.log('\n\nBook/Page in Text Found:', bookPageLinks.textMatches.length);
    bookPageLinks.textMatches.forEach((match, i) => {
      console.log(`\n${i + 1}. Text Match:`);
      console.log(`   Line ${match.lineNumber}: ${match.line}`);
      console.log(`   Book: ${match.bookNumber}, Page: ${match.pageNumber}`);
      console.log(`   Context:`);
      match.context.forEach(ctx => console.log(`      ${ctx}`));
    });

    console.log('\n=== Step 7: Looking for All Tables ===\n');

    const tables = await page.evaluate(() => {
      const allTables = Array.from(document.querySelectorAll('table'));
      return allTables.map((table, idx) => {
        const text = table.innerText || '';
        return {
          index: idx,
          hasHeader: !!table.querySelector('th'),
          rowCount: table.querySelectorAll('tr').length,
          textPreview: text.substring(0, 300),
          hasMiscellaneous: text.toLowerCase().includes('miscellaneous'),
          hasDeed: text.toLowerCase().includes('deed'),
          hasLastRecorded: text.toLowerCase().includes('last recorded'),
          fullText: text
        };
      });
    });

    console.log('Tables found:', tables.length);
    tables.forEach((table, idx) => {
      console.log(`\n=== Table ${idx + 1} ===`);
      console.log('Has header:', table.hasHeader);
      console.log('Row count:', table.rowCount);
      console.log('Has "miscellaneous":', table.hasMiscellaneous);
      console.log('Has "deed":', table.hasDeed);
      console.log('Has "last recorded":', table.hasLastRecorded);
      console.log('\nFull table text:');
      console.log(table.fullText);
      console.log('='.repeat(80));
    });

    console.log('\n=== Step 8: Text Content with "deed" or "recorded" ===\n');

    const deedText = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText.split('\n');
      const relevantLines = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lowerLine = line.toLowerCase();

        if (lowerLine.includes('deed') || lowerLine.includes('recorded')) {
          // Include context (previous and next 2 lines)
          if (i > 1) relevantLines.push(`[${i - 2}] ${lines[i - 2].trim()}`);
          if (i > 0) relevantLines.push(`[${i - 1}] ${lines[i - 1].trim()}`);
          relevantLines.push(`[${i}] >>> ${line} <<<`);
          if (i < lines.length - 1) relevantLines.push(`[${i + 1}] ${lines[i + 1].trim()}`);
          if (i < lines.length - 2) relevantLines.push(`[${i + 2}] ${lines[i + 2].trim()}`);
          relevantLines.push('---');
        }
      }

      return relevantLines.slice(0, 100); // Limit output
    });

    console.log(deedText.join('\n'));

    console.log('\n\n✅ Inspection complete!');
    console.log('Browser will stay open for 5 minutes. Press Ctrl+C to close.\n');
    await wait(300000);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

inspectPropertyPage();
