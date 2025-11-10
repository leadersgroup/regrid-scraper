/**
 * Debug script to analyze Register of Deeds RESULTS page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugRegisterOfDeedsResults() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Register of Deeds...');
    await page.goto('https://rodweb.dconc.gov/web/search/DOCSEARCH5S1', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Dismiss disclaimer
    const disclaimerBtn = await page.$('#submitDisclaimerAccept');
    if (disclaimerBtn) {
      console.log('📝 Clicking "I Accept"...');
      await disclaimerBtn.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        console.log('⚠️ No navigation detected');
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('✅ Dismissed disclaimer');
    }

    // Fill in book and page
    console.log('\n📝 Filling book: 010204 and page: 00989');
    const bookField = await page.$('#field_BookPageID_DOT_Volume');
    const pageField = await page.$('#field_BookPageID_DOT_Page');

    await bookField.click({ clickCount: 3 });
    await bookField.type('010204');
    await new Promise(resolve => setTimeout(resolve, 500));

    await pageField.click({ clickCount: 3 });
    await pageField.type('00989');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click search
    console.log('🔍 Clicking search button...');
    const searchClicked = await page.evaluate(() => {
      // The search button is a link with id="searchButton"
      const searchBtn = document.querySelector('#searchButton');
      if (searchBtn) {
        searchBtn.click();
        return true;
      }
      return false;
    });

    if (!searchClicked) {
      console.log('❌ Could not find search button');
      return;
    }

    console.log('⏳ Waiting for results to load dynamically...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // COMPREHENSIVE ANALYSIS OF RESULTS PAGE
    console.log('\n=== ANALYZING RESULTS PAGE ===\n');

    const pageAnalysis = await page.evaluate(() => {
      return {
        url: window.location.href,

        // Full body text
        bodyText: document.body.innerText,

        // All tables
        tables: Array.from(document.querySelectorAll('table')).map((table, idx) => ({
          tableIndex: idx,
          id: table.id,
          className: table.className,
          rows: Array.from(table.querySelectorAll('tr')).map((row, rowIdx) => ({
            rowIndex: rowIdx,
            cells: Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent.trim()),
            html: row.innerHTML.substring(0, 300)
          }))
        })),

        // All links
        links: Array.from(document.querySelectorAll('a')).map((link, idx) => ({
          index: idx,
          text: link.textContent.trim(),
          href: link.href,
          className: link.className,
          id: link.id,
          visible: link.offsetParent !== null
        })),

        // All clickable elements
        clickableElements: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [onclick], [class*="click"], [class*="button"]')).map(el => ({
          tag: el.tagName,
          text: (el.textContent || el.value || '').trim(),
          className: el.className,
          id: el.id,
          onclick: el.onclick ? el.onclick.toString().substring(0, 100) : null,
          visible: el.offsetParent !== null
        })),

        // Look for document numbers (various patterns)
        potentialDocNumbers: Array.from(document.querySelectorAll('td, span, div')).map(el => {
          const text = el.textContent.trim();
          // Look for numbers that might be document IDs
          if (/^\d{7,12}$/.test(text) || /^[A-Z0-9]{8,15}$/.test(text)) {
            return {
              text: text,
              tag: el.tagName,
              className: el.className,
              parentTag: el.parentElement?.tagName,
              nearbyText: el.parentElement?.textContent.trim().substring(0, 100)
            };
          }
          return null;
        }).filter(x => x !== null)
      };
    });

    console.log('Current URL:', pageAnalysis.url);
    console.log('\n=== FULL BODY TEXT ===');
    console.log(pageAnalysis.bodyText);
    console.log('\n\n=== ALL TABLES ===');
    console.log(JSON.stringify(pageAnalysis.tables, null, 2));
    console.log('\n\n=== ALL LINKS ===');
    console.log(JSON.stringify(pageAnalysis.links, null, 2));
    console.log('\n\n=== CLICKABLE ELEMENTS ===');
    console.log(JSON.stringify(pageAnalysis.clickableElements, null, 2));
    console.log('\n\n=== POTENTIAL DOCUMENT NUMBERS ===');
    console.log(JSON.stringify(pageAnalysis.potentialDocNumbers, null, 2));

    await page.screenshot({ path: '/tmp/durham-rod-results.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/durham-rod-results.png');

    // Now click the document number
    console.log('\n=== CLICKING DOCUMENT NUMBER ===\n');
    const docClicked = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/\b(\d{10})\b/);

      if (match) {
        const docNum = match[1];
        console.log('Found doc num:', docNum);

        // Find clickable element with this doc num
        const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));
        for (const el of allElements) {
          const text = el.textContent.trim();
          if (text === docNum || text.startsWith(docNum)) {
            el.click();
            return { success: true, docNum };
          }
        }
      }

      return { success: false };
    });

    console.log('Click result:', JSON.stringify(docClicked, null, 2));

    if (docClicked.success) {
      console.log('⏳ Waiting after click...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('\n=== ANALYZING PAGE AFTER CLICK ===\n');
      const afterClick = await page.evaluate(() => {
        return {
          url: window.location.href,
          bodyText: document.body.innerText,
          links: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent.trim().substring(0, 100),
            href: a.href
          })),
          iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
            src: iframe.src,
            id: iframe.id
          })),
          buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
            text: (btn.textContent || btn.value || '').trim(),
            className: btn.className
          }))
        };
      });

      console.log('URL after click:', afterClick.url);
      console.log('\n=== BODY TEXT ===');
      console.log(afterClick.bodyText.substring(0, 1000));
      console.log('\n\n=== LINKS ===');
      console.log(JSON.stringify(afterClick.links.slice(0, 20), null, 2));
      console.log('\n\n=== IFRAMES ===');
      console.log(JSON.stringify(afterClick.iframes, null, 2));
      console.log('\n\n=== BUTTONS ===');
      console.log(JSON.stringify(afterClick.buttons, null, 2));

      await page.screenshot({ path: '/tmp/durham-rod-after-click.png', fullPage: true });
      console.log('\n📸 Screenshot after click: /tmp/durham-rod-after-click.png');
    }

    console.log('\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugRegisterOfDeedsResults().catch(console.error);
