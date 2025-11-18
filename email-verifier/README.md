# Email Verifier

A standalone, comprehensive email verification tool with full SMTP verification, bulk processing capabilities, and rate limiting. Perfect for cleaning and verifying mailing lists up to 10,000 emails.

## Features

- ✅ **Full SMTP Verification** - Connects to mail servers to verify mailbox existence
- ✅ **Multi-level Validation** - Syntax, domain, MX records, and SMTP checks
- ✅ **Bulk Processing** - Verify up to 10,000 emails in one run
- ✅ **Rate Limiting** - Configurable concurrency and delays to avoid blocking
- ✅ **Disposable Email Detection** - Identifies temporary/throwaway emails
- ✅ **Role-based Detection** - Flags admin@, info@, support@ type emails
- ✅ **Catch-all Detection** - Identifies domains that accept all emails
- ✅ **Free Provider Detection** - Recognizes Gmail, Yahoo, Hotmail, etc.
- ✅ **Progress Tracking** - Real-time progress bars and statistics
- ✅ **Multiple Formats** - Supports CSV, TXT, and JSON input/output
- ✅ **Resume Capability** - Saves progress during bulk verification
- ✅ **REST API** - HTTP endpoints for single and bulk email verification

## Installation

```bash
cd email-verifier
npm install
```

## Quick Start

### Verify a Single Email

```bash
node cli.js --email john@example.com
```

### Verify Bulk Emails from CSV

```bash
node cli.js --file emails.csv --output results.csv
```

### Verify from Text File

```bash
node cli.js --file emails.txt --output verified.json
```

### Start REST API Server

```bash
npm run api
```

The API will start on http://localhost:3000. See [API.md](API.md) for full API documentation.

## Usage

### Command Line Interface

```bash
# Single email verification
node cli.js -e test@example.com

# Bulk verification from file
node cli.js -f emails.csv -o results.csv

# Show help
node cli.js --help
```

### Programmatic Usage

#### Single Email Verification

```javascript
const EmailVerifier = require('./email-verifier');

const verifier = new EmailVerifier();

async function verify() {
  const result = await verifier.verify('test@example.com');

  console.log(result);
  // {
  //   email: 'test@example.com',
  //   valid: true,
  //   syntax: { valid: true, message: 'Valid syntax' },
  //   domain: { valid: true, message: 'Domain exists' },
  //   mx: { valid: true, records: [...], message: '...' },
  //   smtp: { valid: true, status: 'valid', message: '...' },
  //   disposable: false,
  //   roleBased: false,
  //   catchAll: false,
  //   freeProvider: true,
  //   error: null,
  //   verifiedAt: '2025-01-...'
  // }
}

verify();
```

#### Bulk Email Verification

```javascript
const BulkEmailVerifier = require('./bulk-verifier');

const bulkVerifier = new BulkEmailVerifier();

async function verifyBulk() {
  const emails = [
    'user1@example.com',
    'user2@example.com',
    // ... up to 10,000 emails
  ];

  const { results, stats } = await bulkVerifier.verifyBulk(emails, {
    outputFile: 'results.csv',
    progressFile: 'progress.json',
    onProgress: (progress) => {
      console.log(`${progress.percentComplete}% complete`);
    }
  });

  console.log(stats);
  // {
  //   total: 100,
  //   processed: 100,
  //   valid: 85,
  //   invalid: 15,
  //   disposable: 5,
  //   roleBased: 10,
  //   catchAll: 3,
  //   freeProvider: 60
  // }
}

verifyBulk();
```

### REST API Usage

Start the API server:

```bash
npm run api
```

The API will be available at `http://localhost:3000`.

#### Single Email Verification

```bash
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

#### Bulk Email Verification

```bash
curl -X POST http://localhost:3000/api/verify/bulk \
  -H "Content-Type: application/json" \
  -d '{"emails":["test1@example.com","test2@example.com"]}'
