/**
 * Debug script to inspect the frame structure and find the image icon
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugFrameIcon() {
  console.log('🔍 Debugging Mecklenburg ROD page frame structure...\n');

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

  try {
    // Navigate to a sample deed page (you'll need to get this URL manually first)
    console.log('⏳ Please navigate to the ROD deed page manually and press Enter when ready...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Inspect frame structure
    console.log('\n📋 Inspecting frame structure...');
    const frameInfo = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('frame, iframe'));
      return frames.map((f, i) => ({
        index: i,
        tag: f.tagName,
        name: f.name || '(no name)',
        src: f.src || '(no src)',
        id: f.id || '(no id)'
      }));
    });

    console.log(`Found ${frameInfo.length} frames:`);
    frameInfo.forEach(f => {
      console.log(`  [${f.index}] ${f.tag}: name="${f.name}", id="${f.id}"`);
      console.log(`      src: ${f.src.substring(0, 80)}...`);
    });

    // Inspect bottom frame content
    console.log('\n📋 Inspecting bottom frame content...');
    const bottomFrameContent = await page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('frame, iframe'));

      // Try to find bottom frame
      let bottomFrame = frames.find(f =>
        f.name && (f.name.toLowerCase().includes('bottom') || f.name.toLowerCase().includes('main'))
      );

      if (!bottomFrame && frames.length > 0) {
        bottomFrame = frames[frames.length - 1];
      }

      if (!bottomFrame) {
        return { error: 'No bottom frame found' };
      }

      try {
        const frameDoc = bottomFrame.contentDocument || bottomFrame.contentWindow.document;

        // Get all elements containing "Image:"
        const imageLabels = [];
        const allElements = Array.from(frameDoc.querySelectorAll('*'));

        for (const el of allElements) {
          const text = el.textContent.trim();
          if (text === 'Image:' || text.startsWith('Image:')) {
            imageLabels.push({
              tag: el.tagName,
              text: text,
              html: el.outerHTML.substring(0, 200),
              parentTag: el.parentElement?.tagName,
              parentHTML: el.parentElement?.outerHTML.substring(0, 300)
            });
          }
        }

        // Get all images
        const images = Array.from(frameDoc.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt || '(no alt)',
          title: img.title || '(no title)',
          parent: img.parentElement?.tagName,
          parentHref: img.parentElement?.tagName === 'A' ? img.parentElement.href : null
        }));

        // Get all links
        const links = Array.from(frameDoc.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent.trim().substring(0, 50),
          title: a.title || '(no title)',
          hasImage: a.querySelector('img') !== null
        }));

        return {
          frameFound: true,
          frameName: bottomFrame.name,
          imageLabels,
          totalImages: images.length,
          images: images.slice(0, 10), // First 10 images
          totalLinks: links.length,
          links: links.slice(0, 20) // First 20 links
        };

      } catch (frameError) {
        return { error: `Frame access error: ${frameError.message}` };
      }
    });

    console.log('\n📊 Bottom Frame Analysis:');
    console.log(JSON.stringify(bottomFrameContent, null, 2));

    console.log('\n✅ Debug complete. Press Enter to close browser...');
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugFrameIcon();
