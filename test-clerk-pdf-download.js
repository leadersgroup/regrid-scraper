const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🚀 Testing Harris County Clerk PDF download...\n');

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

  console.log('✅ Loaded Clerk Records page');

  // Fill in the date (07/25/2023)
  console.log('📝 Entering date: 07/25/2023');

  // Find Date From field
  const dateFromSelectors = [
    'input[name*="From"]',
    'input[id*="From"]',
    'input[name*="DateFrom"]'
  ];

  for (const selector of dateFromSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.type(selector, '07/25/2023');
      console.log(`✅ Entered Date From: ${selector}`);
      break;
    } catch (e) {
      // Try next selector
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find Date To field
  const dateToSelectors = [
    'input[name*="To"]',
    'input[id*="To"]',
    'input[name*="DateTo"]'
  ];

  for (const selector of dateToSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      await page.type(selector, '07/25/2023');
      console.log(`✅ Entered Date To: ${selector}`);
      break;
    } catch (e) {
      // Try next selector
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Click search
  console.log('🔍 Clicking search...');
  const searchButton = await page.$('input[type="submit"], button[type="submit"]');
  if (searchButton) {
    await searchButton.click();
    console.log('✅ Clicked search button');
  }

  await new Promise(resolve => setTimeout(resolve, 5000));

  // Look for film code RP-2023-279211
  console.log('\n🔍 Looking for film code RP-2023-279211...');

  const filmCodeLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        return {
          found: true,
          text: link.textContent,
          href: link.href,
          target: link.target
        };
      }
    }
    return { found: false };
  });

  if (filmCodeLink.found) {
    console.log('✅ Found film code link:');
    console.log(`   Text: ${filmCodeLink.text}`);
    console.log(`   Href: ${filmCodeLink.href}`);
    console.log(`   Target: ${filmCodeLink.target || '(none)'}`);

    // Click on the film code link
    console.log('\n🖱️  Clicking film code link...');

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

    // Check if new tab opened
    const pages = await browser.pages();
    console.log(`\n📊 Number of pages: ${pages.length}`);

    let pdfPage = page;
    if (pages.length > 1) {
      pdfPage = pages[pages.length - 1];
      console.log('✅ New tab opened');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    const currentUrl = pdfPage.url();
    console.log(`\n📍 Current URL: ${currentUrl}`);

    // Check if it's a login page
    if (currentUrl.includes('Login.aspx')) {
      console.log('⚠️  Redirected to LOGIN PAGE - PDF requires authentication');

      const pageText = await pdfPage.evaluate(() => document.body.innerText);
      console.log('\n📄 Login page content:');
      console.log(pageText.substring(0, 500));

      // Check what kind of login is required
      const loginInfo = await pdfPage.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const hasUsername = inputs.some(i => i.name && i.name.toLowerCase().includes('user'));
        const hasPassword = inputs.some(i => i.type === 'password');
        const hasEmail = inputs.some(i => i.type === 'email');

        return {
          hasUsername,
          hasPassword,
          hasEmail,
          inputFields: inputs.map(i => ({ name: i.name, type: i.type, id: i.id }))
        };
      });

      console.log('\n🔐 Login page analysis:');
      console.log(`   Has username field: ${loginInfo.hasUsername}`);
      console.log(`   Has password field: ${loginInfo.hasPassword}`);
      console.log(`   Has email field: ${loginInfo.hasEmail}`);
      console.log('\n   Input fields:');
      loginInfo.inputFields.forEach(field => {
        console.log(`     - ${field.type}: ${field.name || field.id}`);
      });

    } else if (currentUrl.includes('.pdf') || currentUrl.includes('ViewEdocs')) {
      console.log('✅ Potentially on PDF page');

      // Try to get PDF content
      try {
        const response = await pdfPage.goto(currentUrl, { waitUntil: 'networkidle2' });
        const buffer = await response.buffer();

        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`\n📄 PDF validation: isPDF=${isPDF}, size=${buffer.length} bytes`);

        if (isPDF) {
          console.log('✅ Valid PDF downloaded!');
        } else {
          console.log('❌ Not a valid PDF - might be HTML page');
          const text = buffer.toString().substring(0, 500);
          console.log('Content preview:', text);
        }
      } catch (e) {
        console.log(`❌ Error downloading: ${e.message}`);
      }
    }

  } else {
    console.log('❌ Film code not found in search results');
  }

  console.log('\n⏸️  Browser will stay open for 60 seconds...');
  await new Promise(resolve => setTimeout(resolve, 60000));

  await browser.close();
})();
