/**
 * Diagnostic script to check for popups on Lee County Property Appraiser
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function inspectPopups() {
  console.log('🔍 Inspecting Lee County Property Appraiser for popups...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const url = 'https://www.leepa.org/Search/PropertySearch.aspx';
  console.log(`📍 Navigating to: ${url}\n`);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log(`✅ Page loaded\n`);

  // Wait a bit for any popups to appear
  await new Promise(r => setTimeout(r, 5000));

  // Check for modal dialogs, overlays, and alerts
  const popupInfo = await page.evaluate(() => {
    const info = {
      modals: [],
      overlays: [],
      dialogs: [],
      alerts: [],
      allVisibleElements: []
    };

    // Check for modal dialogs
    const modalSelectors = [
      '.modal',
      '[class*="modal"]',
      '[class*="dialog"]',
      '[class*="popup"]',
      '[role="dialog"]',
      '[role="alertdialog"]'
    ];

    for (const selector of modalSelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          info.modals.push({
            selector,
            className: el.className,
            id: el.id,
            text: el.textContent?.substring(0, 200),
            display: style.display,
            zIndex: style.zIndex
          });
        }
      });
    }

    // Check for overlays
    const overlaySelectors = [
      '.overlay',
      '[class*="overlay"]',
      '[class*="backdrop"]',
      '[class*="mask"]'
    ];

    for (const selector of overlaySelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          info.overlays.push({
            selector,
            className: el.className,
            id: el.id,
            display: style.display,
            zIndex: style.zIndex
          });
        }
      });
    }

    // Check for buttons that might close popups
    const buttons = document.querySelectorAll('button, input[type="button"], a');
    buttons.forEach(btn => {
      const text = (btn.textContent || btn.value || '').toLowerCase();
      if (text.includes('close') ||
          text.includes('accept') ||
          text.includes('agree') ||
          text.includes('ok') ||
          text.includes('continue') ||
          text.includes('dismiss')) {
        const style = window.getComputedStyle(btn);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          info.dialogs.push({
            tag: btn.tagName,
            text: btn.textContent || btn.value,
            className: btn.className,
            id: btn.id,
            visible: true
          });
        }
      }
    });

    // Check for any elements with high z-index (likely popups)
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex);
      if (zIndex > 100 && style.display !== 'none' && style.visibility !== 'hidden') {
        info.allVisibleElements.push({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          zIndex: zIndex,
          text: el.textContent?.substring(0, 100)
        });
      }
    });

    return info;
  });

  console.log('📊 Popup Detection Results:');
  console.log('='.repeat(80));

  console.log('\n🔲 Modals Found:');
  if (popupInfo.modals.length > 0) {
    popupInfo.modals.forEach((modal, i) => {
      console.log(`  [${i + 1}] ${modal.selector}`);
      console.log(`      Class: ${modal.className}`);
      console.log(`      ID: ${modal.id}`);
      console.log(`      Z-Index: ${modal.zIndex}`);
      console.log(`      Text: ${modal.text}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🔳 Overlays Found:');
  if (popupInfo.overlays.length > 0) {
    popupInfo.overlays.forEach((overlay, i) => {
      console.log(`  [${i + 1}] ${overlay.selector}`);
      console.log(`      Class: ${overlay.className}`);
      console.log(`      ID: ${overlay.id}`);
      console.log(`      Z-Index: ${overlay.zIndex}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n🔘 Close/Accept Buttons Found:');
  if (popupInfo.dialogs.length > 0) {
    popupInfo.dialogs.forEach((btn, i) => {
      console.log(`  [${i + 1}] ${btn.tag}: "${btn.text}"`);
      console.log(`      Class: ${btn.className}`);
      console.log(`      ID: ${btn.id}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n⬆️  High Z-Index Elements (likely popups):');
  if (popupInfo.allVisibleElements.length > 0) {
    const sorted = popupInfo.allVisibleElements.sort((a, b) => b.zIndex - a.zIndex);
    sorted.slice(0, 10).forEach((el, i) => {
      console.log(`  [${i + 1}] ${el.tag} (z-index: ${el.zIndex})`);
      console.log(`      Class: ${el.className}`);
      console.log(`      ID: ${el.id}`);
      console.log(`      Text: ${el.text}`);
    });
  } else {
    console.log('  None');
  }

  console.log('\n⏸️  Keeping browser open for manual inspection...');
  console.log('Press Ctrl+C to exit\n');

  // Keep browser open
  await new Promise(() => {});
}

inspectPopups().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
