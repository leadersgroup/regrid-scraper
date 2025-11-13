/**
 * Debug: See what happens after clicking the View cell
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugAfterClick() {
  const parcelId = '2158020070';
  console.log(`🔍 Debugging what happens after clicking View cell: ${parcelId}\n`);

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

    // Scroll to load all content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    // CRITICAL: Wait for the table data to load (it loads via AJAX)
    console.log('⏳ Waiting for document table to load...');
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 });
    console.log('✅ Document table loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find and click the View cell for the STATUTORY WARRANTY DEED (instrument 201604220703)
    console.log('🔍 Finding STATUTORY WARRANTY DEED View cell...\n');

    const clickResult = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 100) continue;

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          const cellText = cell.textContent.trim();

          if (cellText === 'View') {
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

            if (instrumentNumber && documentType) {
              if (documentType.toUpperCase().includes('EXCISE TAX AFFIDAVIT')) {
                continue;
              }

              // Found the deed! Click the View cell
              cell.click();
              return {
                clicked: true,
                documentType: documentType,
                instrumentNumber: instrumentNumber
              };
            }
          }
        }
      }

      return { clicked: false };
    });

    if (!clickResult.clicked) {
      console.log('❌ Could not find View cell to click');
      await browser.close();
      return;
    }

    console.log(`✅ Clicked View cell for: ${clickResult.documentType}, Instrument: ${clickResult.instrumentNumber}\n`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if we have new windows/tabs
    const pages = await browser.pages();
    console.log(`Number of pages/tabs: ${pages.length}\n`);

    // Check current page URL and title
    const currentURL = page.url();
    const currentTitle = await page.title();
    console.log(`Current Page URL: ${currentURL}`);
    console.log(`Current Page Title: ${currentTitle}\n`);

    // Look for all links containing "image" or "Image"
    const imageLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .filter(link => link.textContent.toLowerCase().includes('image'))
        .map(link => ({
          text: link.textContent.trim().substring(0, 100),
          href: link.href.substring(0, 150)
        }));
    });

    console.log(`Found ${imageLinks.length} links containing "image":`);
    imageLinks.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}"`);
      console.log(`   ${link.href}`);
    });

    console.log('\n\n⏸️  Browser staying open for 60 seconds to inspect...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

debugAfterClick();
