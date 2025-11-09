/**
 * Debug test script for Bexar County scraper
 * This version includes screenshots and detailed page inspection
 */

const BexarCountyTexasScraper = require('./county-implementations/bexar-county-texas');
const fs = require('fs');

async function debugBexarCounty() {
  const testAddress = process.argv[2] || '4126 Monaco Dr, San Antonio, TX 78201';

  console.log('\n' + '='.repeat(80));
  console.log('🧪 BEXAR COUNTY DEBUG TEST');
  console.log('='.repeat(80));
  console.log(`📍 Test Address: ${testAddress}`);
  console.log('='.repeat(80) + '\n');

  const scraper = new BexarCountyTexasScraper({
    headless: false,
    verbose: true,
    timeout: 120000
  });

  try {
    await scraper.initialize();

    // Test address parsing
    console.log('\n📝 Testing address parser...');
    const parsed = scraper.parseAddress(testAddress);
    console.log(`   Street Number: "${parsed.streetNumber}"`);
    console.log(`   Street Name: "${parsed.streetName}"`);

    // Navigate and handle CAPTCHA
    console.log('\n📍 Loading BCAD...');
    await scraper.page.goto('https://esearch.bcad.org/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await scraper.randomWait(3000, 5000);

    // Take screenshot 1
    await scraper.page.screenshot({ path: 'debug-1-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-1-initial.png');

    // Check for CAPTCHA
    const hasCaptcha = await scraper.page.evaluate(() => {
      const recaptchaIframe = document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"]');
      const accessDenied = document.body.innerText.includes('Access denied') ||
                          document.body.innerText.includes('reCAPTCHA validation failed');
      return !!(recaptchaIframe || accessDenied);
    });

    if (hasCaptcha) {
      console.log('⚠️ CAPTCHA detected - checking for TWOCAPTCHA_TOKEN...');

      if (!process.env.TWOCAPTCHA_TOKEN) {
        console.log('❌ TWOCAPTCHA_TOKEN not set. Please solve CAPTCHA manually in the browser.');
        console.log('⏳ Waiting 60 seconds for manual CAPTCHA solving...');
        await new Promise(resolve => setTimeout(resolve, 60000));
      } else {
        console.log('🔧 Solving CAPTCHA with 2Captcha...');
        const siteKey = await scraper.page.evaluate(() => {
          const iframe = document.querySelector('iframe[src*="recaptcha"]');
          if (iframe) {
            const src = iframe.getAttribute('src');
            const match = src.match(/[?&]k=([^&]+)/);
            if (match) return match[1];
          }
          return null;
        });

        if (siteKey) {
          const captchaToken = await scraper.solveCaptchaManually(siteKey, scraper.page.url());
          await scraper.page.evaluate((token) => {
            const responseElement = document.getElementById('g-recaptcha-response');
            if (responseElement) {
              responseElement.innerHTML = token;
            }
            const textareas = document.querySelectorAll('textarea[name="g-recaptcha-response"]');
            textareas.forEach(ta => ta.value = token);
          }, captchaToken);

          console.log('✅ CAPTCHA solved, reloading...');
          await scraper.page.reload({ waitUntil: 'networkidle2' });
          await scraper.randomWait(3000, 5000);
        }
      }
    }

    // Take screenshot 2
    await scraper.page.screenshot({ path: 'debug-2-after-captcha.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-2-after-captcha.png');

    // Close any popups
    await scraper.page.evaluate(() => {
      const closeButtons = Array.from(document.querySelectorAll('button, a'));
      for (const btn of closeButtons) {
        const text = (btn.textContent || '').toLowerCase();
        if (text.includes('close') || text.includes('×') || text === 'x') {
          btn.click();
          return;
        }
      }
    });

    await scraper.randomWait(2000, 3000);

    // Take screenshot 3
    await scraper.page.screenshot({ path: 'debug-3-ready.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-3-ready.png');

    // Switch to Address search
    console.log('\n📝 Switching to Address search...');
    const switched = await scraper.page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
      for (const link of links) {
        const text = link.textContent?.trim().toLowerCase() || '';
        if (text.includes('by address') || text === 'address') {
          link.click();
          return true;
        }
      }
      return false;
    });
    console.log(switched ? '✅ Switched' : '⚠️ Could not switch');

    await scraper.randomWait(2000, 3000);

    // Take screenshot 4
    await scraper.page.screenshot({ path: 'debug-4-address-mode.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-4-address-mode.png');

    // Fill in address
    console.log(`\n📝 Entering: ${parsed.streetNumber} / ${parsed.streetName}`);

    // Get all inputs for debugging
    const inputsInfo = await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));
      return inputs.map((inp, i) => ({
        index: i,
        name: inp.name,
        id: inp.id,
        placeholder: inp.placeholder,
        visible: inp.offsetParent !== null
      }));
    });
    console.log('📋 Available inputs:', JSON.stringify(inputsInfo, null, 2));

    // Enter street number
    const numberEntered = await scraper.page.evaluate((num) => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])'));
      for (const input of inputs) {
        const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        const name = input.name?.toLowerCase() || '';

        if ((label.includes('number') || placeholder.includes('number') || name.includes('number')) &&
            input.offsetParent !== null) {
          input.value = num;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, parsed.streetNumber);
    console.log(numberEntered ? '✅ Street number entered' : '❌ Could not enter street number');

    // Enter street name
    const nameEntered = await scraper.page.evaluate((name) => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      for (const input of inputs) {
        const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
        const placeholder = input.placeholder?.toLowerCase() || '';
        const inputName = input.name?.toLowerCase() || '';

        if ((label.includes('street') || placeholder.includes('street') || inputName.includes('street')) &&
            !label.includes('number') && !placeholder.includes('number') &&
            input.offsetParent !== null) {
          input.value = name;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return false;
    }, parsed.streetName);
    console.log(nameEntered ? '✅ Street name entered' : '❌ Could not enter street name');

    await scraper.randomWait(2000, 3000);

    // Take screenshot 5
    await scraper.page.screenshot({ path: 'debug-5-filled.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-5-filled.png');

    // Submit search
    console.log('\n🔍 Submitting search...');
    const submitted = await scraper.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      for (const button of buttons) {
        const text = (button.textContent || button.value || '').toLowerCase();
        if (text.includes('search') || text.includes('submit')) {
          button.click();
          return { clicked: true, buttonText: text };
        }
      }
      return { clicked: false };
    });
    console.log(submitted.clicked ? `✅ Clicked: ${submitted.buttonText}` : '❌ Could not find search button');

    await scraper.randomWait(5000, 7000);

    // Take screenshot 6
    await scraper.page.screenshot({ path: 'debug-6-results.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-6-results.png');

    // Inspect results page
    const pageInfo = await scraper.page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 500),
        hasTable: document.querySelectorAll('table').length,
        hasRows: document.querySelectorAll('tbody tr').length,
        allLinks: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => a.textContent?.trim())
      };
    });

    console.log('\n📄 Results Page Info:');
    console.log(JSON.stringify(pageInfo, null, 2));

    // Keep browser open for inspection
    console.log('\n⏸️ Browser will remain open for 2 minutes for inspection...');
    console.log('Press Ctrl+C to close early');
    await new Promise(resolve => setTimeout(resolve, 120000));

    await scraper.close();
    console.log('\n✅ Debug test completed');

  } catch (error) {
    console.error('\n❌ Error:', error);
    await scraper.page.screenshot({ path: 'debug-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: debug-error.png');
    await scraper.close();
    process.exit(1);
  }
}

debugBexarCounty().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Debug failed:', error);
  process.exit(1);
});
