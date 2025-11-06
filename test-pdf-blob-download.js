const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Testing PDF blob/stream download...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate to Clerk Records
  console.log('📍 Loading Clerk Records...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fill in date
  await page.waitForSelector('input[name*="From"]', { timeout: 5000 });
  await page.type('input[name*="From"]', '07/25/2023');
  await page.waitForSelector('input[name*="To"]', { timeout: 5000 });
  await page.type('input[name*="To"]', '07/25/2023');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Search
  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('✅ Searched');
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
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get login page
  const pages = await browser.pages();
  let pdfPage = pages[pages.length - 1];

  console.log('🔐 Logging in...');
  await pdfPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await pdfPage.type('input[name*="UserName"]', 'leaderslaw');
  await pdfPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await pdfPage.type('input[type="password"]', 'Leaders2000@1');
  await new Promise(resolve => setTimeout(resolve, 1000));
  await pdfPage.click('input[type="submit"][value*="Log"]');

  console.log('⏳ Waiting for PDF viewer...');
  await new Promise(resolve => setTimeout(resolve, 8000));

  console.log(`📍 Current URL: ${pdfPage.url()}`);

  // Set up request interception BEFORE the PDF loads
  const client = await pdfPage.target().createCDPSession();
  await client.send('Fetch.enable', {
    patterns: [
      { urlPattern: '*', resourceType: 'Document' },
      { urlPattern: '*.pdf*', resourceType: 'Document' }
    ]
  });

  console.log('\n📥 Method 1: Trying to download via page.pdf()...');
  try {
    const pdfBuffer = await pdfPage.pdf({
      format: 'Letter',
      printBackground: true
    });

    const fs = require('fs');
    const path = require('path');
    const filepath = path.join(__dirname, 'test-method1.pdf');
    fs.writeFileSync(filepath, pdfBuffer);
    console.log(`✅ Method 1 saved: ${filepath} (${pdfBuffer.length} bytes)`);
  } catch (e) {
    console.log(`❌ Method 1 failed: ${e.message}`);
  }

  console.log('\n📥 Method 2: Trying to get PDF content directly...');
  try {
    // Check if there's an embedded PDF iframe
    const frames = pdfPage.frames();
    console.log(`   Found ${frames.length} frames`);

    for (const frame of frames) {
      const url = frame.url();
      console.log(`   Frame URL: ${url}`);

      if (url.includes('pdf') || url.startsWith('blob:')) {
        console.log(`   📄 Found PDF frame!`);

        // Try to fetch the content
        const content = await frame.evaluate(async (frameUrl) => {
          try {
            const response = await fetch(frameUrl);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
          } catch (e) {
            return null;
          }
        }, url);

        if (content) {
          const buffer = Buffer.from(content);
          const fs = require('fs');
          const path = require('path');
          const filepath = path.join(__dirname, 'test-method2.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`   ✅ Method 2 saved: ${filepath} (${buffer.length} bytes)`);
          break;
        }
      }
    }
  } catch (e) {
    console.log(`   ❌ Method 2 failed: ${e.message}`);
  }

  console.log('\n📥 Method 3: Screenshot to see what we have...');
  const screenshot = await pdfPage.screenshot({ fullPage: false });
  const fs = require('fs');
  const path = require('path');
  const screenshotPath = path.join(__dirname, 'pdf-viewer-screenshot.png');
  fs.writeFileSync(screenshotPath, screenshot);
  console.log(`   Screenshot saved: ${screenshotPath}`);

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
