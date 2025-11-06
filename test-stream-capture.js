const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing stream-based PDF capture using CDP StreamReader...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate and search
  console.log('📍 Loading Clerk Records...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  await page.type('input[name*="From"]', '07/25/2023');
  await page.type('input[name*="To"]', '07/25/2023');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('✅ Searched\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const filmCodeUrl = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        return link.href;
      }
    }
    return null;
  });

  console.log(`🔗 Film code URL: ${filmCodeUrl}\n`);

  // Create new page
  const newPage = await browser.newPage();
  const client = await newPage.target().createCDPSession();

  // Enable Network domain
  await client.send('Network.enable');

  let pdfCaptured = false;

  // Listen for response
  client.on('Network.responseReceived', async (params) => {
    const response = params.response;
    const mimeType = response.mimeType || '';

    if (mimeType.toLowerCase().includes('pdf') && !pdfCaptured) {
      console.log(`\n📥 PDF Response detected!`);
      console.log(`   Request ID: ${params.requestId}`);
      console.log(`   URL: ${response.url.substring(0, 80)}...`);
      console.log(`   Status: ${response.status}`);
      console.log(`   Content-Length: ${response.headers['Content-Length'] || response.headers['content-length']}`);

      try {
        // Wait a moment for stream to be available
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Try to get stream handle
        console.log(`\n🔍 Attempting to get stream handle...`);

        const streamResponse = await client.send('Network.getResponseBody', {
          requestId: params.requestId
        }).catch(e => {
          console.log(`   ❌ getResponseBody failed: ${e.message}`);
          return null;
        });

        if (streamResponse) {
          let buffer;
          if (streamResponse.base64Encoded) {
            buffer = Buffer.from(streamResponse.body, 'base64');
          } else {
            buffer = Buffer.from(streamResponse.body);
          }

          console.log(`   Got response: ${buffer.length} bytes`);

          const isPDF = buffer.slice(0, 4).toString() === '%PDF';
          if (isPDF && buffer.length > 100000) {  // At least 100KB
            const filepath = path.join(__dirname, 'STREAM-CAPTURED-PDF.pdf');
            fs.writeFileSync(filepath, buffer);
            console.log(`   ✅✅✅ SAVED: ${filepath}\n`);
            pdfCaptured = true;
          } else {
            console.log(`   ❌ Buffer too small or not PDF: ${buffer.length} bytes, isPDF: ${isPDF}`);

            // Log first 100 bytes for debugging
            console.log(`   First 100 bytes: ${buffer.slice(0, 100).toString()}`);
          }
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }
  });

  // Navigate to film code
  console.log('📍 Navigating to film code URL...\n');
  await newPage.goto(filmCodeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Login
  console.log('🔐 Logging in...\n');
  await newPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await newPage.type('input[name*="UserName"]', 'leaderslaw');
  await newPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await newPage.type('input[type="password"]', 'Leaders2000@1');
  await new Promise(resolve => setTimeout(resolve, 1000));

  await newPage.click('input[type="submit"][value*="Log"]');

  // Wait for PDF
  console.log('⏳ Waiting for PDF...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  if (!pdfCaptured) {
    console.log('\n❌ Stream capture failed. Trying alternative: direct fetch with cookies...\n');

    // Get cookies from logged-in session
    const cookies = await newPage.cookies();
    console.log(`🍪 Got ${cookies.length} cookies from session`);

    // Get the current URL (should be ViewEdocs.aspx)
    const currentUrl = newPage.url();
    console.log(`📍 Current URL: ${currentUrl}\n`);

    if (currentUrl.includes('ViewEdocs.aspx')) {
      // Try to fetch the PDF directly using Node's https module with cookies
      const https = require('https');
      const { URL } = require('url');

      const pdfUrl = new URL(currentUrl);

      // Build cookie header
      const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      const options = {
        hostname: pdfUrl.hostname,
        port: 443,
        path: pdfUrl.pathname + pdfUrl.search,
        method: 'POST',  // Try POST as we saw in network log
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*',
          'Referer': currentUrl
        }
      };

      console.log(`🔄 Attempting direct HTTPS fetch...`);
      console.log(`   URL: ${options.hostname}${options.path.substring(0, 80)}...`);

      const pdfData = [];

      const req = https.request(options, (res) => {
        console.log(`\n📥 Response Status: ${res.statusCode}`);
        console.log(`   Content-Type: ${res.headers['content-type']}`);
        console.log(`   Content-Length: ${res.headers['content-length']}`);

        res.on('data', (chunk) => {
          pdfData.push(chunk);
        });

        res.on('end', () => {
          const buffer = Buffer.concat(pdfData);
          console.log(`\n   Total received: ${buffer.length} bytes`);

          const isPDF = buffer.slice(0, 4).toString() === '%PDF';
          console.log(`   Is PDF: ${isPDF}`);

          if (isPDF && buffer.length > 100000) {
            const filepath = path.join(__dirname, 'DIRECT-FETCH-PDF.pdf');
            fs.writeFileSync(filepath, buffer);
            console.log(`   ✅✅✅ SAVED: ${filepath}\n`);
            pdfCaptured = true;
          } else {
            console.log(`   ❌ Not a valid PDF or too small`);
            console.log(`   First 200 chars: ${buffer.slice(0, 200).toString()}\n`);
          }
        });
      });

      req.on('error', (e) => {
        console.log(`   ❌ Request error: ${e.message}\n`);
      });

      req.end();

      // Wait for request to complete
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  if (pdfCaptured) {
    console.log('\n✅✅✅ SUCCESS!\n');
  } else {
    console.log('\n❌ All capture methods failed\n');
  }

  console.log('⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
