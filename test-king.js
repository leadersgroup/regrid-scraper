/**
 * Test script for King County, Washington Scraper
 */

const KingCountyWashingtonScraper = require('./county-implementations/king-county-washington');
const fs = require('fs');

async function testKingCounty(address) {
  console.log('🧪 Testing King County, Washington Scraper\n');

  const scraper = new KingCountyWashingtonScraper({
    headless: false,
    verbose: true
  });

  try {
    // Initialize browser
    await scraper.initialize();
    console.log(`Testing address: ${address}\n`);

    // Run the scraper
    const result = await scraper.getPriorDeed(address);

    // Display results
    console.log('\n📊 RESULTS:');
    console.log('='.repeat(44));
    console.log(`Success: ${result.success}`);
    console.log(`Address: ${result.address}`);
    console.log(`Timestamp: ${result.timestamp}`);

    if (result.success) {
      console.log(`\n✅ PDF Downloaded Successfully!`);
      console.log(`Filename: ${result.filename}`);
      console.log(`File Size: ${(result.fileSize / 1024).toFixed(2)} KB`);
      console.log(`Total Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);

      // Save PDF to file
      if (result.pdfBase64) {
        const pdfBuffer = Buffer.from(result.pdfBase64, 'base64');
        const filename = `king_test_${Date.now()}.pdf`;
        fs.writeFileSync(filename, pdfBuffer);
        console.log(`\n💾 PDF saved to: ${filename}`);
      }

      console.log(`\n📋 Step Details:`);
      if (result.steps.search) {
        console.log(`  Search: ${result.steps.search.success ? '✅' : '❌'} (${(result.steps.search.duration / 1000).toFixed(1)}s)`);
      }
      if (result.steps.recording) {
        console.log(`  Recording: ${result.steps.recording.success ? '✅' : '❌'} (${(result.steps.recording.duration / 1000).toFixed(1)}s)`);
        if (result.steps.recording.recordingNumber) {
          console.log(`    Recording Number: ${result.steps.recording.recordingNumber}`);
        }
      }
      if (result.steps.download) {
        console.log(`  Download: ${result.steps.download.success ? '✅' : '❌'} (${(result.steps.download.duration / 1000).toFixed(1)}s)`);
      }
    } else {
      console.log(`\n❌ Failed: ${result.error}`);
    }

    console.log('='.repeat(44));

    // Close browser
    console.log('🔒 Browser closed');
    await scraper.close();

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);

    try {
      await scraper.close();
    } catch (closeError) {
      // Ignore close errors
    }
  }

  console.log('\n✅ Browser closed');
}

// Get address from command line or use default
const address = process.argv[2] || '7550 41ST';

testKingCounty(address);
