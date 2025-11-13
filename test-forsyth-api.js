/**
 * API Endpoint Test for Forsyth County, NC
 *
 * Tests all API endpoints to ensure Forsyth County is properly configured
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_ADDRESS = '3170 Butterfield Dr';

async function testHealthEndpoint() {
  console.log('\n1️⃣  Testing /api/health endpoint...');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(`${API_BASE_URL}/api/health`);
    console.log('✅ Health check passed');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testCountiesEndpoint() {
  console.log('\n2️⃣  Testing /api/counties endpoint...');
  console.log('='.repeat(50));

  try {
    const response = await axios.get(`${API_BASE_URL}/api/counties`);
    const counties = response.data.counties;

    // Find Forsyth County in the list
    const forsythCounty = counties.find(c =>
      c.name === 'Forsyth County' && c.state === 'NC'
    );

    if (forsythCounty) {
      console.log('✅ Forsyth County found in supported counties list');
      console.log('\nForsyth County Configuration:');
      console.log('  Name:', forsythCounty.name);
      console.log('  State:', forsythCounty.state);
      console.log('  State Code:', forsythCounty.stateCode);
      console.log('  Features:', forsythCounty.features);
      console.log('  Cost:', forsythCounty.cost);
      return true;
    } else {
      console.error('❌ Forsyth County NOT found in supported counties list');
      return false;
    }
  } catch (error) {
    console.error('❌ Counties endpoint failed:', error.message);
    return false;
  }
}

async function testDeedDownloadEndpoint() {
  console.log('\n3️⃣  Testing /api/getPriorDeed endpoint for Forsyth County...');
  console.log('='.repeat(50));

  try {
    console.log(`\nRequest Details:`);
    console.log(`  Address: ${TEST_ADDRESS}`);
    console.log(`  County: Forsyth`);
    console.log(`  State: NC`);

    // Check if 2Captcha token is configured
    const has2CaptchaToken = !!process.env.TWOCAPTCHA_TOKEN;
    console.log(`  2Captcha Token: ${has2CaptchaToken ? '✅ Configured' : '❌ Not configured'}`);

    if (!has2CaptchaToken) {
      console.log('\n⚠️  Note: Without TWOCAPTCHA_TOKEN, the API will return a 503 error');
      console.log('     This is expected behavior for counties requiring CAPTCHA.');
    }

    const response = await axios.post(`${API_BASE_URL}/api/getPriorDeed`, {
      address: TEST_ADDRESS,
      county: 'Forsyth',
      state: 'NC'
    });

    console.log('\n✅ API request successful');
    console.log('\nResponse Summary:');
    console.log('  Success:', response.data.success);
    console.log('  Duration:', response.data.duration);

    if (response.data.success) {
      console.log('  Filename:', response.data.filename);
      console.log('  File Size:', response.data.fileSize, 'bytes');
      console.log('  Steps:');
      if (response.data.steps) {
        Object.keys(response.data.steps).forEach(step => {
          console.log(`    - ${step}:`, response.data.steps[step]);
        });
      }
    } else {
      console.log('  Error:', response.data.error);
    }

    return true;
  } catch (error) {
    if (error.response && error.response.status === 503) {
      console.log('\n⚠️  Expected 503 error (CAPTCHA solver not configured)');
      console.log('Error details:', error.response.data);

      // Check if error message mentions Forsyth County
      if (error.response.data.message.includes('Forsyth')) {
        console.log('✅ Forsyth County is properly configured to require CAPTCHA');
        return true;
      } else {
        console.log('❌ Error message does not mention Forsyth County');
        return false;
      }
    } else {
      console.error('❌ Unexpected error:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
      return false;
    }
  }
}

async function testCountyNameVariations() {
  console.log('\n4️⃣  Testing county name normalization...');
  console.log('='.repeat(50));

  const variations = [
    'Forsyth',
    'forsyth',
    'FORSYTH',
    'Forsyth County',
    'forsyth county'
  ];

  let allPassed = true;

  for (const countyName of variations) {
    try {
      console.log(`\nTesting: "${countyName}"`);
      const response = await axios.post(`${API_BASE_URL}/api/getPriorDeed`, {
        address: TEST_ADDRESS,
        county: countyName,
        state: 'NC'
      }, {
        validateStatus: (status) => status < 600 // Accept all status codes
      });

      // Check if Forsyth was recognized
      if (response.status === 503 && response.data.message.includes('Forsyth')) {
        console.log('  ✅ County name normalized correctly');
      } else if (response.status === 200) {
        console.log('  ✅ County name normalized correctly (request succeeded)');
      } else {
        console.log('  ❌ Unexpected response:', response.status);
        allPassed = false;
      }
    } catch (error) {
      console.log('  ❌ Error:', error.message);
      allPassed = false;
    }
  }

  return allPassed;
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   Forsyth County API Configuration Test Suite     ║');
  console.log('╚════════════════════════════════════════════════════╝');

  const results = {
    health: false,
    counties: false,
    deedDownload: false,
    normalization: false
  };

  // Run all tests
  results.health = await testHealthEndpoint();
  results.counties = await testCountiesEndpoint();
  results.deedDownload = await testDeedDownloadEndpoint();
  results.normalization = await testCountyNameVariations();

  // Summary
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║                  TEST SUMMARY                      ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log();
  console.log(`Health Endpoint:          ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Counties Endpoint:        ${results.counties ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Deed Download Endpoint:   ${results.deedDownload ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`County Name Normalization:${results.normalization ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = Object.values(results).every(r => r === true);

  console.log('\n' + '='.repeat(50));
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED! Forsyth County is properly configured.');
  } else {
    console.log('⚠️  SOME TESTS FAILED. Check the details above.');
  }
  console.log('='.repeat(50) + '\n');

  return allPassed;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then((passed) => {
      process.exit(passed ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };
