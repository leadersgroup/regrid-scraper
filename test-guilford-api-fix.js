/**
 * Test Guilford County implementation with API server
 * Tests the fixed PDF download functionality
 */

const axios = require('axios');

async function testGuilfordAPI() {
  console.log('🧪 Testing Guilford County API with fixed PDF download...\n');

  const testAddress = '1205 Glendale Dr';
  const apiUrl = 'http://localhost:3000/api/prior-deed'; // Adjust port if needed

  try {
    console.log(`📍 Testing address: ${testAddress}`);
    console.log(`🌐 API URL: ${apiUrl}\n`);

    console.log('📡 Sending request to API...');
    const response = await axios.post(apiUrl, {
      address: testAddress,
      county: 'Guilford County',
      state: 'North Carolina'
    }, {
      timeout: 120000 // 2 minute timeout
    });

    console.log('\n✅ API Response received!');

    const data = response.data;

    // Check response structure
    console.log('\n📊 Response Analysis:');
    console.log(`  Success: ${data.success}`);

    if (data.success) {
      console.log(`  Address: ${data.address}`);
      console.log(`  Parcel Number: ${data.steps?.search?.parcelNumber || 'N/A'}`);

      // Check PDF data
      if (data.pdfBase64) {
        const pdfSize = Buffer.from(data.pdfBase64, 'base64').length;
        console.log(`  PDF Size: ${(pdfSize / 1024).toFixed(2)} KB`);

        // Check if it's actually a PDF (not HTML error)
        const pdfBuffer = Buffer.from(data.pdfBase64, 'base64');
        const pdfSignature = pdfBuffer.toString('utf8', 0, 4);
        const firstChars = pdfBuffer.toString('utf8', 0, Math.min(100, pdfBuffer.length));

        if (pdfSignature === '%PDF') {
          console.log('  ✅ Valid PDF format detected');
        } else if (firstChars.includes('<html') || firstChars.includes('<!DOCTYPE') || firstChars.includes('<br')) {
          console.log('  ❌ WARNING: HTML content detected instead of PDF');
          console.log(`  First 100 chars: ${firstChars}`);
        } else {
          console.log(`  ⚠️  Unknown format (signature: ${pdfSignature.substring(0, 4)})`);
        }
      } else {
        console.log('  ❌ No PDF data in response');
      }

      // Timing information
      if (data.steps) {
        console.log('\n⏱️  Timing:');
        console.log(`  Search: ${(data.steps.search?.duration / 1000).toFixed(2)}s`);
        console.log(`  Deed: ${(data.steps.deed?.duration / 1000).toFixed(2)}s`);
        console.log(`  Download: ${(data.steps.download?.duration / 1000).toFixed(2)}s`);

        const totalTime = (data.steps.search?.duration || 0) +
                         (data.steps.deed?.duration || 0) +
                         (data.steps.download?.duration || 0);
        console.log(`  Total: ${(totalTime / 1000).toFixed(2)}s`);
      }

      console.log('\n✅ Test PASSED - Guilford County implementation is working!');

    } else {
      console.log(`  Error: ${data.error || 'Unknown error'}`);
      console.log('\n❌ Test FAILED - API returned error');
    }

  } catch (error) {
    console.error('\n❌ Test FAILED with error:');
    if (error.response) {
      console.error(`  Status: ${error.response.status}`);
      console.error(`  Message: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      console.error('  No response from server. Is the API server running?');
      console.error('  Start the server with: npm start');
    } else {
      console.error(`  Error: ${error.message}`);
    }
  }
}

// Run the test
testGuilfordAPI();