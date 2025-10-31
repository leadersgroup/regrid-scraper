/**
 * Debug what appears after searching for address and clicking Sales tab
 */

const puppeteer = require('puppeteer');

async function debugAfterSalesClick() {
  console.log('🔍 Testing Orange County Address Search + Sales Tab\n');

  const address = '12729 Hawkstone Drive';

  const browser = await puppeteer.launch({
    headless: false, // Non-headless to see what happens
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate to property search
    console.log('Navigating to Property Appraiser...');
    await page.goto('https://ocpaweb.ocpafl.org/parcelsearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find address input
    console.log('\nLooking for address input...');
    const addressInput = await page.$('input[placeholder*="Address"]');

    if (addressInput) {
      console.log('✅ Found address input');
      await addressInput.click();
      await new Promise(resolve => setTimeout(resolve, 500));

      // Type address
      console.log(`Typing address: ${address}`);
      await addressInput.type(address, { delay: 100 });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Press Enter or click search
      console.log('Submitting search...');
      await page.keyboard.press('Enter');

      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('\n' + '='.repeat(80));
      console.log('AFTER ADDRESS SEARCH:');
      console.log('='.repeat(80));

      const afterSearch = await page.evaluate(() => {
        return {
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 2000)
        };
      });

      console.log(`URL: ${afterSearch.url}`);
      console.log(`\nPage Content:\n${afterSearch.bodyText}`);

      // Look for Sales tab
      console.log('\n' + '='.repeat(80));
      console.log('LOOKING FOR SALES TAB:');
      console.log('='.repeat(80));

      const salesClicked = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, li, div, span'));

        for (const el of allElements) {
          const text = el.textContent?.trim() || '';
          const lowerText = text.toLowerCase();

          if (lowerText === 'sales' || (lowerText.includes('sales') && text.length < 30)) {
            console.log('Found sales element:', text, el.tagName);

            const clickable = el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick || el.getAttribute('role') === 'tab';

            if (clickable || el.parentElement?.onclick) {
              console.log('Clicking:', el);
              el.click();
              return true;
            }
          }
        }

        return false;
      });

      if (salesClicked) {
        console.log('✅ Clicked Sales tab');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('\n' + '='.repeat(80));
        console.log('AFTER CLICKING SALES TAB:');
        console.log('='.repeat(80));

        const afterSales = await page.evaluate(() => {
          // Get all links
          const allLinks = Array.from(document.querySelectorAll('a')).map(link => ({
            text: link.textContent?.trim(),
            href: link.href,
            visible: link.offsetParent !== null
          })).filter(l => l.visible && l.text && l.text.length < 100);

          // Look for numeric patterns
          const bodyText = document.body.innerText;
          const numericLinks = allLinks.filter(l => /\d{10,12}/.test(l.text));

          return {
            url: window.location.href,
            bodyText: bodyText.substring(0, 5000),
            allLinksCount: allLinks.length,
            firstLinks: allLinks.slice(0, 50),
            numericLinks: numericLinks
          };
        });

        console.log(`URL: ${afterSales.url}`);
        console.log(`Total visible links: ${afterSales.allLinksCount}`);
        console.log(`\nNumeric links (10-12 digits):`);
        afterSales.numericLinks.forEach((link, i) => {
          console.log(`  ${i + 1}. "${link.text}" -> ${link.href}`);
        });

        console.log(`\nFirst 50 visible links:`);
        afterSales.firstLinks.forEach((link, i) => {
          console.log(`  ${i + 1}. "${link.text}"`);
          if (link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
            console.log(`     -> ${link.href.substring(0, 100)}`);
          }
        });

        console.log(`\n\nPage Text (first 5000 chars):\n${afterSales.bodyText}`);
      } else {
        console.log('❌ Could not find or click Sales tab');
      }
    } else {
      console.log('❌ Address input not found');
    }

    // Keep browser open for manual inspection
    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 60 seconds for manual inspection...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugAfterSalesClick();
