/**
 * Debug Pierce County grid-based table structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreGrid() {
  const parcelId = '2158020070';
  console.log(`🔍 Debugging Pierce County grid structure for parcel: ${parcelId}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate and search
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

    // Enter parcel and search
    const input = await page.$('#cphNoMargin_f_Datatextedit28p');
    await input.click({ clickCount: 3 });
    await input.type(parcelId);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log('✅ At results page\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Debug grid parsing logic
    const debugInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const results = {
        totalRows: rows.length,
        rowsWithManyCells: [],
        documents: []
      };

      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        const cells = Array.from(row.querySelectorAll('td'));

        // Track all rows with many cells
        if (cells.length > 50) {
          results.rowsWithManyCells.push({
            rowIndex: rowIdx,
            cellCount: cells.length
          });
        }

        // Look for the data row (has many cells)
        if (cells.length < 100) continue;

        // Look for "View" links
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();

          if (cellText === 'View' && cell.querySelector('a')) {
            const debugData = {
              viewCellIndex: i,
              nearbyText: []
            };

            // Look ahead for instrument number
            let instrumentNumber = null;
            for (let j = i + 1; j < Math.min(i + 5, cells.length); j++) {
              const text = cells[j].textContent.trim();
              debugData.nearbyText.push({ cellIndex: j, text: text.substring(0, 50) });
              if (text.match(/^\d{7,}$/)) {
                instrumentNumber = text;
                break;
              }
            }

            // Look ahead for document type
            let documentType = null;
            for (let j = i + 5; j < Math.min(i + 15, cells.length); j++) {
              const text = cells[j].textContent.trim();
              if (text.match(/^(STATUTORY\s+)?WARRANTY\s+DEED$/i) ||
                  text.match(/^QUIT\s*CLAIM\s+DEED$/i) ||
                  text.match(/^DEED$/i) ||
                  text.match(/^EXCISE\s+TAX\s+AFFIDAVIT$/i)) {
                documentType = text;
                break;
              }
            }

            results.documents.push({
              ...debugData,
              instrumentNumber: instrumentNumber,
              documentType: documentType,
              isExciseTax: documentType ? documentType.toUpperCase().includes('EXCISE TAX') : false
            });
          }
        }
      }

      return results;
    });

    console.log('\n📊 Grid Parsing Results:\n');
    console.log(`Total rows found: ${debugInfo.totalRows}`);
    console.log(`Rows with 50+ cells: ${debugInfo.rowsWithManyCells.length}`);
    debugInfo.rowsWithManyCells.forEach(row => {
      console.log(`  Row ${row.rowIndex}: ${row.cellCount} cells`);
    });

    console.log(`\nDocuments found: ${debugInfo.documents.length}\n`);
    debugInfo.documents.forEach((doc, idx) => {
      console.log(`Document ${idx + 1}:`);
      console.log(`  View Cell Index: ${doc.viewCellIndex}`);
      console.log(`  Nearby cells:`);
      doc.nearbyText.forEach(cell => {
        console.log(`    Cell ${cell.cellIndex}: "${cell.text}"`);
      });
      console.log(`  Instrument #: ${doc.instrumentNumber || '(not found)'}`);
      console.log(`  Document Type: ${doc.documentType || '(not found)'}`);
      console.log(`  Is Excise Tax: ${doc.isExciseTax}`);
      console.log('');
    });

    const validDeeds = debugInfo.documents.filter(doc => doc.documentType && !doc.isExciseTax);
    console.log(`\n✅ Found ${validDeeds.length} valid deed(s) (non-excise-tax)`);
    if (validDeeds.length > 0) {
      console.log(`First valid deed:`);
      console.log(`  Type: ${validDeeds[0].documentType}`);
      console.log(`  Instrument #: ${validDeeds[0].instrumentNumber}`);
    }

    console.log('\n⏸️  Browser staying open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreGrid();
