/**
 * Test stealth mode with visual inspection
 * This will show us if the CAPTCHA still appears with stealth mode
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testStealthMode() {
  console.log('🕵️  Testing Stealth Mode for CAPTCHA Bypass\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();

  try {
    // Test 1: Check if we can pass the disclaimer without CAPTCHA
    const deedUrl = 'https://selfservice.or.occompt.com/ssweb/web/integration/document/20170015765';

    console.log('📋 Step 1: Navigate to deed URL');
    console.log(`URL: ${deedUrl}\n`);

    await page.goto(deedUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check current page
    const pageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        hasRecaptcha: Array.from(document.querySelectorAll('iframe')).some(iframe =>
          iframe.src && iframe.src.includes('recaptcha')
        ),
        hasDisclaimerAccept: !!document.querySelector('#submitDisclaimerAccept'),
        bodyPreview: document.body.innerText.substring(0, 500)
      };
    });

    console.log('📄 Current Page Status:');
    console.log(`   URL: ${pageInfo.url}`);
    console.log(`   Title: ${pageInfo.title}`);
    console.log(`   Has reCAPTCHA: ${pageInfo.hasRecaptcha ? '❌ YES' : '✅ NO'}`);
    console.log(`   Has "I Accept" button: ${pageInfo.hasDisclaimerAccept}`);
    console.log(`\nBody Preview:\n${pageInfo.bodyPreview}\n`);

    if (pageInfo.hasDisclaimerAccept) {
      console.log('📋 Step 2: Click "I Accept"');

      await page.click('#submitDisclaimerAccept');
      console.log('✅ Clicked "I Accept"');

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check for "Yes - Continue" button
      const hasContinueButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => {
          const text = btn.textContent?.trim().toLowerCase() || '';
          return text.includes('yes') && text.includes('continue');
        });
      });

      if (hasContinueButton) {
        console.log('📋 Step 3: Click "Yes - Continue"');

        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text.includes('yes') && text.includes('continue')) {
              btn.click();
              break;
            }
          }
        });

        console.log('✅ Clicked "Yes - Continue"');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Check again after clicking
      const afterClickInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          hasRecaptcha: Array.from(document.querySelectorAll('iframe')).some(iframe =>
            iframe.src && iframe.src.includes('recaptcha')
          ),
          bodyPreview: document.body.innerText.substring(0, 500)
        };
      });

      console.log('\n📄 After Clicking:');
      console.log(`   URL: ${afterClickInfo.url}`);
      console.log(`   Has reCAPTCHA: ${afterClickInfo.hasRecaptcha ? '❌ YES' : '✅ NO'}`);
      console.log(`\nBody Preview:\n${afterClickInfo.bodyPreview}\n`);

      if (afterClickInfo.hasRecaptcha) {
        console.log('\n❌ RESULT: reCAPTCHA still present - stealth mode did NOT bypass it');
        console.log('\n🔍 The page is still showing CAPTCHA challenge.');
        console.log('This means the Self-Service site has strong bot detection.');
      } else if (afterClickInfo.url.includes('/user/disclaimer')) {
        console.log('\n⚠️ RESULT: Still on disclaimer page but no visible CAPTCHA iframe');
        console.log('The page might be waiting for CAPTCHA completion or there\'s another issue.');
      } else {
        console.log('\n✅ SUCCESS: Made it past the disclaimer page!');
        console.log('Checking for deed download options...');

        await new Promise(resolve => setTimeout(resolve, 3000));

        const deedPageInfo = await page.evaluate(() => {
          return {
            buttons: Array.from(document.querySelectorAll('button, a')).map(el => ({
              text: el.textContent?.trim(),
              href: el.href
            })).filter(el =>
              el.text && (
                el.text.toLowerCase().includes('download') ||
                el.text.toLowerCase().includes('pdf') ||
                (el.href && el.href.includes('.pdf'))
              )
            )
          };
        });

        if (deedPageInfo.buttons.length > 0) {
          console.log('\n📥 Download buttons found:');
          deedPageInfo.buttons.forEach((btn, i) => {
            console.log(`   ${i + 1}. "${btn.text}" ${btn.href ? `-> ${btn.href}` : ''}`);
          });
        } else {
          console.log('\n⚠️ No obvious download buttons found');
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 2 minutes for manual inspection...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

testStealthMode();
