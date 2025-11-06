const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Using Fetch domain to intercept PDF BEFORE Chrome viewer...\n');

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

  // *** KEY CHANGE: Use Fetch domain instead of Network domain ***
  const client = await newPage.target().createCDPSession();

  // Enable Fetch with patterns
  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*',
        resourceType: 'Document'
      }
    ]
  });

  console.log('✅ Fetch domain enabled\n');

  let pdfCaptured = false;

  // Listen for Fetch.requestPaused events
  client.on('Fetch.requestPaused', async (event) => {
    const { requestId, request, responseStatusCode, responseHeaders } = event;

    console.log(`🔍 Request paused:`);
    console.log(`   URL: ${request.url.substring(0, 100)}...`);
    console.log(`   Method: ${request.method}`);
    console.log(`   Status: ${responseStatusCode}`);

    // Check if this is a PDF response
    const contentTypeHeader = (responseHeaders || []).find(h => h.name.toLowerCase() === 'content-type');
    const contentType = contentTypeHeader ? contentTypeHeader.value : '';

    console.log(`   Content-Type: ${contentType}`);

    if (contentType.toLowerCase().includes('pdf') && !pdfCaptured) {
      console.log(`\n📥 PDF DETECTED! Capturing before Chrome viewer...`);

      try {
        // Get the response body
        const responseBody = await client.send('Fetch.getResponseBody', {
          requestId: requestId
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

        if (isPDF) {
          const filepath = path.join(__dirname, 'CAPTURED-FULL-PDF.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅✅✅ SAVED FULL PDF TO: ${filepath}\n`);
          pdfCaptured = true;
        }

        // Continue the request (allow Chrome to display it)
        await client.send('Fetch.continueRequest', { requestId });
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
        // Continue request anyway
        await client.send('Fetch.continueRequest', { requestId }).catch(() => {});
      }
    } else {
      // Not a PDF, just continue
      await client.send('Fetch.continueRequest', { requestId }).catch(() => {});
    }
  });

  // Navigate to film code
  await newPage.goto(filmCodeUrl, { waitUntil: 'load', timeout: 60000 }).catch(() => {
    console.log('(Navigation completed via Fetch interception)');
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Login
  console.log('🔐 Logging in...\n');

  // Disable Fetch temporarily for login
  await client.send('Fetch.disable');

  await newPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await newPage.type('input[name*="UserName"]', 'leaderslaw');
  await newPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await newPage.type('input[type="password"]', 'Leaders2000@1');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Re-enable Fetch BEFORE clicking login
  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*',
        resourceType: 'Document'
      }
    ]
  });

  console.log('🔍 Fetch re-enabled, clicking login...\n');

  await newPage.click('input[type="submit"][value*="Log"]').catch(() => {});

  // Wait for PDF capture
  console.log('⏳ Waiting for PDF to be captured...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  if (pdfCaptured) {
    console.log('\n✅✅✅ SUCCESS! Full PDF captured!\n');
  } else {
    console.log('\n❌ PDF was not captured\n');
  }

  // Check file
  const filepath = path.join(__dirname, 'CAPTURED-FULL-PDF.pdf');
  if (fs.existsSync(filepath)) {
    const stats = fs.statSync(filepath);
    const buffer = fs.readFileSync(filepath);
    const isPDF = buffer.slice(0, 4).toString() === '%PDF';
    console.log(`📄 File check: ${stats.size} bytes, isPDF: ${isPDF}\n`);
  }

  console.log('⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
