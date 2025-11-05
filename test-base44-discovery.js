/**
 * Base44 API Discovery Script
 *
 * This script attempts to discover the correct API format for Base44
 * by trying various endpoint patterns and authentication methods.
 */

const axios = require('axios');

const APP_ID = '68c355d9fe4a6373eb316d23';
const API_KEY = 'c085f441e8ad46ac8d866dc03bc8512f';

// Test data
const testData = {
  address: '1637 NW 59TH ST, Miami, FL',
  county: 'Miami-Dade',
  state: 'FL'
};

console.log('🔍 Base44 API Discovery');
console.log('='.repeat(70));
console.log(`App ID: ${APP_ID}`);
console.log(`API Key: ${API_KEY}`);
console.log('='.repeat(70));
console.log('');

// List of URL patterns to try
const urlPatterns = [
  // Standard REST API patterns
  `https://app.base44.com/api/apps/${APP_ID}/functions/scrapePriorDeed`,
  `https://app.base44.com/api/apps/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/api/v1/apps/${APP_ID}/functions/scrapePriorDeed`,

  // Run/execute patterns
  `https://app.base44.com/api/apps/${APP_ID}/run/scrapePriorDeed`,
  `https://app.base44.com/api/run/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/run/${APP_ID}/scrapePriorDeed`,

  // Direct function patterns
  `https://app.base44.com/api/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/${APP_ID}/functions/scrapePriorDeed`,

  // Invoke patterns
  `https://app.base44.com/api/apps/${APP_ID}/invoke/scrapePriorDeed`,
  `https://app.base44.com/api/invoke/${APP_ID}/scrapePriorDeed`,

  // Execute patterns
  `https://app.base44.com/api/apps/${APP_ID}/execute/scrapePriorDeed`,
  `https://app.base44.com/api/execute/${APP_ID}/scrapePriorDeed`,

  // Action patterns
  `https://app.base44.com/api/apps/${APP_ID}/actions/scrapePriorDeed`,
  `https://app.base44.com/api/actions/${APP_ID}/scrapePriorDeed`,

  // Public/shared patterns
  `https://app.base44.com/public/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/shared/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/api/public/${APP_ID}/scrapePriorDeed`,

  // Webhook patterns
  `https://app.base44.com/webhook/${APP_ID}/scrapePriorDeed`,
  `https://app.base44.com/hooks/${APP_ID}/scrapePriorDeed`,

  // With query parameters
  `https://app.base44.com/api/apps/${APP_ID}/scrapePriorDeed?apiKey=${API_KEY}`,
  `https://app.base44.com/${APP_ID}/scrapePriorDeed?key=${API_KEY}`,
];

// Authentication methods to try
const authMethods = [
  { name: 'No Auth', headers: {} },
  { name: 'X-API-Key', headers: { 'X-API-Key': API_KEY } },
  { name: 'Bearer Token', headers: { 'Authorization': `Bearer ${API_KEY}` } },
  { name: 'API Key Auth', headers: { 'Authorization': `ApiKey ${API_KEY}` } },
  { name: 'API Key Auth 2', headers: { 'Authorization': `API-Key ${API_KEY}` } },
  { name: 'Token Auth', headers: { 'Authorization': `Token ${API_KEY}` } },
  { name: 'X-Auth-Token', headers: { 'X-Auth-Token': API_KEY } },
  { name: 'X-API-Token', headers: { 'X-API-Token': API_KEY } },
  { name: 'api_key header', headers: { 'api_key': API_KEY } },
  { name: 'apikey header', headers: { 'apikey': API_KEY } },
];

async function testEndpoint(url, authMethod, method = 'POST') {
  try {
    const config = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...authMethod.headers
      },
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    };

    if (method === 'POST') {
      config.data = testData;
    }

    const response = await axios(config);

    return {
      success: response.status === 200 || response.status === 201,
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code
    };
  }
}

