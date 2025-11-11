/**
 * Debug Wake County PDF download page
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

    // Click first page number
    console.log('📃 Clicking first page entry...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent.trim();
        if (/^\d{4}$/.test(text)) {
          console.log('Found page link:', text);
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 8000));

    // Analyze PDF page
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 1000),

        // Find all iframes
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className,
          visible: iframe.offsetParent !== null
        })),

        // Find all PDF-related links
        pdfLinks: Array.from(document.querySelectorAll('a'))
          .filter(a => {
            const href = (a.href || '').toLowerCase();
            const text = (a.textContent || '').toLowerCase();
            return href.includes('.pdf') || text.includes('pdf') || text.includes('view') || text.includes('download');
          })
          .map(a => ({
            text: a.textContent.trim(),
            href: a.href
          })),

        // Check for PDF embeds or objects
        embeds: Array.from(document.querySelectorAll('embed, object')).map(el => ({
          tag: el.tagName,
          src: el.src || el.data,
          type: el.type
        }))
      };
    });

    console.log('\n=== PDF PAGE ANALYSIS ===');
    console.log('URL:', analysis.url);
    console.log('Title:', analysis.title);
    console.log('\nBody preview:');
    console.log(analysis.bodyPreview);
    console.log('\n=== IFRAMES ===');
    console.log(JSON.stringify(analysis.iframes, null, 2));
    console.log('\n=== PDF LINKS ===');
    console.log(JSON.stringify(analysis.pdfLinks, null, 2));
    console.log('\n=== EMBEDS/OBJECTS ===');
    console.log(JSON.stringify(analysis.embeds, null, 2));

    console.log('\n\nWaiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
