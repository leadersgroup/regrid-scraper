const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugDallasNetwork() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track all network requests
  const imageRequests = [];

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Look for image responses
    if (contentType.includes('image') || url.includes('.png') || url.includes('.jpg') ||
        url.includes('.jpeg') || url.includes('image') || url.includes('Image')) {
      imageRequests.push({
        url: url,
        status: response.status(),
        contentType: contentType,
        size: response.headers()['content-length']
      });

      console.log(`📷 ${response.status()} ${contentType} ${url.substring(0, 150)}`);
    }
  });

  try {
    // Navigate directly to the document page
    const docUrl = 'https://dallas.tx.publicsearch.us/doc/232080994';
    console.log(`Navigating to document: ${docUrl}`);

    await page.goto(docUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\n=== WAITING FOR DOCUMENT TO LOAD ===');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== ALL IMAGE REQUESTS ===');
    console.log(JSON.stringify(imageRequests, null, 2));

    // Try to find canvas elements (PDFs are often rendered to canvas)
    const canvasInfo = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      return canvases.map((canvas, idx) => ({
        index: idx,
        width: canvas.width,
        height: canvas.height,
        id: canvas.id,
        className: canvas.className,
        parent: {
          tagName: canvas.parentElement?.tagName,
          className: canvas.parentElement?.className,
          id: canvas.parentElement?.id
        }
      }));
    });

    console.log('\n=== CANVAS ELEMENTS ===');
    console.log(JSON.stringify(canvasInfo, null, 2));

    // Check for iframes that might contain the document
    const iframeInfo = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map((iframe, idx) => ({
        index: idx,
        src: iframe.src,
        id: iframe.id,
        className: iframe.className,
        width: iframe.width,
        height: iframe.height
      }));
    });

    console.log('\n=== IFRAME ELEMENTS ===');
    console.log(JSON.stringify(iframeInfo, null, 2));

    // Look for any script tags that might load document data
    const scriptInfo = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts
        .map(script => script.src || 'inline')
        .filter(src => src.includes('doc') || src.includes('image') || src.includes('pdf'))
        .slice(0, 10);
    });

    console.log('\n=== RELEVANT SCRIPT TAGS ===');
    console.log(JSON.stringify(scriptInfo, null, 2));

    // Check window object for any document-related properties
    const windowProps = await page.evaluate(() => {
      const props = Object.keys(window).filter(key => {
        const lower = key.toLowerCase();
        return lower.includes('doc') || lower.includes('image') || lower.includes('pdf') ||
               lower.includes('page');
      });
      return props.slice(0, 20);
    });

    console.log('\n=== WINDOW PROPERTIES ===');
    console.log(JSON.stringify(windowProps, null, 2));

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasNetwork().catch(console.error);
