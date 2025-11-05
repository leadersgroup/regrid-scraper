/**
 * DeedCraft Base44 App Client
 *
 * App URL: https://deed-craft-copy-eb316d23.base44.app
 * API Key: c085f441e8ad46ac8d866dc03bc8512f
 *
 * ✅ Discovered endpoints (all exist but require correct auth):
 * - /api/scrapePriorDeed
 * - /api/functions/scrapePriorDeed
 * - /scrapePriorDeed
 * - /run/scrapePriorDeed
 */

const axios = require('axios');

class DeedCraftClient {
  constructor(apiKey = 'c085f441e8ad46ac8d866dc03bc8512f') {
    this.appUrl = 'https://deed-craft-copy-eb316d23.base44.app';
    this.apiKey = apiKey;
  }

  /**
   * Call scrapePriorDeed function
   */
  async scrapePriorDeed(params) {
    const { address, county, state } = params;

    console.log(`🔄 Calling DeedCraft scrapePriorDeed`);
    console.log(`   Address: ${address}`);
    console.log(`   County: ${county || 'N/A'}, State: ${state || 'N/A'}`);

    // Try primary endpoint first
    const endpoints = [
      '/api/scrapePriorDeed',
      '/scrapePriorDeed',
      '/run/scrapePriorDeed',
      '/api/functions/scrapePriorDeed'
    ];

    // Try different auth methods
    const authMethods = [
      { name: 'X-API-Key', headers: { 'X-API-Key': this.apiKey } },
      { name: 'Bearer', headers: { 'Authorization': `Bearer ${this.apiKey}` } },
      { name: 'X-Auth-Token', headers: { 'X-Auth-Token': this.apiKey } },
    ];

    for (const endpoint of endpoints) {
      for (const authMethod of authMethods) {
        try {
          const url = `${this.appUrl}${endpoint}`;
          console.log(`   Trying: ${endpoint} with ${authMethod.name}`);

          const response = await axios.post(url, {
            address,
            county,
            state
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...authMethod.headers
            },
            timeout: 180000
          });

          console.log(`✅ Success!`);
          return response.data;

        } catch (error) {
          if (error.response) {
            // Log non-401 errors as they might be interesting
            if (error.response.status !== 401) {
              console.log(`   ⚠️  ${error.response.status}: ${error.message}`);
              if (error.response.status === 400 || error.response.status === 422) {
                console.log(`   Response:`, error.response.data);
              }
            }
          }
          // Continue trying other combinations
        }
      }
    }

    throw new Error('All authentication methods failed. The API key might be invalid or require activation in the Base44 dashboard.');
  }

  /**
   * Simple test method
   */
  async test(address = '1637 NW 59TH ST, Miami, FL') {
    console.log('\n🧪 Testing DeedCraft API\n');

    try {
      const result = await this.scrapePriorDeed({
        address,
        county: 'Miami-Dade',
        state: 'FL'
      });

      console.log('\n✅ Test successful!');
      console.log('Result:', JSON.stringify(result, null, 2));
      return result;

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      console.log('\n💡 To fix authentication:');
      console.log('   1. Log into https://deed-craft-copy-eb316d23.base44.app');
      console.log('   2. Look for Settings or API keys section');
      console.log('   3. Generate or activate the API key');
      console.log('   4. Update the key in this client');
      throw error;
    }
  }
}

module.exports = DeedCraftClient;

// Run test if executed directly
if (require.main === module) {
  const client = new DeedCraftClient();

  client.test().catch(() => {
    console.log('\n📋 Endpoints discovered:');
    console.log('   ✅ https://deed-craft-copy-eb316d23.base44.app/api/scrapePriorDeed');
    console.log('   ✅ https://deed-craft-copy-eb316d23.base44.app/scrapePriorDeed');
    console.log('   ✅ https://deed-craft-copy-eb316d23.base44.app/run/scrapePriorDeed');
    console.log('\n   All endpoints exist but require valid authentication.');
    process.exit(1);
  });
}
