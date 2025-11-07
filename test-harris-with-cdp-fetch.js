const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🧪 Testing Harris County Full Workflow with CDP Fetch Domain\n');

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

  // Enter search parameters (To date = From date + 30 days)
  const fromDate = '07/25/2023';
  const fromDateObj = new Date('2023-07-25');
  const toDateObj = new Date(fromDateObj);
  toDateObj.setDate(toDateObj.getDate() + 30);
  const toDate = `${String(toDateObj.getMonth() + 1).padStart(2, '0')}/${String(toDateObj.getDate()).padStart(2, '0')}/${toDateObj.getFullYear()}`;

  await page.type('input[name*="From"]', fromDate);
  await page.type('input[name*="To"]', toDate);
  console.log(`📅 Date range: ${fromDate} to ${toDate}`);
  await new Promise(resolve => setTimeout(resolve, 1000));

  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('✅ Searched\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Find and click film code link
  const filmCodeUrl = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        return link.href;
      }
    }
    return null;
  });

  if (!filmCodeUrl) {
    console.error('❌ Could not find film code link');
    await browser.close();
    return;
  }

  console.log(`🔗 Film code URL: ${filmCodeUrl}\n`);

  // Open PDF page
  const newPage = await browser.newPage();

  // Set up CDP Fetch domain BEFORE navigating
  const client = await newPage.target().createCDPSession();

  await client.send('Fetch.enable', {
    patterns: [
      {
        urlPattern: '*ViewEdocs.aspx*',
        requestStage: 'Response'
      }
    ]
  });

  console.log('✅ CDP Fetch domain enabled\n');

  let pdfCaptured = false;
  let pdfBuffer = null;

  client.on('Fetch.requestPaused', async (event) => {
    try {
      if (event.responseHeaders && !pdfCaptured) {
        const contentType = event.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
        const contentLength = event.responseHeaders.find(h => h.name.toLowerCase() === 'content-length');

        if (contentType && contentType.value.toLowerCase().includes('pdf')) {
          console.log(`🎉 PDF Response detected!`);
          console.log(`   Content-Type: ${contentType.value}`);
          console.log(`   Content-Length: ${contentLength ? contentLength.value : 'Unknown'}`);

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
            console.log(`   Buffer size: ${buffer.length} bytes, isPDF: ${isPDF}`);

            if (isPDF && buffer.length > 100000) {
              pdfBuffer = buffer;
              pdfCaptured = true;
              console.log(`   ✅ Full PDF captured!`);
            }
          } catch (e) {
            console.log(`   ❌ Error getting response body: ${e.message}`);
          }
        }
      }

      // Continue the request
      try {
        await client.send('Fetch.continueRequest', {
          requestId: event.requestId
        });
      } catch (e) {
        // May already be handled
      }
    } catch (e) {
      console.error(`Error in requestPaused handler: ${e.message}`);
    }
  });

  // Navigate to film code
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

  // Wait for PDF response
  console.log('⏳ Waiting for PDF response (max 15 seconds)...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  if (pdfCaptured && pdfBuffer) {
    console.log('\n✅✅✅ SUCCESS! Full PDF downloaded!\n');
    console.log(`📊 PDF Details:`);
    console.log(`   Size: ${pdfBuffer.length} bytes (${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB)`);

    const filename = `harris-RP-2023-279211-${Date.now()}.pdf`;
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, pdfBuffer);
    console.log(`   ✅ SAVED TO: ${filepath}\n`);
  } else {
    console.log('\n❌ PDF was not captured\n');
  }

  console.log('⏸️  Browser will stay open for 10 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  await browser.close();
  console.log('\n✅ Test complete');
})();
