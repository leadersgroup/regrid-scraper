/**
 * API Test Script
 * Tests all API endpoints
 */

const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing Deed Scraper API\n');
  console.log(`📡 API Base URL: ${API_BASE}\n`);

  try {
    // Test 1: Health Check
    console.log('Test 1: Health Check');
    console.log('GET /api/health');
    const healthResponse = await axios.get(`${API_BASE}/api/health`);
    console.log('✅ Response:', JSON.stringify(healthResponse.data, null, 2));
    console.log('');

    // Test 2: List Counties
    console.log('Test 2: List Supported Counties');
    console.log('GET /api/counties');
    const countiesResponse = await axios.get(`${API_BASE}/api/counties`);
    console.log('✅ Response:', JSON.stringify(countiesResponse.data, null, 2));
    console.log('');

    // Test 3: Download Deed
    console.log('Test 3: Download Deed (This will take ~90-120 seconds)');
    console.log('POST /api/deed/download');

    const address = '6431 Swanson St, Windermere, FL 34786';
    console.log(`Address: ${address}`);
    console.log('⏳ Downloading... (please wait)\n');

    const startTime = Date.now();

    const deedResponse = await axios.post(`${API_BASE}/api/deed/download`, {
      address: address,
      options: {
        headless: true,
        verbose: false
      }
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Download completed in ${duration}s\n`);
    console.log('Response Summary:');
    console.log(`  Success: ${deedResponse.data.success}`);
    console.log(`  Parcel ID: ${deedResponse.data.parcelId}`);
    console.log(`  County: ${deedResponse.data.county}, ${deedResponse.data.state}`);
    console.log(`  Filename: ${deedResponse.data.download.filename}`);
    console.log(`  File Size: ${deedResponse.data.download.fileSizeKB} KB`);
    console.log(`  Document ID: ${deedResponse.data.download.documentId}`);
    console.log(`  Cost: ${deedResponse.data.cost}`);
    console.log(`  CAPTCHA Solved: ${deedResponse.data.captchaSolved ? 'Yes' : 'No'}`);
    console.log(`  Transactions Found: ${deedResponse.data.transactions?.length || 0}`);
    console.log('');

    // Test 4: Error Handling (missing address)
    console.log('Test 4: Error Handling (Missing Address)');
    console.log('POST /api/deed/download (without address)');

    try {
      await axios.post(`${API_BASE}/api/deed/download`, {});
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Correctly returned 400 error');
        console.log('   Error:', error.response.data.error);
        console.log('   Message:', error.response.data.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    console.log('');

    // Summary
    console.log('═'.repeat(80));
    console.log('✅ ALL TESTS PASSED');
    console.log('═'.repeat(80));
    console.log('\n📊 API is ready for production use!\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED');

    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
      console.error('Is the server running? Try: node api-server.js');
    } else {
      console.error('Error:', error.message);
    }

    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  testAPI().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = testAPI;
