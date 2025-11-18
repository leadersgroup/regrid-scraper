const EmailVerifier = require('./email-verifier');
const BulkEmailVerifier = require('./bulk-verifier');

async function testSingleEmail() {
  console.log('\n📧 Testing Single Email Verification\n');
  console.log('='.repeat(60));

  const verifier = new EmailVerifier();

  // Test emails
  const testEmails = [
    'test@gmail.com',           // Should be valid (if exists)
    'invalid-email',            // Invalid syntax
    'test@nonexistentdomain123456789.com', // Domain doesn't exist
  ];

  for (const email of testEmails) {
    console.log(`\nTesting: ${email}`);
    console.log('-'.repeat(60));

    try {
      const result = await verifier.verify(email);

      console.log(`Valid:       ${result.valid ? '✅' : '❌'}`);
      console.log(`Syntax:      ${result.syntax.valid ? '✅' : '❌'}`);
      console.log(`Domain:      ${result.domain.valid ? '✅' : '❌'}`);
      console.log(`MX Records:  ${result.mx.valid ? '✅' : '❌'}`);
      console.log(`SMTP:        ${result.smtp.status || 'unknown'}`);
      console.log(`Disposable:  ${result.disposable ? '⚠️  Yes' : '✅ No'}`);
      console.log(`Role-based:  ${result.roleBased ? '⚠️  Yes' : '✅ No'}`);

      if (result.error) {
        console.log(`Error:       ${result.error}`);
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

async function testBulkVerification() {
  console.log('\n📦 Testing Bulk Email Verification\n');
  console.log('='.repeat(60));

  const bulkVerifier = new BulkEmailVerifier();

  // Small test set
  const testEmails = [
    'test1@gmail.com',
    'test2@yahoo.com',
    'admin@example.com',
    'info@test.com',
    'invalid-email',
  ];

  console.log(`Testing with ${testEmails.length} emails...\n`);

  try {
    const { results, stats } = await bulkVerifier.verifyBulk(testEmails, {
      outputFile: 'test-results.csv',
      progressFile: 'test-progress.json'
    });

    console.log('\n✅ Test completed!');
    console.log(`Results saved to: test-results.csv`);

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// Run tests
async function runTests() {
  console.log('\n🚀 Email Verifier Test Suite\n');

  const args = process.argv.slice(2);

  if (args.includes('--bulk')) {
    await testBulkVerification();
  } else if (args.includes('--single')) {
    await testSingleEmail();
  } else {
    console.log('Usage:');
    console.log('  node test-verifier.js --single   # Test single email verification');
    console.log('  node test-verifier.js --bulk     # Test bulk verification');
    console.log('\nRunning single email test by default...\n');
    await testSingleEmail();
  }
}

runTests().catch(error => {
  console.error(`\n❌ Test failed: ${error.message}\n`);
  process.exit(1);
});
