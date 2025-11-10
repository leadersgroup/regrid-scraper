const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasDocImages() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate directly to the document page we found earlier
    const docUrl = 'https://dallas.tx.publicsearch.us/doc/232080994';
    console.log(`Navigating to document: ${docUrl}`);

    await page.goto(docUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze the page for image URLs and document structure
    const docInfo = await page.evaluate(() => {
      const result = {
        images: [],
        canvas: [],
        iframes: [],
        xhr: [],
        pageInfo: {}
      };

      // Look for images
      const imgs = Array.from(document.querySelectorAll('img'));
      result.images = imgs.map(img => ({
        src: img.src,
        width: img.width,
        height: img.height,
        alt: img.alt
      })).filter(img => img.width > 100);

      // Look for canvas elements (might be rendering PDFs)
      const canvases = Array.from(document.querySelectorAll('canvas'));
      result.canvas = canvases.map(c => ({
        width: c.width,
        height: c.height,
        id: c.id,
        className: c.className
      }));

      // Look for iframes
      const iframes = Array.from(document.querySelectorAll('iframe'));
      result.iframes = iframes.map(f => ({
        src: f.src,
        id: f.id
      }));

      // Try to find page count indicator
      const pageText = document.body.innerText;
      const pageMatch = pageText.match(/(\d+)\s+of\s+(\d+)/i);
      if (pageMatch) {
        result.pageInfo = {
          currentPage: pageMatch[1],
          totalPages: pageMatch[2]
        };
      }

      // Look for navigation buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      result.navButtons = buttons.filter(btn => {
        const text = (btn.textContent || '').toLowerCase();
        const title = (btn.title || '').toLowerCase();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        return text.includes('next') || text.includes('prev') ||
               title.includes('next') || title.includes('prev') ||
               ariaLabel.includes('next') || ariaLabel.includes('prev');
      }).map(btn => ({
        text: btn.textContent.trim(),
        title: btn.title,
        ariaLabel: btn.getAttribute('aria-label'),
        className: btn.className
      }));

      return result;
    });

    console.log('\n=== DOCUMENT INFO ===');
    console.log('Images:', JSON.stringify(docInfo.images, null, 2));
    console.log('\nCanvas:', JSON.stringify(docInfo.canvas, null, 2));
    console.log('\nIframes:', JSON.stringify(docInfo.iframes, null, 2));
    console.log('\nPage Info:', JSON.stringify(docInfo.pageInfo, null, 2));
    console.log('\nNav Buttons:', JSON.stringify(docInfo.navButtons, null, 2));

    // Monitor network requests to find image API calls
    console.log('\n=== MONITORING NETWORK REQUESTS ===');
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('image') || url.includes('Image') || url.includes('page') ||
          url.includes('document') || url.includes('Document')) {
        console.log(`📡 ${response.status()} ${url}`);
      }
    });

    // Try clicking next page button if available
    if (docInfo.navButtons.length > 0) {
      console.log('\n=== CLICKING NEXT PAGE ===');
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(btn => {
          const text = (btn.textContent || '').toLowerCase();
          const title = (btn.title || '').toLowerCase();
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          return text.includes('next') || title.includes('next') || ariaLabel.includes('next');
        });
        if (nextBtn) nextBtn.click();
      });

      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('Waited for page change...');
    }

    await page.screenshot({ path: '/tmp/dallas-doc-viewer-debug.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/dallas-doc-viewer-debug.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasDocImages().catch(console.error);
