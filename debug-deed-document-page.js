/**
 * Debug: What's on the deed document page after CAPTCHA bypass
 */

const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');

async function debugDeedDocumentPage() {
  console.log('🔍 Debug: Deed Document Page After CAPTCHA Bypass\n');

  const scraper = new OrangeCountyFloridaScraper({
    headless: false,  // Keep visible
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Navigate through the full workflow
    const address = '6431 Swanson St, Windermere, FL 34786';
    console.log(`Testing with: ${address}\n`);

    // Get parcel data
    await scraper.page.goto('https://regrid.com/', { waitUntil: 'networkidle2' });
    await scraper.randomWait(2000, 3000);

    const searchInput = await scraper.page.$('input[placeholder*="Search"]');
    await searchInput.click();
    await searchInput.type(address, { delay: 100 });
    await scraper.randomWait(2000, 3000);
    await scraper.page.keyboard.press('Enter');
    await scraper.randomWait(5000, 7000);

    // Navigate to Property Appraiser
    await scraper.page.goto('https://ocpaweb.ocpafl.org/parcelsearch', { waitUntil: 'networkidle2' });
    await scraper.randomWait(3000, 5000);

    const addressInput = await scraper.page.$('input[placeholder*="Address"]');
    await addressInput.click();
    await addressInput.type('6431 Swanson St', { delay: 100 });
    await scraper.randomWait(2000, 3000);
    await scraper.page.keyboard.press('Enter');
    await scraper.randomWait(5000, 7000);

    // Click Sales tab
    await scraper.page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, div, span'));
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        if (text === 'SALES' || text === 'Sales') {
          el.click();
          return;
        }
      }
    });
    await scraper.randomWait(5000, 7000);

    // Click instrument number
    await scraper.page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        if (link.textContent?.trim() === '20170015765') {
          link.click();
          return;
        }
      }
    });
    await scraper.randomWait(5000, 7000);

    // Extract Continue to Site URL
    const continueUrl = await scraper.page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = (link.textContent || '').trim().toLowerCase();
        if (text.includes('continue') && text.includes('site')) {
          return link.href;
        }
      }
      return null;
    });

    console.log(`\n📄 Navigating to: ${continueUrl}\n`);

    // Navigate to deed page
    await scraper.page.goto(continueUrl, { waitUntil: 'domcontentloaded' });
    await scraper.randomWait(3000, 5000);

    // Click I Accept
    await scraper.page.click('#submitDisclaimerAccept');
    await scraper.randomWait(5000, 7000);

    // Click Yes - Continue
    await scraper.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.textContent?.trim().toLowerCase() || '';
        if (text.includes('yes') && text.includes('continue')) {
          btn.click();
          return;
        }
      }
    });
    await scraper.randomWait(5000, 7000);

    // Solve CAPTCHA
    console.log('🔧 Solving CAPTCHA...');
    await scraper.page.solveRecaptchas();
    console.log('✅ CAPTCHA solved\n');
    await scraper.randomWait(3000, 5000);

    // Click I Accept again
    await scraper.page.click('#submitDisclaimerAccept');
    await scraper.randomWait(7000, 10000);

    // NOW CHECK WHAT'S ON THE PAGE
    console.log('═'.repeat(80));
    console.log('DEED DOCUMENT PAGE CONTENT:');
    console.log('═'.repeat(80));

    const pageAnalysis = await scraper.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 2000),

        // All links
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          visible: a.offsetParent !== null
        })).filter(l => l.visible && l.text),

        // All buttons
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent?.trim() || btn.value,
          visible: btn.offsetParent !== null
        })).filter(b => b.visible && b.text),

        // IFRAMEs (PDF might be embedded)
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          visible: iframe.offsetParent !== null
        })).filter(i => i.visible),

        // OBJECT/EMBED tags
        embeds: Array.from(document.querySelectorAll('object, embed')).map(obj => ({
          data: obj.data || obj.src,
          type: obj.type
        }))
      };
    });

    console.log(`URL: ${pageAnalysis.url}`);
    console.log(`Title: ${pageAnalysis.title}\n`);

    console.log('Body Text Preview:');
    console.log(pageAnalysis.bodyText);
    console.log('\n');

    if (pageAnalysis.links.length > 0) {
      console.log('LINKS:');
      pageAnalysis.links.slice(0, 20).forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}"`);
        if (link.href.includes('pdf') || link.href.includes('download') || link.href.includes('document')) {
          console.log(`   ⭐ ${link.href}`);
        }
      });
      console.log('');
    }

    if (pageAnalysis.buttons.length > 0) {
      console.log('BUTTONS:');
      pageAnalysis.buttons.forEach((btn, i) => {
        console.log(`${i + 1}. "${btn.text}"`);
      });
      console.log('');
    }

    if (pageAnalysis.iframes.length > 0) {
      console.log('IFRAMES (PDF might be here):');
      pageAnalysis.iframes.forEach((iframe, i) => {
        console.log(`${i + 1}. ${iframe.src}`);
      });
      console.log('');
    }

    if (pageAnalysis.embeds.length > 0) {
      console.log('EMBEDDED OBJECTS:');
      pageAnalysis.embeds.forEach((embed, i) => {
        console.log(`${i + 1}. ${embed.data} (${embed.type})`);
      });
      console.log('');
    }

    console.log('═'.repeat(80));
    console.log('Browser will stay open for 2 minutes for manual inspection...');
    console.log('═'.repeat(80));

    await new Promise(r => setTimeout(r, 120000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
    console.log('\n✅ Complete');
  }
}

if (require.main === module) {
  debugDeedDocumentPage();
}
