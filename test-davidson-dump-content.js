/**
 * Dump all page content after clicking parcel card
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function dumpContent() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('\n✅ Browser initialized\n');

    await page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');
    await page.waitForTimeout(3000);

    // Select Address mode
    await page.selectOption('#inputGroupSelect01', '2');
    console.log('✅ Selected Address mode\n');
    await page.waitForTimeout(3000);

    // Enter address
    const visibleInputs = await page.locator('input[type="text"]:visible').all();
    if (visibleInputs[0]) {
      await visibleInputs[0].fill('6241');
    }
    if (visibleInputs[1]) {
      await visibleInputs[1].fill('Del Sol');
    }

    console.log('✅ Entered address\n');
    await page.waitForTimeout(2000);

    // Submit form
    await page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) {
        form.submit();
      }
    });

    console.log('✅ Submitted form\n');
    await page.waitForTimeout(5000);

    // Click parcel card
    console.log('🔍 Clicking parcel card...\n');
    const parcelClicked = await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          el.click();
          return { clicked: true, parcel: firstLine };
        }
      }
      return { clicked: false };
    });

    console.log(`✅ Clicked: ${parcelClicked.parcel}\n`);

    // Wait a bit
    await page.waitForTimeout(5000);

    // Dump EVERYTHING
    const fullDump = await page.evaluate(() => {
      // Get all elements
      const allElements = Array.from(document.querySelectorAll('*'));

      // Find all clickable elements
      const clickable = allElements
        .filter(el => {
          const tag = el.tagName.toLowerCase();
          const hasClick = el.onclick || el.getAttribute('onclick');
          const isButton = ['button', 'a', 'input'].includes(tag);
          const hasRole = el.getAttribute('role') === 'button';

          return (isButton || hasClick || hasRole) && el.offsetParent !== null;
        })
        .map(el => ({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: (el.textContent || el.value || '').trim().substring(0, 100),
          onclick: (el.getAttribute('onclick') || '').substring(0, 100),
          href: el.getAttribute('href'),
          type: el.getAttribute('type')
        }));

      // Get body text
      const bodyText = document.body.innerText;

      // Check for iframes
      const iframes = Array.from(document.querySelectorAll('iframe')).map(iframe => ({
        src: iframe.src,
        id: iframe.id,
        className: iframe.className
      }));

      // Check for modals/dialogs
      const modals = Array.from(document.querySelectorAll('.modal, [role="dialog"], .dialog, .popup, .overlay'))
        .filter(m => {
          const style = window.getComputedStyle(m);
          return style.display !== 'none' && style.visibility !== 'hidden';
        })
        .map(m => ({
          tag: m.tagName,
          id: m.id,
          className: m.className,
          innerHTML: m.innerHTML.substring(0, 500)
        }));

      // Look for any element containing "deed"
      const deedElements = allElements
        .filter(el => {
          const text = (el.textContent || el.value || '').toLowerCase();
          const onclick = (el.getAttribute('onclick') || '').toLowerCase();
          const href = (el.getAttribute('href') || '').toLowerCase();

          return text.includes('deed') || onclick.includes('deed') || href.includes('deed');
        })
        .map(el => ({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          text: (el.textContent || el.value || '').trim().substring(0, 100),
          onclick: (el.getAttribute('onclick') || '').substring(0, 100),
          href: el.getAttribute('href'),
          visible: el.offsetParent !== null
        }));

      return {
        clickableCount: clickable.length,
        clickable: clickable.slice(0, 30),
        iframeCount: iframes.length,
        iframes: iframes,
        modalCount: modals.length,
        modals: modals,
        deedElementCount: deedElements.length,
        deedElements: deedElements,
        bodySnippet: bodyText.substring(0, 2000),
        bodyHasDeed: bodyText.toLowerCase().includes('deed'),
        url: window.location.href
      };
    });

    console.log('═'.repeat(80));
    console.log('PAGE DUMP AFTER CLICKING PARCEL CARD');
    console.log('═'.repeat(80));

    console.log(`\n📍 URL: ${fullDump.url}\n`);

    console.log(`🔍 Clickable elements: ${fullDump.clickableCount}`);
    if (fullDump.clickable.length > 0) {
      console.log('\nFirst 30 clickable elements:');
      fullDump.clickable.forEach((el, i) => {
        console.log(`   ${i + 1}. [${el.tag}] "${el.text}" (id: ${el.id})`);
        if (el.onclick) console.log(`      onclick: ${el.onclick}`);
        if (el.href) console.log(`      href: ${el.href}`);
      });
    }

    console.log(`\n📦 Iframes: ${fullDump.iframeCount}`);
    if (fullDump.iframes.length > 0) {
      fullDump.iframes.forEach((iframe, i) => {
        console.log(`   ${i + 1}. src: ${iframe.src}`);
      });
    }

    console.log(`\n🪟 Modals: ${fullDump.modalCount}`);
    if (fullDump.modals.length > 0) {
      fullDump.modals.forEach((modal, i) => {
        console.log(`   ${i + 1}. [${modal.tag}] ${modal.className}`);
        console.log(`      ${modal.innerHTML.substring(0, 200)}`);
      });
    }

    console.log(`\n📜 Elements containing "deed": ${fullDump.deedElementCount}`);
    if (fullDump.deedElements.length > 0) {
      fullDump.deedElements.forEach((el, i) => {
        console.log(`   ${i + 1}. [${el.tag}] "${el.text}" (visible: ${el.visible})`);
        if (el.onclick) console.log(`      onclick: ${el.onclick}`);
        if (el.href) console.log(`      href: ${el.href}`);
      });
    }

    console.log(`\n📄 Body text contains "deed": ${fullDump.bodyHasDeed}`);

    console.log('\n📄 Body text snippet:');
    console.log(fullDump.bodySnippet);

    console.log('\n═'.repeat(80));

    // Save to file
    fs.writeFileSync('/tmp/davidson-dump.json', JSON.stringify(fullDump, null, 2));
    console.log('\n💾 Full dump saved to: /tmp/davidson-dump.json');

    await page.screenshot({ path: '/tmp/davidson-dump.png', fullPage: true });
    console.log('📸 Screenshot saved to: /tmp/davidson-dump.png');

    console.log('\n⏸️  Keeping browser open (2 min) for manual inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

dumpContent().catch(console.error);
