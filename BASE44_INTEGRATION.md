# Base44 Integration for scrapePriorDeed

## Overview

This document explains how to control and test the `scrapePriorDeed` function through the Base44 app platform.

## Configuration

**App ID:** `68c355d9fe4a6373eb316d23`
**API Key:** `c085f441e8ad46ac8d866dc03bc8512f`
**Base URL:** `https://app.base44.com/api`

## Files Created

### 1. `base44-client.js`
The main Base44 API client that provides methods to interact with the scrapePriorDeed function.

**Key Methods:**
- `scrapePriorDeed(params)` - Call the scraper function via Base44
- `scrapePriorDeedDirect(params)` - Alternative direct HTTP trigger method
- `getAppInfo()` - Retrieve app information
- `listFunctions()` - List available functions in the app

### 2. `test-base44-integration.js`
A comprehensive test suite for verifying the Base44 integration.

## Usage

### Method 1: Using the Base44 Client Directly

```javascript
const Base44Client = require('./base44-client');

const client = new Base44Client({
  appId: '68c355d9fe4a6373eb316d23',
  apiKey: 'c085f441e8ad46ac8d866dc03bc8512f'
});

// Scrape a deed
const result = await client.scrapePriorDeed({
  address: '1637 NW 59TH ST, Miami, FL',
  county: 'Miami-Dade',
  state: 'FL'
});

console.log(result);
```

### Method 2: Running the Test Script

```bash
# Run the comprehensive test suite
node test-base44-integration.js
```

### Method 3: Quick Test via Client

```bash
# Run the client directly with built-in test
node base44-client.js
```

## API Endpoints

The client tries multiple possible URL patterns to find the correct Base44 endpoint:

1. `https://app.base44.com/api/apps/{appId}/functions/scrapePriorDeed`
2. `https://app.base44.com/api/apps/{appId}/scrapePriorDeed`
3. `https://app.base44.com/api/apps/{appId}/run/scrapePriorDeed`
4. `https://app.base44.com/run/{appId}/scrapePriorDeed`
5. `https://app.base44.com/api/run/{appId}/scrapePriorDeed`

## Request Format

### Input Parameters

```json
{
  "address": "1637 NW 59TH ST, Miami, FL",
  "county": "Miami-Dade",
  "state": "FL"
}
```

**Parameters:**
- `address` (string, required) - Full property address
- `county` (string, required) - County name
- `state` (string, required) - State abbreviation (e.g., "FL")

### Response Format

```json
{
  "success": true,
  "data": {
    "address": "1637 NW 59TH ST, Miami, FL",
    "county": "Miami-Dade",
    "state": "FL",
    "folioNumber": "01-3211-063-0090",
    "salesData": {
      "salePrice": "$350,000",
      "saleDate": "2020-05-15"
    },
    "deedInfo": {
      "bookNumber": "12345",
      "pageNumber": "678",
      "instrumentNumber": "2020-123456"
    },
    "pdfUrl": "https://example.com/deed.pdf",
    "pdfPath": "/path/to/deed.pdf"
  },
  "timestamp": "2025-11-05T12:34:56.789Z"
}
```

## Testing in Claude

### Using the Test Script

Run the comprehensive test to verify the integration:

```bash
node test-base44-integration.js
```

The test script will:
1. ✅ Attempt to get app info from Base44
2. ✅ List available functions in the app
3. ✅ Call the scrapePriorDeed function with a test address
4. ✅ Try alternative direct HTTP trigger methods if needed

### Expected Output

```
🧪 Base44 Integration Test Suite
============================================================
App ID: 68c355d9fe4a6373eb316d23
API Key: c085f441...
============================================================

📋 Test 1: Get App Info
------------------------------------------------------------
✅ App info retrieved successfully
{
  "name": "Deed Scraper",
  "functions": ["scrapePriorDeed"]
}

📋 Test 2: List Available Functions
------------------------------------------------------------
✅ Functions listed successfully
["scrapePriorDeed"]

📋 Test 3: Call scrapePriorDeed Function
------------------------------------------------------------
Test: Miami-Dade Test
Address: 1637 NW 59TH ST, Miami, FL
County: Miami-Dade, State: FL

✅ Deed scraping completed in 45.23s

Result:
{
  "success": true,
  "data": { ... }
}

🎉 SUCCESS! The deed was scraped successfully.
📄 PDF URL: https://example.com/deed.pdf

============================================================
✨ Test suite completed
============================================================
```

