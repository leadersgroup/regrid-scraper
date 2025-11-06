/**
 * Find the actual PDF download method for Brevard
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function findPdf() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Navigate to the detail page
  const url = 'https://vaclmweb1.brevardclerk.us/AcclaimWeb/Details/GetDocumentbyBookPage/OR/6790/1266';
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Wait for page to load
  await new Promise(r => setTimeout(r, 5000));

  // Check for PDF download options
  const info = await page.evaluate(() => {
    const result = {
      buttons: [],
      links: [],
      pdfs: [],
      iframes: [],
      scripts: []
    };

    // Find all buttons
    document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(btn => {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('pdf') || text.includes('download') || text.includes('print') || text.includes('save')) {
        result.buttons.push({
          text: btn.textContent || btn.value,
          id: btn.id,
          onclick: btn.onclick ? btn.onclick.toString() : null
        });
      }
    });

    // Find all links
    document.querySelectorAll('a').forEach(link => {
      const href = link.href || '';
      const text = (link.textContent || '').toLowerCase();
      if (href.includes('pdf') || href.includes('download') || text.includes('pdf') || text.includes('download')) {
        result.links.push({
          href,
          text: link.textContent
        });
      }
    });

    // Find all iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      result.iframes.push({
        src: iframe.src,
        id: iframe.id,
        className: iframe.className
      });
    });

    // Look for script tags that might load PDF
    document.querySelectorAll('script').forEach(script => {
      const src = script.src || '';
      const content = script.textContent || '';
      if (src || content.includes('pdf') || content.includes('document') || content.includes('imgFrame')) {
        result.scripts.push({
          src,
          content: content.substring(0, 500)
        });
      }
    });

    return result;
  });

  console.log('\n=== BUTTONS ===');
  console.log(JSON.stringify(info.buttons, null, 2));

  console.log('\n=== LINKS ===');
  console.log(JSON.stringify(info.links, null, 2));

  console.log('\n=== IFRAMES ===');
  console.log(JSON.stringify(info.iframes, null, 2));

  console.log('\n=== SCRIPTS (first 3) ===');
  console.log(JSON.stringify(info.scripts.slice(0, 3), null, 2));

  // Wait and keep open for manual inspection
  console.log('\n\nKeeping browser open. Press Ctrl+C to exit...');
  await new Promise(() => {});
}

findPdf().catch(console.error);
