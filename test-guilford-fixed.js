/**
 * Test the fixed Guilford County implementation
 * This script tests the improvements:
 * 1. New tab handling for deed links
 * 2. Frame detection for deed content
 * 3. Network monitoring for dynamically loaded images
 */

const GuilfordCounty = require('./county-implementations/guilford-county-north-carolina');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testGuilfordFixed() {
  console.log('🧪 Testing Fixed Guilford County Implementation\n');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
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
      console.log('✅ SUCCESS - Deed information retrieved!');
      console.log(`\n📋 Property Details:`);
      console.log(`  Address: ${result.address}`);
      console.log(`  Parcel: ${result.parcelNumber || 'N/A'}`);
      console.log(`  Total Time: ${totalTime}s`);

      // Check if we got deed information
      if (result.deedInfo) {
        console.log(`\n📜 Deed Information:`);
        console.log(`  Deed Type: ${result.deedInfo.deedType || 'N/A'}`);
        console.log(`  Book: ${result.deedInfo.book || 'N/A'}`);
        console.log(`  Page: ${result.deedInfo.page || 'N/A'}`);
        console.log(`  Date: ${result.deedInfo.date || 'N/A'}`);
      }

      // Check if we got a PDF
      if (result.pdfBase64) {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const pdfSize = (pdfBuffer.length / 1024).toFixed(2);

        console.log(`\n📄 PDF Status:`);
        console.log(`  Size: ${pdfSize} KB`);

        // Check if it's a valid PDF
        const pdfSignature = pdfBuffer.toString('utf8', 0, 4);
        const firstChars = pdfBuffer.toString('utf8', 0, Math.min(200, pdfBuffer.length));

        if (pdfSignature === '%PDF') {
          console.log(`  Format: ✅ Valid PDF`);

          // Save the PDF for inspection
          const filename = `guilford-test-${Date.now()}.pdf`;
          fs.writeFileSync(filename, pdfBuffer);
          console.log(`  Saved as: ${filename}`);
        } else if (firstChars.includes('<html') || firstChars.includes('<!DOCTYPE')) {
          console.log(`  Format: ❌ HTML (not PDF)`);
          console.log(`  First 200 chars: ${firstChars}`);
        } else if (firstChars.includes('Error') || firstChars.includes('Notice')) {
          console.log(`  Format: ❌ Server Error`);
          console.log(`  Error content: ${firstChars}`);
        } else if (pdfBuffer.length < 1000) {
          console.log(`  Format: ❌ Too small (likely blank)`);
        } else {
          console.log(`  Format: ⚠️  Unknown (signature: ${pdfSignature})`);
        }
      } else {
        console.log(`\n📄 PDF Status: ❌ No PDF data`);
      }

      // Check timing information
      if (result.steps) {
        console.log(`\n⏱️  Performance Breakdown:`);
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

      console.log('\n' + '=' .repeat(60));
      console.log('🎉 TEST PASSED - Guilford County implementation is working!');
      console.log('=' .repeat(60));

    } else {
      console.log('❌ FAILED - Could not retrieve deed information');
      console.log(`  Error: ${result.error || 'Unknown error'}`);

      if (result.steps) {
        console.log(`\n📊 Debug Information:`);
        Object.keys(result.steps).forEach(step => {
          const stepData = result.steps[step];
          console.log(`  ${step}: ${stepData.success ? '✅' : '❌'} (${(stepData.duration / 1000).toFixed(2)}s)`);
          if (stepData.error) {
            console.log(`    Error: ${stepData.error}`);
          }
        });
      }

      console.log('\n' + '=' .repeat(60));
      console.log('❌ TEST FAILED - Please check the implementation');
      console.log('=' .repeat(60));
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n⏸️  Browser staying open for manual inspection...');
    console.log('Press Ctrl+C to close');

    // Keep browser open for inspection
    await new Promise(() => {});
  }
}

// Run the test
testGuilfordFixed().catch(console.error);