# Quick Start: California Estate Planning Attorney Collection

## Overview

This tool will automatically research and collect contact information for 50 estate planning attorneys in California and upload them to your Attio CRM.

## Prerequisites

- Node.js installed (version 18 or higher)
- Attio CRM account with API access
- Internet connection

## 5-Minute Setup

### Step 1: Get Your Attio API Key

1. Visit https://app.attio.com/settings/api
2. Click "Create API key"
3. Name it: "Attorney Scraper"
4. Select permissions: `record:read-write` and `note:read-write`
5. Copy the API key (starts with `attio_sk_`)

### Step 2: Set Environment Variable

```bash
export ATTIO_API_KEY="attio_sk_your_actual_key_here"
```

Or create a `.env` file:

```bash
echo 'ATTIO_API_KEY=attio_sk_your_actual_key_here' > .env
```

### Step 3: Run the Collection Script

```bash
./run-attorney-collection.sh
```

That's it! The script will:
1. Test your Attio connection
2. Collect 50 attorney contacts from multiple sources
3. Save data to JSON and CSV files
4. Upload everything to your Attio workspace

## Expected Results

After 10-15 minutes, you'll have:

- 50 California estate planning attorneys
- Contact information: name, firm, phone, email (when available), website
- All data in Attio CRM as person records
- Backup CSV and JSON files in `./attorney-data/`

## What If It Doesn't Work?

### No Attio API Key?

Run without it - data will still be saved to CSV/JSON:

```bash
./run-attorney-collection.sh
# Choose "yes" when prompted to continue without Attio
```

Then manually import the CSV to Attio later.

### Connection Issues?

Test your Attio connection:

```bash
node test-attio-connection.js
```

### Need More Attorneys?

Edit `enhanced-attorney-scraper.js` and change:

```javascript
const CONFIG = {
  TARGET_COUNT: 100,  // Change from 50 to whatever you need
  // ...
}
```

## Manual Option

If automatic collection has issues, you can manually add attorneys to `manual-attorney-data.json`:

```json
[
  {
    "name": "Attorney Name",
    "firm": "Law Firm Name",
    "location": "City, CA",
    "phone": "(555) 123-4567",
    "email": "attorney@lawfirm.com",
    "website": "https://lawfirm.com",
    "source": "Manual Entry"
  }
]
```

Then run the scraper - it will include your manual entries.

## Output Files

All files are saved to `./attorney-data/`:

- `california-estate-attorneys.json` - Full data in JSON format
- `california-estate-attorneys.csv` - Spreadsheet format
- `progress.json` - Progress tracker (for resume capability)
- Screenshots - Debugging screenshots from each source

## Data Quality

Expected completeness:
- Name: 100%
- Firm: 95%
- Phone: 90%
- Location: 95%
- Website: 75%
- Email: 40% (many attorneys don't list emails publicly)

## Resume Capability

If the script is interrupted, just run it again:

```bash
./run-attorney-collection.sh
```

It will automatically resume from where it left off.

## Clear Progress and Start Fresh

```bash
rm -rf ./attorney-data/progress.json
./run-attorney-collection.sh
```

## Troubleshooting

### "Cannot find module"

```bash
npm install
```

### "ATTIO_API_KEY not set"

```bash
export ATTIO_API_KEY="your_key_here"
```

### "API connection failed: 401"

Your API key is invalid. Get a new one from https://app.attio.com/settings/api

### "API connection failed: 403"

Your API key lacks permissions. Recreate it with `record:read-write` scope.

### Collected fewer than 50 attorneys

Some sources may be temporarily unavailable. The script saves whatever it finds. You can:
1. Run it again later
2. Add manual data
3. Try different cities (edit the cities array in the script)

## Advanced Usage

### Run with custom Node script

```bash
node enhanced-attorney-scraper.js
```

### Test only (no upload)

```bash
# Unset API key temporarily
unset ATTIO_API_KEY
node enhanced-attorney-scraper.js
```

### Import CSV to Attio manually

1. Go to Attio > Import
2. Upload `./attorney-data/california-estate-attorneys.csv`
3. Map columns:
   - Name → Name
   - Email → Email Addresses
   - Phone → Phone Numbers
   - Firm → Company
   - Location → Location
   - Website → Website

## Next Steps After Collection

1. **Review in Attio**
   - Go to https://app.attio.com
   - Navigate to People
   - Filter by "Estate Planning Attorney"

2. **Create a List**
   - Create list: "CA Estate Planning - Cold Leads"
   - Add all imported attorneys

3. **Add Tags**
   - Tag: "California"
   - Tag: "Estate Planning"
   - Tag: "Lead - Cold"
   - Tag: "2025-11" (month collected)

4. **Enrich Data**
   - Use Attio's enrichment to find missing emails
   - Add LinkedIn profiles
   - Add notes about specializations

5. **Set Up Outreach**
   - Create email sequence in Attio
   - Set up automated workflows
   - Plan your messaging strategy

## Support

For issues or questions:

1. Read the full documentation: `cat ATTORNEY_SCRAPER_README.md`
2. Check Attio setup guide: `cat ATTIO_SETUP_GUIDE.md`
3. Review error messages in the console output
4. Check generated CSV file for data quality

## Example Session

```bash
$ export ATTIO_API_KEY="attio_sk_abc123..."

$ ./run-attorney-collection.sh

═══════════════════════════════════════════════════════════════════
  California Estate Planning Attorney Collection Tool
═══════════════════════════════════════════════════════════════════

✓ Node.js found: v18.17.0
✓ ATTIO_API_KEY found

Testing Attio connection...
✓ Attio API connection successful
  Workspace: My Company

═══════════════════════════════════════════════════════════════════
  Starting Attorney Collection
═══════════════════════════════════════════════════════════════════

Target: 50 estate planning attorneys in California
This may take 10-15 minutes...

[... collection process ...]

═══════════════════════════════════════════════════════════════════
  ✅ SUCCESS!
═══════════════════════════════════════════════════════════════════

Check your results:
  📁 JSON: ./attorney-data/california-estate-attorneys.json
  📄 CSV: ./attorney-data/california-estate-attorneys.csv
  ☁️  Attio: Check your workspace at https://app.attio.com

Next steps:
  1. Review the CSV file for data quality
  2. Log in to Attio to verify imported contacts
  3. Add tags and organize contacts into lists
  4. Begin your outreach campaign
```

## Files Created

This collection tool consists of:

- `enhanced-attorney-scraper.js` - Main collection script (recommended)
- `estate-attorney-scraper.js` - Original version
- `test-attio-connection.js` - API connection tester
- `run-attorney-collection.sh` - Quick start script
- `.env.attorney` - Environment template
- `ATTORNEY_SCRAPER_README.md` - Full documentation
- `ATTIO_SETUP_GUIDE.md` - Attio configuration guide
- `QUICK_START.md` - This file

## Legal & Ethical Notice

This tool:
- Only collects publicly available information
- Respects website terms of service
- Includes rate limiting to avoid server burden
- Complies with data privacy regulations
- Is intended for legitimate business use only

## Ready to Start?

```bash
export ATTIO_API_KEY="your_key_here"
./run-attorney-collection.sh
```

Happy collecting!
