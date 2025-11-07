const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const https = require('https');
const {URL} = require('url');

(async () => {
  console.log('🚀 Inspecting ViewEdocs.aspx page to find PDF URL...\n');

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

  const pdfViewerUrl = newPage.url();
  console.log(`📍 PDF Viewer URL: ${pdfViewerUrl}\n`);

  // Get the HTML content
  const htmlContent = await newPage.content();
  console.log('📄 ViewEdocs.aspx HTML content (first 2000 chars):');
  console.log('='.repeat(80));
  console.log(htmlContent.substring(0, 2000));
  console.log('='.repeat(80));
  console.log();

  // Look for PDF-related URLs or parameters
  console.log('🔍 Searching for PDF references in HTML...\n');

  const pdfUrls = htmlContent.match(/https?:\/\/[^"'\s]+\.pdf[^"'\s]*/gi) || [];
  const blobUrls = htmlContent.match(/blob:[^"'\s]+/gi) || [];
  const srcMatches = htmlContent.match(/src=["']([^"']+)["']/gi) || [];

  console.log(`PDF URLs found: ${pdfUrls.length}`);
  pdfUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

  console.log(`\nBlob URLs found: ${blobUrls.length}`);
  blobUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

  console.log(`\nSrc attributes found: ${srcMatches.length}`);
  srcMatches.slice(0, 10).forEach((match, i) => console.log(`  ${i + 1}. ${match}`));

  // Try to extract PDF from page evaluate
  console.log('\n🔍 Checking for PDF data in page JavaScript...\n');
  const pdfInfo = await newPage.evaluate(() => {
    // Check if there's an iframe or embed
    const iframes = Array.from(document.querySelectorAll('iframe'));
    const embeds = Array.from(document.querySelectorAll('embed'));
    const objects = Array.from(document.querySelectorAll('object'));

    return {
      iframes: iframes.map(f => ({ src: f.src, type: f.type })),
      embeds: embeds.map(e => ({ src: e.src, type: e.type })),
      objects: objects.map(o => ({ data: o.data, type: o.type })),
      scripts: Array.from(document.querySelectorAll('script')).length
    };
  });

  console.log('Page elements:');
  console.log(JSON.stringify(pdfInfo, null, 2));

  // Get cookies
  const cookies = await newPage.cookies();
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Try fetching with different headers
  console.log('\n📥 Trying to fetch PDF with different Accept headers...\n');

  const attempts = [
    {
      name: 'PDF-only Accept',
      accept: 'application/pdf'
    },
    {
      name: 'All Accept',
      accept: '*/*'
    },
    {
      name: 'Browser Accept (no PDF preference)',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  ];

  for (const attempt of attempts) {
    console.log(`\nAttempt: ${attempt.name}`);

    const pdfUrl = new URL(pdfViewerUrl);
    const options = {
      hostname: pdfUrl.hostname,
      port: 443,
      path: pdfUrl.pathname + pdfUrl.search,
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': attempt.accept,
        'Connection': 'keep-alive'
      }
    };

    const result = await new Promise((resolve) => {
      const chunks = [];
      const req = https.request(options, (res) => {
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const isPDF = buffer.slice(0, 4).toString() === '%PDF';
          resolve({
            status: res.statusCode,
            contentType: res.headers['content-type'],
            size: buffer.length,
            isPDF: isPDF,
            preview: buffer.slice(0, 200).toString()
          });
        });
      });
      req.on('error', () => resolve({ error: true }));
      req.end();
    });

    console.log(`  Status: ${result.status}`);
    console.log(`  Content-Type: ${result.contentType}`);
    console.log(`  Size: ${result.size} bytes`);
    console.log(`  Is PDF: ${result.isPDF}`);
    if (!result.isPDF) {
      console.log(`  Preview: ${result.preview.substring(0, 150)}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
