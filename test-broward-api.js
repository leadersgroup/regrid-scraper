/**
 * Test API endpoint for Broward County FL
 * Test address: 1274 NE 40 STREET #4, OAKLAND PARK FL 33334
 */

const axios = require('axios');

async function testBrowardAPI() {
  console.log('🧪 Testing Broward County API endpoint...\n');

  const API_URL = 'http://localhost:3000/api/deed/download';

  const testData = {
    address: '1274 NE 40 STREET #4, OAKLAND PARK FL 33334',
    county: 'Broward',
    state: 'FL'
  };

  console.log('📍 Request data:', JSON.stringify(testData, null, 2));
  console.log(`🌐 POST ${API_URL}\n`);

  try {
    const response = await axios.post(API_URL, testData, {
      timeout: 180000 // 3 minutes
    });

    console.log('\n' + '='.repeat(80));
    console.log('📊 API RESPONSE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(response.data, null, 2));
    console.log('='.repeat(80) + '\n');

    if (response.data.success) {
      console.log('✅ SUCCESS: API returned successful response');
      if (response.data.download?.pdfBase64) {
        const pdfSize = Buffer.from(response.data.download.pdfBase64, 'base64').length;
        console.log(`📄 PDF Size: ${(pdfSize / 1024).toFixed(2)} KB`);
      }
    } else {
      console.log('❌ FAILED: API returned failure');
      console.log(`Error: ${response.data.error || response.data.message}`);
    }

  } catch (error) {
    console.error('\n❌ API REQUEST FAILED:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Run test
testBrowardAPI()
  .then(() => {
    console.log('\n✅ API test completed\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
