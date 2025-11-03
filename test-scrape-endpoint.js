/**
 * Test /api/scrape endpoint locally
 */

const axios = require('axios');

async function testScrapeEndpoint() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING /api/scrape ENDPOINT');
  console.log('='.repeat(80) + '\n');

  const testAddress = '13109 Tollcross Way, Winter Garden, FL 34787';

  try {
    console.log(`📥 Sending request for: ${testAddress}`);
    console.log('URL: http://localhost:3000/api/scrape');

    const response = await axios.post('http://localhost:3000/api/scrape', {
      addresses: [testAddress]
    });

    console.log('\n' + '='.repeat(80));
    console.log('📊 RESPONSE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(response.data, null, 2));
    console.log('='.repeat(80) + '\n');

    if (response.data.success) {
      console.log('✅ SUCCESS!');
      console.log(`   Addresses processed: ${response.data.summary.total}`);
      console.log(`   Successful: ${response.data.summary.successful}`);
      console.log(`   Failed: ${response.data.summary.failed}`);

      if (response.data.data.length > 0) {
        const result = response.data.data[0];
        console.log(`\n   Parcel ID: ${result.parcelId}`);
        console.log(`   Owner: ${result.ownerName || 'Not found'}`);
        console.log(`   County: ${result.county || 'Not found'}`);
        console.log(`   State: ${result.state || 'Not found'}`);
      }
    } else {
      console.log('❌ FAILED!');
      console.log(`   Error: ${response.data.error}`);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.response?.data || error.message);
    process.exit(1);
  }
}

testScrapeEndpoint();
