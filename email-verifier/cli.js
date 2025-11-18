#!/usr/bin/env node

const EmailVerifier = require('./email-verifier');
const BulkEmailVerifier = require('./bulk-verifier');
const { extractEmails } = require('./csv-utils');
const fs = require('fs').promises;

// Parse command line arguments
const args = process.argv.slice(2);

async function main() {
  // Show help
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Single email verification
  if (args.includes('--email') || args.includes('-e')) {
    const emailIndex = args.indexOf('--email') !== -1 ? args.indexOf('--email') : args.indexOf('-e');
    const email = args[emailIndex + 1];

    if (!email) {
      console.error('❌ Please provide an email address');
      process.exit(1);
    }

    await verifySingleEmail(email);
    return;
  }

  // Bulk verification from file
  if (args.includes('--file') || args.includes('-f')) {
    const fileIndex = args.indexOf('--file') !== -1 ? args.indexOf('--file') : args.indexOf('-f');
    const filename = args[fileIndex + 1];

    if (!filename) {
      console.error('❌ Please provide a file path');
      process.exit(1);
    }

    // Get output filename
    const outputIndex = args.indexOf('--output') !== -1 ? args.indexOf('--output') : args.indexOf('-o');
    const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : 'results.csv';

    await verifyBulkFromFile(filename, outputFile);
    return;
  }

  console.error('❌ Invalid arguments. Use --help for usage information.');
  process.exit(1);
}

/**
 * Verify a single email
 */
async function verifySingleEmail(email) {
  console.log(`\n🔍 Verifying: ${email}\n`);

  const verifier = new EmailVerifier();

  try {
    const result = await verifier.verify(email);

    console.log('─'.repeat(60));
    console.log(`Email:           ${result.email}`);
    console.log(`Valid:           ${result.valid ? '✅ YES' : '❌ NO'}`);
    console.log('─'.repeat(60));
    console.log(`Syntax:          ${result.syntax.valid ? '✅' : '❌'} ${result.syntax.message || ''}`);
    console.log(`Domain:          ${result.domain.valid ? '✅' : '❌'} ${result.domain.message || ''}`);
    console.log(`MX Records:      ${result.mx.valid ? '✅' : '❌'} ${result.mx.message || ''}`);

    if (result.mx.valid && result.mx.records.length > 0) {
      console.log(`                 ${result.mx.records.slice(0, 3).join(', ')}`);
    }

    console.log(`SMTP Check:      ${result.smtp.valid ? '✅' : '❌'} ${result.smtp.status || 'unknown'}`);
    console.log('─'.repeat(60));
    console.log(`Disposable:      ${result.disposable ? '⚠️  YES' : '✅ NO'}`);
    console.log(`Role-based:      ${result.roleBased ? '⚠️  YES' : '✅ NO'}`);
    console.log(`Catch-all:       ${result.catchAll ? '⚠️  YES' : '✅ NO'}`);
    console.log(`Free Provider:   ${result.freeProvider ? '📧 YES' : '✅ NO'}`);
    console.log('─'.repeat(60));

    if (result.error) {
      console.log(`Error:           ${result.error}`);
      console.log('─'.repeat(60));
    }

    console.log(`Verified at:     ${result.verifiedAt}\n`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Verify bulk emails from file
 */
async function verifyBulkFromFile(filename, outputFile) {
  try {
    // Check if file exists
    await fs.access(filename);

    console.log(`\n📂 Reading emails from: ${filename}`);

    // Extract emails from file
    const emails = await extractEmails(filename);

    if (emails.length === 0) {
      console.error('❌ No valid emails found in file');
      process.exit(1);
    }

    console.log(`📧 Found ${emails.length} email(s)\n`);

    // Verify emails
    const bulkVerifier = new BulkEmailVerifier();
    const { stats } = await bulkVerifier.verifyBulk(emails, { outputFile });

    process.exit(0);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
📧 Email Verifier - Bulk Email Verification Tool
${'='.repeat(60)}

USAGE:
  node cli.js [options]

OPTIONS:
  -e, --email <email>          Verify a single email address
  -f, --file <path>            Verify emails from a file (CSV, TXT, JSON)
  -o, --output <path>          Output file path (default: results.csv)
  -h, --help                   Show this help message

EXAMPLES:
  # Verify a single email
  node cli.js --email john@example.com

  # Verify emails from a CSV file
  node cli.js --file emails.csv

  # Verify emails and save to custom output file
  node cli.js --file emails.csv --output verified_emails.csv

  # Verify emails from a text file (one email per line)
  node cli.js --file emails.txt --output results.json

SUPPORTED INPUT FORMATS:
  - CSV files (.csv)
  - Text files (.txt) - one email per line
  - JSON files (.json) - array of emails or {emails: [...]}

OUTPUT FORMATS:
  - CSV files (.csv) - detailed verification results
  - JSON files (.json) - full results with metadata

FEATURES:
  ✅ Full SMTP verification
  ✅ MX record validation
  ✅ Domain validation
  ✅ Disposable email detection
  ✅ Role-based email detection
  ✅ Catch-all detection
  ✅ Free provider detection
  ✅ Bulk processing (up to 10,000 emails)
  ✅ Rate limiting and concurrency control
  ✅ Progress tracking and saving

CONFIGURATION:
  Edit config.js to customize verification settings, rate limits,
  and validation options.

${'='.repeat(60)}
  `);
}

// Run CLI
main().catch(error => {
  console.error(`\n❌ Unexpected error: ${error.message}\n`);
  process.exit(1);
});
