/**
 * Debug script to find the CORRECT download button after clicking document number
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDownloadButton() {
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
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
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

    console.log('⏳ Waiting for results to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Click document number
    console.log('\n🖱️  Clicking document number...');
    const docClicked = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/\b(\d{10})\b/);

      if (match) {
        const docNum = match[1];
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

    if (!docClicked.success) {
      console.log('❌ Could not click document number');
      return;
    }

    console.log(`✅ Clicked document number: ${docClicked.docNum}`);
    console.log('⏳ Waiting for document detail page to load...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // NOW ANALYZE THE DOCUMENT DETAIL PAGE
    console.log('\n=== ANALYZING DOCUMENT DETAIL PAGE ===\n');

    const pageAnalysis = await page.evaluate(() => {
      return {
        url: window.location.href,

        // Body text preview
        bodyText: document.body.innerText.substring(0, 500),

        // ALL clickable elements in upper half of page
        upperRightElements: Array.from(document.querySelectorAll('a, button, i, img, div, span')).map(el => {
          const rect = el.getBoundingClientRect();
          const text = (el.textContent || el.title || el.alt || '').trim();
          const className = el.className || '';
          const id = el.id || '';

          // Only include elements in upper half of page and visible
          if (rect.y < window.innerHeight / 2 && el.offsetParent !== null) {
            return {
              tag: el.tagName,
              text: text.substring(0, 100),
              className: className,
              id: id,
              href: el.href || null,
              src: el.src || null,
              position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              innerHTML: el.innerHTML.substring(0, 200)
            };
          }
          return null;
        }).filter(x => x !== null),

        // Look specifically for download-related elements
        downloadElements: Array.from(document.querySelectorAll('*')).map(el => {
          const text = (el.textContent || el.title || el.alt || '').toLowerCase();
          const className = (el.className || '').toLowerCase();
          const id = (el.id || '').toLowerCase();

          if ((text.includes('download') || text.includes('pdf') || text.includes('print') ||
               className.includes('download') || className.includes('pdf') || className.includes('print') ||
               id.includes('download') || id.includes('pdf') || id.includes('print')) &&
              el.offsetParent !== null) {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              text: (el.textContent || el.title || el.alt || '').trim().substring(0, 100),
              className: el.className,
              id: el.id,
              href: el.href || null,
              position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
              },
              innerHTML: el.innerHTML.substring(0, 200)
            };
          }
          return null;
        }).filter(x => x !== null),

        // Look for iframes (PDF might be in iframe)
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          id: iframe.id,
          className: iframe.className,
          src: iframe.src,
          visible: iframe.offsetParent !== null
        })),

        // Check for new windows/popups
        windowCount: window.length
      };
    });

    console.log('Current URL:', pageAnalysis.url);
    console.log('\n=== BODY TEXT PREVIEW ===');
    console.log(pageAnalysis.bodyText);
    console.log('\n\n=== ALL UPPER-RIGHT CLICKABLE ELEMENTS ===');
    console.log(JSON.stringify(pageAnalysis.upperRightElements, null, 2));
    console.log('\n\n=== DOWNLOAD-RELATED ELEMENTS ===');
    console.log(JSON.stringify(pageAnalysis.downloadElements, null, 2));
    console.log('\n\n=== IFRAMES ===');
    console.log(JSON.stringify(pageAnalysis.iframes, null, 2));

    await page.screenshot({ path: '/tmp/durham-download-button.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/durham-download-button.png');

    // Try clicking each download element and see what happens
    console.log('\n\n=== TESTING DOWNLOAD BUTTONS ===\n');

    for (let i = 0; i < Math.min(3, pageAnalysis.downloadElements.length); i++) {
      const el = pageAnalysis.downloadElements[i];
      console.log(`\nTesting element ${i + 1}:`);
      console.log(`  Tag: ${el.tag}`);
      console.log(`  Text: ${el.text}`);
      console.log(`  Class: ${el.className}`);
      console.log(`  ID: ${el.id}`);

      // Get current window count
      const beforePages = await browser.pages();
      console.log(`  Windows before: ${beforePages.length}`);

      // Click the element
      const clicked = await page.evaluate((className, id, text) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const target = elements.find(el => {
          const elClass = el.className || '';
          const elId = el.id || '';
          const elText = (el.textContent || '').trim();
          return elClass === className && elId === id && elText.startsWith(text.substring(0, 20));
        });

        if (target) {
          target.click();
          return true;
        }
        return false;
      }, el.className, el.id, el.text);

      console.log(`  Click success: ${clicked}`);

      // Wait for potential new window
      await new Promise(resolve => setTimeout(resolve, 5000));

      const afterPages = await browser.pages();
      console.log(`  Windows after: ${afterPages.length}`);

      if (afterPages.length > beforePages.length) {
        console.log('  ✅ NEW WINDOW OPENED!');
        const newPage = afterPages[afterPages.length - 1];
        console.log(`  New window URL: ${newPage.url()}`);

        // Take screenshot of new window
        await newPage.screenshot({ path: `/tmp/durham-new-window-${i}.png` });
        console.log(`  📸 New window screenshot: /tmp/durham-new-window-${i}.png`);
      }
    }

    console.log('\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugDownloadButton().catch(console.error);
