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
    // Go to Register of Deeds
    console.log('Going to Register of Deeds...');
    await page.goto('https://rodweb.dconc.gov/web/search/DOCSEARCH5S1', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    // Accept disclaimer
    const disclaimer = await page.$('#submitDisclaimerAccept');
    if (disclaimer) {
      await disclaimer.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    // Fill in book and page
    console.log('Filling in book/page...');
    await page.type('#field_BookPageID_DOT_Volume', '010204');
    await page.type('#field_BookPageID_DOT_Page', '00989');
    await new Promise(r => setTimeout(r, 1000));

    // Click search
    console.log('Searching...');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 8000));

    console.log('Current URL after search:', page.url());

    // Find and click document number
    console.log('Looking for document number...');
    const docClicked = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/\b(\d{10})\b/);
      if (match) {
        const docNum = match[1];
        const allEls = Array.from(document.querySelectorAll('a, button, div, span, td'));
        for (const el of allEls) {
          if (el.textContent.trim() === docNum) {
            el.click();
            return { success: true, docNum };
          }
        }
      }
      return { success: false };
    });

    console.log('Document click result:', docClicked);
    await new Promise(r => setTimeout(r, 5000));

    console.log('Current URL after clicking doc:', page.url());

    // Analyze all View elements
    const viewAnalysis = await page.evaluate(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      const viewEls = allEls
        .filter(el => {
          const text = (el.textContent || '').trim();
          return text.match(/^View\s*→?\s*$/) && el.offsetParent !== null;
        })
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            text: el.textContent.trim(),
            href: el.href || el.parentElement?.href || 'none',
            className: el.className,
            y: rect.y,
            isClickable: !!(el.onclick || el.href || el.parentElement?.onclick || el.parentElement?.href)
          };
        });

      return {
        currentUrl: window.location.href,
        viewElements: viewEls,
        bodyPreview: document.body.innerText.substring(0, 300)
      };
    });

    console.log('\n=== VIEW ELEMENTS ANALYSIS ===');
    console.log('Current URL:', viewAnalysis.currentUrl);
    console.log('Body preview:', viewAnalysis.bodyPreview);
    console.log('\nAll "View" elements found:');
    console.log(JSON.stringify(viewAnalysis.viewElements, null, 2));

    console.log('\n\nWaiting 60 seconds for manual inspection...');
    await new Promise(r => setTimeout(r, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
