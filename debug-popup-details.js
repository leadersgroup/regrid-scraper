/**
 * Examine the popup that appears when clicking instrument number
 * Look for direct PDF URLs or alternative download methods
 */

const puppeteer = require('puppeteer');

async function debugPopupDetails() {
  console.log('🔍 Examining Instrument # Click Popup\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Step 1: Navigating to Property Appraiser...');
    await page.goto('https://ocpaweb.ocpafl.org/parcelsearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter address
    console.log('Step 2: Entering address...');
    const addressInput = await page.$('input[placeholder*="Address"]');
    await addressInput.click();
    await addressInput.type('6431 Swanson St', { delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 3: Clicking Sales tab...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, div, span'));
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text === 'SALES' || text === 'Sales') {
          el.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('Step 4: Clicking on instrument number 20170015765...');
    await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = link.textContent?.trim();
        if (text === '20170015765') {
          console.log('Clicking:', link);
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n' + '='.repeat(80));
    console.log('POPUP ANALYSIS:');
    console.log('='.repeat(80));

    const popupInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        bodyText: document.body.innerText,

        // All links
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          target: a.target,
          onclick: a.onclick ? 'has onclick' : null
        })).filter(l => l.text),

        // All buttons
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent?.trim() || btn.value,
          onclick: btn.onclick ? 'has onclick' : null,
          type: btn.type
        })),

        // Look for iframes (popup might be in iframe)
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id
        })),

        // Check for modals/dialogs
        modals: Array.from(document.querySelectorAll('[role="dialog"], .modal, .popup, [class*="modal"], [class*="popup"]')).map(el => ({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          visible: el.offsetParent !== null,
          innerHTML: el.innerHTML.substring(0, 1000)
        }))
      };
    });

    console.log(`Current URL: ${popupInfo.url}`);
    console.log(`\nBody Text:\n${popupInfo.bodyText.substring(0, 2000)}\n`);

    console.log('\nLINKS IN POPUP:');
    popupInfo.links.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}"`);
      console.log(`   -> ${link.href}`);
      if (link.target) console.log(`   Target: ${link.target}`);
      if (link.onclick) console.log(`   Has onclick handler`);
    });

    console.log('\nBUTTONS IN POPUP:');
    popupInfo.buttons.forEach((btn, i) => {
      console.log(`${i + 1}. "${btn.text}" (${btn.type})`);
      if (btn.onclick) console.log(`   Has onclick handler`);
    });

    if (popupInfo.iframes.length > 0) {
      console.log('\nIFRAMES:');
      popupInfo.iframes.forEach((iframe, i) => {
        console.log(`${i + 1}. SRC: ${iframe.src}, ID: ${iframe.id}`);
      });
    }

    if (popupInfo.modals.length > 0) {
      console.log('\nMODAL/POPUP ELEMENTS:');
      popupInfo.modals.forEach((modal, i) => {
        console.log(`${i + 1}. ${modal.tag}, ID: ${modal.id}, Visible: ${modal.visible}`);
        console.log(`   Class: ${modal.className}`);
        console.log(`   Content preview:\n${modal.innerHTML.substring(0, 500)}`);
      });
    }

    // Look for "Continue to site" link and extract ALL its attributes
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED "CONTINUE TO SITE" LINK ANALYSIS:');
    console.log('='.repeat(80));

    const continueToSiteDetails = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = (link.textContent || '').trim().toLowerCase();
        if (text.includes('continue') && text.includes('site')) {
          // Get all attributes
          const attrs = {};
          for (let i = 0; i < link.attributes.length; i++) {
            const attr = link.attributes[i];
            attrs[attr.name] = attr.value;
          }

          return {
            found: true,
            text: link.textContent?.trim(),
            href: link.href,
            innerHTML: link.innerHTML,
            outerHTML: link.outerHTML,
            attributes: attrs,
            // Get parent context
            parentHTML: link.parentElement?.outerHTML.substring(0, 1000)
          };
        }
      }
      return { found: false };
    });

    if (continueToSiteDetails.found) {
      console.log(`Text: "${continueToSiteDetails.text}"`);
      console.log(`HREF: ${continueToSiteDetails.href}`);
      console.log(`\nAll Attributes:`);
      Object.entries(continueToSiteDetails.attributes).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
      console.log(`\nOuter HTML:\n${continueToSiteDetails.outerHTML}`);
      console.log(`\nParent HTML:\n${continueToSiteDetails.parentHTML}`);
    } else {
      console.log('❌ "Continue to site" link not found');
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 2 minutes for manual inspection...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugPopupDetails();
