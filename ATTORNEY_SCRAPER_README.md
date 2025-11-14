# California Estate Planning Attorney Research & Attio CRM Integration

## Overview

This tool automatically researches and collects contact information for estate planning attorneys in California and uploads the data to your Attio CRM workspace.

## Features

- **Multi-Source Research**: Searches Avvo, Justia, Lawyers.com, and other legal directories
- **Comprehensive Data Collection**: Name, firm, location, phone, email, website, and more
- **Automatic Deduplication**: Removes duplicate entries based on name and firm
- **Attio CRM Integration**: Automatically creates person and company records
- **Data Quality Reporting**: Provides completeness metrics and source breakdown
- **CSV/JSON Export**: Saves data locally for backup and manual review

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Attio API

1. Log in to your Attio account at https://app.attio.com
2. Navigate to Settings > API (https://app.attio.com/settings/api)
3. Create a new API key with the following permissions:
   - `person:read-write`
   - `company:read-write`
   - `note:read-write`
4. Copy your API key

### 3. Set Environment Variables

Create a `.env` file or export environment variables:

```bash
export ATTIO_API_KEY="your_api_key_here"
```

Or copy the example file:

```bash
cp .env.attorney .env
# Then edit .env with your actual API key
```

## Usage

### Basic Usage

Run the script to collect 50 California estate planning attorneys:

```bash
node estate-attorney-scraper.js
```

### Custom Configuration

Edit the `CONFIG` object in `estate-attorney-scraper.js`:

```javascript
const CONFIG = {
  TARGET_COUNT: 50,           // Number of attorneys to collect
  STATE: 'California',        // Target state
  PRACTICE_AREA: 'Estate Planning',
  OUTPUT_DIR: './attorney-data',
  ATTIO_API_KEY: process.env.ATTIO_API_KEY,
  ATTIO_WORKSPACE_ID: process.env.ATTIO_WORKSPACE_ID
};
```

## Output

The script generates the following outputs:

### 1. JSON File
`./attorney-data/california-estate-attorneys.json`

Complete attorney data in JSON format for programmatic use.

### 2. CSV File
`./attorney-data/california-estate-attorneys.csv`

Spreadsheet-compatible format with columns:
- Name
- Firm
- Location
- Phone
- Email
- Website
- Source

### 3. Attio CRM Records

For each attorney:
- **Person Record**: Contains name, contact info, job title
- **Company Record**: Law firm details (if applicable)
- **Note**: Source information and practice area details

## Data Sources

The script searches multiple high-quality legal directories:

1. **Avvo** (www.avvo.com)
   - Attorney ratings and reviews
   - Verified contact information
   - Practice area specializations

2. **Justia** (www.justia.com)
   - Comprehensive attorney listings
   - Free lawyer directory
   - Detailed practice area filters

3. **Lawyers.com** (www.lawyers.com)
   - Attorney profiles and reviews
   - Contact information
   - Law firm details

## Geographic Coverage

The script searches major California cities including:

- Los Angeles
- San Francisco
- San Diego
- San Jose
- Sacramento
- Oakland
- Fresno
- Long Beach
- Bakersfield
- Anaheim
- Santa Ana
- Riverside
- Irvine
- Pasadena
- Newport Beach
- Beverly Hills

## Data Quality

The script ensures high data quality through:

- **Automatic Deduplication**: Removes duplicate attorneys based on name and firm
- **Data Validation**: Checks for minimum required fields
- **Source Tracking**: Records where each contact was found
- **Error Handling**: Gracefully handles missing or invalid data
- **Verification**: Cross-references multiple sources when possible

## Attio CRM Integration Details

### Person Record Structure

```json
{
  "name": "Attorney Name",
  "email_addresses": [{"email_address": "attorney@lawfirm.com"}],
  "phone_numbers": [{"phone_number": "(555) 123-4567"}],
  "location": "Los Angeles, CA",
  "job_title": "Estate Planning Attorney",
  "company": {"target_record_id": "company_id"}
}
```

### Company Record Structure

```json
{
  "name": "Law Firm Name",
  "website": "https://lawfirm.com",
  "location": "Los Angeles, CA"
}
```

### Notes

Each attorney record includes a note with:
- Data source (Avvo, Justia, etc.)
- Original website URL
- Practice area confirmation
- State verification

## Troubleshooting

### API Connection Issues

If you see "Attio API connection failed":

1. Verify your API key is correct
2. Check API key permissions (should include person and company read-write)
3. Ensure you're not hitting rate limits

### Low Attorney Count

If fewer than expected attorneys are collected:

1. Check your internet connection
2. Some sites may be blocking automated access
3. Try running the script with a smaller `TARGET_COUNT` first
4. Review console output for specific error messages

### Missing Data Fields

Some attorneys may have incomplete data:

- **Email**: Often not publicly listed on directories
- **Phone**: May be firm main line rather than direct
- **Website**: Not all attorneys have personal websites

The script collects all available public information.

## Rate Limiting

The script includes built-in rate limiting:

- 2-second delay between cities
- 1-second delay between Attio API calls
- Respects robots.txt and site terms of service

## Legal & Ethical Compliance

This script:

- ✅ Only collects publicly available information
- ✅ Respects website terms of service
- ✅ Includes rate limiting to avoid server burden
- ✅ Does not bypass authentication or paywalls
- ✅ Complies with data privacy regulations

## Data Privacy

The collected information is:

- Publicly available on legal directories
- Professional contact information (not personal)
- Used for legitimate business purposes (lead generation)
- Stored securely in your Attio CRM workspace

## Support

For issues or questions:

1. Check the console output for error messages
2. Review the generated CSV file for data quality
3. Verify Attio API credentials
4. Check that dependencies are installed correctly

## Example Output

```
═══════════════════════════════════════════════════════════
  California Estate Planning Attorney Research & CRM Upload
═══════════════════════════════════════════════════════════

Target: 50 attorneys
State: California
Practice Area: Estate Planning

📋 Step 1: Initializing Attio CRM connection...
✓ Attio API connection successful

📋 Step 2: Collecting attorney contact information...

🔍 Searching Avvo for attorneys in Los Angeles, CA...
✓ Found 12 attorneys on Avvo

🔍 Searching Justia for attorneys in Los Angeles, CA...
✓ Found 10 attorneys on Justia

Progress: 22/50 attorneys collected

...

✓ Collection complete: 50 unique attorneys

📋 Step 3: Saving collected data...
💾 Data saved to: ./attorney-data/california-estate-attorneys.json
📄 CSV exported to: ./attorney-data/california-estate-attorneys.csv

📋 Step 4: Uploading to Attio CRM...

[1/50] Processing: John Smith
  ✓ Created company: Smith & Associates
  ✓ Created person: John Smith
  ✓ Added source note

...

═══════════════════════════════════════════════════════════
  UPLOAD SUMMARY
═══════════════════════════════════════════════════════════
✓ Successfully uploaded: 50
✗ Failed uploads: 0
📊 Total attorneys collected: 50

═══════════════════════════════════════════════════════════
  COLLECTION SUMMARY
═══════════════════════════════════════════════════════════
📊 Total attorneys collected: 50
📁 JSON file: ./attorney-data/california-estate-attorneys.json
📄 CSV file: ./attorney-data/california-estate-attorneys.csv

📍 Sources:
  - Avvo: 18 attorneys
  - Justia: 17 attorneys
  - Lawyers.com: 15 attorneys

📈 Data Completeness:
  - With email: 23 (46%)
  - With phone: 48 (96%)
  - With website: 42 (84%)

✅ Process completed successfully!
```

## Next Steps

After running the script:

1. **Review Data Quality**: Check the CSV file for completeness
2. **Verify Attio Upload**: Log in to Attio and review imported records
3. **Tag Records**: Add tags in Attio for segmentation (e.g., "California", "Estate Planning", "Lead - Cold")
4. **Set Up Lists**: Create Attio lists for organizing these contacts
5. **Plan Outreach**: Use the data for marketing campaigns

## Advanced Usage

### Programmatic Use

You can import and use the modules in your own scripts:

```javascript
const { AttorneyCollector, AttioClient, uploadToAttio } = require('./estate-attorney-scraper');

async function customWorkflow() {
  const collector = new AttorneyCollector();
  const attorneys = await collector.collectAttorneys(100); // Collect 100 attorneys

  // Custom processing
  const filtered = attorneys.filter(a => a.email); // Only those with email

  const attioClient = new AttioClient(process.env.ATTIO_API_KEY);
  await uploadToAttio(filtered, attioClient);
}
```

### Extending Data Sources

Add new data sources by implementing similar search methods:

```javascript
async searchNewSource(browser, city, limit = 10) {
  console.log(`🔍 Searching NewSource for attorneys in ${city}, CA...`);
  const page = await browser.newPage();

  try {
    // Your search implementation
    const searchUrl = `https://newsource.com/search?city=${city}`;
    await page.goto(searchUrl);

    // Extract attorney data
    const attorneys = await page.evaluate(() => {
      // Extraction logic
    });

    return attorneys;
  } finally {
    await page.close();
  }
}
```

## License

MIT License - See main project LICENSE file for details.
