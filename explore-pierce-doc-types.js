/**
 * Explore Pierce County document types specifically
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreDocTypes() {
  const parcelId = '2158020070';
  console.log(`🔍 Finding all document types for parcel: ${parcelId}\n`);

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

    // Find all document types by searching for text containing common document keywords
    const documents = await page.evaluate(() => {
      // Look for all table cells
      const allCells = Array.from(document.querySelectorAll('td'));
      const results = [];

      for (let i = 0; i < allCells.length; i++) {
        const cell = allCells[i];
        const text = cell.textContent.trim();

        // Check if this looks like a document type
        if (text.match(/DEED|AFFIDAVIT|MORTGAGE|WARRANTY|QUIT/i)) {
          // Look backwards for instrument number (usually appears before document type)
          let instrumentNumber = '';
          for (let j = Math.max(0, i - 10); j < i; j++) {
            const prevText = allCells[j].textContent.trim();
            // Look for a number that looks like an instrument number (7-8 digits)
            if (prevText.match(/^\d{7,8}$/)) {
              instrumentNumber = prevText;
            }
          }

          // Look for link in nearby cells
          let link = null;
          for (let j = Math.max(0, i - 5); j < Math.min(allCells.length, i + 5); j++) {
            const linkEl = allCells[j].querySelector('a');
            if (linkEl && linkEl.textContent.trim().match(/^\d{7,8}$/)) {
              link = {
                href: linkEl.href,
                text: linkEl.textContent.trim()
              };
              break;
            }
          }

          results.push({
            documentType: text,
            instrumentNumber: instrumentNumber || '(not found)',
            link: link
          });
        }
      }

      return results;
    });

    console.log(`Found ${documents.length} documents:\n`);
    documents.forEach((doc, i) => {
      console.log(`${i + 1}. Document Type: "${doc.documentType}"`);
      console.log(`   Instrument #: ${doc.instrumentNumber}`);
      if (doc.link) {
        console.log(`   Link: ${doc.link.text} → ${doc.link.href.substring(0, 80)}`);
      }
      console.log('');
    });

    console.log('\n⏸️  Browser staying open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreDocTypes();
