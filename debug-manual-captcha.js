/**
 * Debug script that accepts disclaimer and waits for manual CAPTCHA completion
 * This will help us see what happens after the CAPTCHA is solved
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function debugManualCaptcha() {
  console.log('🔍 Manual CAPTCHA Testing\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  // Set up download handling
  const downloadPath = path.resolve('./downloads');
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });
  console.log(`📁 Download path set to: ${downloadPath}\n`);

  try {
    const deedUrl = 'https://selfservice.or.occompt.com/ssweb/web/integration/document/20170015765';

    console.log(`Navigating to: ${deedUrl}`);
    await page.goto(deedUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Accept disclaimer
    const currentUrl = page.url();
    if (currentUrl.includes('/user/disclaimer')) {
      console.log('✅ On disclaimer page, clicking "I Accept"...');

      const acceptClicked = await page.evaluate(() => {
        const acceptButton = document.querySelector('#submitDisclaimerAccept');
        if (acceptButton) {
          acceptButton.click();
          return true;
        }
        return false;
      });

      if (acceptClicked) {
        console.log('✅ Clicked "I Accept"');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check for "Yes - Continue" button
        const continueSessionClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          for (const btn of buttons) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            if (text.includes('yes') && text.includes('continue')) {
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (continueSessionClicked) {
          console.log('✅ Clicked "Yes - Continue"');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('MANUAL CAPTCHA INSTRUCTIONS:');
    console.log('='.repeat(80));
    console.log('1. COMPLETE THE reCAPTCHA in the browser window');
    console.log('2. Wait for the deed page to load');
    console.log('3. Look for download/PDF buttons');
    console.log('4. Try clicking them manually');
    console.log('5. Observe what URLs/requests are made');
    console.log('='.repeat(80));
    console.log('\nBrowser will stay open for 5 MINUTES...\n');

    // Monitor network for PDF downloads
    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (url.includes('.pdf') || contentType.includes('pdf') || url.includes('document')) {
        console.log(`\n📄 POTENTIAL DEED URL DETECTED:`);
        console.log(`   URL: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Status: ${response.status()}`);
      }
    });

    // Wait 5 minutes for manual interaction
    await new Promise(resolve => setTimeout(resolve, 300000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugManualCaptcha();
