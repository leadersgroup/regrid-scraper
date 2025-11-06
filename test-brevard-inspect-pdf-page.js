/**
 * Diagnostic script to inspect the Brevard Clerk PDF detail page
 * This will help us understand what's on the page and how to download the PDF
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function inspect() {
  console.log('🔍 Inspecting Brevard Clerk PDF page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Navigate to the PDF detail page
  const testUrl = 'https://vaclmweb1.brevardclerk.us/AcclaimWeb/Details/GetDocumentbyBookPage/OR/6790/1266';
  console.log(`📍 Navigating to: ${testUrl}\n`);

  await page.goto(testUrl, {
    waitUntil: 'networkidle0',
    timeout: 60000
  });

  console.log(`✅ Page loaded\n`);

  // Wait a bit for any dynamic content
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Get page information
  const pageInfo = await page.evaluate(() => {
    const info = {
      title: document.title,
      url: window.location.href,
      bodyText: document.body.innerText.substring(0, 1000),

      // Look for PDF-related elements
      pdfLinks: [],
      pdfIframes: [],
      pdfEmbeds: [],
      pdfObjects: [],
      downloadButtons: [],
      allLinks: []
    };

    // Find PDF links
    const links = document.querySelectorAll('a');
    links.forEach(link => {
      const href = link.href || '';
      const text = (link.textContent || '').trim();

      if (href.toLowerCase().includes('.pdf') ||
          text.toLowerCase().includes('pdf') ||
          text.toLowerCase().includes('download') ||
          text.toLowerCase().includes('view')) {
        info.pdfLinks.push({ href, text });
      }

      if (href) {
        info.allLinks.push({ href, text: text.substring(0, 100) });
      }
    });

    // Find iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      info.pdfIframes.push({
        src: iframe.src,
        id: iframe.id,
        className: iframe.className
      });
    });

    // Find embed tags
    const embeds = document.querySelectorAll('embed');
    embeds.forEach(embed => {
      info.pdfEmbeds.push({
        src: embed.src,
        type: embed.type
      });
    });

    // Find object tags
    const objects = document.querySelectorAll('object');
    objects.forEach(obj => {
      info.pdfObjects.push({
        data: obj.data,
        type: obj.type
      });
    });

    // Find download buttons
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"]');
    buttons.forEach(btn => {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('download') || text.includes('pdf') || text.includes('view')) {
        info.downloadButtons.push({
          text: btn.textContent || btn.value,
          id: btn.id,
          className: btn.className
        });
      }
    });

    return info;
  });

  console.log('📊 Page Information:');
  console.log('='.repeat(80));
  console.log(`Title: ${pageInfo.title}`);
  console.log(`URL: ${pageInfo.url}`);
  console.log('\nBody Text (first 1000 chars):');
  console.log(pageInfo.bodyText);
  console.log('\n' + '='.repeat(80));

  console.log('\n📎 PDF Links found:');
  if (pageInfo.pdfLinks.length > 0) {
    pageInfo.pdfLinks.forEach((link, i) => {
      console.log(`  [${i+1}] ${link.text}`);
      console.log(`      ${link.href}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🖼️  PDF Iframes found:');
  if (pageInfo.pdfIframes.length > 0) {
    pageInfo.pdfIframes.forEach((iframe, i) => {
      console.log(`  [${i+1}] src: ${iframe.src}`);
      console.log(`      id: ${iframe.id}, class: ${iframe.className}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n📌 PDF Embeds found:');
  if (pageInfo.pdfEmbeds.length > 0) {
    pageInfo.pdfEmbeds.forEach((embed, i) => {
      console.log(`  [${i+1}] src: ${embed.src}`);
      console.log(`      type: ${embed.type}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n📦 PDF Objects found:');
  if (pageInfo.pdfObjects.length > 0) {
    pageInfo.pdfObjects.forEach((obj, i) => {
      console.log(`  [${i+1}] data: ${obj.data}`);
      console.log(`      type: ${obj.type}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🔘 Download Buttons found:');
  if (pageInfo.downloadButtons.length > 0) {
    pageInfo.downloadButtons.forEach((btn, i) => {
      console.log(`  [${i+1}] ${btn.text}`);
      console.log(`      id: ${btn.id}, class: ${btn.className}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🔗 All Links (first 20):');
  pageInfo.allLinks.slice(0, 20).forEach((link, i) => {
    console.log(`  [${i+1}] ${link.text}`);
    console.log(`      ${link.href}`);
  });

  console.log('\n⏸️  Keeping browser open for manual inspection...');
  console.log('Press Ctrl+C to exit');

  // Keep browser open for manual inspection
  await new Promise(() => {});
}

inspect().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