async function discoverAPI() {
  const results = [];
  let successCount = 0;
  let testCount = 0;

  // Try POST requests
  console.log('📋 Testing POST requests...\n');

  for (const url of urlPatterns) {
    for (const authMethod of authMethods) {
      testCount++;
      process.stdout.write(`\rTesting ${testCount}/${urlPatterns.length * authMethods.length}...`);

      const result = await testEndpoint(url, authMethod, 'POST');

      if (result.success || (result.status && result.status !== 404 && result.status !== 401)) {
        results.push({
          url,
          method: 'POST',
          auth: authMethod.name,
          ...result
        });

        if (result.success) {
          successCount++;
          console.log(`\n\n✅ SUCCESS! Found working endpoint:`);
          console.log(`   URL: ${url}`);
          console.log(`   Auth: ${authMethod.name}`);
          console.log(`   Status: ${result.status}`);
          console.log(`   Response:`, JSON.stringify(result.data, null, 2));
          console.log('');
        } else if (result.status === 403) {
          console.log(`\n\n⚠️  FOUND BUT FORBIDDEN (403):`);
          console.log(`   URL: ${url}`);
          console.log(`   Auth: ${authMethod.name}`);
          console.log(`   This endpoint exists but requires different auth`);
          console.log('');
        } else if (result.status === 400 || result.status === 422) {
          console.log(`\n\n⚠️  FOUND BUT BAD REQUEST (${result.status}):`);
          console.log(`   URL: ${url}`);
          console.log(`   Auth: ${authMethod.name}`);
          console.log(`   Response:`, JSON.stringify(result.data, null, 2));
          console.log('');
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n\n${'='.repeat(70)}`);
  console.log(`✨ Discovery Complete`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Tests run: ${testCount}`);
  console.log(`Successful connections: ${successCount}`);
  console.log(`Interesting responses: ${results.length}`);

  if (results.length > 0) {
    console.log('\n📊 All interesting responses:\n');
    results.forEach((result, i) => {
      console.log(`${i + 1}. ${result.method} ${result.url}`);
      console.log(`   Auth: ${result.auth}`);
      console.log(`   Status: ${result.status}`);
      if (result.data) {
        console.log(`   Data: ${JSON.stringify(result.data).substring(0, 200)}...`);
      }
      console.log('');
    });
  } else {
    console.log('\n❌ No working endpoints found');
    console.log('\n💡 Possible reasons:');
    console.log('   1. The app might not have a public API');
    console.log('   2. The API key might need to be exchanged for a JWT token');
    console.log('   3. The function might need to be deployed in Base44 first');
    console.log('   4. Base44 might use webhooks instead (call YOUR server)');
    console.log('\n📝 Recommendations:');
    console.log('   1. Check Base44 documentation for API format');
    console.log('   2. Log into Base44 dashboard and look for API docs');
    console.log('   3. Use the webhook server mode instead: node base44-webhook-server.js');
    console.log('   4. Contact Base44 support for API authentication details');
  }

  return results;
}

// Also try GET requests on base URLs
async function tryInfoEndpoints() {
  console.log('\n\n📋 Testing info/metadata endpoints...\n');

  const infoUrls = [
    `https://app.base44.com/api/apps/${APP_ID}`,
    `https://app.base44.com/api/apps/${APP_ID}/info`,
    `https://app.base44.com/api/apps/${APP_ID}/metadata`,
    `https://app.base44.com/api/apps/${APP_ID}/functions`,
    `https://app.base44.com/api/apps/${APP_ID}/schema`,
  ];

  for (const url of infoUrls) {
    for (const authMethod of authMethods.slice(0, 5)) { // Only try top 5 auth methods
      const result = await testEndpoint(url, authMethod, 'GET');

      if (result.success || (result.status && result.status !== 404 && result.status !== 401)) {
        console.log(`\n✅ Info endpoint found:`);
        console.log(`   URL: ${url}`);
        console.log(`   Auth: ${authMethod.name}`);
        console.log(`   Status: ${result.status}`);
        if (result.data) {
          console.log(`   Data:`, JSON.stringify(result.data, null, 2));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Run discovery
(async () => {
  try {
    await tryInfoEndpoints();
    await discoverAPI();
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
  }
})();
