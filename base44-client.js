/**
 * Base44 API Client for controlling the scrapePriorDeed function
 *
 * This client allows you to trigger and control the deed scraper
 * through the Base44 app platform.
 */

const axios = require('axios');

class Base44Client {
  constructor(config) {
    this.appId = config.appId;
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://app.base44.com/api';
  }

  /**
   * Call the scrapePriorDeed function via Base44
   * @param {Object} params - Scraping parameters
   * @param {string} params.address - Property address
   * @param {string} params.county - County name
   * @param {string} params.state - State code
   * @returns {Promise<Object>} - Scraping results
   */
  async scrapePriorDeed(params) {
    // Try multiple authentication methods
    const authMethods = [
      // Method 1: API Key in custom header
      {
        name: 'X-API-Key header',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      },
      // Method 2: Bearer token (even though it's not JWT, some APIs accept it)
      {
        name: 'Bearer token',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      },
      // Method 3: API Key in Authorization header
      {
        name: 'API Key in Authorization',
        headers: {
          'Authorization': `ApiKey ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      },
      // Method 4: Multiple headers
      {
        name: 'Multiple headers',
        headers: {
          'X-API-Key': this.apiKey,
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    ];

    const url = `${this.baseUrl}/apps/${this.appId}/functions/scrapePriorDeed`;
    console.log(`🔄 Calling Base44 API: ${url}`);
    console.log(`📋 Parameters:`, JSON.stringify(params, null, 2));

    for (const method of authMethods) {
      try {
        console.log(`   Trying authentication method: ${method.name}`);
        const response = await axios.post(url, params, {
          headers: method.headers,
          timeout: 180000 // 3 minutes timeout
        });

        console.log(`✅ Success with ${method.name}!`);
        console.log(`   Status:`, response.status);
        return response.data;
      } catch (error) {
        console.log(`   ❌ ${method.name} failed: ${error.message}`);
        if (error.response && error.response.status !== 401) {
          // If it's not an auth error, throw it
          console.error(`   Status: ${error.response.status}`);
          console.error(`   Data:`, error.response.data);
          throw error;
        }
        // Continue to next method
      }
    }

    // All methods failed
    throw new Error('All authentication methods failed. Base44 may require a JWT token. Please check the Base44 dashboard for the correct authentication method.');
  }

  /**
   * Alternative: Call via direct HTTP trigger
   * Some Base44 apps expose functions as HTTP endpoints
   */
  async scrapePriorDeedDirect(params) {
    try {
      // Try different possible URL patterns
      const possibleUrls = [
        `${this.baseUrl}/apps/${this.appId}/scrapePriorDeed`,
        `${this.baseUrl}/apps/${this.appId}/run/scrapePriorDeed`,
        `https://app.base44.com/run/${this.appId}/scrapePriorDeed`,
        `https://app.base44.com/api/run/${this.appId}/scrapePriorDeed`
      ];

      for (const url of possibleUrls) {
        try {
          console.log(`🔄 Trying URL: ${url}`);
          const response = await axios.post(url, params, {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey
            },
            timeout: 180000
          });

          console.log(`✅ Success with URL: ${url}`);
          return response.data;
        } catch (error) {
          console.log(`   ❌ Failed: ${error.message}`);
          continue;
        }
      }

      throw new Error('All URL patterns failed');
    } catch (error) {
      console.error(`❌ All Base44 API attempts failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get app info from Base44
   */
  async getAppInfo() {
    try {
      const url = `${this.baseUrl}/apps/${this.appId}`;
      console.log(`🔄 Fetching app info from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey
        }
      });

      console.log(`✅ App info retrieved`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to get app info:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
        console.error(`   Data:`, error.response.data);
      }
      throw error;
    }
  }

  /**
   * List available functions in the app
   */
  async listFunctions() {
    try {
      const url = `${this.baseUrl}/apps/${this.appId}/functions`;
      console.log(`🔄 Listing functions from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-API-Key': this.apiKey
        }
      });

      console.log(`✅ Functions retrieved`);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to list functions:`, error.message);
      if (error.response) {
        console.error(`   Status: ${error.response.status}`);
      }
      throw error;
    }
  }
}

module.exports = Base44Client;

// Example usage if run directly
if (require.main === module) {
  const client = new Base44Client({
    appId: '68c355d9fe4a6373eb316d23',
    apiKey: 'c085f441e8ad46ac8d866dc03bc8512f'
  });

  // Test with a sample address
  const testParams = {
    address: '1637 NW 59TH ST, Miami, FL',
    county: 'Miami-Dade',
    state: 'FL'
  };

  (async () => {
    try {
      console.log('\n🧪 Testing Base44 Integration\n');
      console.log('='.repeat(50));

      // Try to get app info first
      console.log('\n1️⃣ Getting app info...\n');
      try {
        const appInfo = await client.getAppInfo();
        console.log('App Info:', JSON.stringify(appInfo, null, 2));
      } catch (error) {
        console.log('Could not retrieve app info (might not be supported)');
      }

      // Try to list functions
      console.log('\n2️⃣ Listing functions...\n');
      try {
        const functions = await client.listFunctions();
        console.log('Functions:', JSON.stringify(functions, null, 2));
      } catch (error) {
        console.log('Could not list functions (might not be supported)');
      }

      // Try to call scrapePriorDeed
      console.log('\n3️⃣ Calling scrapePriorDeed function...\n');
      const result = await client.scrapePriorDeed(testParams);
      console.log('\n✅ Success!');
      console.log('Result:', JSON.stringify(result, null, 2));

    } catch (error) {
      console.error('\n❌ Test failed:', error.message);

      // Try the direct method as fallback
      console.log('\n4️⃣ Trying direct HTTP trigger method...\n');
      try {
        const result = await client.scrapePriorDeedDirect(testParams);
        console.log('\n✅ Success with direct method!');
        console.log('Result:', JSON.stringify(result, null, 2));
      } catch (directError) {
        console.error('\n❌ Direct method also failed:', directError.message);
      }
    }
  })();
}
