/**
 * Debug Guilford County PDF download page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugPdfPage() {
  console.log('🔍 Debugging Guilford County PDF page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate to search
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

    // Submit
    console.log('Step 4: Submit...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click parcel
    console.log('Step 5: Click parcel 60312...');
    const parcelHref = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.trim() === '60312') {
          return link.href;
        }
      }
    });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.evaluate((href) => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
        if (link) link.click();
      }, parcelHref)
    ]);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Deeds tab
    console.log('Step 6: Click Deeds tab...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"]'));
      for (const el of allElements) {
        if (el.textContent.trim().toLowerCase() === 'deeds') {
          el.click();
          return true;
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click CORR DEED
    console.log('Step 7: Click CORR DEED...');
    await page.evaluate(() => {
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
                  link.click();
                  return true;
                }
              }
            }
          }
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    await page.screenshot({ path: 'guilford-pdf-page.png', fullPage: true });
    console.log('📸 Screenshot: guilford-pdf-page.png\n');

    // Analyze PDF page
    console.log('Step 8: Analyzing PDF page...\n');
    const pdfPageInfo = await page.evaluate(() => {
      // Look for iframes
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const iframeInfo = iframes.map(iframe => ({
        src: iframe.src,
        id: iframe.id,
        hasPdf: iframe.src.includes('.pdf') || iframe.src.includes('pdf')
      }));

      // Look for embed/object
      const embeds = Array.from(document.querySelectorAll('embed, object'));
      const embedInfo = embeds.map(embed => ({
        src: embed.src || embed.data,
        type: embed.type
      }));

      // Look for links
      const allLinks = Array.from(document.querySelectorAll('a'));
      const linkInfo = allLinks
        .filter(link => {
          const text = link.textContent.toLowerCase();
          const href = link.href.toLowerCase();
          return text.includes('pdf') || text.includes('view') || text.includes('download') ||
                 href.includes('.pdf') || href.includes('showdocument') || href.includes('viewdocument');
        })
        .map(link => ({
          text: link.textContent.trim(),
          href: link.href
        }));

      // Look for buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"]'));
      const buttonInfo = buttons.map(btn => ({
        text: btn.textContent.trim() || btn.value,
        id: btn.id,
        onclick: btn.onclick ? btn.onclick.toString() : null
      }));

      return {
        currentUrl: window.location.href,
        iframes: iframeInfo,
        embeds: embedInfo,
        links: linkInfo,
        buttons: buttonInfo,
        bodyText: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('=== PDF PAGE ANALYSIS ===');
    console.log('Current URL:', pdfPageInfo.currentUrl);
    console.log('\nIframes:', JSON.stringify(pdfPageInfo.iframes, null, 2));
    console.log('\nEmbeds:', JSON.stringify(pdfPageInfo.embeds, null, 2));
    console.log('\nRelevant Links:', JSON.stringify(pdfPageInfo.links, null, 2));
    console.log('\nButtons:', JSON.stringify(pdfPageInfo.buttons, null, 2));
    console.log('\nPage Text (first 1000 chars):', pdfPageInfo.bodyText);

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('guilford-pdf-page.html', html);
    console.log('\n✅ Saved: guilford-pdf-page.html');

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-pdf-error.png' });
  }
}

debugPdfPage().catch(console.error);
