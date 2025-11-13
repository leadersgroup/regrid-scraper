/**
 * Test Guilford County Improved Puppeteer Implementation
 */

const GuilfordCounty = require('./county-implementations/guilford-county-north-carolina');
const fs = require('fs');

async function test() {
  console.log('🧪 Testing Guilford County with Improved Puppeteer\n');
  console.log('=' .repeat(60));

  // Valid Guilford County address for testing
  const testAddress = '1209 Glendale Dr, Greensboro, NC 27406';

  const scraper = new GuilfordCounty({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();
    console.log(`📍 Testing address: ${testAddress}\n`);

    const result = await scraper.getPriorDeed(testAddress);

    console.log('\n' + '=' .repeat(60));
    console.log('📊 FINAL RESULT:');
    console.log('=' .repeat(60));

    if (result.success) {
      console.log('✅ SUCCESS!');
      console.log(`\nAddress: ${result.address}`);
      console.log(`Parcel: ${result.steps.search?.parcelNumber || 'N/A'}`);
      console.log(`Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);

      if (result.pdfBase64) {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const pdfSize = (pdfBuffer.length / 1024).toFixed(2);
        console.log(`\nPDF Size: ${pdfSize} KB`);

        const pdfSignature = pdfBuffer.toString('utf8', 0, 4);
        if (pdfSignature === '%PDF') {
          console.log('PDF Format: ✅ Valid');

          const filename = `guilford-improved-${Date.now()}.pdf`;
          fs.writeFileSync(filename, pdfBuffer);
          console.log(`Saved as: ${filename}`);
        } else {
          console.log('PDF Format: ❌ Invalid');
          console.log(`First chars: ${pdfBuffer.toString('utf8', 0, 50)}`);
        }
      } else {
        console.log('\n❌ No PDF data received');
      }

      if (result.steps) {
        console.log('\n⏱️  Performance:');
        Object.keys(result.steps).forEach(step => {
          const stepData = result.steps[step];
          console.log(`  ${step}: ${stepData.success ? '✅' : '❌'} (${(stepData.duration / 1000).toFixed(2)}s)`);
        });
      }
    } else {
      console.log('❌ FAILED');
      console.log(`Error: ${result.error}`);

      if (result.steps) {
        console.log('\n📊 Step Results:');
        Object.keys(result.steps).forEach(step => {
          const stepData = result.steps[step];
          console.log(`  ${step}: ${stepData.success ? '✅' : '❌'}`);
          if (stepData.error) {
            console.log(`    Error: ${stepData.error}`);
          }
        });
      }
    }

    console.log('\n' + '=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n⏸️ Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');

    // Keep browser open
    await new Promise(() => {});
  }
}

test();
