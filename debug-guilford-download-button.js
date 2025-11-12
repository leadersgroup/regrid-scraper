/**
 * Debug Guilford County PDF viewer to find download button
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugDownloadButton() {
  console.log('🔍 Debugging Guilford County PDF viewer download button...\n');

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

    console.log('⏳ Waiting for page to fully render...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take screenshot
    await page.screenshot({ path: 'guilford-download-button.png', fullPage: true });
    console.log('📸 Screenshot: guilford-download-button.png\n');

    // Analyze page for download button
    console.log('🔍 Searching for download button...\n');
    const downloadInfo = await page.evaluate(() => {
      // Look for buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a[role="button"]'));
      const buttonInfo = buttons.map(btn => ({
        tagName: btn.tagName,
        text: btn.textContent.trim() || btn.value,
        id: btn.id,
        className: btn.className,
        href: btn.tagName === 'A' ? btn.href : null,
        style: {
          position: window.getComputedStyle(btn).position,
          top: window.getComputedStyle(btn).top,
          right: window.getComputedStyle(btn).right
        }
      }));

      // Look for elements in upper right corner
      const allElements = Array.from(document.querySelectorAll('*'));
      const upperRightElements = allElements.filter(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        // Check if in upper right quadrant
        const isUpperRight = rect.top < 200 && rect.right > window.innerWidth - 200;

        return isUpperRight && (
          style.position === 'fixed' ||
          style.position === 'absolute' ||
          el.tagName === 'A' ||
          el.tagName === 'BUTTON'
        );
      }).map(el => ({
        tagName: el.tagName,
        text: el.textContent.trim().substring(0, 50),
        id: el.id,
        className: el.className,
        href: el.tagName === 'A' ? el.href : null,
        title: el.title,
        ariaLabel: el.getAttribute('aria-label'),
        position: {
          top: el.getBoundingClientRect().top,
          right: el.getBoundingClientRect().right,
          left: el.getBoundingClientRect().left
        }
      }));

      // Look for links containing "download" or "save"
      const downloadLinks = Array.from(document.querySelectorAll('a, button')).filter(el => {
        const text = el.textContent.toLowerCase();
        const title = (el.title || '').toLowerCase();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

        return text.includes('download') || text.includes('save') ||
               title.includes('download') || title.includes('save') ||
               ariaLabel.includes('download') || ariaLabel.includes('save');
      }).map(el => ({
        tagName: el.tagName,
        text: el.textContent.trim(),
        href: el.tagName === 'A' ? el.href : null,
        id: el.id,
        className: el.className,
        title: el.title,
        ariaLabel: el.getAttribute('aria-label')
      }));

      // Look for images (might be rendered as image)
      const images = Array.from(document.querySelectorAll('img'));
      const imageInfo = images.map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
        className: img.className,
        id: img.id
      }));

      return {
        currentUrl: window.location.href,
        buttons: buttonInfo,
        upperRightElements,
        downloadLinks,
        images: imageInfo,
        bodyHTML: document.body.innerHTML,
        windowSize: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      };
    });

    console.log('=== DOWNLOAD BUTTON ANALYSIS ===');
    console.log('Current URL:', downloadInfo.currentUrl);
    console.log('Window Size:', downloadInfo.windowSize);
    console.log('\n=== All Buttons ===');
    console.log(JSON.stringify(downloadInfo.buttons, null, 2));
    console.log('\n=== Upper Right Elements ===');
    console.log(JSON.stringify(downloadInfo.upperRightElements, null, 2));
    console.log('\n=== Download/Save Links ===');
    console.log(JSON.stringify(downloadInfo.downloadLinks, null, 2));
    console.log('\n=== Images ===');
    console.log(JSON.stringify(downloadInfo.images, null, 2));
    console.log('\n=== Body HTML (first 2000 chars) ===');
    console.log(downloadInfo.bodyHTML.substring(0, 2000));

    // Save HTML
    const html = await page.content();
    fs.writeFileSync('guilford-download-button.html', html);
    console.log('\n✅ Saved: guilford-download-button.html');

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-download-button-error.png' });
  }
}

debugDownloadButton().catch(console.error);
