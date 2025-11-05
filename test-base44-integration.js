/**
 * Test script for Base44 Integration
 *
 * This script tests the connection and functionality of the Base44 API
 * for controlling the scrapePriorDeed function.
 */

const Base44Client = require('./base44-client');

// Configuration
const BASE44_CONFIG = {
  appId: '68c355d9fe4a6373eb316d23',
  apiKey: 'c085f441e8ad46ac8d866dc03bc8512f'
};

// Test cases
const TEST_ADDRESSES = [
  {
    name: 'Miami-Dade Test',
    address: '1637 NW 59TH ST, Miami, FL',
    county: 'Miami-Dade',
    state: 'FL'
  },
  {
    name: 'Orange County Test',
    address: '123 Main St, Orlando, FL',
    county: 'Orange',
    state: 'FL'
  },
  {
    name: 'Hillsborough County Test',
    address: '456 Oak Ave, Tampa, FL',
    county: 'Hillsborough',
    state: 'FL'
  }
];

async function testBase44Connection() {
  console.log('🧪 Base44 Integration Test Suite');
  console.log('='.repeat(60));
  console.log(`App ID: ${BASE44_CONFIG.appId}`);
  console.log(`API Key: ${BASE44_CONFIG.apiKey.substring(0, 8)}...`);
  console.log('='.repeat(60));

  const client = new Base44Client(BASE44_CONFIG);

  // Test 1: Get app info
  console.log('\n📋 Test 1: Get App Info');
  console.log('-'.repeat(60));
  try {
    const appInfo = await client.getAppInfo();
    console.log('✅ App info retrieved successfully');
    console.log(JSON.stringify(appInfo, null, 2));
  } catch (error) {
    console.log('⚠️  Could not retrieve app info:', error.message);
    console.log('   This might be normal if the endpoint requires different auth');
  }

  // Test 2: List functions
  console.log('\n📋 Test 2: List Available Functions');
  console.log('-'.repeat(60));
  try {
    const functions = await client.listFunctions();
    console.log('✅ Functions listed successfully');
    console.log(JSON.stringify(functions, null, 2));
  } catch (error) {
    console.log('⚠️  Could not list functions:', error.message);
    console.log('   This might be normal if the endpoint requires different auth');
  }

  // Test 3: Call scrapePriorDeed function
  console.log('\n📋 Test 3: Call scrapePriorDeed Function');
  console.log('-'.repeat(60));

  // Use just the first test address
  const testCase = TEST_ADDRESSES[0];
  console.log(`Test: ${testCase.name}`);
  console.log(`Address: ${testCase.address}`);
  console.log(`County: ${testCase.county}, State: ${testCase.state}`);
  console.log('');

  try {
    const startTime = Date.now();
    const result = await client.scrapePriorDeed({
      address: testCase.address,
      county: testCase.county,
      state: testCase.state
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Deed scraping completed in ${duration}s`);
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n🎉 SUCCESS! The deed was scraped successfully.');
      if (result.data && result.data.pdfUrl) {
        console.log(`📄 PDF URL: ${result.data.pdfUrl}`);
      }
    } else {
      console.log('\n⚠️  Scraping completed but was not successful');
      console.log(`Reason: ${result.error || result.message || 'Unknown'}`);
    }

  } catch (error) {
    console.log('❌ Primary method failed:', error.message);

    // Try fallback method
    console.log('\n📋 Test 4: Trying Direct HTTP Trigger Method');
    console.log('-'.repeat(60));
    try {
      const startTime = Date.now();
      const result = await client.scrapePriorDeedDirect({
        address: testCase.address,
        county: testCase.county,
        state: testCase.state
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Deed scraping completed in ${duration}s (direct method)`);
      console.log('\nResult:');
      console.log(JSON.stringify(result, null, 2));

    } catch (directError) {
      console.log('❌ Direct method also failed:', directError.message);
      console.log('\n💡 Suggestions:');
      console.log('   1. Verify the API key is correct');
      console.log('   2. Check if the app ID is correct');
      console.log('   3. Ensure the Base44 app has the scrapePriorDeed function deployed');
      console.log('   4. Check Base44 documentation for correct API endpoint format');
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Test suite completed');
  console.log('='.repeat(60));
}

// Run tests
if (require.main === module) {
  testBase44Connection().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { testBase44Connection };
