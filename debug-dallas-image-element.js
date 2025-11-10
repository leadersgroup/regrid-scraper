const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasImageElement() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate directly to the document page
    const docUrl = 'https://dallas.tx.publicsearch.us/doc/232080994';
    console.log(`Navigating to document: ${docUrl}`);

    await page.goto(docUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Find the document viewer container and image element
    const viewerInfo = await page.evaluate(() => {
      const result = {
        containers: [],
        images: [],
        divs: []
      };

      // Look for common document viewer containers
      const possibleContainers = [
        'div[class*="viewer"]',
        'div[class*="document"]',
        'div[class*="image"]',
        'div[class*="page"]',
        'div[id*="viewer"]',
        'div[id*="document"]',
        'iframe'
      ];

      possibleContainers.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el, idx) => {
          if (el.offsetWidth > 300 && el.offsetHeight > 300) {
            result.containers.push({
              selector: selector,
              index: idx,
              id: el.id,
              className: el.className,
              width: el.offsetWidth,
              height: el.offsetHeight,
              tagName: el.tagName
            });
          }
        });
      });

      // Look for all images
      const imgs = Array.from(document.querySelectorAll('img'));
      result.images = imgs.map((img, idx) => ({
        index: idx,
        src: img.src.substring(0, 200),
        width: img.width,
        height: img.height,
        alt: img.alt,
        id: img.id,
        className: img.className
      })).filter(img => img.width > 100 || img.height > 100);

      // Look for large divs that might contain the document
      const allDivs = Array.from(document.querySelectorAll('div'));
      result.divs = allDivs.filter(div => {
        const width = div.offsetWidth;
        const height = div.offsetHeight;
        return width > 400 && height > 400;
      }).map((div, idx) => ({
        index: idx,
        id: div.id,
        className: div.className,
        width: div.offsetWidth,
        height: div.offsetHeight,
        hasImage: !!div.querySelector('img'),
        hasCanvas: !!div.querySelector('canvas'),
        childCount: div.children.length
      })).slice(0, 10);

      return result;
    });

    console.log('\n=== VIEWER CONTAINER INFO ===');
    console.log('Containers:', JSON.stringify(viewerInfo.containers, null, 2));
    console.log('\nImages:', JSON.stringify(viewerInfo.images, null, 2));
    console.log('\nLarge divs:', JSON.stringify(viewerInfo.divs, null, 2));

    // Try to take a screenshot of the first large container
    if (viewerInfo.containers.length > 0) {
      console.log('\n=== TESTING ELEMENT SCREENSHOT ===');
      const container = viewerInfo.containers[0];
      console.log('Trying to screenshot:', container);

      try {
        const elementHandle = await page.evaluateHandle((selector, index) => {
          const elements = document.querySelectorAll(selector);
          return elements[index];
        }, container.selector, container.index);

        const screenshot = await elementHandle.asElement().screenshot({ type: 'png' });
        require('fs').writeFileSync('/tmp/dallas-element-test.png', screenshot);
        console.log('✅ Element screenshot saved to /tmp/dallas-element-test.png');
        console.log(`   Size: ${(screenshot.length / 1024).toFixed(2)} KB`);
      } catch (error) {
        console.log('❌ Could not screenshot element:', error.message);
      }
    }

    // Also try to find the image by looking at all images
    if (viewerInfo.images.length > 0) {
      console.log('\n=== TESTING IMAGE SCREENSHOT ===');
      for (let i = 0; i < Math.min(3, viewerInfo.images.length); i++) {
        const img = viewerInfo.images[i];
        console.log(`\nTrying image ${i}:`, img.src.substring(0, 100));

        try {
          const imgHandle = await page.evaluateHandle((index) => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const largeImgs = imgs.filter(img => img.width > 100 || img.height > 100);
            return largeImgs[index];
          }, i);

          const screenshot = await imgHandle.asElement().screenshot({ type: 'png' });
          require('fs').writeFileSync(`/tmp/dallas-img-${i}.png`, screenshot);
          console.log(`✅ Image ${i} screenshot saved to /tmp/dallas-img-${i}.png`);
          console.log(`   Size: ${(screenshot.length / 1024).toFixed(2)} KB`);
        } catch (error) {
          console.log(`❌ Could not screenshot image ${i}:`, error.message);
        }
      }
    }

    await page.screenshot({ path: '/tmp/dallas-full-page-debug.png', fullPage: true });
    console.log('\nFull page screenshot saved to /tmp/dallas-full-page-debug.png');

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasImageElement().catch(console.error);
