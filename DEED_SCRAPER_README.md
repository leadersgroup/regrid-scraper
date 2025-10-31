# Prior Deed Scraper

A comprehensive solution for downloading prior recorded deeds from property addresses using a 4-step automated workflow.

## Features

The Prior Deed Scraper automatically:

1. **Step 1**: Extracts parcel ID and owner name from Regrid.com using the property address
2. **Step 2**: Searches the county property assessor website for sale transaction records (document IDs or book/page numbers)
3. **Step 3**: Searches the county deed recorder office or county clerk website when direct links aren't available
4. **Step 4**: Falls back to owner name search if other methods fail

## Installation

The deed scraper is already integrated into the existing regrid-scraper project. No additional installation is required.

## Usage

### Option 1: Using the API Endpoint

Make a POST request to `/api/deed` with a property address:

```bash
curl -X POST http://localhost:3000/api/deed \
  -H "Content-Type: application/json" \
  -d '{"address": "123 Main St, Los Angeles, CA"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "address": "123 Main St, Los Angeles, CA",
    "timestamp": "2025-01-15T10:30:00.000Z",
    "steps": {
      "step1": {
        "success": true,
        "parcelId": "1234567890",
        "ownerName": "JOHN SMITH",
        "county": "Los Angeles",
        "state": "CA"
      },
      "step2": {
        "success": true,
        "transactions": [
          {
            "documentId": "2023-0012345",
            "recordDate": "2023-05-15",
            "downloadUrl": "https://..."
          }
        ]
      }
    },
    "download": {
      "success": true,
      "filename": "deed_2023-0012345_1705318200000.pdf",
      "downloadPath": "./downloads",
      "timestamp": "2025-01-15T10:30:00.000Z"
    }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Option 2: Using the DeedScraper Class Directly

```javascript
const DeedScraper = require('./deed-scraper');

