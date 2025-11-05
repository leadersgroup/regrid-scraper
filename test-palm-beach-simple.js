/**
 * Simple test to understand Palm Beach County workflow
 * Address: 6205 S Dixie Hwy, West Palm Beach, FL 33405, USA
 *
 * Workflow:
 * 1. Go to https://pbcpao.gov/index.htm
 * 2. Search by address
 * 3. Find Sales Information section
 * 4. Click first OR Book/Page link
 * 5. Download PDF using Orange County method
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testWorkflow() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Step 1: Navigate to Property Appraiser
    console.log('Step 1: Navigating to https://pbcpao.gov/index.htm');
    await page.goto('https://pbcpao.gov/index.htm', { waitUntil: 'networkidle2' });
    await wait(3000);

    // Step 2: Search by address
    const address = '6205 S Dixie Hwy';
    console.log(`Step 2: Searching for: ${address}`);

    // Find search input and enter address
    await page.waitForSelector('input[type="text"], input[type="search"]', { timeout: 10000 });
    const inputs = await page.$$('input[type="text"], input[type="search"]');

    for (const input of inputs) {
      try {
        await input.type(address, { delay: 100 });
        console.log('✅ Entered address');
        break;
      } catch (e) {
        // Try next input
      }
    }

    await wait(2000);
    await page.keyboard.press('Enter');
    await wait(5000);

    console.log('Current URL:', page.url());

    // Step 3: Look for Sales Information section
    console.log('Step 3: Looking for Sales Information section');

    const salesInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.includes('Sales Information') || text.includes('SALES INFORMATION')) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return { found: true };
        }
      }
      return { found: false };
    });

    console.log('Sales Information found:', salesInfo.found);
    await wait(3000);

    // Step 4: Find and click first OR Book/Page link
    console.log('Step 4: Finding OR Book/Page links');

    const bookPageLinks = await page.evaluate(() => {
      const results = [];
      const allLinks = Array.from(document.querySelectorAll('a'));

      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        // Look for pattern like "33358 / 1920"
        const match = text.match(/^(\d{4,6})\s*\/\s*(\d{3,5})$/);
        if (match) {
          results.push({
            text: text,
            href: link.href,
            bookNumber: match[1],
            pageNumber: match[2]
          });
        }
      }

      return results;
    });

    console.log('Found OR Book/Page links:', bookPageLinks.length);
    if (bookPageLinks.length > 0) {
      console.log('First link:', bookPageLinks[0]);

      // Set up network monitoring BEFORE navigating
      console.log('Setting up network monitoring...');
      const pdfRequests = [];

      const requestHandler = (request) => {
        const url = request.url();
        const resourceType = request.resourceType();

        if (url.includes('.pdf') || url.includes('/pdf') || url.includes('document') ||
            url.includes('Image') || url.includes('blob') || url.includes('DocumentImage') ||
            resourceType === 'document') {
          pdfRequests.push({
            url,
            resourceType,
            method: request.method()
          });
          console.log(`📥 Captured: ${resourceType} - ${url.substring(0, 100)}`);
        }
      };

      page.on('request', requestHandler);

      // Click the first link
      console.log('Clicking first OR Book/Page link...');
      const firstLink = bookPageLinks[0];

      await page.goto(firstLink.href, { waitUntil: 'networkidle2' });
      await wait(5000);

      page.off('request', requestHandler);

      console.log(`Found ${pdfRequests.length} PDF-related requests`);
      pdfRequests.forEach((req, idx) => {
        console.log(`  ${idx + 1}. ${req.resourceType}: ${req.url.substring(0, 120)}`);
      });

      console.log('New URL:', page.url());

      // Look for PDF on the page (iframe, embed, or direct link)
      console.log('Looking for PDF URL on page...');

      const pdfInfo = await page.evaluate(() => {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const embeds = Array.from(document.querySelectorAll('embed, object'));
        const pdfLinks = Array.from(document.querySelectorAll('a'));

        for (const iframe of iframes) {
          const src = iframe.src || '';
          if (src && (src.includes('.pdf') || src.includes('pdf') || src.includes('document'))) {
            return { found: true, type: 'iframe', url: src };
          }
        }

        for (const embed of embeds) {
          const src = embed.src || embed.data || '';
          if (src && (src.includes('.pdf') || src.includes('pdf'))) {
            return { found: true, type: 'embed', url: src };
          }
        }

        for (const link of pdfLinks) {
          const href = link.href || '';
          const text = (link.textContent || '').toLowerCase();
          if (href.includes('.pdf') || text.includes('pdf') || text.includes('download')) {
            return { found: true, type: 'link', url: href, text };
          }
        }

        return { found: false };
      });

      console.log('PDF Info from page:', pdfInfo);

      // Priority 1: Use PDF from network monitoring
      let pdfUrl = null;
      if (pdfRequests.length > 0) {
        // Prioritize GetDocumentImage requests
        let pdfRequest = pdfRequests.find(r => r.url.includes('GetDocumentImage'));
        if (!pdfRequest) {
          pdfRequest = pdfRequests.find(r => r.url.includes('.pdf'));
        }
        if (!pdfRequest) {
          pdfRequest = pdfRequests.find(r => r.url.includes('Document') && !r.url.includes('google') && !r.url.includes('recaptcha'));
        }
        if (!pdfRequest) {
          pdfRequest = pdfRequests[pdfRequests.length - 1];
        }

        pdfUrl = pdfRequest.url;
        console.log('✅ Using PDF from network:', pdfUrl.substring(0, 150));
      }
      // Priority 2: Use PDF from page elements
      else if (pdfInfo.found) {
        pdfUrl = pdfInfo.url;
        console.log('✅ Using PDF from page:', pdfInfo.type, pdfUrl.substring(0, 100));
      }
      else {
        console.log('❌ No PDF found');
        await browser.close();
        return;
      }

      // Step 5: Download PDF using Orange County method
      console.log('Step 5: Attempting to download PDF...');

      const cookies = await page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const https = require('https');
      const url = require('url');
      const parsedUrl = url.parse(pdfUrl);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.path,
        method: 'GET',
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*',
          'Referer': page.url()
        }
      };

      console.log('Downloading from:', pdfUrl);

      https.get(options, (res) => {
        console.log('Response status:', res.statusCode);
        console.log('Content-Type:', res.headers['content-type']);

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const header = buffer.slice(0, 5).toString();
          console.log('Response header:', header);
          console.log('Response size:', buffer.length, 'bytes');

          if (header === '%PDF-') {
            console.log('✅ SUCCESS: Valid PDF downloaded!');
            console.log('PDF Size:', (buffer.length / 1024).toFixed(2), 'KB');
          } else {
            console.log('❌ Not a PDF. First 100 bytes:');
            console.log(buffer.slice(0, 100).toString());
          }

          browser.close();
        });
      }).on('error', (err) => {
        console.error('Download error:', err.message);
        browser.close();
      });

    } else {
      console.log('❌ No OR Book/Page links found');
      await browser.close();
    }

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

testWorkflow();
