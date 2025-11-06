const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Monitoring ALL network requests for PDF...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Monitor ALL requests
  const requests = [];
  const responses = [];

  await page.setRequestInterception(true);

  page.on('request', request => {
    const url = request.url();
    requests.push({ url, resourceType: request.resourceType() });
    console.log(`📤 REQUEST [${request.resourceType()}]: ${url.substring(0, 100)}...`);
    request.continue();
  });

  page.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    const status = response.status();

    responses.push({ url, contentType, status });

    if (contentType.includes('pdf') || url.includes('.pdf')) {
      console.log(`\n📥 PDF RESPONSE FOUND!`);
      console.log(`   URL: ${url}`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Status: ${status}`);

      try {
        const buffer = await response.buffer();
        console.log(`   Size: ${buffer.length} bytes`);

        const fs = require('fs');
        const path = require('path');
        const filepath = path.join(__dirname, 'captured-pdf.pdf');
        fs.writeFileSync(filepath, buffer);
        console.log(`   ✅ SAVED TO: ${filepath}\n`);
      } catch (e) {
        console.log(`   ❌ Could not save: ${e.message}\n`);
      }
    }
  });

  // Navigate to Clerk Records
  console.log('📍 Loading Clerk Records...\n');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fill and search
  await page.type('input[name*="From"]', '07/25/2023');
  await page.type('input[name*="To"]', '07/25/2023');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('\n✅ Searched\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Click film code
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        link.click();
        return;
      }
    }
  });

  console.log('✅ Clicked film code\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get login page and set up monitoring there too
  const pages = await browser.pages();
  let pdfPage = pages[pages.length - 1];

  pdfPage.on('request', request => {
    const url = request.url();
    console.log(`📤 [NEW TAB] REQUEST [${request.resourceType()}]: ${url.substring(0, 100)}...`);
  });

  pdfPage.on('response', async response => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('pdf') || url.includes('.pdf')) {
      console.log(`\n📥 [NEW TAB] PDF RESPONSE FOUND!`);
      console.log(`   URL: ${url}`);
      console.log(`   Content-Type: ${contentType}`);

      try {
        const buffer = await response.buffer();
        console.log(`   Size: ${buffer.length} bytes`);

        const fs = require('fs');
        const path = require('path');
        const filepath = path.join(__dirname, 'captured-pdf-newtab.pdf');
        fs.writeFileSync(filepath, buffer);
        console.log(`   ✅ SAVED TO: ${filepath}\n`);
      } catch (e) {
        console.log(`   ❌ Could not save: ${e.message}\n`);
      }
    }
  });

  console.log('🔐 Logging in...\n');
  await pdfPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await pdfPage.type('input[name*="UserName"]', 'leaderslaw');
  await pdfPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await pdfPage.type('input[type="password"]', 'Leaders2000@1');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await pdfPage.click('input[type="submit"][value*="Log"]');

  console.log('⏳ Waiting for PDF to load (monitoring network)...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  console.log('\n📊 Summary:');
  console.log(`   Total requests: ${requests.length}`);
  console.log(`   Total responses: ${responses.length}`);

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
