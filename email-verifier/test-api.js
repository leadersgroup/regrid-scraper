/**
 * Test script for Email Verifier API
 * Make sure the API server is running: npm run api
 */

const BASE_URL = 'http://localhost:3000';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
  log('\n📋 Test 1: Health Check', 'cyan');
  log('─'.repeat(60));

  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    log(`Status: ${response.status}`, 'green');
    log(`Response: ${JSON.stringify(data, null, 2)}`);

    if (data.status === 'healthy') {
      log('✅ Health check passed', 'green');
      return true;
    } else {
      log('❌ Health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    log('⚠️  Make sure the API server is running: npm run api', 'yellow');
    return false;
  }
}

async function testSingleVerification() {
  log('\n📋 Test 2: Single Email Verification', 'cyan');
  log('─'.repeat(60));

  const testEmail = 'test@gmail.com';

  try {
    log(`Verifying: ${testEmail}`);

    const response = await fetch(`${BASE_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail })
    });

    const data = await response.json();

    log(`Status: ${response.status}`, 'green');
    log(`Valid: ${data.result?.valid ? '✅' : '❌'}`);
    log(`SMTP Status: ${data.result?.smtp?.status || 'unknown'}`);

    if (data.success) {
      log('✅ Single verification passed', 'green');
      return true;
    } else {
      log(`❌ Single verification failed: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testBulkVerificationSync() {
  log('\n📋 Test 3: Bulk Verification (Synchronous)', 'cyan');
  log('─'.repeat(60));

  const emails = [
    'test1@gmail.com',
    'test2@yahoo.com',
    'admin@example.com'
  ];

  try {
    log(`Verifying ${emails.length} emails synchronously...`);

    const response = await fetch(`${BASE_URL}/api/verify/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, async: false })
    });

    const data = await response.json();

    log(`Status: ${response.status}`, 'green');

    if (data.success && data.stats) {
      log(`Total: ${data.stats.total}`);
      log(`Valid: ${data.stats.valid}`);
      log(`Invalid: ${data.stats.invalid}`);
      log('✅ Bulk sync verification passed', 'green');
      return true;
    } else {
      log(`❌ Bulk sync verification failed: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testBulkVerificationAsync() {
  log('\n📋 Test 4: Bulk Verification (Asynchronous)', 'cyan');
  log('─'.repeat(60));

  // Create a larger list to trigger async processing
  const emails = Array.from({ length: 150 }, (_, i) => `test${i}@example.com`);

  try {
    log(`Starting async verification of ${emails.length} emails...`);

    // Start job
    const startResponse = await fetch(`${BASE_URL}/api/verify/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails, async: true })
    });

    const startData = await startResponse.json();

    if (!startData.success || !startData.jobId) {
      log(`❌ Failed to start job: ${startData.error}`, 'red');
      return false;
    }

    const jobId = startData.jobId;
    log(`Job ID: ${jobId}`, 'blue');

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 60; // 60 * 2 seconds = 2 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await fetch(`${BASE_URL}/api/verify/bulk/${jobId}`);
      const statusData = await statusResponse.json();

      if (!statusData.success) {
        log(`❌ Failed to get job status: ${statusData.error}`, 'red');
        return false;
      }

      const job = statusData.job;
      log(`Status: ${job.status} | Progress: ${job.progress?.percentComplete || 0}%`, 'yellow');

      if (job.status === 'completed') {
        log(`\nJob completed!`, 'green');
        log(`Total: ${job.stats.total}`);
        log(`Valid: ${job.stats.valid}`);
        log(`Invalid: ${job.stats.invalid}`);
        log('✅ Bulk async verification passed', 'green');
        return true;
      } else if (job.status === 'failed') {
        log(`❌ Job failed: ${job.error}`, 'red');
        return false;
      }

      attempts++;
    }

    log('❌ Job timed out', 'red');
    return false;

  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testListJobs() {
  log('\n📋 Test 5: List Jobs', 'cyan');
  log('─'.repeat(60));

  try {
    const response = await fetch(`${BASE_URL}/api/jobs`);
    const data = await response.json();

    log(`Status: ${response.status}`, 'green');
    log(`Total jobs: ${data.total}`);

    if (data.jobs && data.jobs.length > 0) {
      log(`Latest job: ${data.jobs[0].jobId}`);
      log(`Status: ${data.jobs[0].status}`);
    }

    if (data.success) {
      log('✅ List jobs passed', 'green');
      return true;
    } else {
      log(`❌ List jobs failed: ${data.error}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function testInvalidRequests() {
  log('\n📋 Test 6: Invalid Requests (Error Handling)', 'cyan');
  log('─'.repeat(60));

  const tests = [
    {
      name: 'Missing email',
      endpoint: '/api/verify',
      body: {},
      expectedStatus: 400
    },
    {
      name: 'Invalid email type',
      endpoint: '/api/verify',
      body: { email: 123 },
      expectedStatus: 400
    },
    {
      name: 'Empty emails array',
      endpoint: '/api/verify/bulk',
      body: { emails: [] },
      expectedStatus: 400
    },
    {
      name: 'Too many emails',
      endpoint: '/api/verify/bulk',
      body: { emails: Array(10001).fill('test@example.com') },
      expectedStatus: 400
    }
  ];

  let passed = 0;

  for (const test of tests) {
    try {
      log(`\nTesting: ${test.name}`);

      const response = await fetch(`${BASE_URL}${test.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.body)
      });

      if (response.status === test.expectedStatus) {
        log(`✅ Returned expected status ${test.expectedStatus}`, 'green');
        passed++;
      } else {
        log(`❌ Expected ${test.expectedStatus}, got ${response.status}`, 'red');
      }
    } catch (error) {
      log(`❌ Error: ${error.message}`, 'red');
    }
  }

  const allPassed = passed === tests.length;
  log(`\n${allPassed ? '✅' : '❌'} Error handling: ${passed}/${tests.length} tests passed`, allPassed ? 'green' : 'red');

  return allPassed;
}

async function runAllTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 Email Verifier API Test Suite', 'cyan');
  log('='.repeat(60), 'cyan');

  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Single Verification', fn: testSingleVerification },
    { name: 'Bulk Sync Verification', fn: testBulkVerificationSync },
    { name: 'Bulk Async Verification', fn: testBulkVerificationAsync },
    { name: 'List Jobs', fn: testListJobs },
    { name: 'Error Handling', fn: testInvalidRequests }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, passed: result });
    } catch (error) {
      log(`\n❌ Test '${test.name}' threw an error: ${error.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }

  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 Test Summary', 'cyan');
  log('='.repeat(60), 'cyan');

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`${icon} ${result.name}`, color);
  });

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  log('\n' + '─'.repeat(60));
  log(`Total: ${passed}/${total} tests passed`, passed === total ? 'green' : 'yellow');
  log('='.repeat(60) + '\n', 'cyan');

  if (passed === total) {
    log('🎉 All tests passed!', 'green');
  } else {
    log('⚠️  Some tests failed. Check the output above.', 'yellow');
  }
}

// Check if fetch is available (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('❌ Error: fetch is not available. Please use Node.js 18 or higher.');
  console.log('Or install node-fetch: npm install node-fetch');
  process.exit(1);
}

// Run tests
runAllTests().catch(error => {
  log(`\n❌ Test suite failed: ${error.message}`, 'red');
  process.exit(1);
});
