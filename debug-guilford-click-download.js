/**
 * Debug Guilford County PDF viewer - find and click download button
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugClickDownload() {
  console.log('🔍 Debugging Guilford County PDF viewer download button click...\n');

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

    console.log('⏳ Waiting for PDF viewer to fully load...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Take initial screenshot
    await page.screenshot({ path: 'guilford-before-click.png', fullPage: true });
    console.log('📸 Screenshot: guilford-before-click.png\n');

    // Look for download button in different ways
    console.log('🔍 Searching for download button...\n');

    // Strategy 1: Look for button by aria-label or title containing "download"
    const downloadButton = await page.evaluate(() => {
      // Check all buttons
      const allButtons = Array.from(document.querySelectorAll('button, a, [role="button"]'));

      for (const btn of allButtons) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const title = (btn.getAttribute('title') || '').toLowerCase();
        const text = btn.textContent.toLowerCase();
        const id = (btn.id || '').toLowerCase();
        const className = (btn.className || '').toLowerCase();

        if (ariaLabel.includes('download') || title.includes('download') ||
            text.includes('download') || id.includes('download') ||
            className.includes('download')) {
          return {
            found: true,
            tagName: btn.tagName,
            id: btn.id,
            className: btn.className,
            ariaLabel: btn.getAttribute('aria-label'),
            title: btn.getAttribute('title'),
            text: btn.textContent.trim(),
            selector: btn.id ? `#${btn.id}` : null
          };
        }
      }

      return { found: false };
    });

    console.log('Download button info:', JSON.stringify(downloadButton, null, 2));

    if (downloadButton.found && downloadButton.selector) {
      console.log(`\n✅ Found download button: ${downloadButton.selector}`);
      console.log('🖱️  Clicking download button...');

      // Set up download listener
      const downloadPath = '/Users/ll/Documents/regrid-scraper/downloads';
      await page._client().send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      // Click the button
      await page.click(downloadButton.selector);

      console.log('⏳ Waiting for download to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check downloaded files
      const files = fs.readdirSync(downloadPath);
      console.log('\n📥 Downloaded files:', files);

    } else {
      console.log('\n⚠️  Could not find download button with standard selectors');
      console.log('Trying alternative approach...');

      // Strategy 2: Look for clickable elements in upper right corner
      const upperRightClickable = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const clickable = allElements.filter(el => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          // Upper right corner (within 300px from right edge, within 100px from top)
          const isUpperRight = rect.right > window.innerWidth - 300 && rect.top < 100;

          // Is clickable
          const isClickable = el.tagName === 'BUTTON' ||
                            el.tagName === 'A' ||
                            style.cursor === 'pointer' ||
                            el.onclick !== null;

          return isUpperRight && isClickable && rect.width > 0 && rect.height > 0;
        }).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          title: el.getAttribute('title'),
          ariaLabel: el.getAttribute('aria-label'),
          text: el.textContent.trim().substring(0, 20),
          position: {
            top: el.getBoundingClientRect().top,
            right: el.getBoundingClientRect().right,
            width: el.getBoundingClientRect().width,
            height: el.getBoundingClientRect().height
          }
        }));

        return clickable;
      });

      console.log('\n=== Upper Right Clickable Elements ===');
      console.log(JSON.stringify(upperRightClickable, null, 2));
    }

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-click-error.png' });
  }
}

debugClickDownload().catch(console.error);
