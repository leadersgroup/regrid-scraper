const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Capturing ALL network requests to find PDF source...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Track ALL network activity
  const allRequests = [];
  const allResponses = [];

  const client = await page.target().createCDPSession();
  await client.send('Network.enable');

  client.on('Network.requestWillBeSent', (params) => {
    allRequests.push({
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      type: params.type
    });
  });

  client.on('Network.responseReceived', (params) => {
    allResponses.push({
      requestId: params.requestId,
      url: params.response.url,
      status: params.response.status,
      mimeType: params.response.mimeType,
      headers: params.response.headers
    });
  });

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

  // Clear previous requests
  allRequests.length = 0;
  allResponses.length = 0;

  const newPage = await browser.newPage();

  // Set up CDP on new page
  const newClient = await newPage.target().createCDPSession();
  await newClient.send('Network.enable');

  const pdfPageRequests = [];
  const pdfPageResponses = [];

  newClient.on('Network.requestWillBeSent', (params) => {
    const url = params.request.url;
    pdfPageRequests.push({
      requestId: params.requestId,
      url: url,
      method: params.request.method,
      type: params.type
    });
    console.log(`📤 [${params.type}] ${url.substring(0, 100)}...`);
  });

  newClient.on('Network.responseReceived', async (params) => {
    const response = params.response;
    pdfPageResponses.push({
      requestId: params.requestId,
      url: response.url,
      status: response.status,
      mimeType: response.mimeType,
      headers: response.headers
    });
    console.log(`📥 [${response.status}] [${response.mimeType}] ${response.url.substring(0, 80)}...`);
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

  // Clear again before login
  pdfPageRequests.length = 0;
  pdfPageResponses.length = 0;

  console.log('🔍 Monitoring network during and after login...\n');
  await newPage.click('input[type="submit"][value*="Log"]');

  // Wait and monitor
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('\n📊 ANALYSIS:\n');
  console.log(`Total requests: ${pdfPageRequests.length}`);
  console.log(`Total responses: ${pdfPageResponses.length}\n`);

  // Group by type
  const byType = {};
  pdfPageRequests.forEach(req => {
    byType[req.type] = (byType[req.type] || 0) + 1;
  });

  console.log('By type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Look for interesting patterns
  console.log('\n🔍 Looking for interesting URLs:\n');

  const interesting = pdfPageResponses.filter(resp => {
    const url = resp.url.toLowerCase();
    const mime = (resp.mimeType || '').toLowerCase();
    return (
      url.includes('pdf') ||
      url.includes('document') ||
      url.includes('file') ||
      url.includes('download') ||
      url.includes('edoc') ||
      url.includes('image') ||
      url.includes('.aspx') && url.includes('?') ||
      mime.includes('pdf') ||
      mime.includes('octet-stream') ||
      mime.includes('image')
    );
  });

  console.log(`Found ${interesting.length} potentially interesting responses:\n`);
  interesting.forEach((resp, idx) => {
    console.log(`${idx + 1}. [${resp.status}] [${resp.mimeType}]`);
    console.log(`   ${resp.url}`);
    console.log();
  });

  // Try to get body of any PDF responses
  const pdfResponses = pdfPageResponses.filter(r => (r.mimeType || '').includes('pdf'));
  if (pdfResponses.length > 0) {
    console.log('\n📥 Attempting to download PDF responses:\n');
    for (const resp of pdfResponses) {
      try {
        const body = await newClient.send('Network.getResponseBody', {
          requestId: resp.requestId
        });

        let buffer;
        if (body.base64Encoded) {
          buffer = Buffer.from(body.body, 'base64');
        } else {
          buffer = Buffer.from(body.body);
        }

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`  Request ${resp.requestId}: ${buffer.length} bytes, isPDF: ${isPDF}`);

        if (isPDF) {
          const filepath = path.join(__dirname, 'found-pdf.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`  ✅ Saved to: ${filepath}\n`);
        }
      } catch (e) {
        console.log(`  ❌ Could not get body: ${e.message}\n`);
      }
    }
  }

  // Save all requests to file for analysis
  const logFile = path.join(__dirname, 'network-log.json');
  fs.writeFileSync(logFile, JSON.stringify({
    requests: pdfPageRequests,
    responses: pdfPageResponses
  }, null, 2));
  console.log(`\n📝 Full network log saved to: ${logFile}`);

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
