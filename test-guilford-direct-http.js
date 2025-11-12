/**
 * Direct test of the exact URL provided by user
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testDirectHttp() {
  console.log('🔍 Testing exact URL from user\n');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=AutoupgradeInsecureRequests',
      '--allow-insecure-localhost',
      '--unsafely-treat-insecure-origin-as-secure=http://rdlxweb.guilfordcountync.gov'
    ]
  });

  const page = await browser.newPage();

  // Bypass CSP and allow mixed content
  await page.setBypassCSP(true);

  // Monitor network activity
  page.on('request', request => {
    if (request.url().includes('rdlxweb')) {
      console.log(`📡 Request: ${request.method()} ${request.url()}`);
    }
  });

  page.on('response', response => {
    if (response.url().includes('rdlxweb')) {
      console.log(`📨 Response: ${response.status()} ${response.url()}`);
      const headers = response.headers();
      if (headers['location']) {
        console.log(`  Redirect to: ${headers['location']}`);
      }
    }
  });

  try {
    // Test the EXACT URL provided
    const testUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8461&bookpage=888';

    console.log(`📍 Testing: ${testUrl}\n`);
    console.log('Protocol: HTTP (not HTTPS)');
    console.log('Parameters:');
    console.log('  bookcode: r');
    console.log('  booknum: 8461');
    console.log('  bookpage: 888\n');

    const response = await page.goto(testUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log(`\nResponse status: ${response.status()}`);
    console.log(`Final URL: ${response.url()}`);
    console.log(`Protocol changed: ${response.url().startsWith('https')}`);

    // Wait for content
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Analyze page
    const analysis = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const bodyHtml = document.body.innerHTML || '';

      // Check for error
      const hasError = bodyText.includes('tiffInfo') ||
                      bodyText.includes('Notice</b>') ||
                      bodyText.includes('Undefined variable');

      // Check for deed content indicators
      const hasDeedContent = bodyText.includes('GUILFORD COUNTY') ||
                            bodyText.includes('REGISTER OF DEEDS') ||
                            bodyText.includes('Book') ||
                            bodyText.includes('Page');

      // Check for book/page numbers
      const bookMatch = bodyText.match(/B(?:ook|K)[\s:]*(\d+)/i);
      const pageMatch = bodyText.match(/P(?:age|G)[\s:]*(\d+)/i);

      // Check for images
      const images = Array.from(document.querySelectorAll('img'));
      const largeImages = images.filter(img =>
        img.naturalWidth > 100 || img.width > 100
      );

      // Check for canvas
      const canvases = document.querySelectorAll('canvas');

      // Check for embeds
      const embeds = document.querySelectorAll('embed, object');

      // Check for iframes
      const iframes = document.querySelectorAll('iframe');

      // Check background images in divs
      const divsWithBg = Array.from(document.querySelectorAll('div')).filter(div => {
        const bgImage = window.getComputedStyle(div).backgroundImage;
        return bgImage && bgImage !== 'none';
      });

      return {
        url: window.location.href,
        protocol: window.location.protocol,
        hasError,
        errorDetails: hasError ? bodyText.substring(0, 300) : null,
        hasDeedContent,
        bookNumber: bookMatch ? bookMatch[1] : null,
        pageNumber: pageMatch ? pageMatch[1] : null,
        imageCount: images.length,
        largeImageCount: largeImages.length,
        canvasCount: canvases.length,
        embedCount: embeds.length,
        iframeCount: iframes.length,
        divsWithBgCount: divsWithBg.length,
        bodyLength: bodyText.length,
        hasContent: bodyText.length > 100,
        firstImageSrc: images[0]?.src || null,
        sampleText: bodyText.substring(0, 500)
      };
    });

    console.log('\n📊 Page Analysis:');
    console.log(`  Final URL: ${analysis.url}`);
    console.log(`  Protocol: ${analysis.protocol}`);
    console.log(`  Has Error: ${analysis.hasError}`);
    console.log(`  Has Deed Content: ${analysis.hasDeedContent}`);
    if (analysis.bookNumber) {
      console.log(`  Book Number: ${analysis.bookNumber}`);
    }
    if (analysis.pageNumber) {
      console.log(`  Page Number: ${analysis.pageNumber}`);
    }
    console.log(`  Images: ${analysis.imageCount} (${analysis.largeImageCount} large)`);
    console.log(`  Canvas elements: ${analysis.canvasCount}`);
    console.log(`  Embed/Object elements: ${analysis.embedCount}`);
    console.log(`  Iframe elements: ${analysis.iframeCount}`);
    console.log(`  Divs with background images: ${analysis.divsWithBgCount}`);
    console.log(`  Content length: ${analysis.bodyLength} chars`);

    if (analysis.hasError) {
      console.log('\n❌ ERROR DETECTED:');
      console.log(analysis.errorDetails);
    } else if (analysis.hasDeedContent) {
      console.log('\n✅ SUCCESS! Deed content detected!');
      if (analysis.bookNumber === '8461' && analysis.pageNumber === '888') {
        console.log('✅ Correct book and page numbers found!');
      }
      console.log('\nSample text:');
      console.log(analysis.sampleText);
    } else if (analysis.largeImageCount > 0) {
      console.log('\n✅ SUCCESS! Page has deed images!');
      console.log(`First image: ${analysis.firstImageSrc}`);
    } else if (analysis.canvasCount > 0) {
      console.log('\n✅ SUCCESS! Page has canvas (deed viewer)!');
    } else if (analysis.embedCount > 0) {
      console.log('\n✅ SUCCESS! Page has embed/object!');
    } else if (analysis.iframeCount > 0) {
      console.log('\n✅ SUCCESS! Page has iframe!');
    } else if (analysis.divsWithBgCount > 0) {
      console.log('\n✅ SUCCESS! Page has background images!');
    } else if (!analysis.hasContent) {
      console.log('\n⚠️  Page appears to be empty');
    }

    // Take screenshot
    await page.screenshot({ path: 'guilford-http-test.png' });
    console.log('\n📸 Screenshot saved as guilford-http-test.png');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Test complete. Browser remains open.');
    console.log('Press Ctrl+C to exit.');
    await new Promise(() => {});
  }
}

testDirectHttp().catch(console.error);