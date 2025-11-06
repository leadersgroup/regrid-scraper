const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Testing Harris County Clerk PDF download via CDP...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Set up download interception
  const client = await page.target().createCDPSession();
  const downloadPath = require('path').resolve(__dirname);

  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  console.log(`📁 Download path: ${downloadPath}`);

  // Navigate to Clerk Records
  console.log('\n📍 Loading Clerk Records search...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fill in the date
  await page.waitForSelector('input[name*="From"]', { timeout: 5000 });
  await page.type('input[name*="From"]', '07/25/2023');

  await page.waitForSelector('input[name*="To"]', { timeout: 5000 });
  await page.type('input[name*="To"]', '07/25/2023');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Click search
  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('✅ Clicked search');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Click on film code
  console.log('🖱️  Clicking film code...');
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

  // Fill in credentials
  await pdfPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await pdfPage.type('input[name*="UserName"]', 'leaderslaw');

  await pdfPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await pdfPage.type('input[type="password"]', 'Leaders2000@1');

  await new Promise(resolve => setTimeout(resolve, 1000));

  await pdfPage.click('input[type="submit"][value*="Log"]');
  console.log('✅ Clicked login button');

  // Wait for redirect to PDF viewer
  await new Promise(resolve => setTimeout(resolve, 7000));

  const currentUrl = pdfPage.url();
  console.log(`\n📍 Current URL: ${currentUrl}`);

  if (currentUrl.includes('ViewEdocs')) {
    console.log('✅ On PDF viewer page');

    // The page embeds a PDF - try to use CDP to get the PDF stream
    console.log('\n📥 Attempting to download PDF via CDP...');

    try {
      // Get the PDF data using CDP
      const pdfClient = await pdfPage.target().createCDPSession();

      // Try to print the page as PDF (this captures the embedded PDF)
      const {data} = await pdfClient.send('Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true
      });

      const fs = require('fs');
      const path = require('path');

      // Convert base64 to buffer
      const buffer = Buffer.from(data, 'base64');

      const isPDF = buffer.slice(0, 4).toString() === '%PDF';
      console.log(`\n📄 PDF validation: isPDF=${isPDF}, size=${buffer.length} bytes`);

      if (isPDF) {
        const filepath = path.join(__dirname, 'harris-deed-RP-2023-279211.pdf');
        fs.writeFileSync(filepath, buffer);
        console.log(`✅ PDF saved to: ${filepath}`);
      } else {
        console.log('❌ Not a valid PDF from printToPDF');
      }

    } catch (e) {
      console.log(`❌ CDP Error: ${e.message}`);
    }

    // Alternative: Try to access the embedded PDF URL directly
    console.log('\n🔍 Searching for PDF URL in page source...');

    const pageSource = await pdfPage.content();

    // Look for PDF-related URLs in the source
    const pdfUrlMatches = pageSource.match(/https?:\/\/[^\s"'<>]+\.pdf[^\s"'<>]*/gi) ||
                          pageSource.match(/\/[^\s"'<>]*\.pdf[^\s"'<>]*/gi) ||
                          [];

    if (pdfUrlMatches.length > 0) {
      console.log(`Found ${pdfUrlMatches.length} potential PDF URLs:`);
      pdfUrlMatches.forEach((url, i) => {
        console.log(`  [${i}] ${url}`);
      });
    } else {
      console.log('No PDF URLs found in page source');

      // Check for blob URLs or data streams
      const hasBlob = pageSource.includes('blob:');
      const hasDataStream = pageSource.includes('data:application/pdf');

      console.log(`  Blob URL: ${hasBlob}`);
      console.log(`  Data stream: ${hasDataStream}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
