/**
 * Test to extract the actual document ID from Palm Beach Clerk page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function extractDocumentId() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const clerkUrl = 'https://erec.mypalmbeachclerk.com/Search/DocumentAndInfoByBookPage?Key=Assessor&booktype=O&booknumber=33358&pagenumber=1920';

    console.log('Navigating to:', clerkUrl);
    await page.goto(clerkUrl, { waitUntil: 'networkidle2' });
    await wait(5000);

    console.log('\n=== Searching for Document ID ===\n');

    // Method 1: Check all script tags
    const scriptDocId = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';

        // Look for various patterns
        const patterns = [
          /documentId["\s:=]+(\d+)/,
          /DocumentId["\s:=]+(\d+)/,
          /document_id["\s:=]+(\d+)/,
          /"docId"[:\s]+(\d+)/,
          /"id"[:\s]+(\d+)/,
          /var\s+id\s*=\s*(\d+)/,
          /GetDocumentImage.*documentId=(\d+)/
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match && match[1] !== '0') {
            return { found: true, value: match[1], pattern: pattern.toString(), snippet: text.substring(Math.max(0, text.indexOf(match[0]) - 50), text.indexOf(match[0]) + 100) };
          }
        }
      }
      return { found: false };
    });

    console.log('Script search result:', JSON.stringify(scriptDocId, null, 2));

    // Method 2: Check window object
    const windowDocId = await page.evaluate(() => {
      const results = [];

      if (window.documentId) results.push({ key: 'window.documentId', value: window.documentId });
      if (window.DocumentId) results.push({ key: 'window.DocumentId', value: window.DocumentId });
      if (window.document_id) results.push({ key: 'window.document_id', value: window.document_id });
      if (window.docId) results.push({ key: 'window.docId', value: window.docId });

      return results;
    });

    console.log('\nWindow object search:', JSON.stringify(windowDocId, null, 2));

    // Method 3: Monitor network requests
    console.log('\nMonitoring network requests for GetDocumentImage...');
    const requests = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('GetDocumentImage')) {
        requests.push(url);
        console.log('📥 Captured:', url);
      }
    });

    // Scroll to trigger image loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await wait(3000);

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await wait(3000);

    console.log('\nCaptured requests:', requests.length);

    if (requests.length > 0) {
      const match = requests[0].match(/documentId=(\d+)/);
      if (match) {
        console.log('✅ Found document ID from network:', match[1]);
      }
    }

    // Method 4: Check data attributes
    const dataAttrs = await page.evaluate(() => {
      const results = [];
      const elements = Array.from(document.querySelectorAll('*'));

      for (const el of elements) {
        const attrs = el.getAttributeNames();
        for (const attr of attrs) {
          if (attr.toLowerCase().includes('doc') || attr.toLowerCase().includes('id')) {
            const value = el.getAttribute(attr);
            if (value && /^\d+$/.test(value) && value !== '0') {
              results.push({ tag: el.tagName, attr, value });
            }
          }
        }
      }

      return results.slice(0, 20); // Limit results
    });

    console.log('\nData attributes search:', JSON.stringify(dataAttrs, null, 2));

    // Method 5: Dump all script content to find patterns
    const allScripts = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => s.textContent || '').join('\n\n=== NEXT SCRIPT ===\n\n');
    });

    console.log('\n=== ALL SCRIPTS (looking for document ID patterns) ===\n');
    const lines = allScripts.split('\n');
    for (const line of lines) {
      if (line.includes('document') && /\d{3,}/.test(line) && !line.includes('google') && !line.includes('analytics')) {
        console.log(line.trim().substring(0, 200));
      }
    }

    console.log('\n\nBrowser will stay open. Press Ctrl+C to close.');
    await wait(300000); // Keep open for 5 minutes

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

extractDocumentId();
