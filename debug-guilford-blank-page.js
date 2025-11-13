/**
 * Debug script to investigate why Guilford County deed viewer shows blank
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugBlankDeedPage() {
  console.log('🔍 Debugging Guilford County Blank Deed Page Issue\n');
  console.log('=' .repeat(50) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  try {
    // Navigate to the deed viewer URL directly
    const deedUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8264&bookpage=2347';
    console.log(`📄 Navigating to deed viewer: ${deedUrl}\n`);

    // Set up request interception to see what's being loaded
    await page.setRequestInterception(true);
    const requestLog = [];

    page.on('request', request => {
      const url = request.url();
      const type = request.resourceType();
      requestLog.push({ url, type });

      if (type === 'image' || url.includes('.tif') || url.includes('.jpg') || url.includes('.png')) {
        console.log(`  📸 Image request: ${url.substring(0, 100)}...`);
      }

      request.continue();
    });

    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';

      if (status !== 200 && status !== 304) {
        console.log(`  ❌ Failed request (${status}): ${url.substring(0, 100)}...`);
      }

      if (contentType.includes('image') || url.includes('.tif')) {
        console.log(`  ✅ Image response (${status}): ${contentType} - ${url.substring(0, 100)}...`);
      }
    });

    // Navigate to the page
    const response = await page.goto(deedUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log(`\n📊 Page loaded with status: ${response.status()}`);
    console.log(`📄 Content-Type: ${response.headers()['content-type']}`);

    // Wait a bit for any dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check page content
    console.log('\n🔍 Analyzing page content...\n');

    const pageAnalysis = await page.evaluate(() => {
      const analysis = {
        title: document.title,
        url: window.location.href,
        bodyHTML: document.body.innerHTML.substring(0, 500),
        bodyText: document.body.innerText || document.body.textContent || '',
        backgroundColor: window.getComputedStyle(document.body).backgroundColor,
        images: [],
        frames: [],
        scripts: [],
        errors: []
      };

      // Check for images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        analysis.images.push({
          src: img.src,
          width: img.width,
          naturalWidth: img.naturalWidth,
          height: img.height,
          naturalHeight: img.naturalHeight,
          complete: img.complete,
          alt: img.alt
        });
      });

      // Check for frames
      const frames = document.querySelectorAll('frame, iframe');
      frames.forEach(frame => {
        analysis.frames.push({
          src: frame.src,
          name: frame.name,
          id: frame.id
        });
      });

      // Check for scripts
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => {
        if (script.src) {
          analysis.scripts.push(script.src);
        }
      });

      // Check for any error messages in the page
      const errorPatterns = ['error', 'Error', 'ERROR', 'Notice:', 'Warning:', 'Exception'];
      errorPatterns.forEach(pattern => {
        if (document.body.innerHTML.includes(pattern)) {
          analysis.errors.push(pattern);
        }
      });

      // Check for canvas
      analysis.hasCanvas = document.querySelector('canvas') !== null;

      // Check for embed/object
      analysis.hasEmbed = document.querySelector('embed, object') !== null;

      return analysis;
    });

    console.log('📋 Page Title:', pageAnalysis.title || '(empty)');
    console.log('🔗 Page URL:', pageAnalysis.url);
    console.log('🎨 Background Color:', pageAnalysis.backgroundColor);
    console.log('📝 Body Text Length:', pageAnalysis.bodyText.length);
    console.log('🖼️ Images Found:', pageAnalysis.images.length);
    console.log('🖼️ Frames Found:', pageAnalysis.frames.length);
    console.log('📜 Scripts Found:', pageAnalysis.scripts.length);
    console.log('🎨 Has Canvas:', pageAnalysis.hasCanvas);
    console.log('📦 Has Embed/Object:', pageAnalysis.hasEmbed);

    if (pageAnalysis.errors.length > 0) {
      console.log('⚠️ Error indicators found:', pageAnalysis.errors);
    }

    // Show first 200 chars of body HTML
    console.log('\n📄 Body HTML (first 500 chars):');
    console.log(pageAnalysis.bodyHTML);

    // Show body text
    console.log('\n📝 Body Text:');
    console.log(pageAnalysis.bodyText || '(empty)');

    // Show images details
    if (pageAnalysis.images.length > 0) {
      console.log('\n🖼️ Image Details:');
      pageAnalysis.images.forEach((img, i) => {
        console.log(`  Image ${i + 1}:`);
        console.log(`    src: ${img.src}`);
        console.log(`    dimensions: ${img.width}x${img.height} (natural: ${img.naturalWidth}x${img.naturalHeight})`);
        console.log(`    complete: ${img.complete}`);
      });
    }

    // Show request log summary
    console.log('\n📊 Network Request Summary:');
    const requestTypes = {};
    requestLog.forEach(req => {
      requestTypes[req.type] = (requestTypes[req.type] || 0) + 1;
    });
    Object.entries(requestTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} requests`);
    });

    // Check if page source contains TIFF reference
    const pageSource = await page.content();
    if (pageSource.includes('.tif')) {
      console.log('\n✅ Page source contains TIFF reference');
    }

    // Try to check frames content
    const allFrames = page.frames();
    console.log(`\n🖼️ Total frames on page: ${allFrames.length}`);

    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      if (frame.url() && frame.url() !== 'about:blank') {
        console.log(`\n  Frame ${i + 1}: ${frame.url()}`);
        try {
          const frameContent = await frame.evaluate(() => {
            return {
              bodyText: document.body ? (document.body.innerText || '') : '',
              imageCount: document.querySelectorAll('img').length,
              backgroundColor: document.body ? window.getComputedStyle(document.body).backgroundColor : ''
            };
          });
          console.log(`    Text length: ${frameContent.bodyText.length}`);
          console.log(`    Images: ${frameContent.imageCount}`);
          console.log(`    Background: ${frameContent.backgroundColor}`);
        } catch (e) {
          console.log(`    Could not analyze frame: ${e.message}`);
        }
      }
    }

    // Take a screenshot for visual inspection
    await page.screenshot({ path: 'guilford-deed-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved as guilford-deed-debug.png');

    console.log('\n' + '=' .repeat(50));
    console.log('Press Ctrl+C to close the browser and exit...');

    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 300000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugBlankDeedPage();