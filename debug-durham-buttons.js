/**
 * Debug script to analyze what buttons/elements are available after clicking document number
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugButtons() {
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
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      const searchBtn = buttons.find(btn => {
        const text = btn.textContent.toLowerCase() || btn.value?.toLowerCase() || '';
        return text.includes('search') && !text.includes('clear');
      });

      if (searchBtn) {
        searchBtn.click();
        return true;
      }
      return false;
    });

    if (!searchClicked) {
      console.log('⚠️ Could not find search button, trying Enter');
      await page.keyboard.press('Enter');
    }

    console.log('⏳ Waiting for results to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Find and click document number
    console.log('\n🖱️  Finding and clicking document number...');
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
    console.log('⏳ Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // NOW ANALYZE THE PAGE
    console.log('\n=== ANALYZING PAGE AFTER CLICKING DOCUMENT NUMBER ===\n');

    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        bodyTextPreview: document.body.innerText.substring(0, 800),

        // All clickable elements
        allClickableElements: Array.from(document.querySelectorAll('a, button, input[type="button"], input[type="submit"], div[onclick], span[onclick]'))
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.value || '').trim().substring(0, 100),
            className: el.className,
            id: el.id,
            href: el.href || null
          })),

        // Specific search for download/view related elements
        downloadViewElements: Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const text = (el.textContent || el.title || el.alt || '').toLowerCase();
            const className = (el.className || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            return (text.includes('download') || text.includes('view') || text.includes('pdf') ||
                    className.includes('download') || className.includes('view') || className.includes('pdf') ||
                    id.includes('download') || id.includes('view') || id.includes('pdf')) &&
                   el.offsetParent !== null;
          })
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.title || el.alt || '').trim().substring(0, 100),
            className: el.className,
            id: el.id,
            visible: el.offsetParent !== null
          })),

        // Check for iframes
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className
        }))
      };
    });

    console.log('Current URL:', analysis.url);
    console.log('\n=== BODY TEXT PREVIEW ===');
    console.log(analysis.bodyTextPreview);
    console.log('\n\n=== ALL CLICKABLE ELEMENTS ===');
    console.log(JSON.stringify(analysis.allClickableElements, null, 2));
    console.log('\n\n=== DOWNLOAD/VIEW RELATED ELEMENTS ===');
    console.log(JSON.stringify(analysis.downloadViewElements, null, 2));
    console.log('\n\n=== IFRAMES ===');
    console.log(JSON.stringify(analysis.iframes, null, 2));

    await page.screenshot({ path: '/tmp/durham-after-doc-click.png', fullPage: true });
    console.log('\n📸 Screenshot saved: /tmp/durham-after-doc-click.png');

    console.log('\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugButtons().catch(console.error);
