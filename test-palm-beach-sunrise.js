/**
 * Test Palm Beach County scraper with 100 Sunrise Ave #513, Palm Beach, FL
 */

const PalmBeachCountyFloridaScraper = require('./county-implementations/palm-beach-county-florida');

async function test() {
  console.log('Testing Palm Beach County with: 100 Sunrise Ave #513, Palm Beach, FL\n');
  
  const scraper = new PalmBeachCountyFloridaScraper({
    headless: false,
    timeout: 120000,
    verbose: true
  });

  try {
    await scraper.initialize();
    console.log('✅ Scraper initialized\n');
    
    const result = await scraper.getPriorDeed('100 Sunrise Ave #513, Palm Beach, FL 33480, USA');
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL RESULT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(80) + '\n');
    
    if (result.success) {
      console.log('✅ SUCCESS: Deed downloaded successfully!');
      if (result.download?.filename) {
        console.log(`📄 File: ${result.download.filename}`);
        console.log(`📏 Size: ${(result.download.fileSize / 1024).toFixed(2)} KB`);
      }
    } else {
      console.log('❌ FAILED: Could not download deed');
      console.log(`Error: ${result.error || result.message}`);
    }
    
    await scraper.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await scraper.close();
    process.exit(1);
  }
}

test();
