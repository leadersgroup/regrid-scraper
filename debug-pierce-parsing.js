/**
 * Debug what the parsing logic finds after waiting for table to load
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugParsing() {
  const parcelId = '2158020070';
  console.log(`🔍 Debugging parsing logic for parcel: ${parcelId}\n`);

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

    // Scroll
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Wait for table with 100+ cells
    console.log('⏳ Waiting for table data (row with 100+ cells)...');

    const waitResult = await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 }).then(() => true).catch(() => false);

    console.log(`Wait result: ${waitResult ? 'SUCCESS - Found row with 100+ cells' : 'TIMEOUT'}\n`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Now run the exact same parsing logic as the scraper
    console.log('📊 Running parsing logic...\n');

    const parseResult = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const debug = {
        totalRows: rows.length,
        rowsWith100Plus: 0,
        viewLinksFound: [],
        documents: []
      };

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));

        if (cells.length > 100) {
          debug.rowsWith100Plus++;

          // Look for "View" links
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            const cellText = cell.textContent.trim();

            if (cellText === 'View' && cell.querySelector('a')) {
              const viewLink = cell.querySelector('a');

              // Collect debug info about what's nearby
              const nearby = [];
              for (let j = i; j < Math.min(i + 20, cells.length); j++) {
                nearby.push(`Cell ${j}: "${cells[j].textContent.trim().substring(0, 40)}"`);
              }

              debug.viewLinksFound.push({
                cellIndex: i,
                nearby: nearby
              });

              // Look ahead for instrument number
              let instrumentNumber = null;
              for (let j = i + 1; j < Math.min(i + 5, cells.length); j++) {
                const text = cells[j].textContent.trim();
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

              debug.documents.push({
                cellIndex: i,
                instrumentNumber: instrumentNumber,
                documentType: documentType,
                isExciseTax: documentType ? documentType.toUpperCase().includes('EXCISE TAX') : false,
                hasViewLink: !!viewLink
              });
            }
          }
        }
      }

      return debug;
    });

    console.log(`Total rows: ${parseResult.totalRows}`);
    console.log(`Rows with 100+ cells: ${parseResult.rowsWith100Plus}`);
    console.log(`View links found: ${parseResult.viewLinksFound.length}\n`);

    if (parseResult.viewLinksFound.length > 0) {
      console.log('First few View links:');
      parseResult.viewLinksFound.slice(0, 3).forEach((view, i) => {
        console.log(`\n${i + 1}. View link at cell ${view.cellIndex}:`);
        view.nearby.forEach(line => console.log(`  ${line}`));
      });
    }

    console.log(`\n\nDocuments parsed: ${parseResult.documents.length}\n`);
    parseResult.documents.forEach((doc, i) => {
      console.log(`${i + 1}. Cell ${doc.cellIndex}:`);
      console.log(`   Instrument #: ${doc.instrumentNumber || '(not found)'}`);
      console.log(`   Document Type: ${doc.documentType || '(not found)'}`);
      console.log(`   Is Excise Tax: ${doc.isExciseTax}`);
      console.log(`   Has View Link: ${doc.hasViewLink}`);
      console.log('');
    });

    const validDeeds = parseResult.documents.filter(d => d.documentType && !d.isExciseTax);
    console.log(`\n✅ Valid deeds (non-excise-tax): ${validDeeds.length}`);

    console.log('\n⏸️  Browser staying open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

debugParsing();
