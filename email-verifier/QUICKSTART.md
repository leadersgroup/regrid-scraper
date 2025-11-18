# Quick Start Guide

## Installation

```bash
cd email-verifier
npm install
```

## Test Single Email

```bash
node cli.js --email test@gmail.com
```

## Test with Sample Files

```bash
# CSV file
node cli.js --file examples/sample-emails.csv --output results.csv

# Text file
node cli.js --file examples/sample-emails.txt --output results.csv

# JSON file
node cli.js --file examples/sample-emails.json --output results.json
```

## Run Tests

```bash
# Test single email verification
node test-verifier.js --single

# Test bulk verification
node test-verifier.js --bulk
```

## Configuration

Before running on large lists, edit `config.js` to:

1. **Set your email** in `smtp.fromEmail` (use your own domain)
2. **Adjust rate limiting** if needed:
   - `concurrent`: Number of simultaneous verifications (default: 10)
   - `delayBetweenBatches`: Delay between batches in ms (default: 1000)
   - `delayBetweenRequests`: Delay between requests in ms (default: 100)

## Example Output

### Single Email

```
🔍 Verifying: john@example.com

────────────────────────────────────────────────────────────
Email:           john@example.com
Valid:           ✅ YES
────────────────────────────────────────────────────────────
Syntax:          ✅ Valid syntax
Domain:          ✅ Domain exists
MX Records:      ✅ Found 2 MX record(s)
                 mx1.example.com, mx2.example.com
SMTP Check:      ✅ valid
────────────────────────────────────────────────────────────
Disposable:      ✅ NO
Role-based:      ✅ NO
Catch-all:       ✅ NO
Free Provider:   ✅ NO
────────────────────────────────────────────────────────────
Verified at:     2025-01-18T12:34:56.789Z
```

### Bulk Verification

```
🚀 Starting bulk verification of 1000 emails...
⚙️  Concurrent connections: 10
⏱️  Delay between batches: 1000ms

📦 Processing batch 1/10 (100 emails)...
[██████████████████████████████] 100% | 1000/1000 | 8.5 emails/sec

✅ Verification complete!

📊 Final Statistics:
──────────────────────────────────────────────────
Total Processed:  1000
Valid Emails:     850 (85.0%)
Invalid Emails:   150 (15.0%)
Disposable:       25
Role-based:       45
Catch-all:        10
Free Provider:    500
Errors:           5
──────────────────────────────────────────────────
Time Elapsed:     117.5s
Average Speed:    8.51 emails/sec
──────────────────────────────────────────────────

💾 Results saved to: results.csv
```

## Tips

1. **For best results**: Use your own domain in `smtp.fromEmail`
2. **Large lists**: Start with a small test batch first
3. **Rate limiting**: If you get many timeouts, increase delays
4. **Verification**: Some servers may block SMTP verification attempts
5. **Catch-all domains**: Will show all emails as valid - use the catch-all flag to filter

## Next Steps

1. Test with sample files
2. Adjust configuration as needed
3. Run on your email list
4. Check results.csv for detailed output

For full documentation, see [README.md](README.md)
