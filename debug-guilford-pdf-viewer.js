/**
 * Debug Guilford County PDF viewer page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugPdfViewer() {
  console.log('🔍 Debugging Guilford County PDF viewer page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate directly to the PDF viewer URL
    const pdfUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8264&bookpage=2347';
    console.log('Navigating to PDF viewer:', pdfUrl);

    await page.goto(pdfUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot
    await page.screenshot({ path: 'guilford-pdf-viewer.png', fullPage: true });
    console.log('📸 Screenshot: guilford-pdf-viewer.png\n');

    // Analyze page
    console.log('Analyzing PDF viewer page...\n');
    const viewerInfo = await page.evaluate(() => {
      // Check if current URL is a PDF
      const isPdfUrl = window.location.href.toLowerCase().includes('.pdf');

      // Look for iframes
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const iframeInfo = iframes.map(iframe => ({
        src: iframe.src,
        id: iframe.id,
        name: iframe.name
      }));

      // Look for embed/object
      const embeds = Array.from(document.querySelectorAll('embed, object'));
      const embedInfo = embeds.map(embed => ({
        src: embed.src || embed.data,
        type: embed.type
      }));

      // Look for images (might be rendered as image)
      const images = Array.from(document.querySelectorAll('img'));
      const imageInfo = images.slice(0, 10).map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height
      }));

      // Look for canvas (might be PDF.js)
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const canvasInfo = canvases.map(canvas => ({
        id: canvas.id,
        className: canvas.className,
        width: canvas.width,
        height: canvas.height
      }));

      // Look for any PDF-related elements
      const pdfElements = Array.from(document.querySelectorAll('[class*="pdf"], [id*="pdf"]'));
      const pdfElementInfo = pdfElements.map(el => ({
        tagName: el.tagName,
        id: el.id,
        className: el.className
      }));

      // Get all scripts that might load PDF
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const scriptInfo = scripts.map(script => script.src);

      return {
        currentUrl: window.location.href,
        isPdfUrl,
        iframes: iframeInfo,
        embeds: embedInfo,
        images: imageInfo,
        canvases: canvasInfo,
        pdfElements: pdfElementInfo,
        scripts: scriptInfo,
        bodyText: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('=== PDF VIEWER PAGE ANALYSIS ===');
    console.log('Current URL:', viewerInfo.currentUrl);
    console.log('Is PDF URL:', viewerInfo.isPdfUrl);
    console.log('\nIframes:', JSON.stringify(viewerInfo.iframes, null, 2));
    console.log('\nEmbeds:', JSON.stringify(viewerInfo.embeds, null, 2));
    console.log('\nImages (first 10):', JSON.stringify(viewerInfo.images, null, 2));
    console.log('\nCanvases:', JSON.stringify(viewerInfo.canvases, null, 2));
    console.log('\nPDF Elements:', JSON.stringify(viewerInfo.pdfElements, null, 2));
    console.log('\nScripts:', JSON.stringify(viewerInfo.scripts, null, 2));
    console.log('\nPage Text (first 1000 chars):', viewerInfo.bodyText);

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('guilford-pdf-viewer.html', html);
    console.log('\n✅ Saved: guilford-pdf-viewer.html');

    // Try to get the actual PDF URL if it's an image viewer
    console.log('\n🔍 Checking for actual PDF or image URL...');
    const pdfResourceUrl = await page.evaluate(() => {
      // Check for direct image
      const images = Array.from(document.querySelectorAll('img'));
      if (images.length > 0) {
        const mainImg = images.find(img => img.width > 500) || images[0];
        return mainImg ? mainImg.src : null;
      }

      // Check for canvas with data URL
      const canvases = Array.from(document.querySelectorAll('canvas'));
      if (canvases.length > 0) {
        try {
          return canvases[0].toDataURL();
        } catch (e) {
          return null;
        }
      }

      return null;
    });

    if (pdfResourceUrl) {
      console.log('Found resource URL:', pdfResourceUrl.substring(0, 200) + '...');
    } else {
      console.log('No direct PDF/image resource found');
    }

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-pdf-viewer-error.png' });
  }
}

debugPdfViewer().catch(console.error);
