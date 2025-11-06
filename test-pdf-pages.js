const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const {PDFDocument} = require('pdf-lib');

(async () => {
  console.log('🚀 Testing multi-page PDF capture by printing each page...\n');

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

  console.log('⏳ Waiting for PDF viewer to load...\n');
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Check if there's a page navigation or if we can access the shadow DOM
  console.log('🔍 Inspecting page structure...\n');

  const pageInfo = await newPage.evaluate(() => {
    // Look for page indicators
    const bodyText = document.body.innerText;
    const pageMatch = bodyText.match(/(\d+)\s*\/\s*(\d+)|Page\s*(\d+)\s*of\s*(\d+)/i);

    // Check for iframe with PDF
    const iframes = Array.from(document.querySelectorAll('iframe'));
    const pdfIframe = iframes.find(iframe => {
      const src = iframe.src || '';
      const type = iframe.getAttribute('type') || '';
      return src.includes('pdf') || type.includes('pdf') || src.startsWith('chrome-extension');
    });

    // Check for page navigation buttons
    const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"]'));
    const navButtons = buttons.filter(btn => {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      return text.includes('next') || text.includes('prev') || text.includes('page') ||
             text.includes('>') || text.includes('<') || text.includes('→') || text.includes('←');
    });

    return {
      pageMatch: pageMatch ? pageMatch[0] : null,
      currentPage: pageMatch ? parseInt(pageMatch[1] || pageMatch[3]) : null,
      totalPages: pageMatch ? parseInt(pageMatch[2] || pageMatch[4]) : null,
      hasPdfIframe: !!pdfIframe,
      pdfIframeSrc: pdfIframe ? pdfIframe.src : null,
      navButtonsCount: navButtons.length,
      navButtonsText: navButtons.map(btn => btn.textContent || btn.value).slice(0, 5)
    };
  });

  console.log('Page info:', JSON.stringify(pageInfo, null, 2));

  if (pageInfo.totalPages) {
    console.log(`\n📄 Document has ${pageInfo.totalPages} pages\n`);
    console.log('📸 Will try to capture each page by navigating and printing...\n');

    const mergedPdf = await PDFDocument.create();

    for (let i = 1; i <= pageInfo.totalPages; i++) {
      console.log(`   Capturing page ${i}/${pageInfo.totalPages}...`);

      // Try to navigate to page i (if navigation exists)
      if (pageInfo.navButtonsCount > 0) {
        // Click next button if not on page i
        // This is simplified - real implementation would need better navigation logic
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Print current view
      const client = await newPage.target().createCDPSession();
      const {data} = await client.send('Page.printToPDF', {
        printBackground: true,
        preferCSSPageSize: true
      });

      const pageBuffer = Buffer.from(data, 'base64');
      console.log(`      ${pageBuffer.length} bytes captured`);

      // Load this page into pdf-lib
      const pagePdf = await PDFDocument.load(pageBuffer);
      const [copiedPage] = await mergedPdf.copyPages(pagePdf, [0]);
      mergedPdf.addPage(copiedPage);
    }

    // Save merged PDF
    const mergedBytes = await mergedPdf.save();
    const filepath = path.join(__dirname, 'merged-all-pages.pdf');
    fs.writeFileSync(filepath, mergedBytes);
    console.log(`\n✅ Merged PDF saved: ${filepath} (${mergedBytes.length} bytes)\n`);
  } else {
    console.log('\n❌ Could not determine page count\n');

    // Just try printing current view
    console.log('📸 Printing current view...\n');
    const client = await newPage.target().createCDPSession();
    const {data} = await client.send('Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: true
    });

    const buffer = Buffer.from(data, 'base64');
    const filepath = path.join(__dirname, 'single-print.pdf');
    fs.writeFileSync(filepath, buffer);
    console.log(`✅ Saved: ${filepath} (${buffer.length} bytes)\n`);
  }

  console.log('⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
