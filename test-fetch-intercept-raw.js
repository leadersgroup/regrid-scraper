const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Using CDP Fetch domain to intercept raw PDF response...\n');

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
  const client = await newPage.target().createCDPSession();

  // Enable Fetch domain with aggressive pattern matching
  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*ViewEdocs.aspx*',
        requestStage: 'Response'
      },
      {
        urlPattern: '*.pdf*',
        requestStage: 'Response'
      },
      {
        urlPattern: '*',
        resourceType: 'Document',
        requestStage: 'Response'
      }
    ]
  });

  console.log('✅ Fetch domain enabled with Response interception\n');

  let pdfCaptured = false;

  client.on('Fetch.requestPaused', async (event) => {
    console.log(`\n🎯 Request paused!`);
    console.log(`   Request ID: ${event.requestId}`);
    console.log(`   URL: ${event.request.url.substring(0, 100)}...`);
    console.log(`   Resource Type: ${event.resourceType}`);
    console.log(`   Response Status: ${event.responseStatusCode || 'N/A'}`);

    if (event.responseHeaders) {
      const contentType = event.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
      const contentLength = event.responseHeaders.find(h => h.name.toLowerCase() === 'content-length');

      console.log(`   Content-Type: ${contentType ? contentType.value : 'N/A'}`);
      console.log(`   Content-Length: ${contentLength ? contentLength.value : 'N/A'}`);

      if (contentType && contentType.value.toLowerCase().includes('pdf') && !pdfCaptured) {
        console.log(`\n   🎉 PDF DETECTED! Attempting to get body...`);

        try {
          const response = await client.send('Fetch.getResponseBody', {
            requestId: event.requestId
          });

          let buffer;
          if (response.base64Encoded) {
            buffer = Buffer.from(response.body, 'base64');
          } else {
            buffer = Buffer.from(response.body);
          }

          const isPDF = buffer.slice(0, 4).toString() === '%PDF';
          console.log(`   Buffer size: ${buffer.length} bytes`);
          console.log(`   Is PDF: ${isPDF}`);

          if (isPDF && buffer.length > 100000) {
            const filepath = path.join(__dirname, 'FETCH-INTERCEPTED-PDF.pdf');
            fs.writeFileSync(filepath, buffer);
            console.log(`   ✅✅✅ SAVED FULL PDF TO: ${filepath}\n`);
            pdfCaptured = true;
          } else if (isPDF) {
            console.log(`   ⚠️ PDF too small: ${buffer.length} bytes\n`);
            const filepath = path.join(__dirname, 'FETCH-SMALL-PDF.pdf');
            fs.writeFileSync(filepath, buffer);
            console.log(`   📄 Saved anyway: ${filepath}\n`);
          } else {
            console.log(`   ❌ Not a PDF. First 300 chars:\n${buffer.slice(0, 300).toString()}\n`);
          }
        } catch (e) {
          console.log(`   ❌ Error getting response body: ${e.message}\n`);
        }
      }
    }

    // Continue the request
    try {
      await client.send('Fetch.continueRequest', {
        requestId: event.requestId
      });
    } catch (e) {
      console.log(`   ⚠️ Error continuing request: ${e.message}`);
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

  console.log('🔐 Clicking login (Fetch interceptor active)...\n');
  await newPage.click('input[type="submit"][value*="Log"]');

  console.log('⏳ Waiting for PDF response...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  if (pdfCaptured) {
    console.log('\n✅✅✅ SUCCESS!\n');
  } else {
    console.log('\n❌ PDF not captured via Fetch domain\n');
  }

  // Check all generated files
  console.log('📊 Final file check:\n');
  const files = ['FETCH-INTERCEPTED-PDF.pdf', 'FETCH-SMALL-PDF.pdf'];
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
