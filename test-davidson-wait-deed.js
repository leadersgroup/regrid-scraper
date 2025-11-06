/**
 * Test with longer wait times to see if View Deed button appears
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testWithWait() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\n✅ Page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address mode
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter address
    await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      const visibleInputs = inputs.filter(i => i.offsetParent !== null);

      if (visibleInputs[0]) {
        visibleInputs[0].value = '6241';
        visibleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (visibleInputs[1]) {
        visibleInputs[1].value = 'Del Sol';
        visibleInputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    console.log('✅ Entered address\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Submit form
    await scraper.page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) {
        form.submit();
      }
    });

    console.log('✅ Submitted form\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click parcel card
    console.log('🔍 Looking for parcel card...\n');
    const parcelCardClicked = await scraper.page.evaluate(() => {
      const pattern = /^\d{3}\s+\d{2}\s+\w+\s+\d+\.\d+$/i;
      const allElements = Array.from(document.querySelectorAll('a, button, div, span, td'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        const firstLine = text.split('\n')[0].trim();
        if (pattern.test(firstLine)) {
          console.log('Found parcel card:', firstLine);
          el.click();
          return { clicked: true, parcel: firstLine };
        }
      }
      return { clicked: false };
    });

    console.log('Parcel card result:', JSON.stringify(parcelCardClicked));

    if (parcelCardClicked.clicked) {
      console.log('\n✅ Clicked parcel card\n');

      // Wait and check for UI changes multiple times
      for (let i = 1; i <= 6; i++) {
        console.log(`\n📊 Check #${i} (after ${i * 2}s)...\n`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const uiState = await scraper.page.evaluate(() => {
          // Check for modals, overlays, iframes
          const modals = Array.from(document.querySelectorAll('.modal, [role="dialog"], .dialog, .overlay'));
          const visibleModals = modals.filter(m => {
            const style = window.getComputedStyle(m);
            return style.display !== 'none' && style.visibility !== 'hidden';
          });

          const iframes = Array.from(document.querySelectorAll('iframe'));

          // Get all buttons again
          const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, div[onclick], span[onclick]'));
          const visibleButtons = allButtons
            .filter(btn => {
              const style = window.getComputedStyle(btn);
              return style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetParent !== null;
            })
            .map(btn => ({
              tag: btn.tagName,
              text: (btn.textContent || btn.value || '').trim().substring(0, 60),
              onclick: (btn.getAttribute('onclick') || '').substring(0, 60),
              id: btn.id,
              className: btn.className
            }))
            .filter(b => b.text.length > 0 || b.onclick.length > 0);

          // Look specifically for deed-related buttons
          const deedButtons = visibleButtons.filter(b =>
            b.text.toLowerCase().includes('deed') ||
            b.onclick.toLowerCase().includes('deed')
          );

          return {
            modalCount: visibleModals.length,
            modalInfo: visibleModals.map(m => ({
              tag: m.tagName,
              id: m.id,
              className: m.className
            })),
            iframeCount: iframes.length,
            buttonCount: visibleButtons.length,
            buttons: visibleButtons.slice(0, 15),
            deedButtons: deedButtons
          };
        });

        console.log(`   Modals: ${uiState.modalCount}`);
        if (uiState.modalCount > 0) {
          console.log('   Modal info:', JSON.stringify(uiState.modalInfo, null, 2));
        }

        console.log(`   Iframes: ${uiState.iframeCount}`);
        console.log(`   Buttons: ${uiState.buttonCount}`);

        if (uiState.deedButtons.length > 0) {
          console.log('\n   🎯 DEED BUTTONS FOUND:');
          uiState.deedButtons.forEach((btn, idx) => {
            console.log(`      ${idx + 1}. [${btn.tag}] "${btn.text}" ${btn.onclick ? '(has onclick)' : ''}`);
          });
        }

        if (uiState.buttonCount > 0) {
          console.log('\n   All buttons:');
          uiState.buttons.forEach((btn, idx) => {
            console.log(`      ${idx + 1}. [${btn.tag}] "${btn.text}"`);
          });
        }
      }

      // Take screenshot at the end
      await scraper.page.screenshot({ path: '/tmp/davidson-wait-test.png', fullPage: true });
      console.log('\n📸 Screenshot saved: /tmp/davidson-wait-test.png');

      console.log('\n⏸️  Keeping browser open (2 min) for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 120000));
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testWithWait().catch(console.error);
