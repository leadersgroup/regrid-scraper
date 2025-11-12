/**
 * Debug Guilford County PDF viewer - intercept PDF URL from network requests
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function interceptPdfUrl() {
  console.log('🔍 Intercepting Guilford County PDF URL from network requests...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Track all network requests
  const pdfUrls = [];
  const imageUrls = [];

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Check for PDF
    if (contentType.includes('pdf') || url.toLowerCase().includes('.pdf')) {
      console.log(`📄 Found PDF: ${url}`);
      console.log(`   Content-Type: ${contentType}`);
      pdfUrls.push(url);
    }

    // Check for images (deed might be served as image)
    if (contentType.includes('image/') || url.match(/\.(jpg|jpeg|png|gif|tiff|tif)$/i)) {
      const status = response.status();
      if (status === 200) {
        console.log(`🖼️  Found image: ${url.substring(0, 100)}...`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Status: ${status}`);
        imageUrls.push({ url, contentType });
      }
    }
  });

  try {
    // Navigate to the PDF viewer URL
    const viewerUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8264&bookpage=2347';
    console.log('Navigating to PDF viewer:', viewerUrl);
    console.log('');

    await page.goto(viewerUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log('\n⏳ Waiting for all resources to load...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Take screenshot
    await page.screenshot({ path: 'guilford-intercepted.png', fullPage: true });
    console.log('\n📸 Screenshot: guilford-intercepted.png');

    console.log('\n=== INTERCEPTED RESOURCES ===');
    console.log(`\nPDF URLs found: ${pdfUrls.length}`);
    if (pdfUrls.length > 0) {
      pdfUrls.forEach((url, idx) => {
        console.log(`${idx + 1}. ${url}`);
      });
    }

    console.log(`\nImage URLs found: ${imageUrls.length}`);
    if (imageUrls.length > 0) {
      imageUrls.forEach((img, idx) => {
        console.log(`${idx + 1}. ${img.url}`);
        console.log(`   Type: ${img.contentType}`);
      });
    }

    // Try to get the actual PDF/image data
    if (pdfUrls.length > 0) {
      console.log('\n🔍 Trying to download PDF...');
      const pdfResponse = await page.goto(pdfUrls[0], { waitUntil: 'networkidle0' });
      const pdfBuffer = await pdfResponse.buffer();
      fs.writeFileSync('guilford-intercepted.pdf', pdfBuffer);
      console.log(`✅ Saved PDF: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
    } else if (imageUrls.length > 0) {
      console.log('\n🔍 Checking images for deed document...');
      for (let i = 0; i < Math.min(imageUrls.length, 5); i++) {
        const img = imageUrls[i];
        try {
          const imgResponse = await page.goto(img.url, { waitUntil: 'networkidle0' });
          const imgBuffer = await imgResponse.buffer();
          console.log(`Image ${i + 1}: ${(imgBuffer.length / 1024).toFixed(2)} KB`);

          // Save if it's larger than 100KB (likely a document, not an icon)
          if (imgBuffer.length > 100 * 1024) {
            const ext = img.contentType.split('/')[1] || 'jpg';
            fs.writeFileSync(`guilford-intercepted-img-${i + 1}.${ext}`, imgBuffer);
            console.log(`✅ Saved large image ${i + 1}`);
          }
        } catch (e) {
          console.log(`⚠️  Could not download image ${i + 1}: ${e.message}`);
        }
      }
    }

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-intercept-error.png' });
  }
}

interceptPdfUrl().catch(console.error);
