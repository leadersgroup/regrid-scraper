/**
 * Explore Pierce County document results to understand document type structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreDocuments() {
  const parcelId = '2158020070';
  console.log(`🔍 Exploring Pierce County documents for parcel: ${parcelId}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('📍 Step 1: Navigate and acknowledge disclaimer...');
    await page.goto('https://armsweb.co.pierce.wa.us/RealEstate/SearchEntry.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click disclaimer
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.toLowerCase().includes('click here to acknowledge')) {
          link.click();
          return;
        }
      }
    });

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📍 Step 2: Enter parcel ID and search...');
    const input = await page.$('#cphNoMargin_f_Datatextedit28p');
    await input.click({ clickCount: 3 });
    await input.type(parcelId);
    await new Promise(resolve => setTimeout(resolve, 1000));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log('✅ Results page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Scroll to load all content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📊 Analyzing document table...\n');

    // Extract all table rows and analyze document structure
    const documents = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tr'));
      const results = [];

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length === 0) continue;

        const rowData = {
          cellCount: cells.length,
          cells: cells.map((cell, idx) => ({
            index: idx,
            text: cell.textContent.trim().substring(0, 100),
            hasLink: !!cell.querySelector('a'),
            linkHref: cell.querySelector('a')?.href || null,
            linkText: cell.querySelector('a')?.textContent.trim() || null
          }))
        };

        // Only include rows with meaningful data
        if (rowData.cells.some(c => c.text.length > 0)) {
          results.push(rowData);
        }
      }

      return results;
    });

    console.log(`Found ${documents.length} data rows\n`);

    // Print first 10 rows
    documents.slice(0, 15).forEach((row, i) => {
      console.log(`Row ${i + 1} (${row.cellCount} cells):`);
      row.cells.forEach(cell => {
        if (cell.text) {
          console.log(`  Cell ${cell.index}: "${cell.text}"`);
          if (cell.hasLink) {
            console.log(`    → Link: ${cell.linkText}`);
          }
        }
      });
      console.log('');
    });

    console.log('\n⏸️  Browser staying open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreDocuments();
