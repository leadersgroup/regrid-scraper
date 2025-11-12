/**
 * Test Guilford County with correct HTTP protocol
 * Based on user-provided URL: http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

async function testGuilfordHttp() {
  console.log('🔍 Testing Guilford County with HTTP Protocol\n');
  console.log('=' .repeat(60));
  console.log('Key insight: Deed URLs use http:// not https://');
  console.log('=' .repeat(60) + '\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--disable-web-security', // Allow mixed content (http in https)
      '--allow-running-insecure-content'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Test 1: Direct HTTP access (what the actual links use)
    console.log('📍 TEST 1: Direct HTTP Access\n');

    const httpUrl = 'http://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8461&bookpage=888';
    console.log(`Testing: ${httpUrl}`);

    await page.goto(httpUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.waitForTimeout(5000);

    const httpContent = await page.evaluate(() => {
      const bodyText = document.body.innerText || '';
      const hasError = bodyText.includes('tiffInfo');
      const hasImage = document.querySelectorAll('img').length > 0;
      return {
        hasError,
        hasImage,
        textLength: bodyText.length,
        firstChars: bodyText.substring(0, 200),
        url: window.location.href
      };
    });

    console.log('HTTP Results:');
    console.log(`  URL: ${httpContent.url}`);
    console.log(`  Has tiffInfo error: ${httpContent.hasError}`);
    console.log(`  Has images: ${httpContent.hasImage}`);
    console.log(`  Content length: ${httpContent.textLength}`);

    if (httpContent.hasError) {
      console.log('  ❌ Still has tiffInfo error with HTTP');
    } else if (httpContent.hasImage) {
      console.log('  ✅ SUCCESS! HTTP works without session error!');
    }

    // Test 2: Try with axios to see raw response
    console.log('\n📍 TEST 2: Raw HTTP Request\n');

    try {
      const response = await axios.get(httpUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: 5
      });

      const responseText = response.data.substring(0, 500);
      console.log('Raw response status:', response.status);
      console.log('Content-Type:', response.headers['content-type']);

      if (responseText.includes('tiffInfo')) {
        console.log('❌ Raw request also has tiffInfo error');
        console.log('First 500 chars:', responseText);
      } else if (response.headers['content-type']?.includes('image')) {
        console.log('✅ Raw request returns image!');
      }
    } catch (axiosError) {
      console.log('Axios error:', axiosError.message);
    }

    // Test 3: Navigate through the full flow
    console.log('\n📍 TEST 3: Full Navigation Flow\n');

    // Go to property search
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Loaded search page');

    // Click Location Address tab
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      for (const link of links) {
        if (link.textContent.includes('Location Address')) {
          link.click();
          break;
        }
      }
    });

    await page.waitForTimeout(1000);

    // Search for address
    const testAddress = '1205 Glendale Dr';
    const [streetNumber, ...streetNameParts] = testAddress.split(' ');
    const streetName = streetNameParts.join(' ');

    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', streetNumber);
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', streetName);

    await page.evaluate(() => {
      const button = document.querySelector('#ctl00_ContentPlaceHolder1_LocationAddressSearchButton');
      if (button) button.click();
    });

    console.log('⏳ Waiting for results...');
    await page.waitForTimeout(5000);

    // Click first result
    const clicked = await page.evaluate(() => {
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

    if (!clicked) {
      console.log('❌ Could not find property');
      return;
    }

    console.log('✅ Clicked property');
    await page.waitForTimeout(3000);

    // Find deed links and check their protocols
    const deedLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      return links
        .filter(link => link.textContent.toLowerCase().includes('deed'))
        .map(link => ({
          text: link.textContent.trim(),
          href: link.href,
          protocol: new URL(link.href).protocol
        }));
    });

    console.log(`\nFound ${deedLinks.length} deed links:`);
    deedLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link.text}`);
      console.log(`     Protocol: ${link.protocol}`);
      console.log(`     URL: ${link.href}`);
    });

    if (deedLinks.length > 0) {
      // Click first deed and monitor
      console.log('\nClicking first deed link...');

      const newPagePromise = new Promise(resolve =>
        browser.once('targetcreated', target => resolve(target.page()))
      );

      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const deedLink = links.find(link => link.textContent.toLowerCase().includes('deed'));
        if (deedLink) deedLink.click();
      });

      try {
        const newPage = await newPagePromise;
        console.log('✅ New tab opened');

        await newPage.waitForTimeout(5000);

        const newPageUrl = newPage.url();
        const newPageProtocol = new URL(newPageUrl).protocol;

        console.log(`New tab URL: ${newPageUrl}`);
        console.log(`Protocol: ${newPageProtocol}`);

        const newPageContent = await newPage.evaluate(() => {
          const bodyText = document.body.innerText || '';
          return {
            hasError: bodyText.includes('tiffInfo'),
            hasImage: document.querySelectorAll('img').length > 0,
            textLength: bodyText.length
          };
        });

        if (newPageContent.hasError) {
          console.log('❌ New tab has tiffInfo error');
        } else if (newPageContent.hasImage) {
          console.log('✅ New tab loaded successfully!');
        }
      } catch (e) {
        console.log('No new tab opened');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    console.log('\n' + '=' .repeat(60));
    console.log('Test complete. Browser remains open.');
    console.log('Check if HTTP vs HTTPS makes a difference.');
    console.log('Press Ctrl+C to exit.');

    await new Promise(() => {});
  }
}

// Run test
testGuilfordHttp().catch(console.error);