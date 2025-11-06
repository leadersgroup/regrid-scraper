const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Testing Harris County Clerk login and PDF download...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate to Clerk Records
  console.log('📍 Loading Clerk Records search...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fill in the date
  console.log('📝 Entering date: 07/25/2023');

  await page.waitForSelector('input[name*="From"]', { timeout: 5000 });
  await page.type('input[name*="From"]', '07/25/2023');
  console.log('✅ Entered Date From');

  await page.waitForSelector('input[name*="To"]', { timeout: 5000 });
  await page.type('input[name*="To"]', '07/25/2023');
  console.log('✅ Entered Date To');

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Click search
  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('✅ Clicked search');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Click on film code
  console.log('\n🖱️  Clicking film code RP-2023-279211...');
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        link.click();
        return;
      }
    }
  });

  console.log('✅ Clicked film code link');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get all pages
  const pages = await browser.pages();
  let loginPage = pages[pages.length - 1];

  console.log(`\n📊 Number of pages: ${pages.length}`);
  console.log(`📍 Login page URL: ${loginPage.url()}`);

  if (loginPage.url().includes('Login.aspx')) {
    console.log('\n🔐 On login page - attempting to log in...');

    // Fill in credentials
    const usernameField = 'input[name*="UserName"], input[id*="UserName"]';
    const passwordField = 'input[type="password"]';
    const loginButton = 'input[type="submit"][value*="Log"]';

    await loginPage.waitForSelector(usernameField, { timeout: 5000 });
    await loginPage.type(usernameField, 'leaderslaw');
    console.log('✅ Entered username');

    await loginPage.waitForSelector(passwordField, { timeout: 5000 });
    await loginPage.type(passwordField, 'Leaders2000@1');
    console.log('✅ Entered password');

    await new Promise(resolve => setTimeout(resolve, 1000));

    await loginPage.click(loginButton);
    console.log('✅ Clicked login button');

    // Wait for login to complete
    console.log('⏳ Waiting for login to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const currentUrl = loginPage.url();
    console.log(`\n📍 After login URL: ${currentUrl}`);

    if (currentUrl.includes('Login.aspx')) {
      console.log('❌ Still on login page - login may have failed');

      const errorMsg = await loginPage.evaluate(() => {
        const errors = document.querySelectorAll('.error, .alert, [class*="error"], [class*="alert"]');
        if (errors.length > 0) {
          return Array.from(errors).map(e => e.textContent.trim()).join(', ');
        }
        return null;
      });

      if (errorMsg) {
        console.log(`   Error message: ${errorMsg}`);
      }
    } else if (currentUrl.includes('ViewEdocs')) {
      console.log('✅ Login successful! Now on PDF viewer page');

      // Try to download the PDF
      console.log('\n📥 Attempting to download PDF...');

      try {
        const response = await loginPage.goto(currentUrl, { waitUntil: 'networkidle2' });
        const buffer = await response.buffer();

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`\n📄 PDF validation: isPDF=${isPDF}, size=${buffer.length} bytes`);

        if (isPDF) {
          console.log('✅ Valid PDF downloaded!');

          // Save it
          const fs = require('fs');
          const path = require('path');
          const filepath = path.join(__dirname, 'test-deed-download.pdf');
          fs.writeFileSync(filepath, buffer);
          console.log(`💾 Saved to: ${filepath}`);
        } else {
          console.log('⚠️  Not a PDF - might be HTML viewer');
          const text = buffer.toString().substring(0, 500);
          console.log('Content preview:', text);
        }
      } catch (e) {
        console.log(`❌ Error downloading: ${e.message}`);
      }
    } else {
      console.log(`⚠️  Unexpected URL after login: ${currentUrl}`);
    }
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
