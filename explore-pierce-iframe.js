/**
 * Check for iframes and dynamic content loading
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreIframe() {
  const parcelId = '2158020070';
  console.log(`🔍 Checking for iframes and dynamic content for parcel: ${parcelId}\n`);

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

    // Wait extra time for dynamic content
    console.log('Waiting 10 seconds for dynamic content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for iframes
    const iframes = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('iframe'));
      return frames.map(f => ({
        id: f.id,
        name: f.name,
        src: f.src.substring(0, 100)
      }));
    });

    console.log(`Found ${iframes.length} iframes:`);
    iframes.forEach((f, i) => {
      console.log(`  ${i + 1}. ID: ${f.id || '(none)'}, Name: ${f.name || '(none)'}, Src: ${f.src}`);
    });

    // Check all table rows
    const tableInfo = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      const allRows = Array.from(document.querySelectorAll('tr'));

      return {
        tableCount: tables.length,
        rowCount: allRows.length,
        tablesWithManyRows: tables.filter(t => t.querySelectorAll('tr').length > 5).map(t => ({
          rows: t.querySelectorAll('tr').length,
          id: t.id || '(no id)',
          class: t.className || '(no class)'
        }))
      };
    });

    console.log(`\nFound ${tableInfo.tableCount} tables, ${tableInfo.rowCount} total rows`);
    console.log(`Tables with 5+ rows:`);
    tableInfo.tablesWithManyRows.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.rows} rows, ID: ${t.id}, Class: ${t.class}`);
    });

    // Try to find the DevExpress grid control (common in ASP.NET apps)
    const devExpressInfo = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div[id*="Grid"], div[id*="grid"], div[class*="dx"], div[class*="Grid"]'));
      return divs.slice(0, 10).map(d => ({
        id: d.id,
        class: d.className.substring(0, 100),
        hasTable: !!d.querySelector('table')
      }));
    });

    console.log(`\nFound ${devExpressInfo.length} potential grid controls:`);
    devExpressInfo.forEach((d, i) => {
      console.log(`  ${i + 1}. ID: ${d.id || '(none)'}, Class: ${d.class}, Has Table: ${d.hasTable}`);
    });

    // Look for data in script tags or JSON
    const hasJsonData = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        if (script.textContent.includes('201604220703') || script.textContent.includes('2158020070')) {
          return true;
        }
      }
      return false;
    });

    console.log(`\nData in script tags: ${hasJsonData}`);

    console.log('\n⏸️  Browser staying open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreIframe();