async function downloadDeed() {
  const scraper = new DeedScraper({
    headless: true,
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    const result = await scraper.getPriorDeed('123 Main St, Los Angeles, CA');

    console.log('Result:', JSON.stringify(result, null, 2));

    if (result.success && result.download) {
      console.log(`Downloaded deed to: ${result.download.filename}`);
    }
  } finally {
    await scraper.close();
  }
}

downloadDeed();
```

### Option 3: Using Individual Steps

You can also use individual steps of the workflow:

```javascript
const DeedScraper = require('./deed-scraper');

async function customWorkflow() {
  const scraper = new DeedScraper({ verbose: true });
  await scraper.initialize();

  try {
    // Step 1: Get property data from Regrid
    const propertyData = await scraper.getPropertyDataFromRegrid('123 Main St, Los Angeles, CA');
    console.log('Property Data:', propertyData);

    // Step 2: Search property assessor
    const assessorResults = await scraper.searchPropertyAssessor(propertyData);
    console.log('Assessor Results:', assessorResults);

    // Step 3: Search deed recorder
    const deedRecords = await scraper.searchDeedRecorder(assessorResults);
    console.log('Deed Records:', deedRecords);

    // Step 4: Fallback to owner name search
    const ownerResults = await scraper.searchByOwnerName(propertyData);
    console.log('Owner Search Results:', ownerResults);

  } finally {
    await scraper.close();
  }
}

customWorkflow();
```

## Configuration

### Constructor Options

```javascript
const scraper = new DeedScraper({
  headless: true,        // Run browser in headless mode (default: true)
  timeout: 60000,        // Timeout for page loads in ms (default: 60000)
  verbose: true          // Enable verbose logging (default: false)
});
```

### Environment Variables

- `DEED_DOWNLOAD_PATH`: Directory for downloaded deeds (default: `./downloads`)
- `RAILWAY_ENVIRONMENT_NAME`: Automatically detected for Railway deployments
- `RAILWAY_PROJECT_NAME`: Automatically detected for Railway deployments

## Workflow Details

### Step 1: Regrid.com Data Extraction

The scraper navigates to [Regrid.com](https://app.regrid.com) and:
- Searches for the property using the provided address
- Extracts parcel ID using position-based parsing (field above owner name)
- Extracts owner name using pattern matching and CSS selectors
- Identifies county and state information

### Step 2: County Property Assessor Search

The scraper searches the county property assessor website:
- Uses the parcel ID or address to find the property
- Looks for sale transaction records
- Extracts document IDs or book/page number combinations
- Checks for direct download links to deeds

### Step 3: Deed Recorder Office Search

If no direct links are found in Step 2:
- Navigates to the county deed recorder or clerk website
- Searches using document ID or book/page numbers
- Retrieves deed documents with download links

### Step 4: Owner Name Fallback

If previous steps fail to find transaction records:
- Searches the deed recorder office by owner name (grantee)
- Returns all deeds where the owner is listed as grantee (buyer)

## County Support

The scraper includes pre-configured URLs for the following counties:

### California
- Los Angeles County
- Orange County
- San Diego County

### Florida
- Miami-Dade County
- Broward County

### Texas
- Harris County (Houston)
- Dallas County

### Adding New Counties

To add support for additional counties, edit the `getAssessorUrl()` and `getDeedRecorderUrl()` methods in [deed-scraper.js](deed-scraper.js):

```javascript
getAssessorUrl(county, state) {
  const assessorUrls = {
    'YourCounty_ST': 'https://your-county-assessor-url.com',
    // ... add more counties
  };

  const key = `${county}_${state}`;
  return assessorUrls[key] || null;
}
```

## County-Specific Implementation

The current implementation provides a **framework** for deed downloading. For full functionality, you'll need to implement county-specific scraping logic:

### Required Implementations

1. **searchAssessorSite()** - Parse assessor search results for your county
2. **extractTransactionRecords()** - Extract transaction data from assessor pages
3. **searchByDocumentId()** - Search recorder office by document ID
4. **searchByBookPage()** - Search recorder office by book/page numbers
5. **searchByGranteeName()** - Search recorder office by owner name

Each county has different:
- Search form structures
- Field names and selectors
- Result page layouts
- Download mechanisms

### Example: Implementing Los Angeles County Assessor Search

```javascript
async searchAssessorSite(parcelId, ownerName) {
  if (this.currentCounty === 'Los Angeles' && this.currentState === 'CA') {
    // LA County-specific implementation
    const searchInput = await this.page.$('#ain'); // Assessor Identification Number
    await searchInput.type(parcelId);
    await this.page.click('#searchButton');
    await this.page.waitForNavigation();

    // Check if property was found
    const propertyFound = await this.page.$('.property-info');
    return { success: !!propertyFound };
  }

  // Default implementation for other counties
  return { success: false, message: 'County-specific implementation needed' };
}
```

## Testing

Run the test script to verify the scraper is working:

```bash
node test-deed-scraper.js
```

The test script will:
- Test multiple property addresses
- Show detailed logs of each step
- Display the final results in JSON format

## API Endpoints

### POST `/api/deed`

Download prior deed for a property address.

**Request Body:**
```json
{
  "address": "123 Main St, Los Angeles, CA"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "123 Main St, Los Angeles, CA",
    "steps": { ... },
    "download": { ... }
  },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Download Locations

Downloaded deeds are saved to:
- Default: `./downloads/` directory in project root
- Custom: Set via `DEED_DOWNLOAD_PATH` environment variable

File naming convention:
```
deed_{documentId}_{timestamp}.pdf
deed_{bookNumber}_{pageNumber}_{timestamp}.pdf
```

## Anti-Detection Features

The scraper includes sophisticated anti-bot measures:
- Randomized user agents
- Realistic viewport sizes
- Human-like typing delays
- Random mouse movements
- Natural wait times between actions
- Removal of automation markers (`navigator.webdriver`)

## Error Handling

The scraper handles various error scenarios:
- Missing search inputs on websites
- Rate limiting (429 errors)
- Timeout errors
- Invalid addresses
- Properties not found
- Missing transaction records

All errors are logged and returned in the response with detailed messages.

## Limitations

1. **County-Specific Implementation Required**: The framework is in place, but each county requires custom scraping logic due to varying website structures.

2. **Rate Limiting**: Some county websites implement rate limiting. The scraper includes delays, but you may need to adjust them.

3. **Authentication**: Some counties require login or payment for deed access. These scenarios are not currently handled.

4. **PDF Downloads**: The download mechanism assumes PDFs are directly downloadable. Some counties may use viewer applications that require different extraction methods.

5. **Website Changes**: County websites may change their structure, requiring updates to selectors and logic.

## Future Enhancements

- [ ] Implement county-specific logic for top 50 US counties
- [ ] Add PDF text extraction and parsing
- [ ] Implement authentication for counties requiring login
- [ ] Add caching to avoid redundant searches
- [ ] Support bulk deed downloads
- [ ] Add OCR for scanned deeds
- [ ] Extract structured data from deeds (grantors, grantees, dates, amounts)

## Contributing

To add support for a new county:

1. Add the assessor and recorder URLs to `getAssessorUrl()` and `getDeedRecorderUrl()`
2. Implement county-specific search logic in the helper methods
3. Test thoroughly with multiple addresses in that county
4. Submit a pull request with your changes

## License

MIT

## Support

For issues or questions:
1. Check the verbose logs by setting `verbose: true`
2. Review the county-specific implementation requirements
3. Verify the county websites are accessible
4. Check for rate limiting or captchas
