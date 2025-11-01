/**
 * Test stealth mode with better click handling
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function testStealthClick() {
  console.log('🕵️  Testing Stealth Mode - Click Handling\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox'],
    protocolTimeout: 120000 // Increase timeout to 2 minutes
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(120000);

  try {
    const deedUrl = 'https://selfservice.or.occompt.com/ssweb/web/integration/document/20170015765';

    console.log('Step 1: Navigate to deed URL');
    await page.goto(deedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Step 2: Check for reCAPTCHA');
    const hasRecaptcha = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).some(iframe =>
        iframe.src && iframe.src.includes('recaptcha')
      );
    });

    console.log(`   reCAPTCHA present: ${hasRecaptcha ? '❌ YES' : '✅ NO'}\n`);

    if (!hasRecaptcha) {
      console.log('✅ NO CAPTCHA! Stealth mode is working!');
      console.log('Step 3: Click "I Accept" button');

      // Try clicking with different methods
      try {
        await page.waitForSelector('#submitDisclaimerAccept', { timeout: 10000 });
        await page.click('#submitDisclaimerAccept');
        console.log('✅ Clicked "I Accept" (method 1: page.click)');
      } catch (err) {
        console.log('⚠️ Method 1 failed, trying evaluate click...');
        await page.evaluate(() => {
          document.querySelector('#submitDisclaimerAccept')?.click();
        });
        console.log('✅ Clicked "I Accept" (method 2: evaluate)');
      }

      console.log('Waiting for navigation or response...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      if (currentUrl.includes('/user/disclaimer')) {
        console.log('Still on disclaimer page, looking for "Yes - Continue"...');

        const continueButtonExists = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text.includes('yes') && text.includes('continue')) {
              console.log('Found "Yes - Continue" button:', btn);
              return true;
            }
          }
          return false;
        });

        if (continueButtonExists) {
          console.log('Step 4: Click "Yes - Continue"');
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            for (const btn of buttons) {
              const text = btn.textContent?.trim().toLowerCase() || '';
              if (text.includes('yes') && text.includes('continue')) {
                btn.click();
                return;
              }
            }
          });
          console.log('✅ Clicked "Yes - Continue"');

          await new Promise(resolve => setTimeout(resolve, 8000));
        }
      }

      // Check final state
      const finalUrl = page.url();
      console.log(`\nFinal URL: ${finalUrl}`);

      if (!finalUrl.includes('/user/disclaimer')) {
        console.log('✅ SUCCESS! Made it past disclaimer page!');

        // Look for deed content
        const pageContent = await page.evaluate(() => {
          return {
            bodyText: document.body.innerText.substring(0, 1000),
            downloadLinks: Array.from(document.querySelectorAll('a, button')).map(el => ({
              text: el.textContent?.trim(),
              href: el.href,
              tag: el.tagName
            })).filter(el => {
              const text = (el.text || '').toLowerCase();
              return text.includes('download') || text.includes('pdf') || text.includes('view');
            })
          };
        });

        console.log('\n📄 Deed Page Content:');
        console.log(pageContent.bodyText);

        if (pageContent.downloadLinks.length > 0) {
          console.log('\n📥 Download Options:');
          pageContent.downloadLinks.forEach((link, i) => {
            console.log(`${i + 1}. [${link.tag}] "${link.text}"`);
            if (link.href) console.log(`   -> ${link.href}`);
          });
        }
      } else {
        console.log('⚠️ Still on disclaimer page');
      }

      console.log('\n' + '='.repeat(80));
      console.log('Browser staying open for 1 minute...');
      console.log('='.repeat(80));
      await new Promise(resolve => setTimeout(resolve, 60000));
    } else {
      console.log('❌ reCAPTCHA still present even with stealth mode');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

testStealthClick();
