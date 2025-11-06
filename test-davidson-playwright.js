/**
 * Test Davidson County using Playwright instead of Puppeteer
 */

const { chromium } = require('playwright');

async function testWithPlaywright() {
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
      console.log('✅ Entered number: 6241');
    }
    if (visibleInputs[1]) {
      await visibleInputs[1].fill('Del Sol');
      console.log('✅ Entered street: Del Sol');
    }

    await page.waitForTimeout(2000);

    // Submit form
    await page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) {
        form.submit();
      }
    });

    console.log('\n✅ Submitted form\n');
    await page.waitForTimeout(3000);

    // Wait for and click parcel card
    console.log('🔍 Looking for parcel card...\n');

    const parcelCard = await page.locator('text=/^\\d{3}\\s+\\d{2}\\s+\\w+\\s+\\d+\\.\\d+$/i').first();
    await parcelCard.waitFor({ state: 'visible', timeout: 10000 });

    const parcelText = await parcelCard.innerText();
    console.log(`✅ Found parcel card: ${parcelText}\n`);

    await parcelCard.click();
    console.log('✅ Clicked parcel card\n');

    // Wait for UI to update and look for View Deed button
    console.log('⏳ Waiting for View Deed button...\n');

    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(1000);

      // Get all visible buttons
      const buttons = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a, div[onclick], span[onclick]'));
        return allButtons
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
      });

      const deedButtons = buttons.filter(b =>
        b.text.toLowerCase().includes('deed') ||
        b.onclick.toLowerCase().includes('deed')
      );

      console.log(`   Check ${i}: ${buttons.length} buttons, ${deedButtons.length} deed buttons`);

      if (deedButtons.length > 0) {
        console.log('\n✅ Found deed button(s):');
        deedButtons.forEach((btn, idx) => {
          console.log(`   ${idx + 1}. [${btn.tag}] "${btn.text}" (id: ${btn.id})`);
        });

        // Try to click the deed button
        const deedButton = await page.locator(`text=/deed/i`).first();
        await deedButton.click();
        console.log('\n✅ Clicked deed button');

        await page.waitForTimeout(3000);

        // Check for PDF
        const pdfInfo = await page.evaluate(() => {
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

          return { type: 'unknown' };
        });

        console.log('\n📄 PDF info:', JSON.stringify(pdfInfo, null, 2));

        break;
      }

      if (i === 10) {
        console.log('\n❌ No deed button found after 10 seconds');
        console.log('\n📋 All visible buttons:');
        buttons.slice(0, 15).forEach((btn, idx) => {
          console.log(`   ${idx + 1}. [${btn.tag}] "${btn.text}"`);
        });
      }
    }

    await page.screenshot({ path: '/tmp/davidson-playwright.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/davidson-playwright.png');

    console.log('\n⏸️  Keeping browser open (2 min) for inspection...');
    await page.waitForTimeout(120000);

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-playwright-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
}

testWithPlaywright().catch(console.error);
