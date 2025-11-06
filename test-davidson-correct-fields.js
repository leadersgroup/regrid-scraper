/**
 * Test with correct field IDs and find View Deed button
 */

const { chromium } = require('playwright');

async function testCorrectFields() {
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

    // Enter address using correct IDs
    await page.evaluate(() => {
      const numField = document.querySelector('#streetNumber');
      const streetField = document.querySelector('#singleSearchCriteria');

      if (numField) {
        numField.value = '6241';
        numField.dispatchEvent(new Event('input', { bubbles: true }));
        numField.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (streetField) {
        streetField.value = 'Del Sol';
        streetField.dispatchEvent(new Event('input', { bubbles: true }));
        streetField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    console.log('✅ Entered address (6241, Del Sol)\n');
    await page.waitForTimeout(2000);

    // Submit
    await page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) {
        form.submit();
      }
    });

    console.log('✅ Submitted form\n');
    await page.waitForTimeout(5000);

    // Find and click parcel card
    console.log('🔍 Looking for parcel card...\n');

    const parcelCard = await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          // DON'T click yet, just return info
          return { found: true, parcel: firstLine, tag: el.tagName, className: el.className, id: el.id };
        }
      }
      return { found: false };
    });

    if (!parcelCard.found) {
      console.log('❌ Parcel card not found');
      return;
    }

    console.log(`✅ Found parcel card: ${parcelCard.parcel}`);
    console.log(`   Tag: ${parcelCard.tag}, Class: ${parcelCard.className}, ID: ${parcelCard.id}\n`);

    // NOW click it and watch what happens
    console.log('🖱️  Clicking parcel card...\n');

    await page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          el.click();
          return;
        }
      }
    });

    console.log('✅ Clicked parcel card\n');

    // Wait and check for changes every second
    console.log('⏳ Watching for View Deed button...\n');

    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(1000);

      const snapshot = await page.evaluate(() => {
        // Get ALL elements that might be deed-related
        const allElements = Array.from(document.querySelectorAll('*'));

        const deedElements = allElements
          .filter(el => {
            const text = (el.textContent || el.value || '').toLowerCase();
            const onclick = (el.getAttribute('onclick') || '').toLowerCase();
            const href = (el.getAttribute('href') || '').toLowerCase();
            const id = (el.id || '').toLowerCase();
            const className = (el.className || '').toLowerCase();

            return text.includes('deed') || onclick.includes('deed') || href.includes('deed') || id.includes('deed') || className.includes('deed');
          })
          .map(el => ({
            tag: el.tagName,
            id: el.id,
            className: typeof el.className === 'string' ? el.className : '',
            text: (el.textContent || el.value || '').trim().substring(0, 100),
            onclick: (el.getAttribute('onclick') || '').substring(0, 100),
            href: el.getAttribute('href'),
            visible: el.offsetParent !== null
          }));

        // Also get ALL clickable elements
        const clickable = allElements
          .filter(el => {
            const tag = el.tagName.toLowerCase();
            const hasClick = el.onclick || el.getAttribute('onclick');
            const isButton = ['button', 'a', 'input'].includes(tag);

            return (isButton || hasClick) && el.offsetParent !== null;
          })
          .map(el => ({
            tag: el.tagName,
            text: (el.textContent || el.value || '').trim().substring(0, 60)
          }));

        return {
          deedElements: deedElements,
          clickableCount: clickable.length,
          clickable: clickable.slice(0, 15),
          url: window.location.href,
          bodyHasDeed: document.body.innerText.toLowerCase().includes('deed')
        };
      });

      console.log(`   Check ${i}:`);
      console.log(`      URL: ${snapshot.url}`);
      console.log(`      Deed elements: ${snapshot.deedElements.length}`);
      console.log(`      Clickable elements: ${snapshot.clickableCount}`);
      console.log(`      Body has "deed": ${snapshot.bodyHasDeed}`);

      if (snapshot.deedElements.length > 0) {
        console.log('\n      🎯 DEED ELEMENTS FOUND:');
        snapshot.deedElements.forEach((el, idx) => {
          console.log(`         ${idx + 1}. [${el.tag}] "${el.text}" (visible: ${el.visible})`);
          if (el.onclick) console.log(`            onclick: ${el.onclick}`);
          if (el.href) console.log(`            href: ${el.href}`);
        });
      }

      if (i === 1 || i === 5 || i === 10) {
        console.log(`\n      Clickable elements:`);
        snapshot.clickable.forEach((el, idx) => {
          console.log(`         ${idx + 1}. [${el.tag}] "${el.text}"`);
        });
      }

      console.log('');

      // If we found deed elements, try to click one
      if (snapshot.deedElements.filter(e => e.visible).length > 0) {
        console.log('      ✅ Found visible deed element, attempting to click...\n');

        const clicked = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('*'));

          const deedElements = allElements
            .filter(el => {
              const text = (el.textContent || el.value || '').toLowerCase();
              const onclick = (el.getAttribute('onclick') || '').toLowerCase();
              const href = (el.getAttribute('href') || '').toLowerCase();

              return (text.includes('deed') || onclick.includes('deed') || href.includes('deed')) && el.offsetParent !== null;
            });

          if (deedElements.length > 0) {
            deedElements[0].click();
            return { clicked: true, element: deedElements[0].tagName };
          }

          return { clicked: false };
        });

        console.log(`      Click result: ${JSON.stringify(clicked)}\n`);

        if (clicked.clicked) {
          await page.waitForTimeout(3000);

          // Check for PDF
          const pdfCheck = await page.evaluate(() => {
            const pdfEmbed = document.querySelector('embed[type="application/pdf"], object[type="application/pdf"], iframe[src*="pdf"]');
            if (pdfEmbed) {
              return { type: 'embedded', src: pdfEmbed.getAttribute('src') || pdfEmbed.getAttribute('data') };
            }

            if (window.location.href.includes('.pdf')) {
              return { type: 'direct', url: window.location.href };
            }

            const pdfLinks = Array.from(document.querySelectorAll('a[href*=".pdf"]'));
            if (pdfLinks.length > 0) {
              return { type: 'link', href: pdfLinks[0].href };
            }

            return { type: 'unknown', url: window.location.href };
          });

          console.log('      📄 PDF check:', JSON.stringify(pdfCheck, null, 2));
        }

        break;
      }
    }

    await page.screenshot({ path: '/tmp/davidson-correct-fields.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-correct-fields.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

testCorrectFields().catch(console.error);
