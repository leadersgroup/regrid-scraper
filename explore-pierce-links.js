/**
 * Simple approach: Find all instrument number links and check nearby text
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreLinks() {
  const parcelId = '2158020070';
  console.log(`🔍 Finding instrument links for parcel: ${parcelId}\n`);

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

    // Find all instrument number links
    const instruments = await page.evaluate(() => {
      // Find all links with 7+ digit numbers
      const links = Array.from(document.querySelectorAll('a'));
      const results = [];

      for (const link of links) {
        const text = link.textContent.trim();
        if (text.match(/^\d{7,}$/)) {
          // Found an instrument number link
          // Look at parent row for document type
          const row = link.closest('tr');
          if (row) {
            const rowText = row.textContent;

            let documentType = null;
            if (rowText.match(/STATUTORY\s+WARRANTY\s+DEED/i)) {
              documentType = 'STATUTORY WARRANTY DEED';
            } else if (rowText.match(/QUIT\s*CLAIM\s+DEED/i)) {
              documentType = 'QUITCLAIM DEED';
            } else if (rowText.match(/WARRANTY\s+DEED/i)) {
              documentType = 'WARRANTY DEED';
            } else if (rowText.match(/EXCISE\s+TAX\s+AFFIDAVIT/i)) {
              documentType = 'EXCISE TAX AFFIDAVIT';
            } else if (rowText.match(/\bDEED\b/i)) {
              documentType = 'DEED';
            }

            results.push({
              instrumentNumber: text,
              href: link.href,
              documentType: documentType,
              rowTextSample: rowText.substring(0, 200)
            });
          }
        }
      }

      return results;
    });

    console.log(`Found ${instruments.length} instrument links:\n`);
    instruments.forEach((inst, i) => {
      console.log(`${i + 1}. Instrument #: ${inst.instrumentNumber}`);
      console.log(`   Document Type: ${inst.documentType || '(not identified)'}`);
      console.log(`   Row Text Sample: ${inst.rowTextSample}`);
      console.log('');
    });

    const validDeeds = instruments.filter(inst =>
      inst.documentType && !inst.documentType.includes('EXCISE TAX')
    );

    console.log(`\n✅ Found ${validDeeds.length} valid deed(s) (non-excise-tax)`);
    if (validDeeds.length > 0) {
      console.log(`\nFirst valid deed:`);
      console.log(`  Instrument #: ${validDeeds[0].instrumentNumber}`);
      console.log(`  Document Type: ${validDeeds[0].documentType}`);
      console.log(`  Link: ${validDeeds[0].href}`);
    }

    console.log('\n⏸️  Browser staying open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreLinks();
