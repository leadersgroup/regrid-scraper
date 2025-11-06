/**
 * Get deed URL and fetch it directly
 */

const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');

async function testFetchDeed() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log('\n✅ Browser initialized\n');

    await page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    // Select Address mode
    await page.selectOption('#inputGroupSelect01', '2');
    await page.waitForTimeout(2000);

    // Enter address
    await page.fill('#streetNumber', '6241');
    await page.fill('#singleSearchCriteria', 'del sol');
    console.log('✅ Entered address: 6241 del sol\n');

    // Click search button
    await page.click('button[type="submit"]');
    console.log('✅ Clicked search button\n');

    // Wait for results
    await page.waitForSelector('text=/049 14 0A 023\\.00/i', { timeout: 10000 });
    console.log('✅ Results appeared\n');

    // Click parcel link
    await page.click('a[onclick*="OnSearchGridSelectAccount"]');
    console.log('✅ Clicked parcel link\n');

    // Wait for property details
    await page.waitForTimeout(3000);

    // Wait for View Deed link
    await page.waitForSelector('a:has-text("View Deed")', { timeout: 10000 });
    console.log('✅ Found View Deed link\n');

    // Get the deed URL
    const deedUrl = await page.getAttribute('a:has-text("View Deed")', 'href');
    console.log(`📄 Deed URL: ${deedUrl}\n`);

    // Get cookies for the request
    const cookies = await context.cookies();
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    console.log('🔽 Fetching deed PDF via axios...\n');

    // Fetch the PDF directly
    const response = await axios.get(deedUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://portal.padctn.org/'
      }
    });

    console.log(`✅ Response received:`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Content-Type: ${response.headers['content-type']}`);
    console.log(`   Size: ${response.data.byteLength} bytes\n`);

    // Save to file
    const downloadPath = '/tmp/davidson-deed.pdf';
    fs.writeFileSync(downloadPath, Buffer.from(response.data));

    // Verify it's a PDF
    const buffer = Buffer.from(response.data);
    const isPDF = buffer.toString('utf8', 0, 4) === '%PDF';

    console.log(`📋 File verification:`);
    console.log(`   Saved to: ${downloadPath}`);
    console.log(`   Is PDF: ${isPDF}`);
    console.log(`   Size: ${buffer.length} bytes`);
    console.log(`   First 20 bytes: ${buffer.toString('hex', 0, 20)}\n`);

    if (isPDF) {
      console.log('🎉 SUCCESS! Deed PDF downloaded successfully!\n');

      // Also save as base64 for the scraper result
      const base64 = buffer.toString('base64');
      console.log(`📦 Base64 length: ${base64.length} characters\n`);
    } else {
      console.log('⚠️  Warning: Downloaded file may not be a valid PDF\n');
      console.log('First 200 chars:');
      console.log(buffer.toString('utf8', 0, 200));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data?.toString('utf8', 0, 200));
    }
  } finally {
    console.log('\n✅ Closing browser...');
    await browser.close();
  }
}

testFetchDeed().catch(console.error);
