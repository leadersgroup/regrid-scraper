/**
 * Debug: Check what's in the new tab that opens after clicking View
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugNewTab() {
  const parcelId = '2158020070';
  console.log(`🔍 Checking new tab content: ${parcelId}\n`);

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

    console.log('✅ At results page');

    // Scroll and wait for table
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('⏳ Waiting for document table...');
    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      return rows.some(row => row.querySelectorAll('td').length > 100);
    }, { timeout: 30000 });
    console.log('✅ Table loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Listen for new pages/popups
    const newPagePromise = new Promise(resolve => {
      browser.once('targetcreated', async target => {
        const newPage = await target.page();
        resolve(newPage);
      });
    });

    // Click View cell
    console.log('🔍 Clicking View cell...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        if (cells.length < 100) continue;

        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i];
          if (cell.textContent.trim() === 'View') {
            // Look for deed
            let instrumentNumber = null;
            for (let j = i + 1; j < Math.min(i + 5, cells.length); j++) {
              const text = cells[j].textContent.trim();
              if (text.match(/^\d{7,}$/)) {
                instrumentNumber = text;
                break;
              }
            }

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

            if (instrumentNumber && documentType && !documentType.toUpperCase().includes('EXCISE TAX')) {
              cell.click();
              return;
            }
          }
        }
      }
    });

    console.log('✅ Clicked View cell');

    // Wait for new page
    console.log('⏳ Waiting for new page/popup...');
    const newPage = await Promise.race([
      newPagePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

    if (newPage) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const newURL = newPage.url();
      const newTitle = await newPage.title();
      console.log(`\n📄 NEW PAGE/POPUP OPENED:`);
      console.log(`   URL: ${newURL}`);
      console.log(`   Title: ${newTitle}\n`);

      // Look for links with "image" on the NEW page
      const imageLinks = await newPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .filter(link => link.textContent.toLowerCase().includes('image'))
          .map(link => ({
            text: link.textContent.trim(),
            href: link.href
          }));
      });

      console.log(`Found ${imageLinks.length} links with "image" on NEW page:`);
      imageLinks.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}"`);
        console.log(`   ${link.href}`);
      });

      // Look for "Image:" text in table cells
      const imageCells = await newPage.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('td, th'));
        return cells
          .filter(cell => cell.textContent.toLowerCase().includes('image:'))
          .map(cell => ({
            text: cell.textContent.trim().substring(0, 100),
            hasLink: cell.querySelectorAll('a').length > 0
          }));
      });

      console.log(`\nFound ${imageCells.length} cells with "Image:" on NEW page:`);
      imageCells.forEach((cell, i) => {
        console.log(`${i + 1}. "${cell.text}" (has link: ${cell.hasLink})`);
      });
    }

    console.log('\n\n⏸️  Browser staying open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

debugNewTab();
