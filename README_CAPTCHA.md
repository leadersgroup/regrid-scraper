# 🤖 Automatic CAPTCHA Solving for Deed Downloads

## Quick Start

### 1. Get a 2Captcha API Key

```bash
# Sign up at https://2captcha.com/
# Add funds to your account ($3 minimum)
# Copy your API key from the dashboard
```

### 2. Set Your API Key

```bash
export TWOCAPTCHA_TOKEN="your_api_key_here"
```

### 3. Run Your Scraper

```bash
node test-swanson-st.js
```

That's it! CAPTCHAs will now be solved automatically.

## What Gets Automated

### Before (Manual CAPTCHA)
```
⚠️ reCAPTCHA challenge detected
❌ Automated download not possible
→ User must manually visit URL and solve CAPTCHA
```

### After (Automatic CAPTCHA)
```
⚠️ reCAPTCHA challenge detected
🔧 Attempting to solve reCAPTCHA using 2Captcha API...
✅ reCAPTCHA solved successfully!
✅ Successfully moved past disclaimer page!
📥 Downloading deed PDF...
✅ Deed downloaded successfully
```

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Scraper encounters reCAPTCHA                                │
├─────────────────────────────────────────────────────────────────┤
│  2. Sends CAPTCHA challenge to 2Captcha API                     │
├─────────────────────────────────────────────────────────────────┤
│  3. Human worker solves CAPTCHA (10-30 seconds)                 │
├─────────────────────────────────────────────────────────────────┤
│  4. Solution returned to scraper via API                        │
├─────────────────────────────────────────────────────────────────┤
│  5. Solution injected into browser automatically                │
├─────────────────────────────────────────────────────────────────┤
│  6. Page proceeds as if human solved it                         │
├─────────────────────────────────────────────────────────────────┤
│  7. PDF download continues automatically                        │
└─────────────────────────────────────────────────────────────────┘
```

## Pricing

### 2Captcha Rates
- **$1.00 per 1,000 CAPTCHAs**
- **$0.001 per deed** (1/10th of a cent)

### Example Costs
| Deeds Per Month | Cost Per Month |
|-----------------|----------------|
| 100             | $0.10          |
| 500             | $0.50          |
| 1,000           | $1.00          |
| 5,000           | $5.00          |
| 10,000          | $10.00         |

💡 **This is extremely affordable for automated deed downloads!**

## Configuration Options

### Environment Variables

```bash
# Required for CAPTCHA solving
TWOCAPTCHA_TOKEN=your_api_key_here

# Optional: Download path
DEED_DOWNLOAD_PATH=./downloads

# Optional: Verbose logging
VERBOSE=true
```

### Using .env File

Create `.env` in project root:

```env
TWOCAPTCHA_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
DEED_DOWNLOAD_PATH=./downloads
VERBOSE=true
```

Then install dotenv:

```bash
npm install dotenv
```

And load it in your script:

```javascript
require('dotenv').config();
const scraper = new OrangeCountyFloridaScraper({
  headless: true,
  verbose: process.env.VERBOSE === 'true'
});
```

## API Response Examples

### Success (With API Key)

```json
{
  "success": true,
  "download": {
    "success": true,
    "filename": "deed_20170015765_1730483573161.pdf",
    "downloadPath": "/Users/you/regrid-scraper/downloads",
    "documentId": "20170015765",
    "captchaSolved": true,
    "captchaSolveTime": 15.2
  }
}
```

### Failure (No API Key)

```json
{
  "success": false,
  "download": {
    "success": false,
    "requiresCaptcha": true,
    "error": "CAPTCHA_REQUIRED_NO_API_KEY",
    "message": "Set TWOCAPTCHA_TOKEN environment variable to enable automatic solving",
    "deedUrl": "https://selfservice.or.occompt.com/ssweb/web/integration/document/20170015765"
  }
}
```

### Failure (API Error)

```json
{
  "success": false,
  "download": {
    "success": false,
    "requiresCaptcha": true,
    "error": "CAPTCHA_SOLVER_FAILED",
    "captchaSolverError": "Insufficient balance",
    "message": "reCAPTCHA solving failed. Manual intervention required"
  }
}
```

## Supported Counties

### Current Implementation
- ✅ **Orange County, Florida** - Full CAPTCHA solving support

### Easily Extensible
The CAPTCHA solving is implemented in the base `DeedScraper` class, so any county implementation can use it:

```javascript
// In any county implementation
if (hasCaptcha) {
  if (process.env.TWOCAPTCHA_TOKEN) {
    await this.page.solveRecaptchas();
    // Continue with download
  }
}
```

## Monitoring Usage

### Check Your Balance

Log in to https://2captcha.com/ to see:
- Current balance
- CAPTCHAs solved today/this month
- Average solve time
- Success rate

### Set Up Alerts

1. Go to 2Captcha settings
2. Set up low balance alerts
3. Get notified via email when balance < $1

## Best Practices

### 1. Start Small
```bash
# Test with small balance first
# Add $3, test 100 deeds
# Then scale up based on needs
```

### 2. Monitor Costs
```bash
# Check balance regularly
# Set up alerts
# Review monthly spending
```

### 3. Handle Failures Gracefully
```javascript
try {
  const result = await scraper.getPriorDeed(address);
  if (result.download?.captchaSolved) {
    console.log('✅ CAPTCHA solved automatically');
  }
} catch (error) {
  // Log and continue with next deed
  console.error('Failed:', error.message);
}
```

### 4. Batch Processing
```javascript
// Process multiple deeds
const addresses = [...];
const results = [];

