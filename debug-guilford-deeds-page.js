/**
 * Debug Guilford County Deeds page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugDeedsPage() {
  console.log('🔍 Debugging Guilford County Deeds page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate and search
    console.log('Step 1: Navigate...');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Location Address tab
    console.log('Step 2: Click Location Address tab...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      for (const link of links) {
        if (link.textContent.trim().includes('Location Address')) {
          link.click();
          return true;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill address
    console.log('Step 3: Fill address...');
    await page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', { visible: true });
    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', '1205');
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', 'Glendale');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit search
    console.log('Step 4: Submit search...');
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click first parcel
    console.log('Step 5: Click parcel...');
    const parcelClicked = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        let parcelColumnIndex = -1;

        for (const row of rows) {
          const headers = Array.from(row.querySelectorAll('th'));
          for (let i = 0; i < headers.length; i++) {
            if (headers[i].textContent.toLowerCase().includes('parcel')) {
              parcelColumnIndex = i;
              break;
            }
          }
          if (parcelColumnIndex !== -1) break;
        }

        if (parcelColumnIndex !== -1) {
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length > parcelColumnIndex) {
              const link = cells[parcelColumnIndex].querySelector('a');
              if (link) {
                const parcelNumber = link.textContent.trim();
                link.click();
                return { success: true, parcelNumber };
              }
            }
          }
        }
      }
      return { success: false };
    });
    console.log('Parcel clicked:', parcelClicked);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click Deeds tab
    console.log('Step 6: Click Deeds tab...');
    const deedsClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.trim().toLowerCase() === 'deeds') {
          link.click();
          return true;
        }
      }
      return false;
    });
    console.log('Deeds tab clicked:', deedsClicked);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot of Deeds page
    await page.screenshot({ path: 'guilford-deeds-page.png', fullPage: true });
    console.log('📸 Screenshot: guilford-deeds-page.png\n');

    // Analyze Deeds page structure
    console.log('Step 7: Analyzing Deeds page structure...\n');
    const deedsPageInfo = await page.evaluate(() => {
      // Look for all tables
      const tables = Array.from(document.querySelectorAll('table'));
      const tableInfo = tables.map((table, idx) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const rows = table.querySelectorAll('tr').length;
        return { index: idx, headers, rows };
      });

      // Look for "Deed Type" text
      const bodyText = document.body.innerText;
      const hasDeedType = bodyText.includes('Deed Type');

      // Look for all links
      const allLinks = Array.from(document.querySelectorAll('a'));
      const linkTexts = allLinks.map(link => ({
        text: link.textContent.trim(),
        href: link.href,
        visible: link.offsetParent !== null
      })).filter(l => l.text && l.visible).slice(0, 30);

      // Look for tabs
      const tabs = Array.from(document.querySelectorAll('a[data-toggle="tab"], .nav-tabs a, .nav-pills a'));
      const tabInfo = tabs.map(tab => tab.textContent.trim());

      return {
        tables: tableInfo,
        hasDeedType,
        links: linkTexts,
        tabs: tabInfo,
        currentUrl: window.location.href
      };
    });

    console.log('=== DEEDS PAGE ANALYSIS ===');
    console.log('Current URL:', deedsPageInfo.currentUrl);
    console.log('\nTabs found:', deedsPageInfo.tabs);
    console.log('\nHas "Deed Type" text:', deedsPageInfo.hasDeedType);
    console.log('\nTables:', JSON.stringify(deedsPageInfo.tables, null, 2));
    console.log('\nLinks (first 30):', JSON.stringify(deedsPageInfo.links, null, 2));

    // Save page HTML
    const pageHTML = await page.content();
    fs.writeFileSync('guilford-deeds-page.html', pageHTML);
    console.log('\n✅ HTML saved: guilford-deeds-page.html');

    console.log('\n⏸️  Keeping browser open for manual inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-deeds-error.png' });
  }
}

debugDeedsPage().catch(console.error);
