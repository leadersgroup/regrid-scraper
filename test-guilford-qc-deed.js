/**
 * Test script for Guilford County QC Deed download using direct approach
 * Based on user-provided code that:
 * 1. Fetches DeedDetails.aspx with PARCELPK
 * 2. Parses HTML to find QC DEED link
 * 3. Extracts book/page parameters
 * 4. Constructs direct PDF download URL
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testQcDeedDownload(parcelPk) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing QC Deed Download for Parcel: ${parcelPk}`);
  console.log('='.repeat(80));

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Step 1: Navigate to the deed details page
    const deedDetailsUrl = `https://lrcpwa.ncptscloud.com/guilford/DeedDetails.aspx?PARCELPK=${parcelPk}`;
    console.log(`\n📍 Step 1: Navigating to deed details page...`);
    console.log(`   URL: ${deedDetailsUrl}`);

    await page.goto(deedDetailsUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('   ✅ Page loaded');

    // Step 2: Find QC DEED link on the page
    console.log(`\n🔍 Step 2: Looking for QC DEED link...`);

    const deedInfo = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));

      // Look for any deed type link
      const deedLinks = [];

      for (const link of allLinks) {
        const text = link.textContent.trim();
        const href = link.href;

        // Look for deed-related links
        if (text && (
          text.includes('DEED') ||
          text.includes('QC') ||
          text.includes('WARRANTY') ||
          text.includes('CORR')
        ) && href && href.includes('gis_viewimage')) {
          deedLinks.push({
            text: text,
            href: href
          });
        }
      }

      return {
        found: deedLinks.length > 0,
        deeds: deedLinks
      };
    });

    if (!deedInfo.found) {
      console.log('   ❌ No deed links found on page');
      return null;
    }

    console.log(`   ✅ Found ${deedInfo.deeds.length} deed link(s):`);
    deedInfo.deeds.forEach((deed, i) => {
      console.log(`      ${i + 1}. ${deed.text}`);
      console.log(`         URL: ${deed.href}`);
    });

    // Step 3: Extract parameters from first deed link
    console.log(`\n📄 Step 3: Extracting deed parameters...`);
    const firstDeed = deedInfo.deeds[0];

    // Parse URL parameters
    const url = new URL(firstDeed.href);
    const bookCode = url.searchParams.get('bookcode') || 'r';
    const bookNum = url.searchParams.get('booknum');
    const bookPage = url.searchParams.get('bookpage');

    if (!bookNum || !bookPage) {
      console.log('   ❌ Could not extract book/page parameters');
      return null;
    }

    console.log(`   ✅ Extracted parameters:`);
    console.log(`      Book Code: ${bookCode}`);
    console.log(`      Book Number: ${bookNum}`);
    console.log(`      Book Page: ${bookPage}`);

    // Step 4: Construct the direct PDF download URL
    const pdfUrl = `https://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=${bookCode}&booknum=${bookNum}&bookpage=${bookPage}&export=pdf`;
    console.log(`\n📥 Step 4: Constructed PDF URL:`);
    console.log(`   ${pdfUrl}`);

    // Step 5: Download the PDF using fetch in browser context
    console.log(`\n💾 Step 5: Downloading PDF...`);

    const pdfData = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/pdf,*/*'
          }
        });

        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          };
        }

        const contentType = response.headers.get('content-type') || '';
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convert to base64
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }

        return {
          success: true,
          base64: btoa(binary),
          contentType: contentType,
          size: uint8Array.length
        };
      } catch (err) {
        return {
          success: false,
          error: err.message
        };
      }
    }, pdfUrl);

    if (!pdfData.success) {
      console.log(`   ❌ Download failed: ${pdfData.error}`);
      return null;
    }

    // Verify it's a PDF
    let buffer = Buffer.from(pdfData.base64, 'base64');
    const signature = buffer.toString('utf8', 0, 4);

    console.log(`   Content Type: ${pdfData.contentType}`);
    console.log(`   File Size: ${(pdfData.size / 1024).toFixed(2)} KB`);
    console.log(`   Signature: ${signature}`);

    // Handle case where PHP errors are prepended to the PDF
    if (signature !== '%PDF') {
      console.log(`   ⚠️  Signature doesn't match (expected %PDF, got ${signature})`);

      // Look for PDF signature in the first few KB
      const searchLimit = Math.min(buffer.length, 5000);
      const searchText = buffer.toString('utf8', 0, searchLimit);
      const pdfIndex = searchText.indexOf('%PDF');

      if (pdfIndex > 0) {
        console.log(`   ✅ Found PDF signature at byte ${pdfIndex} - stripping PHP errors`);
        // Strip everything before the PDF signature
        buffer = buffer.slice(pdfIndex);
        console.log(`   📄 Cleaned PDF size: ${(buffer.length / 1024).toFixed(2)} KB`);
      } else {
        console.log(`   ❌ No PDF signature found in first ${searchLimit} bytes`);
        const firstChars = buffer.toString('utf8', 0, 200);
        console.log(`   First 200 chars: ${firstChars}`);
        return null;
      }
    }

    console.log('   ✅ Valid PDF downloaded!');

    // Save to file
    const filename = `guilford_deed_${bookNum}_${bookPage}_${Date.now()}.pdf`;
    const filepath = `/Users/ll/Documents/regrid-scraper/${filename}`;
    fs.writeFileSync(filepath, buffer);
    console.log(`   📁 Saved to: ${filename}`);

    return {
      success: true,
      filename: filename,
      filepath: filepath,
      size: buffer.length,
      bookNum: bookNum,
      bookPage: bookPage,
      deedType: firstDeed.text
    };

  } catch (error) {
    console.log(`\n❌ Error: ${error.message}`);
    console.log(error.stack);
    return null;
  } finally {
    await browser.close();
  }
}

// Test with parcel PK 60314 (from user's example)
(async () => {
  console.log('Starting Guilford County QC Deed Download Test\n');

  // You can test with different parcel PKs
  const testCases = [
    60314,  // User's example
    60312,  // From previous test (1205 Glendale Dr)
  ];

  for (const parcelPk of testCases) {
    const result = await testQcDeedDownload(parcelPk);

    if (result) {
      console.log(`\n${'='.repeat(80)}`);
      console.log('✅ SUCCESS!');
      console.log(`   Deed Type: ${result.deedType}`);
      console.log(`   Book: ${result.bookNum}, Page: ${result.bookPage}`);
      console.log(`   File: ${result.filename}`);
      console.log(`   Size: ${(result.size / 1024).toFixed(2)} KB`);
      console.log('='.repeat(80));
    } else {
      console.log(`\n${'='.repeat(80)}`);
      console.log('❌ FAILED');
      console.log('='.repeat(80));
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ All tests completed!');
})();
