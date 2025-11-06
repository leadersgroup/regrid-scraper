# Harris County, Texas - Deed Scraper Setup

## Files Created

1. **county-implementations/harris-county-texas.js** - Main scraper implementation
2. **test-harris-county.js** - Test script

## Workflow Implementation

The scraper implements the following workflow based on your specifications:

### Step 1: Skip Regrid
Harris County doesn't need parcel ID lookup from Regrid.

### Step 2: Search HCAD
**URL**: https://hcad.org/property-search/property-search

**Process**:
- Wait for Property Search interface to load
- Select "Property Address" radio button
- Enter address in text field (e.g., "5019 Lymbar Dr")
- Click search button (magnifying glass icon)
- Results show account number (e.g., 0901540000007)
- Click on account number to view property details

### Step 3: Extract Ownership Data
From the property detail page, extract:
- **Owner Name** from "Ownership History" section (e.g., "XU HUIPING")
- **Effective Date** from first entry (e.g., "07/25/2023")

### Step 4: Search Clerk Records
**URL**: https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx

**Process**:
- Enter Owner Name in "Grantee" field
- Enter Effective Date in both "Date (From)" and "Date (To)" fields
- Click "Search"
- Results page shows Film Code (e.g., "RP-2023-278675")

### Step 5: Download Deed PDF
- Click on Film Code link to download PDF

## Cloudflare Protection Handling

### Implemented Solutions

The scraper now includes multiple layers of protection bypass:

#### ✅ 1. Stealth Plugin
- Already implemented: `puppeteer-extra-plugin-stealth`
- Hides automation indicators from websites

#### ✅ 2. reCAPTCHA Solver
- **Installed**: `puppeteer-extra-plugin-recaptcha`
- **Configuration**: Set `CAPTCHA_API_KEY` environment variable with your 2captcha API key
- **Get API Key**: Sign up at https://2captcha.com
- Automatically solves reCAPTCHA challenges when detected

#### ✅ 3. Cloudflare Detection
The scraper now:
- Detects Cloudflare "Just a moment" pages
- Waits for challenges to complete automatically
- Uses reCAPTCHA solver if configured
- Takes debug screenshots on failure
- Provides detailed logging

### Setup Instructions

1. **Get 2captcha API Key** (Optional but recommended):
   ```bash
   # Sign up at https://2captcha.com
   # Get your API key from dashboard
   ```

2. **Configure Environment**:
   ```bash
   # Copy the example file
   cp .env.example .env

   # Edit .env and add your API key
   CAPTCHA_API_KEY=your_2captcha_api_key_here
   ```

3. **Load Environment Variables**:
   ```javascript
   require('dotenv').config();
   ```

### Alternative Options

If Cloudflare still blocks access:

#### Option A: Use Residential Proxies
- Route requests through residential proxies
- Rotate IP addresses
- Services: Bright Data, Oxylabs, SmartProxy

#### Option B: Manual Browser Session
- Run with `headless: false`
- Manually complete Cloudflare challenge once
- Save cookies for reuse

#### Option C: Check for API Access
- Investigate if HCAD provides public API
- Look for alternative search endpoints

## Expected Selectors (Once Cloudflare is Bypassed)

Based on the screenshot you provided:

```javascript
// Radio buttons for search type
'input[type="radio"]' // Property Address, Owner Name, Business Name, Account Number

// Address input field (next to selected radio button)
'input[type="text"]'

// Search button (magnifying glass icon)
button with search icon or 'input[type="submit"]'

// Search results table
'table' with columns:
- Account Number (clickable link, 13 digits)
- Business|Owner Name
- Address
- Type
```

## Next Steps

1. **Test with Manual Cloudflare Bypass**: Run with `headless: false` and manually complete the Cloudflare challenge to verify the rest of the workflow works.

2. **Implement reCAPTCHA Solver**: Add puppeteer-extra-plugin-recaptcha with a 2captcha API key.

3. **Add Session Management**: Save cookies after successful Cloudflare bypass and reuse them.

4. **Test Full Workflow**: Once HCAD search works, test the complete flow through to PDF download.

## Test Address

**Address**: 5019 Lymbar Dr Houston TX 77096

**Expected Results**:
- Account Number: 0901540000007
- Owner: XU HUIPING
- Effective Date: 07/25/2023
- Film Code: RP-2023-278675

## Usage

```javascript
const HarrisCountyTexasScraper = require('./county-implementations/harris-county-texas');

const scraper = new HarrisCountyTexasScraper({
  headless: false,  // Set to false to see browser
  verbose: true,
  timeout: 90000
});

const result = await scraper.getPriorDeed('5019 Lymbar Dr Houston TX 77096');
console.log(result);

await scraper.close();
```
