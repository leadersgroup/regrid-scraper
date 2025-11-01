# CAPTCHA Solving Setup Guide

## Overview

This project now supports **automatic reCAPTCHA solving** using the 2Captcha API service. This enables fully automated deed downloads from Orange County, Florida and other counties that use CAPTCHA protection.

## What is 2Captcha?

2Captcha is a human-powered CAPTCHA solving service that provides an API for automated CAPTCHA solving. Real humans solve the CAPTCHAs, ensuring high success rates.

### Pricing (as of 2025)
- **$1.00 per 1,000 solved CAPTCHAs**
- Response time: < 12 seconds
- Supports reCAPTCHA v2, v3, hCaptcha, and more

### Official Website
https://2captcha.com/

## Setup Instructions

### Step 1: Create a 2Captcha Account

1. Go to https://2captcha.com/
2. Click "Sign Up" or "Register"
3. Create an account with your email
4. Verify your email address

### Step 2: Add Funds to Your Account

1. Log in to your 2Captcha account
2. Go to the "Add Funds" section
3. Add money to your balance (minimum $3)
4. Payment methods: PayPal, credit card, cryptocurrency, etc.

### Step 3: Get Your API Key

1. Once logged in, go to your dashboard
2. Find your **API Key** (also called "API Token")
3. Copy this key - you'll need it for the environment variable

Example API key format: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

### Step 4: Set Environment Variable

You need to set the `TWOCAPTCHA_TOKEN` environment variable with your API key.

#### Option A: Set in Terminal (Temporary - Current Session Only)

**macOS/Linux:**
```bash
export TWOCAPTCHA_TOKEN="your_api_key_here"
```

**Windows (PowerShell):**
```powershell
$env:TWOCAPTCHA_TOKEN="your_api_key_here"
```

**Windows (Command Prompt):**
```cmd
set TWOCAPTCHA_TOKEN=your_api_key_here
```

#### Option B: Create .env File (Recommended - Persistent)

1. Create a file named `.env` in the project root:
```bash
TWOCAPTCHA_TOKEN=your_api_key_here
```

2. Install dotenv package (if not already installed):
```bash
npm install dotenv
```

3. Add to the top of your script:
```javascript
require('dotenv').config();
```

#### Option C: Set System-Wide Environment Variable (Permanent)

**macOS/Linux:**
Add to `~/.bashrc` or `~/.zshrc`:
```bash
export TWOCAPTCHA_TOKEN="your_api_key_here"
```

Then reload:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

**Windows:**
1. Search for "Environment Variables" in Windows settings
2. Click "Edit the system environment variables"
3. Click "Environment Variables" button
4. Under "User variables", click "New"
5. Variable name: `TWOCAPTCHA_TOKEN`
6. Variable value: `your_api_key_here`
7. Click OK

### Step 5: Test the Setup

Run a test to verify everything is working:

```bash
# Set the API key (if not already set)
export TWOCAPTCHA_TOKEN="your_api_key_here"

# Run the Orange County test
node test-swanson-st.js
```

You should see output like:
```
⚠️ reCAPTCHA challenge detected
🔧 Attempting to solve reCAPTCHA using 2Captcha API...
✅ reCAPTCHA solved successfully!
✅ Successfully moved past disclaimer page!
```

## How It Works

1. **Detection**: The scraper detects when a reCAPTCHA is present on the page
2. **API Call**: If `TWOCAPTCHA_TOKEN` is set, the scraper automatically calls 2Captcha API
3. **Human Solving**: A human worker on 2Captcha solves the CAPTCHA (takes ~10-30 seconds)
4. **Solution Injection**: The solution is automatically injected into the page
5. **Continuation**: The scraper continues with the download process

## Cost Estimates

### Orange County, Florida Deeds
- Each deed download requires 1 CAPTCHA solve
- Cost: **$0.001 per deed** (1/10th of a cent)
- 1,000 deeds = $1.00

### Example Monthly Costs
- 100 deeds/month = $0.10
- 1,000 deeds/month = $1.00
- 10,000 deeds/month = $10.00

## Implementation Details

### Files Modified
1. **deed-scraper.js** - Added RecaptchaPlugin configuration
2. **orange-county-florida.js** - Added CAPTCHA solving logic in `downloadDeed()` method

### Code Flow
```javascript
// Check for CAPTCHA
if (hasCaptcha) {
  // If API key is set
  if (process.env.TWOCAPTCHA_TOKEN) {
    // Automatically solve
    await this.page.solveRecaptchas();
  } else {
    // Return error with instructions
    return {
      success: false,
      error: 'CAPTCHA_REQUIRED_NO_API_KEY'
    };
  }
}
```

## Troubleshooting

### "No 2Captcha API key configured"
- Make sure you've set the `TWOCAPTCHA_TOKEN` environment variable
- Restart your terminal/script after setting the variable
- Verify the variable is set: `echo $TWOCAPTCHA_TOKEN` (should show your key)

### "Failed to solve reCAPTCHA"
- Check your 2Captcha account balance - you may need to add funds
- Verify your API key is correct
- Check 2Captcha service status at https://2captcha.com/
- The CAPTCHA type might not be supported (very rare)

### "Balance too low"
- Log in to https://2captcha.com/
- Add more funds to your account
- Minimum recommended balance: $3

### Slow Response Time
- Normal CAPTCHA solving takes 10-30 seconds
- If taking longer, check 2Captcha's current queue status
- Peak hours may have slightly longer wait times

## Security Notes

### Protecting Your API Key

⚠️ **NEVER commit your API key to version control!**

Add to `.gitignore`:
```
.env
```

### Best Practices
1. Use `.env` file for local development
2. Use environment variables in production
3. Rotate your API key periodically
4. Monitor your 2Captcha usage and spending

## Alternative CAPTCHA Solvers

If you prefer a different service, the implementation can be modified to use:

- **CapSolver** - https://www.capsolver.com/
- **Anti-Captcha** - https://anti-captcha.com/
- **DeathByCaptcha** - https://deathbycaptcha.com/

To switch providers, modify the RecaptchaPlugin configuration in `deed-scraper.js`.

## Support

### 2Captcha Support
- Documentation: https://2captcha.com/api-docs
- Support: https://2captcha.com/support
- Status: https://2captcha.com/status

### Project Issues
- For issues with this implementation, create an issue in the project repository
- Include error messages and logs

---

**Last Updated:** November 1, 2025