```

#### Check Job Status

```bash
curl http://localhost:3000/api/verify/bulk/JOB_ID
```

For complete API documentation, see [API.md](API.md).

## Input File Formats

### CSV File

```csv
email,name,company
john@example.com,John Doe,Acme Inc
jane@test.com,Jane Smith,Test Co
```

### Text File

```
john@example.com
jane@test.com
admin@company.com
```

### JSON File

```json
{
  "emails": [
    "john@example.com",
    "jane@test.com",
    "admin@company.com"
  ]
}
```

Or simple array:

```json
[
  "john@example.com",
  "jane@test.com",
  "admin@company.com"
]
```

## Output Format

### CSV Output

```csv
email,valid,smtp_status,disposable,role_based,catch_all,free_provider,domain,mx_records,error,verified_at
john@example.com,yes,valid,no,no,no,no,example.com,mx1.example.com;mx2.example.com,,2025-01-18T...
```

### JSON Output

```json
{
  "stats": {
    "total": 100,
    "processed": 100,
    "valid": 85,
    "invalid": 15,
    ...
  },
  "results": [
    {
      "email": "john@example.com",
      "valid": true,
      "syntax": {...},
      "domain": {...},
      "mx": {...},
      "smtp": {...},
      ...
    }
  ]
}
```

## Configuration

Edit `config.js` to customize settings:

```javascript
module.exports = {
  smtp: {
    timeout: 10000,           // SMTP connection timeout
    fromEmail: 'verify@yourdomain.com',
    retries: 2,
  },

  rateLimit: {
    concurrent: 10,           // Max concurrent connections
    delayBetweenBatches: 1000,    // Delay between batches (ms)
    delayBetweenRequests: 100,    // Delay between requests (ms)
  },

  bulk: {
    maxEmails: 10000,         // Max emails per run
    batchSize: 100,           // Emails per batch
    saveProgressInterval: 50, // Save progress every N emails
  },

  validation: {
    checkSyntax: true,
    checkDomain: true,
    checkMX: true,
    checkSMTP: true,
    checkDisposable: true,
    checkRoleBased: true,
    checkCatchAll: true,
    checkFreeProvider: true,
  }
};
```

## Verification Process

The tool performs verification in multiple stages:

1. **Syntax Validation** - Checks if email format is valid using regex
2. **Domain Validation** - DNS lookup to verify domain exists
3. **MX Record Check** - Verifies domain has mail exchange servers
4. **SMTP Verification** - Connects to mail server and verifies mailbox
   - Establishes connection to MX server
   - Sends HELO/MAIL FROM/RCPT TO commands
   - Checks server response codes
   - Does NOT send actual emails
5. **Additional Checks**
   - Disposable email detection
   - Role-based email detection
   - Catch-all server detection
   - Free provider detection

## Rate Limiting

To avoid being blocked by mail servers:

- **Concurrent connections**: 10 simultaneous verifications (configurable)
- **Batch delays**: 1 second between batches (configurable)
- **Request delays**: 100ms between requests (configurable)
- **Automatic retries**: 2 retries for failed verifications

## Performance

- **Speed**: ~5-10 emails/second (depends on mail server response times)
- **Capacity**: Up to 10,000 emails per run
- **Time estimate**: 1,000 emails ≈ 2-3 minutes
- **Time estimate**: 10,000 emails ≈ 20-30 minutes

## Progress Tracking

During bulk verification:
- Real-time progress bar
- Emails per second metric
- Estimated time remaining
- Live statistics
- Auto-save progress every 50 emails

## Troubleshooting

### Timeouts or Connection Errors

- Increase `smtp.timeout` in config.js
- Reduce `rateLimit.concurrent` to avoid overwhelming servers
- Increase delays between requests

### Too Many Invalid Results

- Some mail servers block verification attempts
- Catch-all servers will show all emails as valid
- Use disposable/role-based flags to filter results

### Rate Limiting Issues

- Increase delays in config.js
- Reduce concurrent connections
- Some providers may block frequent SMTP checks

## Examples

Example CSV files are provided in the `examples/` folder:

- `sample-emails.csv` - Sample email list
- `sample-emails.txt` - Text file format

## License

MIT

## Notes

- SMTP verification connects to mail servers but does NOT send emails
- Some mail servers may block verification attempts
- Use responsibly and in compliance with email verification best practices
- Respect rate limits to avoid being blocked
