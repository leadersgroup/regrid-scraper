/**
 * Headless test for Guilford County Improved Implementation
 */

const GuilfordCounty = require('./county-implementations/guilford-county-north-carolina');
const fs = require('fs');

async function test() {
  console.log('🧪 Testing Guilford County (Headless Mode)\n');
  console.log('=' .repeat(60));

  const testAddress = '1209 Glendale Dr, Greensboro, NC 27406';

  const scraper = new GuilfordCounty({
    headless: true,  // Run headless for automated testing
    verbose: true
  });

  try {
    console.log(`📍 Test Address: ${testAddress}\n`);
    console.log('🚀 Starting scraper...\n');

    const startTime = Date.now();
    await scraper.initialize();

    const result = await scraper.getPriorDeed(testAddress);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 TEST RESULTS');
    console.log('=' .repeat(60));

    if (result.success) {
      console.log('✅ SUCCESS!\n');
      console.log(`Address: ${result.address}`);
      console.log(`Parcel: ${result.steps?.search?.parcelNumber || 'N/A'}`);
      console.log(`Total Time: ${totalTime}s`);

      // Check PDF
      if (result.pdfBase64) {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const pdfSize = (pdfBuffer.length / 1024).toFixed(2);
        const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

        console.log(`\n📄 PDF Information:`);
        console.log(`  Size: ${pdfSize} KB`);
        console.log(`  Format: ${pdfSignature === '%PDF' ? '✅ Valid PDF' : '❌ Invalid'}`);

        if (pdfSignature === '%PDF') {
          const filename = `guilford-test-${Date.now()}.pdf`;
          fs.writeFileSync(filename, pdfBuffer);
          console.log(`  Saved: ${filename}`);
        } else {
          console.log(`  First bytes: ${pdfBuffer.toString('utf8', 0, 100)}`);
        }
      } else {
        console.log('\n❌ No PDF data received');
      }

      // Performance breakdown
      if (result.steps) {
        console.log(`\n⏱️  Performance Breakdown:`);
        for (const [step, data] of Object.entries(result.steps)) {
          const status = data.success ? '✅' : '❌';
          const duration = (data.duration / 1000).toFixed(2);
          console.log(`  ${step}: ${status} ${duration}s`);
          if (data.error) {
            console.log(`    Error: ${data.error}`);
          }
        }
      }

      console.log('\n' + '=' .repeat(60));
      console.log('🎉 TEST PASSED');
      console.log('=' .repeat(60));

    } else {
      console.log('❌ TEST FAILED\n');
      console.log(`Error: ${result.error}`);

      if (result.steps) {
        console.log(`\n📊 Step Results:`);
        for (const [step, data] of Object.entries(result.steps)) {
          const status = data.success ? '✅' : '❌';
          const duration = (data.duration / 1000).toFixed(2);
          console.log(`  ${step}: ${status} ${duration}s`);
          if (data.error) {
            console.log(`    Error: ${data.error}`);
          }
        }
      }

      console.log('\n' + '=' .repeat(60));
      console.log('❌ TEST FAILED');
      console.log('=' .repeat(60));
    }

  } catch (error) {
    console.error('\n💥 Test crashed with error:');
    console.error(`Message: ${error.message}`);
    console.error(`\nStack trace:`);
    console.error(error.stack);
  } finally {
    try {
      await scraper.close();
      console.log('\n✅ Browser closed');
    } catch (e) {
      console.log('\n⚠️  Error closing browser:', e.message);
    }
  }
}

// Run test
test().catch(console.error);
