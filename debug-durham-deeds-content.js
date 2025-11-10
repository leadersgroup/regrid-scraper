/**
 * Debug script to see actual content on Deeds tab
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDeedsContent() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Durham Property search...');
    await page.goto('https://property.spatialest.com/nc/durham-tax/#/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search
    console.log('🔍 Searching for: 6409 winding arch dr');
    await page.waitForSelector('#searchTerm', { timeout: 10000 });
    const searchInput = await page.$('#searchTerm');
    await searchInput.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    await searchInput.type('6409 winding arch dr');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Click Search button
    console.log('🔍 Clicking Search button...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const searchButton = buttons.find(btn => {
        const text = btn.textContent.trim();
        return text.includes('Search') || btn.querySelector('.fa-search');
      });
      if (searchButton) searchButton.click();
    });
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Click parcel ID
    console.log('📄 Clicking parcel ID...');
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        for (const cell of cells) {
          const text = cell.textContent.trim();
          if (/^\d{5,}$/.test(text)) {
            const link = cell.querySelector('a');
            if (link) {
              link.click();
              return;
            }
            cell.click();
            return;
          }
        }
      }
    });

    // Wait for new window
    console.log('⏳ Waiting for new window...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Switch to new window
    const pages = await browser.pages();
    let newPage = null;
    for (const p of pages) {
      const url = p.url();
      if (url.includes('PropertySummary.aspx')) {
        newPage = p;
        break;
      }
    }

    if (!newPage) {
      console.log('❌ Could not find property detail window');
      return;
    }

    const newUrl = newPage.url();
    console.log('✅ Switched to:', newUrl);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Deeds tab
    console.log('📄 Clicking Deeds tab...');
    await newPage.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('a, button, div, span'));
      const deedsTab = elements.find(el => {
        const text = el.textContent.trim().toLowerCase();
        return text === 'deeds' && el.offsetParent !== null;
      });
      if (deedsTab) deedsTab.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Analyze the ENTIRE Deeds tab content
    console.log('\n=== ANALYZING DEEDS TAB CONTENT ===\n');
    const deedsContent = await newPage.evaluate(() => {
      return {
        url: window.location.href,
        fullBodyText: document.body.innerText,
        tables: Array.from(document.querySelectorAll('table')).map((table, idx) => ({
          index: idx,
          rows: Array.from(table.querySelectorAll('tr')).map(row => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            return cells.map(cell => cell.textContent.trim());
          })
        }))
      };
    });

    console.log('=== FULL BODY TEXT ===');
    console.log(deedsContent.fullBodyText);
    console.log('\n\n=== TABLES ===');
    console.log(JSON.stringify(deedsContent.tables, null, 2));

    await newPage.screenshot({ path: '/tmp/durham-deeds-content.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/durham-deeds-content.png');

    console.log('\n⏳ Waiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugDeedsContent().catch(console.error);
