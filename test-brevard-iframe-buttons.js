/**
 * Check what buttons/elements are in the iframe
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function checkIframe() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  const url = 'https://vaclmweb1.brevardclerk.us/AcclaimWeb/Details/GetDocumentbyBookPage/OR/6790/1266';
  console.log(`Navigating to: ${url}`);

  await page.goto(url, { waitUntil: 'networkidle0' });

  // Wait for iframe
  await new Promise(r => setTimeout(r, 5000));

  const iframeElement = await page.$('iframe');

  if (!iframeElement) {
    console.log('No iframe found');
    await browser.close();
    return;
  }

  console.log('✅ Found iframe');

  const frame = await iframeElement.contentFrame();

  if (!frame) {
    console.log('Could not access iframe');
    await browser.close();
    return;
  }

  console.log('✅ Accessed iframe content');

  // Wait for content
  await new Promise(r => setTimeout(r, 3000));

  // Get all elements
  const elements = await frame.evaluate(() => {
    const result = {
      buttons: [],
      links: [],
      allElements: []
    };

    // Get all buttons
    document.querySelectorAll('button').forEach(btn => {
      result.buttons.push({
        text: btn.textContent,
        title: btn.title,
        id: btn.id,
        className: btn.className,
        ariaLabel: btn.getAttribute('aria-label')
      });
    });

    // Get all links
    document.querySelectorAll('a').forEach(link => {
      result.links.push({
        text: link.textContent,
        href: link.href,
        title: link.title,
        id: link.id,
        className: link.className
      });
    });

    // Get all interactive elements
    document.querySelectorAll('*').forEach(el => {
      const text = (el.textContent || '').trim();
      const tag = el.tagName.toLowerCase();

      if (tag === 'button' || tag === 'a' || tag === 'input' ||
          el.onclick || el.getAttribute('role') === 'button') {
        result.allElements.push({
          tag,
          text: text.substring(0, 100),
          id: el.id,
          className: el.className,
          title: el.title,
          onclick: el.onclick ? 'yes' : 'no'
        });
      }
    });

    return result;
  });

  console.log('\n=== BUTTONS ===');
  console.log(JSON.stringify(elements.buttons, null, 2));

  console.log('\n=== LINKS ===');
  console.log(JSON.stringify(elements.links, null, 2));

  console.log('\n=== ALL INTERACTIVE ELEMENTS (first 20) ===');
  console.log(JSON.stringify(elements.allElements.slice(0, 20), null, 2));

  console.log('\n\nKeeping browser open. Press Ctrl+C to exit...');
  await new Promise(() => {});
}

checkIframe().catch(console.error);
