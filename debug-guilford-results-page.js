/**
 * Debug Guilford County results page to find parcel link
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugResultsPage() {
  console.log('🔍 Debugging Guilford County results page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate
    console.log('Step 1: Navigate...');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Location Address tab
    console.log('Step 2: Click Location Address tab...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      for (const link of links) {
        if (link.textContent.trim().includes('Location Address')) {
          link.click();
          return true;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill address
    console.log('Step 3: Fill address (1205 Glendale)...');
    await page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', { visible: true });
    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', '1205');
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', 'Glendale');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit search
    console.log('Step 4: Submit search...');
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take screenshot of results
    await page.screenshot({ path: 'guilford-results-page.png', fullPage: true });
    console.log('📸 Screenshot: guilford-results-page.png\n');

    // Analyze results page
    console.log('Step 5: Analyzing results page...\n');
    const resultsInfo = await page.evaluate(() => {
      // Get all tables
      const tables = Array.from(document.querySelectorAll('table'));
      const tableInfo = tables.map((table, idx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const firstRowCells = Array.from(table.querySelectorAll('tr:nth-child(2) td')).map(td => ({
          text: td.textContent.trim(),
          hasLink: td.querySelector('a') !== null,
          linkHref: td.querySelector('a')?.href || null,
          linkText: td.querySelector('a')?.textContent.trim() || null
        }));
        return {
          index: idx,
          headers,
          rowCount: table.querySelectorAll('tr').length,
          firstRow: firstRowCells
        };
      });

      // Look for links that might be the parcel
      const allLinks = Array.from(document.querySelectorAll('a'));
      const numberLinks = allLinks
        .filter(link => /^\d+$/.test(link.textContent.trim()))
        .map(link => ({
          text: link.textContent.trim(),
          href: link.href
        }));

      return {
        currentUrl: window.location.href,
        tables: tableInfo,
        numberLinks,
        bodyText: document.body.innerText.substring(0, 500)
      };
    });

    console.log('=== RESULTS PAGE ANALYSIS ===');
    console.log('Current URL:', resultsInfo.currentUrl);
    console.log('\nTables:', JSON.stringify(resultsInfo.tables, null, 2));
    console.log('\nNumber Links:', JSON.stringify(resultsInfo.numberLinks, null, 2));
    console.log('\nPage text (first 500 chars):', resultsInfo.bodyText);

    // Save HTML
    const pageHTML = await page.content();
    fs.writeFileSync('guilford-results-page.html', pageHTML);
    console.log('\n✅ HTML saved: guilford-results-page.html');

    console.log('\n⏸️  Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-results-error.png' });
  }
}

debugResultsPage().catch(console.error);
