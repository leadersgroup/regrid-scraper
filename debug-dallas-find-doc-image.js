const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugDallasDocImage() {
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

    // Search for the document image more aggressively
    const docImageInfo = await page.evaluate(() => {
      const result = {
        allImages: [],
        divWithImage: null,
        imageContainer: null
      };

      // Get ALL images on the page
      const allImgs = Array.from(document.querySelectorAll('img'));
      result.allImages = allImgs.map((img, idx) => ({
        index: idx,
        src: img.src,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        id: img.id,
        className: img.className,
        parent: {
          tagName: img.parentElement?.tagName,
          className: img.parentElement?.className,
          id: img.parentElement?.id
        }
      }));

      // Find the div with class css-1wvt4ep that contains the image
      const containerDiv = document.querySelector('.css-1wvt4ep');
      if (containerDiv) {
        result.divWithImage = {
          className: containerDiv.className,
          width: containerDiv.offsetWidth,
          height: containerDiv.offsetHeight,
          innerHTML: containerDiv.innerHTML.substring(0, 500),
          hasImage: !!containerDiv.querySelector('img')
        };
      }

      // Look for any element with "document" or "image" in the class
      const docElements = Array.from(document.querySelectorAll('[class*="document"], [class*="Document"], [class*="image"], [class*="Image"]'));
      result.docElements = docElements.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        width: el.offsetWidth,
        height: el.offsetHeight,
        hasImg: !!el.querySelector('img')
      })).filter(el => el.width > 200);

      return result;
    });

    console.log('\n=== ALL IMAGES ===');
    console.log(JSON.stringify(docImageInfo.allImages, null, 2));

    console.log('\n=== DIV WITH IMAGE (css-1wvt4ep) ===');
    console.log(JSON.stringify(docImageInfo.divWithImage, null, 2));

    console.log('\n=== DOCUMENT ELEMENTS ===');
    console.log(JSON.stringify(docImageInfo.docElements, null, 2));

    // Try to screenshot the div with class css-1wvt4ep
    console.log('\n=== ATTEMPTING TO SCREENSHOT DOCUMENT VIEWER ===');
    try {
      const viewerDiv = await page.$('.css-1wvt4ep');
      if (viewerDiv) {
        const screenshot = await viewerDiv.screenshot({ type: 'png' });
        fs.writeFileSync('/tmp/dallas-viewer-div.png', screenshot);
        console.log('✅ Viewer div screenshot saved to /tmp/dallas-viewer-div.png');
        console.log(`   Size: ${(screenshot.length / 1024).toFixed(2)} KB`);
      } else {
        console.log('❌ Could not find .css-1wvt4ep div');
      }
    } catch (error) {
      console.log('❌ Error screenshotting viewer div:', error.message);
    }

    // Try to screenshot the first large image
    if (docImageInfo.allImages.length > 0) {
      console.log('\n=== ATTEMPTING TO SCREENSHOT FIRST LARGE IMAGE ===');
      const largeImages = docImageInfo.allImages.filter(img => img.naturalWidth > 200);

      for (let i = 0; i < Math.min(3, largeImages.length); i++) {
        const img = largeImages[i];
        console.log(`\nImage ${i}:`, {
          src: img.src.substring(0, 100),
          size: `${img.naturalWidth}x${img.naturalHeight}`
        });

        try {
          const imgElements = await page.$$('img');
          const largeImgElements = [];

          for (const imgEl of imgElements) {
            const dimensions = await imgEl.evaluate(el => ({
              naturalWidth: el.naturalWidth,
              naturalHeight: el.naturalHeight
            }));
            if (dimensions.naturalWidth > 200) {
              largeImgElements.push(imgEl);
            }
          }

          if (largeImgElements[i]) {
            const screenshot = await largeImgElements[i].screenshot({ type: 'png' });
            fs.writeFileSync(`/tmp/dallas-doc-img-${i}.png`, screenshot);
            console.log(`✅ Image ${i} saved to /tmp/dallas-doc-img-${i}.png`);
            console.log(`   Size: ${(screenshot.length / 1024).toFixed(2)} KB`);
          }
        } catch (error) {
          console.log(`❌ Error with image ${i}:`, error.message);
        }
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

debugDallasDocImage().catch(console.error);
