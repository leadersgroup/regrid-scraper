const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing PDF download using session cookies...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate and login
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

  console.log('⏳ Waiting for PDF viewer...\n');
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Get cookies after login
  const cookies = await newPage.cookies();
  console.log('🍪 Session cookies:');
  cookies.forEach(cookie => {
    console.log(`   ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
  });
  console.log();

  // Check the page source for any hidden forms or POST data
  const pageSource = await newPage.content();

  // Look for ViewState and other ASP.NET fields
  const viewStateMatch = pageSource.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const viewStateGeneratorMatch = pageSource.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);
  const eventValidationMatch = pageSource.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);

  console.log('📝 ASP.NET State:');
  if (viewStateMatch) console.log(`   __VIEWSTATE: ${viewStateMatch[1].substring(0, 50)}...`);
  if (viewStateGeneratorMatch) console.log(`   __VIEWSTATEGENERATOR: ${viewStateGeneratorMatch[1]}`);
  if (eventValidationMatch) console.log(`   __EVENTVALIDATION: ${eventValidationMatch[1].substring(0, 50)}...`);
  console.log();

  // Try to find the actual PDF URL by examining network traffic
  const client = await newPage.target().createCDPSession();

  // Enable network tracking
  await client.send('Network.enable');

  const pdfRequests = [];

  client.on('Network.responseReceived', (params) => {
    const response = params.response;
    if (response.mimeType && response.mimeType.includes('pdf')) {
      pdfRequests.push({
        url: response.url,
        status: response.status,
        mimeType: response.mimeType,
        requestId: params.requestId
      });
      console.log(`📥 PDF Response detected:`);
      console.log(`   URL: ${response.url}`);
      console.log(`   Status: ${response.status}`);
      console.log(`   MIME: ${response.mimeType}`);
      console.log(`   Request ID: ${params.requestId}\n`);
    }
  });

  // Reload the page to trigger PDF load
  console.log('🔄 Reloading page to capture PDF network traffic...\n');
  await newPage.reload({ waitUntil: 'networkidle2' });
  await new Promise(resolve => setTimeout(resolve, 10000));

  if (pdfRequests.length > 0) {
    console.log(`\n✅ Found ${pdfRequests.length} PDF request(s)!\n`);

    for (const req of pdfRequests) {
      console.log(`📥 Attempting to download PDF from request ${req.requestId}...\n`);

      try {
        const response = await client.send('Network.getResponseBody', {
          requestId: req.requestId
        });

        let buffer;
        if (response.base64Encoded) {
          buffer = Buffer.from(response.body, 'base64');
        } else {
          buffer = Buffer.from(response.body);
        }

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   Size: ${buffer.length} bytes, isPDF: ${isPDF}`);

        if (isPDF) {
          const filepath = path.join(__dirname, 'session-downloaded.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅ SAVED TO: ${filepath}\n`);
        } else {
          console.log(`   ❌ Not a valid PDF\n`);
        }
      } catch (e) {
        console.log(`   ❌ Error getting response body: ${e.message}\n`);
      }
    }
  } else {
    console.log('❌ No PDF requests captured during reload\n');
  }

  console.log('⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
