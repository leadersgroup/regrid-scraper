/**
 * Test script for DeedCraft Base44 App
 *
 * App URL: https://deed-craft-copy-eb316d23.base44.app
 * API Key: c085f441e8ad46ac8d866dc03bc8512f
 */

const axios = require('axios');

const APP_URL = 'https://deed-craft-copy-eb316d23.base44.app';
const API_KEY = 'c085f441e8ad46ac8d866dc03bc8512f';

// Test data
const testData = {
  address: '1637 NW 59TH ST, Miami, FL',
  county: 'Miami-Dade',
  state: 'FL'
};

console.log('🧪 Testing DeedCraft Base44 App');
console.log('='.repeat(70));
console.log(`App URL: ${APP_URL}`);
console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
console.log('='.repeat(70));
console.log('');

// Common Base44 API endpoint patterns
const endpoints = [
  // API endpoints
  '/api/scrapePriorDeed',
  '/api/functions/scrapePriorDeed',
  '/api/run/scrapePriorDeed',
  '/api/execute/scrapePriorDeed',
  '/api/invoke/scrapePriorDeed',

  // Direct function paths
  '/scrapePriorDeed',
  '/functions/scrapePriorDeed',
  '/run/scrapePriorDeed',

  // Action paths
  '/actions/scrapePriorDeed',
  '/action/scrapePriorDeed',

  // Webhook paths
  '/webhook/scrapePriorDeed',
  '/webhooks/scrapePriorDeed',
  '/hook/scrapePriorDeed',
];

// Authentication methods
const authMethods = [
  {
    name: 'X-API-Key header',
    headers: { 'X-API-Key': API_KEY }
  },
  {
    name: 'Authorization Bearer',
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  },
  {
    name: 'X-Auth-Token',
    headers: { 'X-Auth-Token': API_KEY }
  },
  {
    name: 'No auth (public endpoint)',
    headers: {}
  }
];

async function testEndpoint(url, authMethod) {
  try {
    const response = await axios.post(url, testData, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authMethod.headers
      },
      timeout: 15000,
      validateStatus: () => true
    });

    return {
      status: response.status,
      success: response.status >= 200 && response.status < 300,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      status: null,
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

async function runTests() {
  console.log('📋 Testing API endpoints...\n');

  let foundWorking = false;

  for (const endpoint of endpoints) {
    for (const authMethod of authMethods) {
      const url = `${APP_URL}${endpoint}`;
      const result = await testEndpoint(url, authMethod);

      // Report interesting responses
      if (result.success) {
        console.log('✅ SUCCESS! Working endpoint found:');
        console.log(`   URL: ${url}`);
        console.log(`   Auth: ${authMethod.name}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Response:`, JSON.stringify(result.data, null, 2));
        console.log('');
        foundWorking = true;
      } else if (result.status === 400 || result.status === 422) {
        console.log('⚠️  Endpoint found but bad request:');
        console.log(`   URL: ${url}`);
        console.log(`   Auth: ${authMethod.name}`);
        console.log(`   Status: ${result.status}`);
        console.log(`   Response:`, JSON.stringify(result.data, null, 2));
        console.log('   💡 This endpoint exists but might need different data format');
        console.log('');
      } else if (result.status === 403) {
        console.log('⚠️  Endpoint found but forbidden:');
        console.log(`   URL: ${url}`);
        console.log(`   Auth: ${authMethod.name}`);
        console.log(`   Status: 403 Forbidden`);
        console.log('   💡 Try different authentication method');
        console.log('');
      } else if (result.status === 401) {
        console.log('⚠️  Endpoint found but unauthorized:');
        console.log(`   URL: ${url}`);
        console.log(`   Auth: ${authMethod.name}`);
        console.log(`   Status: 401 Unauthorized`);
        console.log('   💡 API key might be invalid or expired');
        console.log('');
      } else if (result.status === 405) {
        console.log('⚠️  Endpoint found but wrong method:');
        console.log(`   URL: ${url}`);
        console.log(`   Status: 405 Method Not Allowed`);
        console.log('   💡 This endpoint might require GET instead of POST');
        console.log('');
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log('='.repeat(70));

  if (!foundWorking) {
    console.log('❌ No working endpoints found');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Log into the Base44 app in your browser');
    console.log('   2. Open browser DevTools (F12)');
    console.log('   3. Go to Network tab');
    console.log('   4. Try using the scrapePriorDeed function in the UI');
    console.log('   5. Look at the Network tab to see what API endpoint is called');
    console.log('   6. Note the request URL, headers, and body format');
    console.log('');
    console.log('🔗 Alternative: Use webhook mode');
    console.log('   Run: node base44-webhook-server.js');
    console.log('   Then configure Base44 to call your webhook URL');
  }

  console.log('='.repeat(70));
}

// Also try to get app metadata
async function tryMetadata() {
  console.log('\n📋 Trying metadata endpoints...\n');

  const metaEndpoints = [
    '/',
    '/api',
    '/api/info',
    '/api/functions',
    '/api/schema',
    '/health',
    '/status'
  ];

  for (const endpoint of metaEndpoints) {
    const url = `${APP_URL}${endpoint}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'Accept': 'application/json',
          'X-API-Key': API_KEY
        },
        timeout: 5000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data) {
        console.log(`✅ Metadata found at: ${url}`);
        console.log(`   Status: ${response.status}`);
        console.log(`   Data:`, JSON.stringify(response.data, null, 2));
        console.log('');
      }
    } catch (error) {
      // Silently continue
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Run all tests
(async () => {
  try {
    await tryMetadata();
    await runTests();
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
  }
})();
