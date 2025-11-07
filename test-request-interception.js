const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing request interception to prevent Chrome PDF viewer...\n');

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

  const newPage = await browser.newPage();

  // Enable request interception BEFORE any navigation
  await newPage.setRequestInterception(true);

  let pdfCaptured = false;
  const pdfUrl = new URL(filmCodeUrl);
  const viewEdocsPath = '/Applications/WebSearch/EComm/ViewEdocs.aspx';

  newPage.on('request', request => {
    const url = request.url();

    // Let all requests through normally
    request.continue();
  });

  newPage.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.toLowerCase().includes('pdf') && !pdfCaptured) {
      console.log(`\n📥 PDF Response intercepted!`);
      console.log(`   URL: ${url.substring(0, 100)}...`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Status: ${response.status()}`);

      try {
        const buffer = await response.buffer();
        console.log(`   Buffer size: ${buffer.length} bytes`);

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   Is PDF: ${isPDF}`);

        if (isPDF && buffer.length > 100000) {
          const filepath = path.join(__dirname, 'INTERCEPTED-PDF.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅✅✅ SAVED FULL PDF TO: ${filepath}\n`);
          pdfCaptured = true;
        } else if (isPDF) {
          console.log(`   ⚠️ PDF too small: ${buffer.length} bytes (expected > 100KB)\n`);
          // Save it anyway to inspect
          const filepath = path.join(__dirname, 'SMALL-PDF.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   📄 Saved small PDF to: ${filepath}\n`);
        } else {
          console.log(`   ❌ Not a PDF. First 200 chars:\n${buffer.slice(0, 200).toString()}\n`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }
  });

  await newPage.goto(filmCodeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Login
  console.log('🔐 Logging in...\n');
  await newPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await newPage.type('input[name*="UserName"]', 'leaderslaw');
  await newPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await newPage.type('input[type="password"]', 'Leaders2000@1');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('🔐 Clicking login button...\n');
  await newPage.click('input[type="submit"][value*="Log"]');

  console.log('⏳ Waiting for PDF response...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  if (pdfCaptured) {
    console.log('\n✅✅✅ SUCCESS!\n');
  } else {
    console.log('\n❌ PDF not captured via response interception\n');

    // Try CDP approach as fallback
    console.log('🔄 Trying CDP Network.getResponseBody as fallback...\n');

    const client = await newPage.target().createCDPSession();
    await client.send('Network.enable');

    const pdfRequestIds = [];

    client.on('Network.responseReceived', (params) => {
      const response = params.response;
      const mimeType = response.mimeType || '';

      if (mimeType.toLowerCase().includes('pdf')) {
        console.log(`   Found PDF response: ${params.requestId}`);
        pdfRequestIds.push(params.requestId);
      }
    });

    // Wait a bit for events
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (pdfRequestIds.length > 0) {
      console.log(`\n🎯 Found ${pdfRequestIds.length} PDF request(s), attempting capture...\n`);

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
            const filepath = path.join(__dirname, 'CDP-CAPTURED-PDF.pdf');
            fs.writeFileSync(filepath, buffer);
            console.log(`   ✅ Saved to: ${filepath}\n`);
            pdfCaptured = true;
            break;
          }
        } catch (e) {
          console.log(`   ❌ Error getting response body: ${e.message}`);
        }
      }
    }
  }

  // Check all generated files
  console.log('\n📊 Final file check:\n');
  const files = ['INTERCEPTED-PDF.pdf', 'SMALL-PDF.pdf', 'CDP-CAPTURED-PDF.pdf'];
  for (const filename of files) {
    const filepath = path.join(__dirname, filename);
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      const buffer = fs.readFileSync(filepath);
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`   📄 ${filename}: ${stats.size} bytes, isPDF: ${isPDF}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
