/**
 * Inspect the Duval County Clerk page to understand PDF viewing mechanism
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function inspectClerkPage() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const clerkUrl = 'http://oncore.duvalclerk.com/showdetails.aspx?Book=21348&Page=475&BookType=OR';

    console.log('Navigating to Duval County Clerk page...');
    console.log('URL:', clerkUrl);

    // Monitor network requests
    const requests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('pdf') || url.includes('PDF') || url.includes('image') || url.includes('Image') || url.includes('document') || url.includes('Document')) {
        requests.push(url);
        console.log('📥 Captured request:', url.substring(0, 120));
      }
    });

    await page.goto(clerkUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('\nPage loaded successfully!\n');
    await wait(5000);

    console.log('\n=== Page Analysis ===\n');

    // Check for iframes
    const iframes = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('iframe'));
      return frames.map(f => ({
        id: f.id,
        name: f.name,
        src: f.src,
        width: f.width,
        height: f.height
      }));
    });

    console.log('Iframes found:', iframes.length);
    iframes.forEach((frame, i) => {
      console.log((i + 1) + '. ID:', frame.id || '(none)');
      console.log('   Name:', frame.name || '(none)');
      console.log('   Src:', frame.src || '(none)');
      console.log('');
    });

    // Check for PDF-related links
    const pdfLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links.filter(link => {
        const href = (link.href || '').toLowerCase();
        const text = (link.textContent || '').trim();
        return href.includes('pdf') || href.includes('document') || href.includes('image') ||
               text.toLowerCase().includes('pdf') || text.toLowerCase().includes('view') || text.toLowerCase().includes('download');
      }).map(link => ({
        text: link.textContent.trim(),
        href: link.href,
        id: link.id,
        className: link.className
      }));
    });

    console.log('\nPDF-related links found:', pdfLinks.length);
    pdfLinks.forEach((link, i) => {
      console.log((i + 1) + '. Text:', link.text.substring(0, 50));
      console.log('   Href:', link.href.substring(0, 100));
      console.log('   ID:', link.id || '(none)');
      console.log('   Class:', link.className || '(none)');
      console.log('');
    });

    // Check for buttons
    const buttons = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
      return btns.map(btn => ({
        type: btn.type,
        id: btn.id,
        value: btn.value || '',
        text: btn.textContent || '',
        onclick: btn.onclick ? btn.onclick.toString().substring(0, 100) : ''
      }));
    });

    console.log('\nButtons found:', buttons.length);
    buttons.forEach((btn, i) => {
      console.log((i + 1) + '. Type:', btn.type);
      console.log('   ID:', btn.id || '(none)');
      console.log('   Value:', btn.value);
      console.log('   Text:', btn.text.trim().substring(0, 50));
      console.log('   Onclick:', btn.onclick);
      console.log('');
    });

    console.log('\n=== Captured Network Requests ===\n');
    console.log('Total requests:', requests.length);
    requests.forEach((req, i) => {
      console.log((i + 1) + '. ' + req);
    });

    console.log('\n\nBrowser will stay open for 5 minutes. Press Ctrl+C to close.\n');
    await wait(300000);

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

inspectClerkPage();
