/**
 * Debug what happens after CAPTCHA is solved
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

puppeteer.use(StealthPlugin());

// Add 2Captcha plugin
if (process.env.TWOCAPTCHA_TOKEN) {
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.TWOCAPTCHA_TOKEN
      },
      visualFeedback: true
    })
  );
}

async function debugAfterCaptchaSolve() {
  console.log('🔍 Debug: What happens after CAPTCHA is solved\n');

  const browser = await puppeteer.launch({
    headless: false, // Keep visible
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    const deedUrl = 'https://selfservice.or.occompt.com/ssweb/web/integration/document/20170015765';

    console.log('Step 1: Navigate to deed URL');
    await page.goto(deedUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    console.log('Step 2: Click "I Accept"');
    await page.click('#submitDisclaimerAccept');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Step 3: Click "Yes - Continue"');
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
    await new Promise(r => setTimeout(r, 5000));

    const hasCaptcha = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('iframe')).some(i =>
        i.src && i.src.includes('recaptcha')
      );
    });

    console.log(`Step 4: CAPTCHA present: ${hasCaptcha}\n`);

    if (hasCaptcha && process.env.TWOCAPTCHA_TOKEN) {
      console.log('Step 5: Solving CAPTCHA...');
      console.log('(This will take 10-30 seconds)\n');

      await page.solveRecaptchas();

      console.log('✅ CAPTCHA solved!\n');
      await new Promise(r => setTimeout(r, 5000));

      // Check what happened after solving
      const afterSolve = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 1000),

          // Check for forms that might need submitting
          forms: Array.from(document.querySelectorAll('form')).map(f => ({
            action: f.action,
            method: f.method,
            id: f.id,
            hasSubmitButton: !!f.querySelector('button[type="submit"], input[type="submit"]')
          })),

          // Check for buttons
          buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
            text: btn.textContent?.trim() || btn.value,
            type: btn.type,
            id: btn.id,
            visible: btn.offsetParent !== null
          })).filter(b => b.visible),

          // Check if CAPTCHA is still there
          stillHasCaptcha: Array.from(document.querySelectorAll('iframe')).some(i =>
            i.src && i.src.includes('recaptcha')
          ),

          // Check for any links that might lead to the document
          documentLinks: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim(),
            href: a.href
          })).filter(l =>
            l.href && (
              l.href.includes('document') ||
              l.href.includes('pdf') ||
              l.href.includes('20170015765')
            )
          )
        };
      });

      console.log('═'.repeat(80));
      console.log('AFTER CAPTCHA SOLVED:');
      console.log('═'.repeat(80));
      console.log(`URL: ${afterSolve.url}`);
      console.log(`Title: ${afterSolve.title}`);
      console.log(`Still has CAPTCHA: ${afterSolve.stillHasCaptcha}\n`);

      console.log('Body Text:');
      console.log(afterSolve.bodyText);
      console.log('\n');

      if (afterSolve.forms.length > 0) {
        console.log('FORMS FOUND:');
        afterSolve.forms.forEach((form, i) => {
          console.log(`${i + 1}. Action: ${form.action}, Method: ${form.method}`);
          console.log(`   Has Submit Button: ${form.hasSubmitButton}`);
        });
        console.log('');
      }

      if (afterSolve.buttons.length > 0) {
        console.log('BUTTONS FOUND:');
        afterSolve.buttons.forEach((btn, i) => {
          console.log(`${i + 1}. "${btn.text}" (${btn.type}) ID: ${btn.id}`);
        });
        console.log('');
      }

      if (afterSolve.documentLinks.length > 0) {
        console.log('DOCUMENT LINKS:');
        afterSolve.documentLinks.forEach((link, i) => {
          console.log(`${i + 1}. "${link.text}"`);
          console.log(`   -> ${link.href}`);
        });
        console.log('');
      }

      // Try submitting form if one exists with submit button
      if (afterSolve.forms.some(f => f.hasSubmitButton)) {
        console.log('Found form with submit button, trying to submit...');

        await page.evaluate(() => {
          const form = document.querySelector('form');
          const submitBtn = form?.querySelector('button[type="submit"], input[type="submit"]');
          if (submitBtn) {
            submitBtn.click();
          }
        });

        console.log('Clicked submit button, waiting for navigation...');
        await new Promise(r => setTimeout(r, 10000));

        const afterSubmit = await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 500)
        }));

        console.log('\n' + '═'.repeat(80));
        console.log('AFTER FORM SUBMIT:');
        console.log('═'.repeat(80));
        console.log(`URL: ${afterSubmit.url}`);
        console.log(`Title: ${afterSubmit.title}`);
        console.log(`Body: ${afterSubmit.bodyText}`);
      }

      console.log('\n' + '═'.repeat(80));
      console.log('Browser staying open for 2 minutes for manual inspection...');
      console.log('═'.repeat(80));
      await new Promise(r => setTimeout(r, 120000));

    } else if (!process.env.TWOCAPTCHA_TOKEN) {
      console.log('❌ No TWOCAPTCHA_TOKEN set, cannot solve CAPTCHA');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugAfterCaptchaSolve();
