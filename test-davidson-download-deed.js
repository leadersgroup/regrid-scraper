/**
 * Complete test - search, click parcel, click View Deed, download PDF
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testDownloadDeed() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    acceptDownloads: true
  });

  const page = await context.newPage();

  try {
    console.log('\n✅ Browser initialized\n');

    await page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');

    // Select Address mode
    await page.selectOption('#inputGroupSelect01', '2');
    console.log('✅ Selected Address mode\n');
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

    // Wait for property details to load
    await page.waitForTimeout(3000);

    // Wait for View Deed link
    await page.waitForSelector('a:has-text("View Deed")', { timeout: 10000 });
    console.log('✅ Found View Deed link\n');

    // Get the deed URL
    const deedUrl = await page.getAttribute('a:has-text("View Deed")', 'href');
    console.log(`📄 Deed URL: ${deedUrl}\n`);

    // Click View Deed and wait for download
    console.log('🔽 Downloading deed PDF...\n');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('a:has-text("View Deed")')
    ]);

    // Save the download
    const downloadPath = '/tmp/davidson-deed.pdf';
    await download.saveAs(downloadPath);

    const stats = fs.statSync(downloadPath);

    console.log('✅ Download complete!');
    console.log(`   File: ${downloadPath}`);
    console.log(`   Size: ${stats.size} bytes\n`);

    // Verify it's a PDF
    const buffer = fs.readFileSync(downloadPath);
    const isPDF = buffer.toString('utf8', 0, 4) === '%PDF';

    console.log(`📋 File verification:`);
    console.log(`   Is PDF: ${isPDF}`);
    console.log(`   First 20 bytes: ${buffer.toString('hex', 0, 20)}\n`);

    if (isPDF) {
      console.log('🎉 SUCCESS! Deed PDF downloaded successfully!\n');
    } else {
      console.log('⚠️  Warning: Downloaded file may not be a valid PDF\n');
    }

    await page.screenshot({ path: '/tmp/davidson-download.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/davidson-download.png\n');

  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/davidson-download-error.png', fullPage: true });
  } finally {
    console.log('✅ Closing browser...');
    await browser.close();
  }
}

testDownloadDeed().catch(console.error);
