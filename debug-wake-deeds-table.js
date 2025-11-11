/**
 * Debug Wake County Deeds table to find page numbers
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Wake County Real Estate Search...');
    await page.goto('https://services.wake.gov/realestate/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill search fields
    console.log('📝 Filling search fields...');
    await page.type('input[name="stnum"]', '4501');
    await page.type('input[name="stname"]', 'rockwood');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click search
    console.log('🔍 Clicking search...');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="image"]'));
      const searchBtn = inputs.find(input => input.name === 'Search by Address');
      if (searchBtn) searchBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click account
    console.log('🖱️  Clicking account...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (/^\d{7}$/.test(link.textContent.trim())) {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click Deeds tab
    console.log('📄 Clicking Deeds tab...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.trim().toLowerCase() === 'deeds') {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // NOW ANALYZE THE DEEDS TABLE
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 1500),

        // Find all tables
        tables: Array.from(document.querySelectorAll('table')).map((table, idx) => ({
          index: idx,
          text: table.innerText.substring(0, 500),
          headers: Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim()),
          firstRowCells: Array.from(table.querySelectorAll('tbody tr:first-child td')).map(td => ({
            text: td.textContent.trim(),
            html: td.innerHTML.substring(0, 100)
          }))
        })),

        // Find all links with numbers
        numberLinks: Array.from(document.querySelectorAll('a'))
          .filter(a => /\d+/.test(a.textContent.trim()))
          .map(a => ({
            text: a.textContent.trim(),
            href: a.href
          }))
      };
    });

    console.log('\n=== DEEDS PAGE ANALYSIS ===');
    console.log('URL:', analysis.url);
    console.log('Title:', analysis.title);
    console.log('\nBody preview:');
    console.log(analysis.bodyPreview);
    console.log('\n=== TABLES ===');
    console.log(JSON.stringify(analysis.tables, null, 2));
    console.log('\n=== NUMBER LINKS ===');
    console.log(JSON.stringify(analysis.numberLinks.slice(0, 10), null, 2));

    console.log('\n\nWaiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