for (const address of addresses) {
  const result = await scraper.getPriorDeed(address);
  results.push(result);

  // Add delay between requests
  await new Promise(r => setTimeout(r, 2000));
}
```

## Troubleshooting

### "Error: Insufficient balance"

```bash
# Add funds to your 2Captcha account
# Visit: https://2captcha.com/enterpage
# Minimum: $3
```

### "Error: Invalid API key"

```bash
# Verify your API key
echo $TWOCAPTCHA_TOKEN

# Should show your key, not empty
# Re-copy from https://2captcha.com/2captcha-api
```

### "CAPTCHA solving taking too long"

```
# Normal: 10-30 seconds
# If > 60 seconds, may be queue congestion
# Check status: https://2captcha.com/status
```

### "Balance depleting quickly"

```bash
# Check for infinite loops
# Verify you're not re-solving same CAPTCHA
# Add logging to track CAPTCHA solves:

if (process.env.VERBOSE) {
  console.log('CAPTCHA solve cost: $0.001');
}
```

## Advanced Configuration

### Custom Timeout

```javascript
// In deed-scraper.js
RecaptchaPlugin({
  provider: {
    id: '2captcha',
    token: process.env.TWOCAPTCHA_TOKEN
  },
  visualFeedback: true,
  timeout: 120000 // 2 minutes instead of default
})
```

### Different Provider

```javascript
// Use CapSolver instead
RecaptchaPlugin({
  provider: {
    id: 'capsolver',
    token: process.env.CAPSOLVER_API_KEY
  }
})
```

### Debug Mode

```bash
# Enable verbose CAPTCHA solving logs
DEBUG=puppeteer-extra-plugin:* node test-swanson-st.js
```

## Security

### ⚠️ Never Commit API Keys

```bash
# Add to .gitignore
echo ".env" >> .gitignore

# Verify not tracked
git status
```

### ✅ Use Environment Variables

```bash
# Development
export TWOCAPTCHA_TOKEN="..."

# Production (Railway, Heroku, etc.)
# Set via platform's environment variable UI
```

### 🔄 Rotate Keys Periodically

```
1. Generate new API key in 2Captcha dashboard
2. Update environment variable
3. Revoke old key
```

## FAQ

**Q: Is this legal?**
A: Yes, using CAPTCHA solving services is legal. You're paying humans to solve CAPTCHAs on your behalf.

**Q: How fast is it?**
A: Typically 10-30 seconds per CAPTCHA. Much faster than manual solving.

**Q: What if solving fails?**
A: The scraper falls back to returning the deed URL for manual download.

**Q: Can I use a different service?**
A: Yes, the plugin supports multiple providers. See Advanced Configuration.

**Q: Do I need to keep the browser window open?**
A: No, you can run in headless mode. The CAPTCHA solving happens server-side.

**Q: What about reCAPTCHA v3?**
A: The plugin also supports reCAPTCHA v3, though Orange County uses v2.

---

## Next Steps

1. ✅ Sign up for 2Captcha: https://2captcha.com/
2. ✅ Add $3 to your account
3. ✅ Get your API key
4. ✅ Set `TWOCAPTCHA_TOKEN` environment variable
5. ✅ Run `node test-swanson-st.js`
6. ✅ Watch it automatically solve the CAPTCHA and download the deed!

**Need help?** See full setup guide: [CAPTCHA_SOLVING_SETUP.md](CAPTCHA_SOLVING_SETUP.md)

---

**Last Updated:** November 1, 2025
