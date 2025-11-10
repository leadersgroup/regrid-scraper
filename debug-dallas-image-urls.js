const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasImageUrls() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Track all image requests
  const imageUrls = [];

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Look for document image PNGs
    if (url.includes('/files/documents/') && url.includes('/images/') && url.endsWith('.png')) {
      imageUrls.push(url);
      console.log(`📷 Found document image: ${url}`);
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

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`\nFound ${imageUrls.length} image(s) on page 1`);

    // Get page count
    const pageInfo = await page.evaluate(() => {
      const pageText = document.body.innerText;
      const pageMatch = pageText.match(/(\d+)\s+of\s+(\d+)/i);
      return {
        currentPage: pageMatch ? parseInt(pageMatch[1]) : 1,
        totalPages: pageMatch ? parseInt(pageMatch[2]) : 1
      };
    });

    console.log(`Page info:`, pageInfo);

    // Click next page to see the pattern
    if (pageInfo.totalPages > 1) {
      console.log('\nClicking next page...');

      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(btn => {
          const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
          const title = (btn.title || '').toLowerCase();
          return ariaLabel.includes('next') || title.includes('next');
        });
        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`\nFound ${imageUrls.length} total image(s) after clicking next`);
      }
    }

    console.log('\n=== ALL DOCUMENT IMAGE URLS ===');
    imageUrls.forEach((url, idx) => {
      console.log(`${idx + 1}. ${url}`);
    });

    // Analyze the URL pattern
    if (imageUrls.length > 0) {
      const urlPattern = imageUrls[0];
      const match = urlPattern.match(/\/files\/documents\/(\d+)\/images\/(\d+)_(\d+)\.png/);
      if (match) {
        console.log('\n=== URL PATTERN ANALYSIS ===');
        console.log(`Document ID: ${match[1]}`);
        console.log(`Image ID: ${match[2]}`);
        console.log(`Page Number: ${match[3]}`);
        console.log(`\nPattern: /files/documents/{docId}/images/{imageId}_{pageNum}.png`);
      }
    }

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasImageUrls().catch(console.error);
