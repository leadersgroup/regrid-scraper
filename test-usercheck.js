const EmailVerifier = require('./email-verifier/email-verifier');

async function test() {
  const verifier = new EmailVerifier();

  console.log('Testing UserCheck API integration...\n');

  // Test valid email
  console.log('Testing valid Gmail: test@gmail.com');
  const result1 = await verifier.verify('test@gmail.com');
  console.log(JSON.stringify(result1, null, 2));
  console.log('\n---\n');

  // Wait for rate limit (1 second)
  console.log('Waiting 2 seconds for rate limit...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test disposable email
  console.log('Testing disposable email: test@tempmail.com');
  const result2 = await verifier.verify('test@tempmail.com');
  console.log(JSON.stringify(result2, null, 2));
  console.log('\n---\n');

  // Wait for rate limit
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test role-based email
  console.log('Testing role-based email: info@example.com');
  const result3 = await verifier.verify('info@example.com');
  console.log(JSON.stringify(result3, null, 2));
}

test().catch(console.error);
