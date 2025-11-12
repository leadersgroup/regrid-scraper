/**
 * Manual test to understand and fix Guilford County deed viewer
 * This navigates through the actual flow to see what sets up tiffInfo
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function manualGuilfordTest() {
  console.log('🔍 Manual Guilford County Test - Finding the Missing Piece\n');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Monitor all requests
  const requestLog = [];
  page.on('request', request => {
    const url = request.url();
    if (url.includes('guilford') || url.includes('ncpts')) {
      requestLog.push({
        method: request.method(),
        url: url,
        timestamp: Date.now()
      });
      console.log(`📡 ${request.method()} ${url}`);
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('viewimage')) {
      console.log(`📨 Response from viewimage: ${response.status()}`);

      // Try to get response text
      try {
        const text = await response.text();
        if (text.includes('tiffInfo')) {
          console.log('⚠️  Response contains "tiffInfo"');
          console.log('First 500 chars:', text.substring(0, 500));
        }
      } catch (e) {
        // Ignore if we can't get text
      }
    }
  });

  try {
    // Step 1: Go to property search (correct URL)
    console.log('\n📍 STEP 1: Navigate to Property Search\n');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Loaded property search page');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Search for property
    console.log('\n📍 STEP 2: Search for Property\n');

    // Click Location Address tab
    const tabClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      for (const link of links) {
        if (link.textContent.includes('Location Address')) {
          link.click();
          return true;
        }
      }
      return false;
    });

    if (!tabClicked) {
      console.log('❌ Could not find Location Address tab');
      return;
    }

    console.log('✅ Clicked Location Address tab');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Fill in address
    const testAddress = '1205 Glendale Dr';
    const [streetNumber, ...streetNameParts] = testAddress.split(' ');
    const streetName = streetNameParts.join(' ');

    console.log(`📝 Searching for: ${testAddress}`);

    // Fill street number
    await page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', { visible: true });
    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', streetNumber);

    // Fill street name
    await page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNameTextBox', { visible: true });
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', streetName);

    // Click search
    await page.evaluate(() => {
      const button = document.querySelector('#ctl00_ContentPlaceHolder1_LocationAddressSearchButton');
      if (button) button.click();
    });

    console.log('⏳ Waiting for search results...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click first result
    const resultClicked = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0 && cells[0].textContent.includes('1205')) {
          const link = row.querySelector('a');
          if (link) {
            link.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!resultClicked) {
      console.log('❌ Could not find or click property result');
      return;
    }

    console.log('✅ Clicked property result');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Find and analyze deed table
    console.log('\n📍 STEP 3: Analyze Deed Table\n');

    // Look for Prior Deeds table
    const deedInfo = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('h2, h3, th'));
      let deedTableFound = false;
      let deedTable = null;

      for (const header of headers) {
        if (header.textContent.includes('Prior Deeds')) {
          deedTableFound = true;
          // Find the table after this header
          let element = header.nextElementSibling;
          while (element) {
            if (element.tagName === 'TABLE') {
              deedTable = element;
              break;
            }
            element = element.nextElementSibling;
          }
          if (!deedTable && header.closest('table')) {
            deedTable = header.closest('table');
          }
          break;
        }
      }

      if (deedTable) {
        const rows = Array.from(deedTable.querySelectorAll('tr'));
        const deedLinks = [];

        rows.forEach(row => {
          const links = Array.from(row.querySelectorAll('a'));
          links.forEach(link => {
            const text = link.textContent.trim();
            if (text.toLowerCase().includes('deed')) {
              deedLinks.push({
                text: text,
                href: link.href,
                onclick: link.onclick ? link.onclick.toString() : null
              });
            }
          });
        });

        return {
          found: true,
          deedCount: deedLinks.length,
          deedLinks: deedLinks
        };
      }

      return { found: false };
    });

    if (!deedInfo.found) {
      console.log('❌ Could not find Prior Deeds table');
      return;
    }

    console.log(`✅ Found Prior Deeds table with ${deedInfo.deedCount} deed links`);

    if (deedInfo.deedLinks.length > 0) {
      console.log('\nDeed links found:');
      deedInfo.deedLinks.forEach((link, i) => {
        console.log(`  ${i + 1}. ${link.text}`);
        console.log(`     URL: ${link.href}`);
      });

      // Step 4: Monitor what happens when we click a deed link
      console.log('\n📍 STEP 4: Click Deed Link and Monitor\n');

      const firstDeed = deedInfo.deedLinks[0];
      console.log(`Clicking: ${firstDeed.text}`);

      // Clear request log
      requestLog.length = 0;

      // Get current cookies before clicking
      const cookiesBefore = await page.cookies();
      console.log(`\n🍪 Cookies before click: ${cookiesBefore.length}`);
      const sessionCookie = cookiesBefore.find(c => c.name.toLowerCase().includes('sess'));
      if (sessionCookie) {
        console.log(`  Session cookie: ${sessionCookie.name} = ${sessionCookie.value.substring(0, 20)}...`);
      }

      // Monitor for new tabs
      const pagesBefore = (await browser.pages()).length;

      // Click the deed link
      await page.evaluate((href) => {
        const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
        if (link) {
          console.log('Clicking deed link...');
          link.click();
        }
      }, firstDeed.href);

      // Wait to see what happens
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for new tabs
      const pagesAfter = await browser.pages();
      const newTabOpened = pagesAfter.length > pagesBefore;

      if (newTabOpened) {
        console.log('✅ New tab opened');
        const newPage = pagesAfter[pagesAfter.length - 1];

        // Get URL of new tab
        const newUrl = newPage.url();
        console.log(`📄 New tab URL: ${newUrl}`);

        // Check cookies in new tab
        const newPageCookies = await newPage.cookies();
        console.log(`\n🍪 Cookies in new tab: ${newPageCookies.length}`);
        const newSessionCookie = newPageCookies.find(c => c.name.toLowerCase().includes('sess'));
        if (newSessionCookie) {
          console.log(`  Session cookie: ${newSessionCookie.name} = ${newSessionCookie.value.substring(0, 20)}...`);
        }

        // Analyze new page content
        const content = await newPage.evaluate(() => {
          const bodyText = document.body.innerText || '';
          return {
            hasError: bodyText.includes('Notice</b>') || bodyText.includes('Undefined variable'),
            errorText: bodyText.match(/Notice<\/b>:[^<]*/)?.[0] || '',
            textLength: bodyText.length,
            firstChars: bodyText.substring(0, 300)
          };
        });

        console.log('\n📊 New Tab Analysis:');
        console.log(`  Has Error: ${content.hasError}`);
        if (content.errorText) {
          console.log(`  Error: ${content.errorText}`);
        }
        console.log(`  Content length: ${content.textLength}`);
        console.log(`  First 300 chars: ${content.firstChars}`);

      } else {
        console.log('⚠️  No new tab - checking current page');
        const currentUrl = page.url();
        console.log(`📄 Current URL: ${currentUrl}`);
      }

      // Step 5: Analyze the requests made
      console.log('\n📍 STEP 5: Analyze Network Requests\n');

      console.log('Requests made after clicking deed:');
      requestLog.forEach((req, i) => {
        console.log(`  ${i + 1}. ${req.method} ${req.url}`);
      });

      // Look for patterns
      const viewimageRequests = requestLog.filter(r => r.url.includes('viewimage'));
      if (viewimageRequests.length > 0) {
        console.log('\n⚠️  Direct viewimage requests found:');
        viewimageRequests.forEach(r => {
          console.log(`  ${r.url}`);
          // Parse the URL to understand parameters
          const url = new URL(r.url);
          console.log('  Parameters:', Array.from(url.searchParams.entries()));
        });
      }

      // Step 6: Try to find the missing setup
      console.log('\n📍 STEP 6: Looking for Missing Setup\n');

      // Check if there's JavaScript that should run before viewimage
      const jsAnalysis = await page.evaluate(() => {
        // Look for any global functions related to viewing deeds
        const funcs = Object.keys(window).filter(key => {
          const name = key.toLowerCase();
          return typeof window[key] === 'function' &&
                 (name.includes('deed') || name.includes('view') || name.includes('image'));
        });

        // Check for AJAX setup
        const hasJQuery = typeof $ !== 'undefined';
        const hasAjax = hasJQuery && $.ajax;

        return {
          globalFuncs: funcs,
          hasJQuery,
          hasAjax
        };
      });

      console.log('JavaScript Analysis:');
      console.log(`  jQuery: ${jsAnalysis.hasJQuery}`);
      console.log(`  AJAX available: ${jsAnalysis.hasAjax}`);
      console.log(`  Global functions: ${jsAnalysis.globalFuncs.join(', ') || 'none'}`);

    }

    // Step 7: Save findings
    console.log('\n📍 STEP 7: Summary\n');

    const findings = {
      timestamp: new Date().toISOString(),
      searchUrl: 'https://lrcpwa.ncptscloud.com/guilford/',
      deedViewerUrl: requestLog.find(r => r.url.includes('viewimage'))?.url || 'not found',
      requestCount: requestLog.length,
      requests: requestLog,
      needsSessionSetup: true,
      errorFound: 'Undefined variable: tiffInfo',
      possibleSolutions: [
        'Need to find and call the API/page that sets up tiffInfo session variable',
        'May need to parse deed link parameters differently',
        'Could require specific cookie or header setup'
      ]
    };

    fs.writeFileSync('guilford-findings.json', JSON.stringify(findings, null, 2));
    console.log('✅ Saved findings to guilford-findings.json');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Test complete. Browser remains open for manual inspection.');
    console.log('Check the Network tab to see all requests.');
    console.log('Try manually clicking through to see what works.');
    console.log('Press Ctrl+C to exit.');

    await new Promise(() => {});
  }
}

// Run the test
manualGuilfordTest().catch(console.error);