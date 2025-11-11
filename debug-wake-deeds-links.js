/**
 * Debug Wake County Deeds page to find ALL clickable elements
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

    // NOW ANALYZE ALL CLICKABLE ELEMENTS ON DEEDS PAGE
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,

        // Get the full deeds table HTML
        deedsTableHTML: (() => {
          const tables = Array.from(document.querySelectorAll('table'));
          for (const table of tables) {
            const tableText = table.innerText.toLowerCase();
            if (tableText.includes('book') && tableText.includes('page') && tableText.includes('date')) {
              return table.outerHTML;
            }
          }
          return null;
        })(),

        // Find all links in the deeds table area
        deedsTableLinks: (() => {
          const tables = Array.from(document.querySelectorAll('table'));
          for (const table of tables) {
            const tableText = table.innerText.toLowerCase();
            if (tableText.includes('book') && tableText.includes('page') && tableText.includes('date')) {
              const links = Array.from(table.querySelectorAll('a'));
              return links.map(a => ({
                text: a.textContent.trim(),
                href: a.href,
                onclick: a.getAttribute('onclick')
              }));
            }
          }
          return [];
        })(),

        // Find the specific cell with page number 2621
        pageCell: (() => {
          const tables = Array.from(document.querySelectorAll('table'));
          for (const table of tables) {
            const headers = Array.from(table.querySelectorAll('th'));
            const pageColIndex = headers.findIndex(th =>
              th.textContent.trim().toLowerCase() === 'page'
            );

            if (pageColIndex !== -1) {
              const rows = Array.from(table.querySelectorAll('tbody tr'));
              for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells[pageColIndex]) {
                  const pageCell = cells[pageColIndex];
                  return {
                    text: pageCell.textContent.trim(),
                    innerHTML: pageCell.innerHTML,
                    hasLink: pageCell.querySelector('a') !== null,
                    hasOnclick: pageCell.hasAttribute('onclick'),
                    onclick: pageCell.getAttribute('onclick')
                  };
                }
              }
            }
          }
          return null;
        })(),

        // Check if book numbers are clickable
        bookCell: (() => {
          const tables = Array.from(document.querySelectorAll('table'));
          for (const table of tables) {
            const headers = Array.from(table.querySelectorAll('th'));
            const bookColIndex = headers.findIndex(th =>
              th.textContent.trim().toLowerCase() === 'book'
            );

            if (bookColIndex !== -1) {
              const rows = Array.from(table.querySelectorAll('tbody tr'));
              for (const row of rows) {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells[bookColIndex]) {
                  const bookCell = cells[bookColIndex];
                  return {
                    text: bookCell.textContent.trim(),
                    innerHTML: bookCell.innerHTML,
                    hasLink: bookCell.querySelector('a') !== null,
                    hasOnclick: bookCell.hasAttribute('onclick'),
                    onclick: bookCell.getAttribute('onclick')
                  };
                }
              }
            }
          }
          return null;
        })(),

        // Look for any "view" or "download" text near the deeds
        viewDownloadElements: Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const text = el.textContent.toLowerCase();
            return (text.includes('view') || text.includes('download') || text.includes('pdf'))
                   && el.offsetParent !== null
                   && el.textContent.trim().length < 50;
          })
          .map(el => ({
            tag: el.tagName,
            text: el.textContent.trim(),
            href: el.href || null,
            onclick: el.getAttribute('onclick')
          }))
      };
    });

    console.log('\n=== DEEDS PAGE DETAILED ANALYSIS ===');
    console.log('URL:', analysis.url);
    console.log('\n=== DEEDS TABLE LINKS ===');
    console.log(JSON.stringify(analysis.deedsTableLinks, null, 2));
    console.log('\n=== PAGE CELL (2621) ===');
    console.log(JSON.stringify(analysis.pageCell, null, 2));
    console.log('\n=== BOOK CELL (16838) ===');
    console.log(JSON.stringify(analysis.bookCell, null, 2));
    console.log('\n=== VIEW/DOWNLOAD ELEMENTS ===');
    console.log(JSON.stringify(analysis.viewDownloadElements, null, 2));
    console.log('\n=== DEEDS TABLE HTML (first 2000 chars) ===');
    console.log(analysis.deedsTableHTML ? analysis.deedsTableHTML.substring(0, 2000) : 'Not found');

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
