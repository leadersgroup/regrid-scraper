/**
 * Test script to verify Guilford County session cookie fix
 * This tests that PHP session is properly preserved when opening deed viewer
 */

const GuilfordCounty = require('./county-implementations/guilford-county-north-carolina');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testGuilfordSessionFix() {
  console.log('🧪 Testing Guilford County Session Cookie Fix\n');
  console.log('=' .repeat(60));
  console.log('This test verifies that PHP session cookies are properly');
  console.log('preserved when opening deed documents in new tabs.');
  console.log('=' .repeat(60) + '\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser to observe behavior
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  try {
    // Test address
    const testAddress = '1205 Glendale Dr';
    console.log(`📍 Test Address: ${testAddress}`);
    console.log(`📍 County: Guilford County, North Carolina\n`);

    // Initialize the county scraper
    const guilford = new GuilfordCounty();

    // Start the scraping process
    console.log('🚀 Starting scraping process...\n');
    const startTime = Date.now();

    const result = await guilford.scrape({
      address: testAddress,
      browser: browser
    });

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS:');
    console.log('=' .repeat(60));

    if (result.success) {
      console.log('✅ SUCCESS - Deed information retrieved!\n');

      // Check for the specific PHP error
      let hasSessionError = false;
      let errorDetails = '';

      // Check if we got a PDF
      if (result.pdfBase64) {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const pdfSize = (pdfBuffer.length / 1024).toFixed(2);
        const firstChars = pdfBuffer.toString('utf8', 0, Math.min(500, pdfBuffer.length));

        // Check for PHP session error
        if (firstChars.includes('Undefined variable: tiffInfo')) {
          hasSessionError = true;
          errorDetails = 'PHP Error: Undefined variable: tiffInfo';
        } else if (firstChars.includes('Notice</b>') || firstChars.includes('Error</b>')) {
          hasSessionError = true;
          errorDetails = firstChars.substring(0, 200);
        }

        console.log(`📄 PDF Analysis:`);
        console.log(`  Size: ${pdfSize} KB`);

        if (hasSessionError) {
          console.log(`\n❌ SESSION ERROR DETECTED!`);
          console.log(`  ${errorDetails}`);
          console.log(`\n⚠️  The session cookie fix did NOT work properly.`);
          console.log(`  The PHP session is not being preserved.`);
        } else {
          // Check if it's a valid PDF
          const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

          if (pdfSignature === '%PDF') {
            console.log(`  Format: ✅ Valid PDF`);
            console.log(`\n🎉 SESSION FIX VERIFIED!`);
            console.log(`  ✅ No PHP session errors`);
            console.log(`  ✅ Session cookies properly preserved`);
            console.log(`  ✅ Deed document successfully retrieved`);

            // Save the PDF for inspection
            const filename = `guilford-session-test-${Date.now()}.pdf`;
            fs.writeFileSync(filename, pdfBuffer);
            console.log(`  ✅ PDF saved as: ${filename}`);
          } else if (firstChars.includes('<html') || firstChars.includes('<!DOCTYPE')) {
            console.log(`  Format: ⚠️  HTML (not PDF)`);
            console.log(`  Content preview: ${firstChars.substring(0, 200)}`);
            console.log(`\n⚠️  Received HTML instead of PDF`);
          } else if (pdfBuffer.length < 1000) {
            console.log(`  Format: ⚠️  Too small (likely blank)`);
            console.log(`\n⚠️  PDF appears to be blank or incomplete`);
          }
        }
      } else {
        console.log(`\n⚠️  No PDF data received`);
      }

      // Display timing
      console.log(`\n⏱️  Performance:`);
      console.log(`  Total Time: ${totalTime}s`);

      if (result.steps) {
        if (result.steps.search) {
          console.log(`  Property Search: ${(result.steps.search.duration / 1000).toFixed(2)}s`);
        }
        if (result.steps.deed) {
          console.log(`  Deed Retrieval: ${(result.steps.deed.duration / 1000).toFixed(2)}s`);
        }
        if (result.steps.download) {
          console.log(`  PDF Download: ${(result.steps.download.duration / 1000).toFixed(2)}s`);
        }
      }

      // Display cookie information
      console.log(`\n🍪 Session Cookie Status:`);
      if (result.cookieCount !== undefined) {
        console.log(`  Cookies captured: ${result.cookieCount}`);
        console.log(`  Session preserved: ${!hasSessionError ? '✅ Yes' : '❌ No'}`);
      } else {
        console.log(`  Unable to determine cookie status`);
      }

    } else {
      console.log('❌ FAILED - Could not retrieve deed information');
      console.log(`  Error: ${result.error || 'Unknown error'}`);

      if (result.error && result.error.includes('tiffInfo')) {
        console.log(`\n❌ SESSION ERROR: PHP session not preserved!`);
        console.log(`  The cookies are not being properly transferred to the new tab.`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    if (!hasSessionError) {
      console.log('✅ TEST PASSED - Session cookie fix is working!');
    } else {
      console.log('❌ TEST FAILED - Session cookies not properly preserved');
    }
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);

    if (error.message.includes('tiffInfo')) {
      console.error('\n⚠️  This is the PHP session error we\'re trying to fix!');
      console.error('  The session cookies are not being preserved properly.');
    }
  } finally {
    console.log('\n⏸️  Browser staying open for manual inspection...');
    console.log('You can manually check:');
    console.log('  1. Open Developer Tools (F12)');
    console.log('  2. Go to Application/Storage -> Cookies');
    console.log('  3. Look for PHPSESSID cookie');
    console.log('  4. Check if it exists in both tabs');
    console.log('\nPress Ctrl+C to close');

    // Keep browser open for inspection
    await new Promise(() => {});
  }
}

// Run the test
testGuilfordSessionFix().catch(console.error);