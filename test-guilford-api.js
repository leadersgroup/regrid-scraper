/**
 * Test Guilford County API endpoint
 *
 * This script tests the /api/getPriorDeed endpoint for Guilford County
 *
 * Usage:
 *   1. Start the API server: node api-server.js
 *   2. Run this test: node test-guilford-api.js
 */

const axios = require('axios');

async function testGuilfordCountyAPI() {
  console.log('🧪 Testing Guilford County API Endpoint\n');

  const API_URL = 'http://localhost:3000/api/getPriorDeed';

  const testRequest = {
    address: '1205 Glendale Dr',
    county: 'Guilford',
    state: 'NC'
  };

  console.log('📤 Sending request:');
  console.log(JSON.stringify(testRequest, null, 2));
  console.log('\n⏳ Waiting for response...\n');

  const startTime = Date.now();

  try {
    const response = await axios.post(API_URL, testRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 3 minutes
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = response.data;

    console.log('\n📊 RESPONSE:');
    console.log('============================================');
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Success: ${data.success}`);
    console.log(`Duration: ${duration}s`);

    if (data.success) {
      console.log('\n✅ Deed Downloaded Successfully!');
      console.log(`Address: ${data.address}`);
      console.log(`Timestamp: ${data.timestamp}`);

      // Step details
      if (data.steps) {
        console.log('\n📋 Step Details:');

        if (data.steps.search) {
          console.log(`  Search: ${data.steps.search.success ? '✅' : '❌'} (${(data.steps.search.duration / 1000).toFixed(1)}s)`);
          if (data.steps.search.parcelNumber) {
            console.log(`    Parcel: ${data.steps.search.parcelNumber}`);
          }
        }

        if (data.steps.deed) {
          console.log(`  Deed Info: ${data.steps.deed.success ? '✅' : '❌'} (${(data.steps.deed.duration / 1000).toFixed(1)}s)`);
        }

        if (data.steps.download) {
          console.log(`  Download: ${data.steps.download.success ? '✅' : '❌'} (${(data.steps.download.duration / 1000).toFixed(1)}s)`);
          console.log(`    File Size: ${(data.steps.download.fileSize / 1024).toFixed(2)} KB`);
        }
      }

      // PDF info
      if (data.pdfBase64) {
        const pdfSize = Buffer.from(data.pdfBase64, 'base64').length;
        console.log(`\n📄 PDF Information:`);
        console.log(`  Filename: ${data.filename}`);
        console.log(`  Size: ${(pdfSize / 1024).toFixed(2)} KB`);
        console.log(`  Base64 Length: ${data.pdfBase64.length} chars`);

        // Verify PDF signature
        const pdfBuffer = Buffer.from(data.pdfBase64, 'base64');
        const signature = pdfBuffer.toString('utf8', 0, 4);
        console.log(`  Signature: ${signature === '%PDF' ? '✅ Valid PDF' : '❌ Invalid'}`);
      }

      console.log(`\n⏱️  Total Duration: ${data.totalDuration ? (data.totalDuration / 1000).toFixed(1) + 's' : duration + 's'}`);

    } else {
      console.log(`\n❌ Request Failed`);
      console.log(`Error: ${data.error}`);
      if (data.message) {
        console.log(`Message: ${data.message}`);
      }
    }

    console.log('\n============================================');

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.error('\n❌ API Request Failed');
    console.error('============================================');
    console.error(`Duration: ${duration}s`);

    if (error.response) {
      // Server responded with error status
      console.error(`Status: ${error.response.status} ${error.response.statusText}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.error('No response received from server');
      console.error('Is the API server running? (node api-server.js)');
    } else {
      // Error setting up request
      console.error('Error:', error.message);
    }

    console.error('============================================');
  }
}

// Run the test
console.log('Starting Guilford County API test...\n');
testGuilfordCountyAPI().catch(console.error);
