/**
 * Deep dive into Sales tab content
 */

const puppeteer = require('puppeteer');

async function debugSalesContent() {
  console.log('🔍 Deep Dive into Sales Tab Content\n');

  const address = '12729 Hawkstone Drive';

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.goto('https://ocpaweb.ocpafl.org/parcelsearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search for address
    const addressInput = await page.$('input[placeholder*="Address"]');
    await addressInput.click();
    await addressInput.type(address, { delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('✅ Property loaded');

    // Click Sales tab
    const salesClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, li, div, span'));
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text.toLowerCase() === 'sales') {
          console.log('Clicking Sales:', el);
          el.click();
          return true;
        }
      }
      return false;
    });

    if (salesClicked) {
      console.log('✅ Clicked Sales tab');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Scroll to reveal content
      await page.evaluate(() => window.scrollBy(0, 1000));
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract EVERYTHING from the page
      const salesData = await page.evaluate(() => {
        // Get full body text
        const fullText = document.body.innerText;

        // Find all tables
        const tables = Array.from(document.querySelectorAll('table')).map((table, i) => {
          const rows = Array.from(table.querySelectorAll('tr')).map(row => {
            const cells = Array.from(row.querySelectorAll('td, th')).map(cell => cell.innerText);
            return cells;
          });

          return {
            index: i,
            rowCount: rows.length,
            rows: rows.slice(0, 20) // First 20 rows
          };
        });

        // Find all sections/divs with "sales" or "sale" in their content
        const salesSections = [];
        const allDivs = Array.from(document.querySelectorAll('div, section, article'));

        for (const div of allDivs) {
          const text = div.innerText || '';
          if (text.toLowerCase().includes('sale') && text.length > 50 && text.length < 5000) {
            salesSections.push({
              tag: div.tagName,
              classes: div.className,
              text: text.substring(0, 2000)
            });
          }
        }

        // Look for anything that looks like a CFN, document number, or book/page
        const cfnPattern = /CFN[:\s#]*(\d+)/gi;
        const docPattern = /(?:Document|Doc)[:\s#]*(\d{10,12})/gi;
        const bookPagePattern = /Book[:\s#]*(\d+)[,\s]+Page[:\s#]*(\d+)/gi;
        const orPattern = /(?:OR|Official\s*Record)[:\s#]*(\d{10,12})/gi;

        const cfnMatches = [...fullText.matchAll(cfnPattern)].map(m => m[0]);
        const docMatches = [...fullText.matchAll(docPattern)].map(m => m[0]);
        const bookPageMatches = [...fullText.matchAll(bookPagePattern)].map(m => m[0]);
        const orMatches = [...fullText.matchAll(orPattern)].map(m => m[0]);

        return {
          fullText: fullText.substring(10000, 20000), // Middle section of text
          tables,
          salesSections: salesSections.slice(0, 5),
          cfnMatches,
          docMatches,
          bookPageMatches,
          orMatches
        };
      });

      console.log('\n' + '='.repeat(80));
      console.log('SALES TAB ANALYSIS:');
      console.log('='.repeat(80));

      console.log(`\nTables found: ${salesData.tables.length}`);
      salesData.tables.forEach((table, i) => {
        console.log(`\nTable ${i + 1}: ${table.rowCount} rows`);
        table.rows.forEach((row, ri) => {
          if (row.length > 0) {
            console.log(`  Row ${ri + 1}: ${row.join(' | ')}`);
          }
        });
      });

      console.log(`\nSales sections found: ${salesData.salesSections.length}`);
      salesData.salesSections.forEach((section, i) => {
        console.log(`\nSection ${i + 1} (${section.tag}):`);
        console.log(section.text);
      });

      console.log('\n' + '='.repeat(80));
      console.log('PATTERN MATCHES:');
      console.log('='.repeat(80));
      console.log(`CFN matches: ${salesData.cfnMatches.length}`);
      salesData.cfnMatches.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

      console.log(`\nDocument matches: ${salesData.docMatches.length}`);
      salesData.docMatches.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

      console.log(`\nBook/Page matches: ${salesData.bookPageMatches.length}`);
      salesData.bookPageMatches.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

      console.log(`\nOR matches: ${salesData.orMatches.length}`);
      salesData.orMatches.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

      console.log('\n' + '='.repeat(80));
      console.log('FULL TEXT SAMPLE (chars 10000-20000):');
      console.log('='.repeat(80));
      console.log(salesData.fullText);
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 60 seconds...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugSalesContent();
