/**
 * Debug script to understand Guilford County deed viewer flow
 * This will help us identify what sets up the tiffInfo session variable
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugGuilfordFlow() {
  console.log('🔍 Debugging Guilford County Deed Viewer Flow\n');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true, // Open DevTools automatically
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Enable request interception to monitor all network requests
  await page.setRequestInterception(true);

  const networkRequests = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('guilfordcountync.gov')) {
      console.log(`📡 Request: ${request.method()} ${url}`);
      networkRequests.push({
        method: request.method(),
        url: url,
        headers: request.headers()
      });
    }
    request.continue();
  });

  page.on('response', response => {
    const url = response.url();
    if (url.includes('guilfordcountync.gov')) {
      console.log(`📨 Response: ${response.status()} ${url}`);
    }
  });

  try {
    // Step 1: Go to property search
    console.log('\n📍 STEP 1: Property Search\n');
    const searchUrl = 'https://gis.guilfordcountync.gov/ggims/parcel.html';
    await page.goto(searchUrl, { waitUntil: 'networkidle0' });

    console.log('Waiting for search form to load...');
    await page.waitForSelector('#txtSearch', { timeout: 30000 });

    // Search for address
    const testAddress = '1205 Glendale Dr';
    console.log(`Searching for: ${testAddress}`);

    await page.type('#txtSearch', testAddress);
    await page.keyboard.press('Enter');

    // Wait for results
    console.log('Waiting for search results...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for property results
    const hasResults = await page.evaluate(() => {
      const resultsTable = document.querySelector('table');
      return resultsTable && resultsTable.querySelectorAll('tr').length > 1;
    });

    if (!hasResults) {
      console.log('❌ No search results found');
      return;
    }

    console.log('✅ Found property results');

    // Click first result
    await page.evaluate(() => {
      const firstRow = document.querySelector('table tbody tr');
      if (firstRow) {
        const link = firstRow.querySelector('a');
        if (link) link.click();
      }
    });

    console.log('Waiting for property details...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 2: Find and analyze deed links
    console.log('\n📍 STEP 2: Analyzing Deed Links\n');

    // Get all deed links and their attributes
    const deedLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .filter(link => {
          const text = link.textContent.toLowerCase();
          const href = link.href || '';
          return text.includes('deed') || href.includes('deed') || href.includes('viewimage');
        })
        .map(link => ({
          text: link.textContent.trim(),
          href: link.href,
          onclick: link.onclick ? link.onclick.toString() : null,
          target: link.target,
          attributes: Array.from(link.attributes).map(attr => ({
            name: attr.name,
            value: attr.value
          }))
        }));
    });

    console.log(`Found ${deedLinks.length} deed-related links:`);
    deedLinks.forEach((link, i) => {
      console.log(`\nLink ${i + 1}:`);
      console.log(`  Text: ${link.text}`);
      console.log(`  Href: ${link.href}`);
      console.log(`  Target: ${link.target || 'none'}`);
      if (link.onclick) {
        console.log(`  OnClick: ${link.onclick.substring(0, 100)}...`);
      }
    });

    // Step 3: Monitor what happens when clicking a deed link
    console.log('\n📍 STEP 3: Clicking Deed Link and Monitoring\n');

    if (deedLinks.length > 0) {
      const targetLink = deedLinks.find(l => l.text.toLowerCase().includes('deed')) || deedLinks[0];

      console.log(`Clicking: ${targetLink.text}`);
      console.log('Monitoring network requests...\n');

      // Clear previous requests
      networkRequests.length = 0;

      // Set up promise to wait for new tab
      const newPagePromise = new Promise(resolve =>
        browser.once('targetcreated', target => resolve(target.page()))
      );

      // Click the deed link
      await page.evaluate((href) => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
        if (link) {
          console.log('Clicking link...');
          link.click();
        }
      }, targetLink.href);

      // Wait a bit to capture any immediate requests
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if new tab opened
      let deedPage = page;
      try {
        const newPage = await Promise.race([
          newPagePromise,
          new Promise(resolve => setTimeout(() => resolve(null), 3000))
        ]);

        if (newPage) {
          console.log('✅ New tab opened');
          deedPage = newPage;

          // Monitor new tab's requests too
          await deedPage.setRequestInterception(true);

          deedPage.on('request', request => {
            const url = request.url();
            if (url.includes('guilfordcountync.gov')) {
              console.log(`📡 [New Tab] Request: ${request.method()} ${url}`);
            }
            request.continue();
          });
        } else {
          console.log('⚠️  No new tab, checking current page navigation');
        }
      } catch (e) {
        console.log('⚠️  Tab handling error:', e.message);
      }

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check current URL
      const currentUrl = deedPage.url();
      console.log(`\n📄 Current URL: ${currentUrl}`);

      // Check page content
      const pageInfo = await deedPage.evaluate(() => {
        const bodyText = document.body.innerText || '';
        const hasError = bodyText.includes('Notice</b>') ||
                        bodyText.includes('Error</b>') ||
                        bodyText.includes('Undefined variable');

        let errorMessage = '';
        if (hasError) {
          const match = bodyText.match(/Notice<\/b>:([^<]+)/);
          if (match) errorMessage = match[0];
        }

        // Check for images, iframes, embeds
        const images = document.querySelectorAll('img');
        const iframes = document.querySelectorAll('iframe');
        const embeds = document.querySelectorAll('embed, object');

        return {
          hasError,
          errorMessage,
          imageCount: images.length,
          iframeCount: iframes.length,
          embedCount: embeds.length,
          textLength: bodyText.length,
          firstChars: bodyText.substring(0, 200)
        };
      });

      console.log('\n📊 Page Analysis:');
      console.log(`  Has Error: ${pageInfo.hasError}`);
      if (pageInfo.errorMessage) {
        console.log(`  Error: ${pageInfo.errorMessage}`);
      }
      console.log(`  Images: ${pageInfo.imageCount}`);
      console.log(`  Iframes: ${pageInfo.iframeCount}`);
      console.log(`  Embeds: ${pageInfo.embedCount}`);
      console.log(`  Text length: ${pageInfo.textLength}`);

      // Step 4: Try to understand the correct flow
      console.log('\n📍 STEP 4: Analyzing Network Requests\n');

      console.log('All requests made:');
      networkRequests.forEach((req, i) => {
        console.log(`${i + 1}. ${req.method} ${req.url}`);
      });

      // Step 5: Try alternative approach - look for JavaScript functions
      console.log('\n📍 STEP 5: Checking for JavaScript Functions\n');

      const jsFunctions = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        const functionPatterns = [];

        scripts.forEach(script => {
          const content = script.textContent || '';
          // Look for functions related to deeds/images
          const matches = content.match(/function\s+\w*[Dd]eed\w*|function\s+\w*[Ii]mage\w*|function\s+\w*[Vv]iew\w*/g);
          if (matches) {
            functionPatterns.push(...matches);
          }
        });

        // Also check for global functions
        const globalFuncs = Object.keys(window).filter(key => {
          return typeof window[key] === 'function' &&
                 (key.toLowerCase().includes('deed') ||
                  key.toLowerCase().includes('image') ||
                  key.toLowerCase().includes('view'));
        });

        return {
          inlineFunc: functionPatterns,
          globalFunc: globalFuncs
        };
      });

      console.log('Found JavaScript functions:');
      console.log('  Inline:', jsFunctions.inlineFunc);
      console.log('  Global:', jsFunctions.globalFunc);

      // Step 6: Try to find the missing piece
      console.log('\n📍 STEP 6: Looking for Session Setup\n');

      // Check if there's an intermediate page or API call
      const cookies = await deedPage.cookies();
      console.log(`\nCookies (${cookies.length} total):`);
      cookies.forEach(cookie => {
        if (cookie.name.includes('SESS') || cookie.name.includes('sess')) {
          console.log(`  ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
        }
      });

      // Try to find any AJAX setup calls
      const hasAjaxSetup = await page.evaluate(() => {
        // Check if jQuery is loaded and look for AJAX calls
        if (typeof $ !== 'undefined' && $.ajax) {
          return 'jQuery available - may use AJAX';
        }
        return 'No jQuery found';
      });
      console.log(`\nAJAX Status: ${hasAjaxSetup}`);

    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Debug session complete. Browser remains open for inspection.');
    console.log('Check the Network tab in DevTools for all requests.');
    console.log('Press Ctrl+C to exit.');

    // Keep browser open
    await new Promise(() => {});
  }
}

// Run the debug session
debugGuilfordFlow().catch(console.error);