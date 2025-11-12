/**
 * Direct test of Guilford County deed page to diagnose blank PDF issue
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testDeedPage() {
  console.log('🔍 Testing Guilford County deed page directly...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Test URL that's having issues
    const deedUrl = 'https://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8264&bookpage=2347';

    console.log(`📍 Navigating to: ${deedUrl}\n`);

    // Navigate with various wait strategies
    console.log('Step 1: Initial navigation...');
    await page.goto(deedUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    console.log('Step 2: Waiting for content to load...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

    // Check what's on the page
    console.log('Step 3: Analyzing page content...\n');

    const pageInfo = await page.evaluate(() => {
      // Get page text
      const bodyText = document.body.innerText || '';

      // Look for images
      const images = Array.from(document.querySelectorAll('img'));
      const imageInfo = images.map(img => ({
        src: img.src,
        width: img.width || img.naturalWidth,
        height: img.height || img.naturalHeight,
        alt: img.alt,
        visible: img.offsetParent !== null
      }));

      // Look for iframes
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const iframeInfo = iframes.map(iframe => ({
        src: iframe.src,
        width: iframe.width,
        height: iframe.height
      }));

      // Look for embeds/objects
      const embeds = Array.from(document.querySelectorAll('embed, object'));
      const embedInfo = embeds.map(embed => ({
        src: embed.src || embed.data,
        type: embed.type,
        width: embed.width,
        height: embed.height
      }));

      // Check for error messages
      const hasError = bodyText.includes('Notice</b>') ||
                      bodyText.includes('Error</b>') ||
                      bodyText.includes('Warning</b>') ||
                      bodyText.includes('Undefined variable');

      // Check if page is mostly empty
      const isEmpty = bodyText.trim().length < 100;

      return {
        url: window.location.href,
        title: document.title,
        bodyText: bodyText.substring(0, 500),
        textLength: bodyText.length,
        hasError,
        isEmpty,
        images: imageInfo,
        iframes: iframeInfo,
        embeds: embedInfo
      };
    });

    console.log('=== PAGE ANALYSIS ===');
    console.log('URL:', pageInfo.url);
    console.log('Title:', pageInfo.title);
    console.log('Text length:', pageInfo.textLength);
    console.log('Has error:', pageInfo.hasError);
    console.log('Is empty:', pageInfo.isEmpty);
    console.log('\nImages found:', pageInfo.images.length);
    if (pageInfo.images.length > 0) {
      pageInfo.images.forEach((img, i) => {
        console.log(`  Image ${i + 1}: ${img.width}x${img.height}, visible: ${img.visible}`);
        console.log(`    src: ${img.src}`);
      });
    }
    console.log('\nIframes found:', pageInfo.iframes.length);
    console.log('Embeds found:', pageInfo.embeds.length);
    console.log('\nFirst 500 chars of text:');
    console.log(pageInfo.bodyText);

    // Take screenshots
    console.log('\n📸 Taking screenshots...');

    // Full page screenshot
    await page.screenshot({
      path: 'guilford-deed-fullpage.png',
      fullPage: true
    });
    console.log('✅ Saved: guilford-deed-fullpage.png');

    // Viewport screenshot
    await page.screenshot({
      path: 'guilford-deed-viewport.png'
    });
    console.log('✅ Saved: guilford-deed-viewport.png');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('guilford-deed-page.html', html);
    console.log('✅ Saved: guilford-deed-page.html');

    // Try alternate approaches
    console.log('\n🔄 Trying alternate approaches...');

    // Try refreshing the page
    console.log('  Refreshing page...');
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 5000));

    const afterRefresh = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      const largeImages = images.filter(img =>
        (img.width > 400 || img.naturalWidth > 400) && img.offsetParent !== null
      );
      return {
        imageCount: images.length,
        largeImageCount: largeImages.length,
        hasContent: document.body.innerText.length > 100
      };
    });

    console.log('  After refresh:');
    console.log(`    Images: ${afterRefresh.imageCount}`);
    console.log(`    Large images: ${afterRefresh.largeImageCount}`);
    console.log(`    Has content: ${afterRefresh.hasContent}`);

    // Try with different URL parameters
    console.log('\n  Trying alternate URL formats...');
    const alternateUrls = [
      'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8264&bookpage=2347',
      'https://rdlxweb.guilfordcountync.gov/gis/viewimage.php?bookcode=r&booknum=8264&bookpage=2347',
      'https://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=R&booknum=8264&bookpage=2347'
    ];

    for (const altUrl of alternateUrls) {
      console.log(`\n  Testing: ${altUrl}`);
      try {
        const newPage = await browser.newPage();
        await newPage.goto(altUrl, {
          waitUntil: 'networkidle0',
          timeout: 30000
        });
        await new Promise(resolve => setTimeout(resolve, 3000));

        const result = await newPage.evaluate(() => {
          const images = Array.from(document.querySelectorAll('img'));
          const bodyText = document.body.innerText || '';
          return {
            hasImages: images.some(img => img.width > 400 || img.naturalWidth > 400),
            hasError: bodyText.includes('Notice</b>') || bodyText.includes('Error</b>'),
            textLength: bodyText.length
          };
        });

        console.log(`    Has images: ${result.hasImages}`);
        console.log(`    Has error: ${result.hasError}`);
        console.log(`    Text length: ${result.textLength}`);

        await newPage.close();
      } catch (err) {
        console.log(`    Failed: ${err.message}`);
      }
    }

    console.log('\n✅ Test complete. Check the saved files to see what was captured.');
    console.log('\n⚠️  DIAGNOSIS:');
    if (pageInfo.hasError) {
      console.log('  The Guilford County server is returning PHP errors instead of deed images.');
      console.log('  This is a server-side issue that cannot be fixed in the scraper.');
      console.log('  The server needs to be fixed or an alternative data source needs to be found.');
    } else if (pageInfo.isEmpty) {
      console.log('  The page appears to be empty or not loading properly.');
      console.log('  This could be due to server issues or authentication requirements.');
    } else if (pageInfo.images.length === 0) {
      console.log('  No images found on the page. The deed might be loaded differently.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n⏸️  Browser staying open for manual inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {}); // Keep browser open
  }
}

testDeedPage();