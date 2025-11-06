const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Disabling Chrome PDF viewer to force download...\n');

  const downloadPath = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-features=PdfViewerUpdate',  // Disable PDF viewer
      `--safebrowsing-disable-download-protection`,
      `--disable-pdf-extension`
    ]
  });

  const page = await browser.newPage();

  // Set download behavior
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  console.log(`📁 Download path: ${downloadPath}\n`);

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

  // Set download behavior on new page too
  const newClient = await newPage.target().createCDPSession();
  await newClient.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
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

  await newPage.click('input[type="submit"][value*="Log"]');

  console.log('⏳ Waiting for download...\n');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Check downloads folder
  console.log('📊 Checking downloads folder...\n');
  if (fs.existsSync(downloadPath)) {
    const files = fs.readdirSync(downloadPath).filter(f => !f.startsWith('.'));
    if (files.length > 0) {
      console.log(`✅ Found ${files.length} file(s) in downloads:\n`);
      files.forEach(file => {
        const filepath = path.join(downloadPath, file);
        const stats = fs.statSync(filepath);
        const buffer = fs.readFileSync(filepath);
        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   ${file}: ${stats.size} bytes, isPDF: ${isPDF}`);

        if (isPDF) {
          console.log(`\n   ✅✅✅ SUCCESS! Full PDF downloaded: ${filepath}\n`);
        }
      });
    } else {
      console.log('❌ No files downloaded\n');
    }
  }

  console.log('⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
