/**
 * Debug the full workflow: Address search -> Sales tab -> Click instrument# -> Continue to site -> Find download
 */

const puppeteer = require('puppeteer');

async function debugFullWorkflow() {
  console.log('🔍 Debugging Full Deed Download Workflow\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Step 1: Navigate and search
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

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 5: Looking for and clicking "Continue to site"...');
    const continueClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
      for (const el of allElements) {
        const text = (el.textContent || el.value || '').toLowerCase();
        if (text.includes('continue') && text.includes('site')) {
          console.log('Clicking continue:', el);
          el.click();
          return { clicked: true, text: el.textContent || el.value };
        }
      }
      return { clicked: false };
    });

    if (continueClicked.clicked) {
      console.log(`✅ Clicked: "${continueClicked.text}"`);
    } else {
      console.log('❌ Could not find "Continue to site" button');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n' + '='.repeat(80));
    console.log('AFTER CLICKING "CONTINUE TO SITE":');
    console.log('='.repeat(80));

    const pageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 3000),
        allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        })).filter(l => l.text && l.text.length < 100),
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent?.trim() || btn.value,
          type: btn.type
        }))
      };
    });

    console.log(`URL: ${pageInfo.url}`);
    console.log(`Title: ${pageInfo.title}`);
    console.log(`\nBody Text:\n${pageInfo.bodyText}`);

    console.log('\nALL LINKS ON PAGE:');
    pageInfo.allLinks.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}"`);
      if (link.href.includes('.pdf') || link.text.toLowerCase().includes('pdf') || link.text.toLowerCase().includes('download')) {
        console.log(`   ⭐ ${link.href}`);
      } else {
        console.log(`   -> ${link.href.substring(0, 100)}`);
      }
    });

    console.log('\nBUTTONS ON PAGE:');
    pageInfo.buttons.forEach((btn, i) => {
      console.log(`${i + 1}. "${btn.text}" (${btn.type})`);
    });

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

debugFullWorkflow();
