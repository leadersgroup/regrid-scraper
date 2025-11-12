/**
 * Debug Guilford County deed details page to find all available links
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDeedPage() {
  console.log('🔍 Debugging Guilford County deed details page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate to property search
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Location Address tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      const addressTab = tabs.find(tab => tab.textContent.includes('Location Address'));
      if (addressTab) addressTab.click();
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fill in search
    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', '1205');
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', 'Glendale');
    await page.keyboard.press('Enter');

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click on first parcel
    await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (/^\d+$/.test(text) && text.length >= 3) {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Deeds tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      const deedsTab = tabs.find(tab => tab.textContent.includes('Deeds'));
      if (deedsTab) deedsTab.click();
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click first deed type
    const deedUrl = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        let deedTypeColumnIndex = -1;
        let headerRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          const headers = Array.from(rows[i].querySelectorAll('th'));
          for (let j = 0; j < headers.length; j++) {
            const headerText = headers[j].textContent.toLowerCase().trim();
            if (headerText === 'deed type') {
              deedTypeColumnIndex = j;
              headerRowIndex = i;
              break;
            }
          }
          if (deedTypeColumnIndex !== -1) break;
        }

        if (deedTypeColumnIndex !== -1 && headerRowIndex !== -1) {
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = Array.from(row.querySelectorAll('td'));

            if (cells.length > deedTypeColumnIndex) {
              const deedTypeCell = cells[deedTypeColumnIndex];
              const link = deedTypeCell.querySelector('a');

              if (link) {
                const deedType = link.textContent.trim();
                if (deedType.length > 0 && deedType.toLowerCase().includes('deed')) {
                  return link.href;
                }
              }
            }
          }
        }
      }
      return null;
    });

    if (deedUrl) {
      console.log('Navigating to deed URL:', deedUrl);
      await page.goto(deedUrl, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const currentUrl = page.url();
    console.log('\n=== CURRENT PAGE ===');
    console.log('URL:', currentUrl);

    // Analyze all links on the page
    const allLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.map(link => ({
        text: link.textContent.trim().substring(0, 50),
        href: link.href,
        id: link.id,
        className: link.className,
        visible: link.offsetParent !== null
      }));
    });

    console.log('\n=== ALL LINKS ON PAGE ===');
    allLinks.forEach((link, idx) => {
      console.log(`${idx + 1}. ${link.text || '(no text)'}`);
      console.log(`   href: ${link.href}`);
      console.log(`   visible: ${link.visible}`);
      console.log('');
    });

    // Look specifically for CustomAttachmentsResource
    const customAttachment = allLinks.find(link => link.href.includes('CustomAttachmentsResource'));
    if (customAttachment) {
      console.log('✅ FOUND CustomAttachmentsResource:');
      console.log(JSON.stringify(customAttachment, null, 2));
    } else {
      console.log('❌ CustomAttachmentsResource NOT FOUND');
    }

    await page.screenshot({ path: 'guilford-deed-details-page.png', fullPage: true });
    console.log('\n📸 Screenshot saved: guilford-deed-details-page.png');

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-deed-debug-error.png' });
  }
}

debugDeedPage().catch(console.error);