## Authentication

The client uses Bearer token authentication:

```
Authorization: Bearer c085f441e8ad46ac8d866dc03bc8512f
```

Alternative authentication methods are also tried:

```
X-API-Key: c085f441e8ad46ac8d866dc03bc8512f
```

## Supported Counties

The scrapePriorDeed function supports the following counties:

| County | State | CAPTCHA | Status |
|--------|-------|---------|--------|
| Miami-Dade | FL | No | ✅ Supported |
| Orange | FL | Yes | ✅ Supported |
| Hillsborough | FL | No | ✅ Supported |
| Duval | FL | No | ✅ Supported |
| Broward | FL | No | ✅ Supported |
| Lee | FL | No | ✅ Supported |
| Pinellas | FL | No | ✅ Supported |
| Polk | FL | No | ✅ Supported |
| Brevard | FL | No | ✅ Supported |
| Palm Beach | FL | No | ✅ Supported |
| Davidson | TN | No | ✅ Supported |

## Error Handling

The client handles various error scenarios:

1. **Network Errors** - Retries with exponential backoff
2. **Invalid API Key** - Returns 401/403 error
3. **Invalid App ID** - Returns 404 error
4. **Function Not Found** - Tries alternative URL patterns
5. **Timeout** - Default 3-minute timeout for long-running scrapes

### Example Error Response

```json
{
  "success": false,
  "error": "Property not found",
  "message": "Could not locate property with the given address",
  "timestamp": "2025-11-05T12:34:56.789Z"
}
```

## Troubleshooting

### API Key Issues

If you receive authentication errors:

1. Verify the API key is correct: `c085f441e8ad46ac8d866dc03bc8512f`
2. Check if the key has expired
3. Ensure the app ID matches: `68c355d9fe4a6373eb316d23`

### URL Not Found (404)

If the API returns 404:

1. The client automatically tries multiple URL patterns
2. Check the Base44 documentation for the correct endpoint format
3. Verify the function is deployed in the Base44 app

### Timeout Errors

For timeout issues:

1. Increase the timeout in the client (default: 180 seconds)
2. Some properties take longer to scrape due to CAPTCHA solving
3. Check if the target county website is responding

### Function Not Working

If the scraping fails:

1. Test the local endpoint first: `POST http://localhost:3000/api/deed`
2. Verify the county is supported
3. Check the property address format
4. Review server logs for detailed error messages

## Integration with Base44 Platform

### How Base44 Works

Base44 likely works in one of these modes:

1. **Function-as-a-Service**: Your code runs on Base44's infrastructure
2. **Webhook Mode**: Base44 calls your server endpoints
3. **Proxy Mode**: Base44 proxies requests to your server

### Required Base44 Configuration

In your Base44 app settings, you may need to:

1. Set the function name to `scrapePriorDeed`
2. Configure the HTTP endpoint or webhook URL
3. Set environment variables if needed
4. Configure authentication/API keys

## Next Steps

1. ✅ Run `node test-base44-integration.js` to verify the integration
2. ✅ Test with different addresses and counties
3. ✅ Monitor the response times and success rates
4. ✅ Set up error logging and monitoring
5. ✅ Document any Base44-specific configuration needed

## Support

For issues or questions:

- Check the Base44 documentation
- Review the server logs at `/api/health` for system status
- Test the local API endpoint before testing via Base44
- Verify all required dependencies are installed: `npm install`

## Example: Complete Test Flow

```javascript
// 1. Initialize the client
const Base44Client = require('./base44-client');
const client = new Base44Client({
  appId: '68c355d9fe4a6373eb316d23',
  apiKey: 'c085f441e8ad46ac8d866dc03bc8512f'
});

// 2. Prepare test data
const testAddress = {
  address: '1637 NW 59TH ST, Miami, FL',
  county: 'Miami-Dade',
  state: 'FL'
};

// 3. Call the function
async function test() {
  try {
    console.log('🔄 Starting deed scrape...');
    const result = await client.scrapePriorDeed(testAddress);

    if (result.success) {
      console.log('✅ Success!');
      console.log('Folio:', result.data.folioNumber);
      console.log('PDF:', result.data.pdfUrl);
    } else {
      console.log('❌ Failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// 4. Run the test
test();
```

---

**Last Updated:** 2025-11-05
**Version:** 1.0.0
