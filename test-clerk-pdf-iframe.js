const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Testing Harris County Clerk PDF iframe extraction...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate to Clerk Records
  console.log('📍 Loading Clerk Records search...');
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
  let loginPage = pages[pages.length - 1];

  console.log('🔐 Logging in...');

  // Fill in credentials
  await loginPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
  await loginPage.type('input[name*="UserName"]', 'leaderslaw');

  await loginPage.waitForSelector('input[type="password"]', { timeout: 5000 });
  await loginPage.type('input[type="password"]', 'Leaders2000@1');

  await new Promise(resolve => setTimeout(resolve, 1000));

  await loginPage.click('input[type="submit"][value*="Log"]');
  console.log('✅ Clicked login button');

  // Wait for redirect
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log(`\n📍 Current URL: ${loginPage.url()}`);

  if (loginPage.url().includes('ViewEdocs')) {
    console.log('✅ Login successful! On PDF viewer page');

    // Wait for iframe to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for iframe with PDF
    console.log('\n🔍 Looking for PDF iframe...');

    const iframeInfo = await loginPage.evaluate(() => {
      const iframes = document.querySelectorAll('iframe');
      if (iframes.length > 0) {
        return Array.from(iframes).map((iframe, i) => ({
          index: i,
          src: iframe.src,
          name: iframe.name,
          id: iframe.id
        }));
      }
      return [];
    });

    console.log(`Found ${iframeInfo.length} iframes:`);
    iframeInfo.forEach(info => {
      console.log(`  [${info.index}] src="${info.src}" name="${info.name}" id="${info.id}"`);
    });

    // Try to get PDF from iframe
    if (iframeInfo.length > 0) {
      const pdfSrc = iframeInfo[0].src;
      console.log(`\n📥 Downloading PDF from iframe src: ${pdfSrc}`);

      try {
        // Navigate to the PDF URL directly
        const response = await loginPage.goto(pdfSrc, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        const buffer = await response.buffer();
        const isPDF = buffer.slice(0, 4).toString() === '%PDF';

        console.log(`\n📄 PDF validation: isPDF=${isPDF}, size=${buffer.length} bytes`);

        if (isPDF) {
          console.log('✅ Valid PDF downloaded!');

          // Save it
          const fs = require('fs');
          const path = require('path');
          const filepath = path.join(__dirname, 'harris-deed-RP-2023-279211.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`💾 Saved to: ${filepath}`);
        } else {
          console.log('❌ Not a valid PDF');
          const preview = buffer.toString().substring(0, 200);
          console.log('Content preview:', preview);
        }
      } catch (e) {
        console.log(`❌ Error: ${e.message}`);
      }
    } else {
      console.log('⚠️  No iframes found');

      // Check for PDF links
      const links = await loginPage.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        return allLinks.map(a => ({ href: a.href, text: a.textContent.trim() })).filter(l => l.text);
      });

      console.log('\n🔗 Links found on page:');
      links.forEach((link, i) => {
        if (i < 10) {
          console.log(`  [${i}] ${link.text} -> ${link.href}`);
        }
      });
    }
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
