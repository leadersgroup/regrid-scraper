const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Intercepting PDF response with Fetch domain...\n');

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

  // Enable Network domain for monitoring
  await client.send('Network.enable');

  let pdfCaptured = false;
  const pdfRequestIds = [];

  // Track responses
  client.on('Network.responseReceived', (params) => {
    const response = params.response;
    const mimeType = response.mimeType || '';

    if (mimeType.toLowerCase().includes('pdf')) {
      console.log(`\n📥 PDF Response detected!`);
      console.log(`   Request ID: ${params.requestId}`);
      console.log(`   URL: ${response.url.substring(0, 80)}...`);
      console.log(`   Status: ${response.status}`);
      console.log(`   MIME: ${mimeType}`);
      console.log(`   Content-Length: ${response.headers['Content-Length'] || response.headers['content-length'] || 'unknown'}`);

      pdfRequestIds.push(params.requestId);
    }
  });

  // Track when loading finishes
  client.on('Network.loadingFinished', async (params) => {
    if (pdfRequestIds.includes(params.requestId) && !pdfCaptured) {
      console.log(`\n🎯 PDF loading finished! Request ID: ${params.requestId}`);
      console.log(`   Attempting to get response body...`);

      try {
        const responseBody = await client.send('Network.getResponseBody', {
          requestId: params.requestId
        });

        let buffer;
        if (responseBody.base64Encoded) {
          buffer = Buffer.from(responseBody.body, 'base64');
        } else {
          buffer = Buffer.from(responseBody.body);
        }

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   Size: ${buffer.length} bytes`);
        console.log(`   Is PDF: ${isPDF}`);

        if (isPDF && buffer.length > 10000) {  // Must be > 10KB to be real PDF
          const filepath = path.join(__dirname, 'FULL-PDF-CAPTURED.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅✅✅ SAVED FULL PDF TO: ${filepath}\n`);
          pdfCaptured = true;
        } else {
          console.log(`   ❌ Not a valid/complete PDF\n`);
        }
      } catch (e) {
        console.log(`   ❌ Error getting response body: ${e.message}\n`);
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
  console.log('⏳ Waiting for PDF to load and capture...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  if (pdfCaptured) {
    console.log('\n✅✅✅ SUCCESS! Full PDF captured!\n');
  } else {
    console.log('\n❌ PDF was not captured\n');

    if (pdfRequestIds.length > 0) {
      console.log(`🔍 Found ${pdfRequestIds.length} PDF request(s), trying manual capture...\n`);

      for (const requestId of pdfRequestIds) {
        try {
          const responseBody = await client.send('Network.getResponseBody', {
            requestId: requestId
          });

          let buffer;
          if (responseBody.base64Encoded) {
            buffer = Buffer.from(responseBody.body, 'base64');
          } else {
            buffer = Buffer.from(responseBody.body);
          }

          const isPDF = buffer.slice(0, 4).toString() === '%PDF';
          console.log(`   Request ${requestId}: ${buffer.length} bytes, isPDF: ${isPDF}`);

          if (isPDF && buffer.length > 10000) {
            const filepath = path.join(__dirname, 'MANUAL-CAPTURED-PDF.pdf');
            fs.writeFileSync(filepath, buffer);
            console.log(`   ✅ Saved to: ${filepath}\n`);
            pdfCaptured = true;
            break;
          }
        } catch (e) {
          console.log(`   ❌ Error: ${e.message}`);
        }
      }
    }
  }

  // Check files
  const files = ['FULL-PDF-CAPTURED.pdf', 'MANUAL-CAPTURED-PDF.pdf'];
  for (const filename of files) {
    const filepath = path.join(__dirname, filename);
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      const buffer = fs.readFileSync(filepath);
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`\n📄 ${filename}: ${stats.size} bytes, isPDF: ${isPDF}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
