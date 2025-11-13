/**
 * Test Guilford County using Playwright instead of Puppeteer
 * Playwright has better session/context handling
 */

const { chromium } = require('playwright');

async function testGuilfordWithPlaywright() {
  console.log('🎭 Testing Guilford County with Playwright\n');
  console.log('=' .repeat(60));

  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });

  // Create a persistent context to maintain session
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    // Enable all cookies and storage
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    // Keep session storage
    storageState: undefined
  });

  // Monitor requests
  context.on('request', request => {
    const url = request.url();
    if (url.includes('guilford') || url.includes('ncpts')) {
      console.log(`📡 ${request.method()} ${url}`);
    }
  });

  context.on('response', async response => {
    const url = response.url();
    if (url.includes('viewimage')) {
      console.log(`📨 Response: ${response.status()} ${url}`);

      try {
        const text = await response.text();
        if (text.includes('tiffInfo')) {
          console.log('⚠️  tiffInfo error detected');
          console.log('First 200 chars:', text.substring(0, 200));
        }
      } catch (e) {
        // Ignore
      }
    }
  });

  const page = await context.newPage();

  try {
    // Step 1: Navigate to search
    console.log('\n📍 STEP 1: Navigate to Property Search\n');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle'
    });

    console.log('✅ Loaded search page');

    // Step 2: Search for property
    console.log('\n📍 STEP 2: Search for Property\n');

    // Click Location Address tab
    await page.click('a[data-toggle="tab"]:has-text("Location Address")');
    console.log('✅ Clicked Location Address tab');

    await page.waitForTimeout(1000);

    // Fill address
    const testAddress = '1209 Glendale Dr, Greensboro, NC 27406';
    const [streetNumber, ...streetNameParts] = testAddress.split(' ');
    const streetName = streetNameParts.join(' ').replace(/, Greensboro, NC 27406/, '');

    console.log(`📝 Searching for: ${testAddress}`);

    await page.fill('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', streetNumber);
    await page.fill('#ctl00_ContentPlaceHolder1_StreetNameTextBox', streetName);

    // Click search
    await page.click('#ctl00_ContentPlaceHolder1_LocationAddressSearchButton');

    console.log('⏳ Waiting for results...');
    await page.waitForTimeout(5000);

    // Click first result
    const resultLink = await page.locator('table tr td:has-text("1205")').first().locator('..').locator('a').first();

    if (await resultLink.count() > 0) {
      await resultLink.click();
      console.log('✅ Clicked property result');
    } else {
      console.log('❌ No results found');
      return;
    }

    await page.waitForTimeout(3000);

    // Step 3: Find deed links
    console.log('\n📍 STEP 3: Find and Click Deed Link\n');

    // Look for deed links in the Prior Deeds table
    const deedLinks = await page.locator('a').filter({ hasText: /deed/i });
    const deedCount = await deedLinks.count();

    console.log(`Found ${deedCount} deed links`);

    if (deedCount > 0) {
      // Get first deed link info
      const firstDeedLink = deedLinks.first();
      const deedText = await firstDeedLink.textContent();
      const deedHref = await firstDeedLink.getAttribute('href');

      console.log(`\nFirst deed: ${deedText}`);
      console.log(`URL: ${deedHref}`);

      // Get current context state before clicking
      const stateBeforeClick = await context.storageState();
      console.log(`\n🍪 Cookies before click: ${stateBeforeClick.cookies.length}`);
      const sessionCookie = stateBeforeClick.cookies.find(c =>
        c.name.toLowerCase().includes('sess') || c.name === 'PHPSESSID'
      );
      if (sessionCookie) {
        console.log(`  Session: ${sessionCookie.name} = ${sessionCookie.value.substring(0, 20)}...`);
      }

      // Method 1: Click and wait for popup
      console.log('\n📍 METHOD 1: Using Playwright popup handling\n');

      const [popup] = await Promise.all([
        context.waitForEvent('page'),
        firstDeedLink.click()
      ]);

      if (popup) {
        console.log('✅ Popup/new tab opened');

        // Wait for popup to load
        await popup.waitForLoadState('networkidle');

        const popupUrl = popup.url();
        console.log(`📄 Popup URL: ${popupUrl}`);

        // Check popup content
        const popupContent = await popup.content();
        const hasError = popupContent.includes('tiffInfo');

        if (hasError) {
          console.log('❌ tiffInfo error still present in popup');

          // Try Method 2: Navigate in same context
          console.log('\n📍 METHOD 2: Navigate in same page with context\n');

          // Go back to main page and navigate directly
          await page.goto(deedHref, { waitUntil: 'networkidle' });

          const pageContent = await page.content();
          const stillHasError = pageContent.includes('tiffInfo');

          if (stillHasError) {
            console.log('❌ tiffInfo error persists with direct navigation');

            // Try Method 3: Use context cookies
            console.log('\n📍 METHOD 3: Create new page with full context\n');

            const newPage = await context.newPage();
            await newPage.goto(deedHref, { waitUntil: 'networkidle' });

            const newPageContent = await newPage.content();
            const newPageError = newPageContent.includes('tiffInfo');

            if (newPageError) {
              console.log('❌ Error persists even with full context');

              // Try Method 4: Intercept and modify request
              console.log('\n📍 METHOD 4: Route interception\n');

              // Set up route to add headers/modify request
              await context.route('**/gis_viewimage.php**', async route => {
                console.log('🔧 Intercepting viewimage request');

                // Get cookies from context
                const cookies = await context.cookies();
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                // Continue with modified headers
                await route.continue({
                  headers: {
                    ...route.request().headers(),
                    'Cookie': cookieString,
                    'Referer': page.url()
                  }
                });
              });

              // Try again with interception
              const testPage = await context.newPage();
              await testPage.goto(deedHref, { waitUntil: 'networkidle' });

              const testContent = await testPage.content();
              const testError = testContent.includes('tiffInfo');

              if (testError) {
                console.log('❌ Error persists even with request modification');
                console.log('\n⚠️  The issue is server-side - tiffInfo is not being set');
              } else {
                console.log('✅ Success with request modification!');
              }
            } else {
              console.log('✅ Success with new context page!');
            }
          } else {
            console.log('✅ Success with direct navigation!');
          }
        } else {
          console.log('✅ No tiffInfo error in popup!');

          // Check if we have actual content
          const hasImage = await popup.locator('img').count() > 0;
          const hasCanvas = await popup.locator('canvas').count() > 0;
          const hasEmbed = await popup.locator('embed, object').count() > 0;

          console.log(`\n📊 Content Analysis:`);
          console.log(`  Images: ${hasImage}`);
          console.log(`  Canvas: ${hasCanvas}`);
          console.log(`  Embeds: ${hasEmbed}`);
        }
      }
    }

    // Step 4: Analyze what we learned
    console.log('\n📍 ANALYSIS\n');

    const state = await context.storageState();
    console.log(`Final cookies: ${state.cookies.length}`);
    console.log(`Local storage items: ${state.origins.length}`);

    // Save findings
    const findings = {
      timestamp: new Date().toISOString(),
      playwright: true,
      cookieCount: state.cookies.length,
      cookies: state.cookies.map(c => ({ name: c.name, domain: c.domain })),
      localStorage: state.origins
    };

    require('fs').writeFileSync('guilford-playwright-findings.json', JSON.stringify(findings, null, 2));
    console.log('\n✅ Saved findings to guilford-playwright-findings.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Test complete. Browser remains open.');
    console.log('Press Ctrl+C to exit.');

    // Keep open for inspection
    await new Promise(() => {});
  }
}

// Run test
testGuilfordWithPlaywright().catch(console.error);