/**
 * Find instrument number cells and try clicking them
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreClickCell() {
  const parcelId = '2158020070';
  const targetInstrument = '201604220703';

  console.log(`🔍 Looking for instrument ${targetInstrument} for parcel: ${parcelId}\n`);

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
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Scroll to load content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find the cell containing the target instrument number and click it
    console.log(`Looking for cell containing: ${targetInstrument}`);

    const clicked = await page.evaluate((targetNum) => {
      const allCells = Array.from(document.querySelectorAll('td'));

      for (const cell of allCells) {
        const text = cell.textContent.trim();
        if (text === targetNum) {
          console.log(`Found cell with text: "${text}"`);

          // Check if there's a link inside
          const link = cell.querySelector('a');
          if (link) {
            console.log('Cell has a link inside, clicking link');
            link.click();
            return { clicked: true, method: 'link', text: text };
          }

          // Otherwise click the cell itself
          console.log('No link found, clicking cell directly');
          cell.click();
          return { clicked: true, method: 'cell', text: text };
        }
      }

      return { clicked: false };
    }, targetInstrument);

    if (clicked.clicked) {
      console.log(`\n✅ Clicked on instrument ${clicked.text} using method: ${clicked.method}`);
      console.log('Waiting for navigation...');

      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {
        console.log('No navigation detected');
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`Current URL: ${page.url()}`);
    } else {
      console.log(`\n❌ Could not find cell with text: ${targetInstrument}`);

      // Let's see what instrument numbers ARE on the page
      const allNumbers = await page.evaluate(() => {
        const allCells = Array.from(document.querySelectorAll('td'));
        const numbers = [];

        for (const cell of allCells) {
          const text = cell.textContent.trim();
          if (text.match(/^\d{7,}$/)) {
            numbers.push(text);
          }
        }

        return numbers;
      });

      console.log(`\nFound ${allNumbers.length} cells with 7+ digit numbers:`);
      allNumbers.forEach((num, i) => {
        console.log(`  ${i + 1}. ${num}`);
      });
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

exploreClickCell();
