const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Setting up response listener BEFORE login click...\n');

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

  // **KEY: Set up response handler BEFORE any navigation**
  let pdfCaptured = false;
  const responseHandler = async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.toLowerCase().includes('pdf') && !pdfCaptured) {
      console.log(`\n📥 PDF Response intercepted!`);
      console.log(`   URL: ${url.substring(0, 80)}...`);
      console.log(`   Content-Type: ${contentType}`);
      console.log(`   Status: ${response.status()}`);

      try {
        // Try to get buffer IMMEDIATELY
        const buffer = await response.buffer();
        console.log(`   Buffer size: ${buffer.length} bytes`);

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   Is PDF: ${isPDF}`);

        if (isPDF && buffer.length > 100000) {  // Must be > 100KB
          const filepath = path.join(__dirname, 'INTERCEPTED-FULL-PDF.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅✅✅ SAVED FULL PDF TO: ${filepath}\n`);
          pdfCaptured = true;
        } else if (!isPDF) {
          console.log(`   ❌ Not a PDF, first 200 chars: ${buffer.slice(0, 200).toString()}\n`);
        } else {
          console.log(`   ❌ PDF too small: ${buffer.length} bytes\n`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }
  };

  newPage.on('response', responseHandler);

  console.log('✅ Response handler set up\n');

  await newPage.goto(filmCodeUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Login
  console.log('🔐 Filling login form...\n');
  await newPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await newPage.type('input[name*="UserName"]', 'leaderslaw');
  await newPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await newPage.type('input[type="password"]', 'Leaders2000@1');
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('🔐 Clicking login button (response handler is active)...\n');

  // Use waitForResponse to ensure we catch the PDF
  const [pdfResponse] = await Promise.all([
    newPage.waitForResponse(
      response => (response.headers()['content-type'] || '').toLowerCase().includes('pdf'),
      { timeout: 30000 }
    ).catch(() => null),
    newPage.click('input[type="submit"][value*="Log"]')
  ]);

  if (pdfResponse && !pdfCaptured) {
    console.log(`\n📥 Got PDF response from waitForResponse!`);
    try {
      const buffer = await pdfResponse.buffer();
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`   Size: ${buffer.length} bytes, isPDF: ${isPDF}`);

      if (isPDF && buffer.length > 100000) {
        const filepath = path.join(__dirname, 'WAIT-FOR-RESPONSE-PDF.pdf');
        fs.writeFileSync(filepath, buffer);
        console.log(`   ✅✅✅ SAVED: ${filepath}\n`);
        pdfCaptured = true;
      }
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}\n`);
    }
  }

  console.log('⏳ Waiting a bit more...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  if (pdfCaptured) {
    console.log('\n✅✅✅ SUCCESS!\n');
  } else {
    console.log('\n❌ PDF capture failed\n');
  }

  // Check files
  const files = ['INTERCEPTED-FULL-PDF.pdf', 'WAIT-FOR-RESPONSE-PDF.pdf'];
  for (const filename of files) {
    const filepath = path.join(__dirname, filename);
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      const buffer = fs.readFileSync(filepath);
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`📄 ${filename}: ${stats.size} bytes, isPDF: ${isPDF}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
