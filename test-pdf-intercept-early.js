const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing early PDF interception...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Set up response interception on MAIN page
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.toLowerCase().includes('pdf')) {
      console.log(`\n📥 PDF RESPONSE on main page!`);
      console.log(`   URL: ${url}`);
      console.log(`   Content-Type: ${contentType}`);

      try {
        const buffer = await response.buffer();
        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   Size: ${buffer.length} bytes, isPDF: ${isPDF}`);

        if (isPDF) {
          const filepath = path.join(__dirname, 'captured-full-pdf.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅ SAVED FULL PDF TO: ${filepath}\n`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }
  });

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

  // Instead of clicking the link, let's intercept before opening new tab
  console.log('🔗 Getting film code link URL...\n');
  const filmCodeUrl = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        return link.href;
      }
    }
    return null;
  });

  console.log(`   Film code URL: ${filmCodeUrl}\n`);

  // Create a new page and set up interception BEFORE navigating
  const newPage = await browser.newPage();

  // Set up response listener on NEW page BEFORE any navigation
  newPage.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    console.log(`📤 Response: ${url.substring(0, 80)}... [${contentType}]`);

    if (contentType.toLowerCase().includes('pdf')) {
      console.log(`\n📥 PDF RESPONSE on new page!`);
      console.log(`   URL: ${url}`);
      console.log(`   Content-Type: ${contentType}`);

      try {
        const buffer = await response.buffer();
        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   Size: ${buffer.length} bytes, isPDF: ${isPDF}`);

        if (isPDF) {
          const filepath = path.join(__dirname, 'captured-full-pdf-newpage.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅ SAVED FULL PDF TO: ${filepath}\n`);
        }
      } catch (e) {
        console.log(`   ❌ Error: ${e.message}\n`);
      }
    }
  });

  console.log('🔐 Navigating to film code URL and logging in...\n');
  await newPage.goto(filmCodeUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Check if on login page
  const isLoginPage = await newPage.evaluate(() => {
    return document.body.innerText.toLowerCase().includes('log in');
  });

  if (isLoginPage) {
    console.log('🔐 Logging in...\n');
    await newPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
    await newPage.type('input[name*="UserName"]', 'leaderslaw');
    await newPage.waitForSelector('input[type="password"]', { timeout: 5000 });
    await newPage.type('input[type="password"]', 'Leaders2000@1');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await newPage.click('input[type="submit"][value*="Log"]');

    console.log('⏳ Waiting for PDF after login...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log('\n📊 Checking for saved PDF files...\n');

  const files = [
    'captured-full-pdf.pdf',
    'captured-full-pdf-newpage.pdf'
  ];

  for (const filename of files) {
    const filepath = path.join(__dirname, filename);
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      const buffer = fs.readFileSync(filepath);
      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`   ${filename}: ${stats.size} bytes, isPDF: ${isPDF}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
