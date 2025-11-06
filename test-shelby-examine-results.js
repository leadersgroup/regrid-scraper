#!/usr/bin/env node

/**
 * Examine the Shelby County search results page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function examineSearchResults() {
  console.log('🔍 Examining Shelby County search results...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    // Navigate to assessor
    console.log('📍 Step 1: Navigating to Property Assessor...');
    await page.goto('https://www.assessormelvinburgess.com/propertySearch', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter search criteria
    console.log('🔍 Step 2: Entering search criteria...');
    await page.type('#stNumber', '809');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.type('#stName', 'harbor isle');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit search
    console.log('📤 Step 3: Submitting search...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('button[type="submit"]')
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Search results page loaded\n');

    // Take screenshot
    await page.screenshot({ path: 'shelby-results-detailed.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-results-detailed.png\n');

    // Examine search results in detail
    const resultsAnalysis = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 2000),
        viewButtons: [],
        allButtons: [],
        allLinks: [],
        tables: []
      };

      // Find all view buttons with full details
      const allElements = Array.from(document.querySelectorAll('button, a, input'));
      allElements.forEach(el => {
        const text = (el.textContent || el.value || '').trim();

        if (text.toLowerCase().includes('view')) {
          results.viewButtons.push({
            tag: el.tagName,
            text: text,
            href: el.href || null,
            onclick: el.getAttribute('onclick') || null,
            id: el.id || null,
            classes: el.className || null,
            outerHTML: el.outerHTML.substring(0, 200)
          });
        }

        if (el.tagName === 'BUTTON' || (el.tagName === 'INPUT' && el.type === 'button')) {
          results.allButtons.push({
            text: text.substring(0, 50),
            onclick: el.getAttribute('onclick') ? true : false
          });
        }
      });

      // Get all links
      document.querySelectorAll('a[href]').forEach(link => {
        const text = link.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          results.allLinks.push({
            text: text,
            href: link.href
          });
        }
      });

      // Get table data
      document.querySelectorAll('table').forEach((table, i) => {
        const rows = table.querySelectorAll('tr');
        results.tables.push({
          index: i,
          rows: rows.length,
          firstRowText: rows[0] ? rows[0].textContent.trim().substring(0, 100) : ''
        });
      });

      return results;
    });

    console.log('📊 Search Results Analysis:\n');
    console.log(`Current URL: ${resultsAnalysis.url}\n`);

    console.log('1️⃣  View buttons found:');
    resultsAnalysis.viewButtons.forEach((btn, i) => {
      console.log(`\n   ${i + 1}. <${btn.tag}> "${btn.text}"`);
      console.log(`      id: ${btn.id}`);
      console.log(`      class: ${btn.classes}`);
      console.log(`      href: ${btn.href}`);
      console.log(`      onclick: ${btn.onclick}`);
      console.log(`      HTML: ${btn.outerHTML}`);
    });
    console.log();

    console.log('2️⃣  All buttons found:');
    resultsAnalysis.allButtons.slice(0, 10).forEach((btn, i) => {
      console.log(`   ${i + 1}. "${btn.text}" (has onclick: ${btn.onclick})`);
    });
    console.log(`   Total: ${resultsAnalysis.allButtons.length}\n`);

    console.log('3️⃣  Tables found:');
    resultsAnalysis.tables.forEach((table, i) => {
      console.log(`   Table ${i + 1}: ${table.rows} rows`);
      console.log(`      First row: ${table.firstRowText}`);
    });
    console.log();

    console.log('4️⃣  Page text preview:');
    console.log(resultsAnalysis.bodyText);
    console.log();

    console.log('✅ Analysis complete!');
    console.log('\n⏸️  Keeping browser open for 2 minutes for manual inspection...');

    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🏁 Done');
  }
}

examineSearchResults().catch(console.error);
