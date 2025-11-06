# Harris County, Texas - Deed Scraper

## Overview

This scraper automates the process of downloading prior recorded deeds from Harris County, Texas by:
1. Searching property by address on HCAD (Harris County Appraisal District)
2. Extracting ownership information
3. Searching clerk records
4. Downloading the deed PDF

## Quick Start

### Installation

```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth puppeteer-extra-plugin-recaptcha
```

### Basic Usage

```javascript
const HarrisCountyTexasScraper = require('./county-implementations/harris-county-texas');

async function main() {
  const scraper = new HarrisCountyTexasScraper({
    headless: false,  // Set to true for production
    verbose: true,
    timeout: 90000
  });

  try {
    const result = await scraper.getPriorDeed('5019 Lymbar Dr Houston TX 77096');
    console.log(result);
  } finally {
    await scraper.close();
  }
}

main();
```

## Cloudflare Protection

The HCAD website uses Cloudflare protection. Here's how to handle it:

### Method 1: Using 2captcha (Recommended)

1. **Sign up for 2captcha**: https://2captcha.com
2. **Get your API key** from the dashboard
3. **Create .env file**:
   ```bash
   cp .env.example .env
   ```
4. **Add your API key to .env**:
   ```
   CAPTCHA_API_KEY=your_2captcha_api_key_here
   ```
5. **Load environment variables in your script**:
   ```javascript
   require('dotenv').config();
   const scraper = new HarrisCountyTexasScraper({ ... });
   ```

The scraper will automatically:
- Detect Cloudflare challenges
- Wait for them to complete
- Solve reCAPTCHA if present (with API key)

### Method 2: Manual Browser (Free)

Run with `headless: false` and manually complete the Cloudflare challenge:

```javascript
const scraper = new HarrisCountyTexasScraper({
  headless: false,  // Opens visible browser
  verbose: true
});
```

When Cloudflare appears:
1. Wait for the challenge to auto-complete, OR
2. Click the checkbox if needed
3. The scraper will continue automatically

### Method 3: Save Cookies (Reuse Session)

After manually passing Cloudflare once, you can save cookies and reuse them:

```javascript
// After successful run
const cookies = await page.cookies();
fs.writeFileSync('cookies.json', JSON.stringify(cookies));

// On next run
const cookies = JSON.parse(fs.readFileSync('cookies.json'));
await page.setCookie(...cookies);
```

## Workflow Details

### Step 1: HCAD Property Search
**URL**: https://hcad.org/property-search/property-search

The scraper:
1. Waits for Cloudflare challenge to complete
2. Selects "Property Address" radio button
3. Enters the street address
4. Clicks search button
5. Finds account number in results (e.g., 0901540000007)
6. Clicks on account number to view details

### Step 2: Extract Ownership Data
From the property detail page:
- Locates "Ownership History" section
- Extracts first entry:
  - Owner name (e.g., "XU HUIPING")
  - Effective date (e.g., "07/25/2023")

### Step 3: Search Clerk Records
**URL**: https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx

The scraper:
1. Enters owner name in "Grantee" field
2. Enters effective date in "Date (From)" and "Date (To)" fields
3. Clicks "Search"
4. Extracts film code from results (e.g., "RP-2023-278675")

### Step 4: Download Deed PDF
- Clicks on film code link
- Downloads PDF file
- Saves to `./downloads/` directory

## Configuration Options

```javascript
const scraper = new HarrisCountyTexasScraper({
  headless: false,       // false = visible browser, true = headless
  verbose: true,         // Enable detailed logging
  timeout: 90000         // Timeout in milliseconds (90 seconds)
});
```

## Output Format

