/**
 * Print ALL links on the page to see what's available
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreAllLinks() {
  const parcelId = '2158020070';
  console.log(`🔍 Getting ALL links for parcel: ${parcelId}\n`);

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
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait extra time for content

    // Scroll to load all content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get ALL links on page
    const allLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        text: link.textContent.trim().substring(0, 100),
        href: link.href.substring(0, 150)
      }));
    });

    console.log(`Found ${allLinks.length} total links:\n`);
    allLinks.forEach((link, i) => {
      console.log(`${i + 1}. Text: "${link.text}"`);
      console.log(`   Href: ${link.href}`);
      console.log('');
    });

    // Wait to inspect
    console.log('\n⏸️  Browser staying open for 20 seconds...');
    await new Promise(resolve => setTimeout(resolve, 20000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreAllLinks();