```javascript
{
  "success": true,
  "address": "5019 Lymbar Dr Houston TX 77096",
  "timestamp": "2025-11-06T19:54:34.775Z",
  "duration": "45.23s",
  "steps": {
    "step1": {
      "success": true,
      "skipped": true,
      "message": "Harris County supports direct address search"
    },
    "step2": {
      "success": true,
      "accountNumber": "0901540000007",
      "owner": "XU HUIPING",
      "effectiveDate": "07/25/2023",
      "hcadUrl": "https://hcad.org/property-search/property-search"
    },
    "step3": {
      "success": true,
      "filmCode": "RP-2023-278675",
      "clerkUrl": "https://www.cclerk.hctx.net/Applications/WebSearch/RP_R.aspx?..."
    }
  },
  "download": {
    "success": true,
    "filename": "harris_deed_RP_2023_278675.pdf",
    "downloadPath": "/Users/you/regrid-scraper/downloads",
    "filmCode": "RP-2023-278675",
    "fileSize": 524288
  }
}
```

## Debugging

### Debug Screenshots
When the scraper fails to find the search interface, it automatically saves a screenshot:
```
debug-hcad-[timestamp].png
```

Check this screenshot to see what page is actually loading.

### Verbose Logging
Enable verbose logging to see detailed step-by-step progress:
```javascript
const scraper = new HarrisCountyTexasScraper({ verbose: true });
```

### Common Issues

#### Issue: "Could not find address input field"
**Cause**: Cloudflare challenge didn't complete

**Solutions**:
1. Add 2captcha API key to environment
2. Run with `headless: false` and manually complete challenge
3. Increase wait times in the scraper
4. Use residential proxies

#### Issue: "Timeout waiting for search interface"
**Cause**: Page didn't load or is still showing Cloudflare

**Solutions**:
1. Check the debug screenshot
2. Increase timeout value
3. Try running manually with `headless: false`

#### Issue: "Could not find account number link"
**Cause**: Address not found or wrong format

**Solutions**:
1. Verify the address exists in Harris County
2. Try a different address format (just street, no city/state)
3. Check if search returned "0 results"

## Testing

Run the test script:
```bash
node test-harris-county.js
```

Test with your own address:
```javascript
const result = await scraper.getPriorDeed('YOUR ADDRESS HERE');
```

## Cost Estimate (with 2captcha)

- 2captcha pricing: ~$2.99 per 1000 reCAPTCHAs
- Most pages: No reCAPTCHA needed (just Cloudflare wait)
- Occasional reCAPTCHA: $0.003 per solve
- Typical cost per deed: $0.00 - $0.01

## Limits and Rate Limiting

- HCAD doesn't have explicit rate limits
- Cloudflare may trigger more challenges if scraping too fast
- Recommended: 5-10 second delays between requests
- Use the built-in `randomWait()` function

## Support

For issues specific to:
- **HCAD website changes**: Update selectors in `harris-county-texas.js`
- **Cloudflare blocking**: Adjust wait times, use 2captcha, or use proxies
- **Clerk website changes**: Update selectors in `searchClerkRecords()` method

## Example: Batch Processing

```javascript
const addresses = [
  '5019 Lymbar Dr Houston TX 77096',
  '123 Main St Houston TX 77002',
  // ... more addresses
];

async function processBatch() {
  const scraper = new HarrisCountyTexasScraper({ verbose: true });

  for (const address of addresses) {
    try {
      console.log(`Processing: ${address}`);
      const result = await scraper.getPriorDeed(address);

      if (result.success) {
        console.log(`✓ Downloaded: ${result.download.filename}`);
      } else {
        console.log(`✗ Failed: ${result.message}`);
      }

      // Wait between requests to avoid rate limiting
      await new Promise(r => setTimeout(r, 10000)); // 10 seconds

    } catch (error) {
      console.error(`Error processing ${address}:`, error);
    }
  }

  await scraper.close();
}

processBatch();
```

## Contributing

To add support for additional counties, use this implementation as a template:
1. Create a new file in `county-implementations/`
2. Extend `DeedScraper` class
3. Implement county-specific methods
4. Add tests

## License

Same as parent project.
