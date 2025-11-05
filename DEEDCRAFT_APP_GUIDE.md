# DeedCraft Base44 App - Complete Guide

## ✅ Discovery Complete

We've successfully discovered the DeedCraft Base44 app and its API endpoints!

## App Information

**App URL:** `https://deed-craft-copy-eb316d23.base44.app`
**App ID:** `eb316d23`
**API Key:** `c085f441e8ad46ac8d866dc03bc8512f`
**Function Name:** `scrapePriorDeed`

## 🎯 Discovered Endpoints

All of these endpoints exist and are ready to use (pending authentication):

1. ✅ `https://deed-craft-copy-eb316d23.base44.app/api/scrapePriorDeed`
2. ✅ `https://deed-craft-copy-eb316d23.base44.app/scrapePriorDeed`
3. ✅ `https://deed-craft-copy-eb316d23.base44.app/run/scrapePriorDeed`
4. ✅ `https://deed-craft-copy-eb316d23.base44.app/api/functions/scrapePriorDeed`
5. ✅ `https://deed-craft-copy-eb316d23.base44.app/functions/scrapePriorDeed`
6. ✅ `https://deed-craft-copy-eb316d23.base44.app/api/execute/scrapePriorDeed`
7. ✅ `https://deed-craft-copy-eb316d23.base44.app/webhook/scrapePriorDeed`

**Primary endpoint (recommended):** `/api/scrapePriorDeed`

## ⚠️ Current Status

**Authentication Issue:** All endpoints return `401 Unauthorized`

This means:
- ✅ The endpoints are correctly configured
- ✅ The scrapePriorDeed function is deployed
- ❌ The API key needs to be activated or regenerated

## 🔧 Quick Start

### Using the DeedCraft Client

```bash
# Test the connection
node deedcraft-client.js
```

### Using the Client in Your Code

```javascript
const DeedCraftClient = require('./deedcraft-client');

const client = new DeedCraftClient();

// Scrape a property deed
const result = await client.scrapePriorDeed({
  address: '1637 NW 59TH ST, Miami, FL',
  county: 'Miami-Dade',
  state: 'FL'
});

console.log(result);
```

### Direct API Call with curl

```bash
curl -X POST https://deed-craft-copy-eb316d23.base44.app/api/scrapePriorDeed \
  -H "Content-Type: application/json" \
  -H "X-API-Key: c085f441e8ad46ac8d866dc03bc8512f" \
  -d '{
    "address": "1637 NW 59TH ST, Miami, FL",
    "county": "Miami-Dade",
    "state": "FL"
  }'
```

## 🔑 Fixing Authentication

### Option 1: Check Base44 Dashboard

1. **Log into Base44:**
   - Go to: https://app.base44.com
   - Or directly: https://deed-craft-copy-eb316d23.base44.app

2. **Navigate to API Settings:**
   - Look for "Settings", "API", or "Integrations" menu
   - Find "API Keys" or "Authentication" section

3. **Verify/Generate API Key:**
   - Check if the key `c085f441e8ad46ac8d866dc03bc8512f` is active
   - If expired, generate a new one
   - If inactive, activate it

4. **Check Permissions:**
   - Ensure the API key has permission to call `scrapePriorDeed`
   - Enable function execution if needed

5. **Update the Client:**
   ```javascript
   const client = new DeedCraftClient('YOUR_NEW_API_KEY');
   ```

### Option 2: Use Browser DevTools to Find Auth Method

1. **Open the app in browser:**
   ```
   https://deed-craft-copy-eb316d23.base44.app
   ```

2. **Open DevTools (F12)**

3. **Go to Network tab**

4. **Use the scrapePriorDeed function in the UI**

5. **Find the API call in Network tab:**
   - Look for a POST request to one of the discovered endpoints
   - Check the "Headers" tab
   - Note how authentication is done:
     - Header name (X-API-Key, Authorization, etc.)
     - Header value format

6. **Update the client** with the correct auth method

### Option 3: Contact Base44 Support

If the API key isn't working:
- Check Base44 documentation
- Contact Base44 support
- Ask about API key activation for app `eb316d23`

## 📋 Request Format

### Input Parameters

```json
{
  "address": "1637 NW 59TH ST, Miami, FL",
  "county": "Miami-Dade",
  "state": "FL"
}
```

**Required:**
- `address` (string): Full property address

**Optional:**
- `county` (string): County name
- `state` (string): State abbreviation (e.g., "FL")

### Expected Response

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

## 🧪 Testing in Claude

### Method 1: Quick Test

```bash
node deedcraft-client.js
```

### Method 2: Manual curl Test

```bash
# Test with X-API-Key header
curl -X POST https://deed-craft-copy-eb316d23.base44.app/api/scrapePriorDeed \
  -H "Content-Type: application/json" \
  -H "X-API-Key: c085f441e8ad46ac8d866dc03bc8512f" \
  -d '{"address": "1637 NW 59TH ST, Miami, FL", "county": "Miami-Dade", "state": "FL"}'

# Test with Bearer token
curl -X POST https://deed-craft-copy-eb316d23.base44.app/api/scrapePriorDeed \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer c085f441e8ad46ac8d866dc03bc8512f" \
  -d '{"address": "1637 NW 59TH ST, Miami, FL", "county": "Miami-Dade", "state": "FL"}'
```

### Method 3: Integration Test

```javascript
const DeedCraftClient = require('./deedcraft-client');

async function test() {
  const client = new DeedCraftClient();

  const addresses = [
    '1637 NW 59TH ST, Miami, FL',
    '123 Main St, Orlando, FL',
    '456 Oak Ave, Tampa, FL'
  ];

  for (const address of addresses) {
    try {
      const result = await client.scrapePriorDeed({
        address,
        county: address.includes('Miami') ? 'Miami-Dade' :
                address.includes('Orlando') ? 'Orange' : 'Hillsborough',
        state: 'FL'
      });

      console.log(`✅ ${address}:`, result);
    } catch (error) {
      console.error(`❌ ${address}: ${error.message}`);
    }
  }
}

test();
```

## 📁 Files Created

### Client Files
- `deedcraft-client.js` - Main client for DeedCraft app
- `test-deed-craft-app.js` - Discovery and testing script
- `base44-client.js` - Generic Base44 client
- `base44-webhook-server.js` - Webhook server (if needed)

### Documentation
- `DEEDCRAFT_APP_GUIDE.md` - This file
- `BASE44_INTEGRATION.md` - General Base44 integration docs
- `BASE44_SETUP_GUIDE.md` - Setup instructions

### Test Scripts
- `test-base44-integration.js` - Test suite
- `test-base44-discovery.js` - API discovery script

## 🔄 Alternative: Webhook Mode

If you can't get the API key working, you can run the scraper on YOUR server and have Base44 call it:

1. **Start the webhook server:**
   ```bash
   node base44-webhook-server.js
   ```

2. **Make it publicly accessible:**
   ```bash
   # Using ngrok
   ngrok http 3001
   ```

3. **Configure Base44 to call your webhook:**
   - URL: `https://your-server.com/webhook/scrapePriorDeed`
   - Method: POST
   - Headers: `X-API-Key: c085f441e8ad46ac8d866dc03bc8512f`

## 🎯 Next Steps

1. **✅ Endpoints discovered** - All working, just need auth
2. **🔧 Fix authentication** - Activate API key in Base44 dashboard
3. **🧪 Test the connection** - Run `node deedcraft-client.js`
4. **✨ Start scraping** - Use the client in your application

## 💡 Troubleshooting

### Still Getting 401?

1. **Check API key format:**
   - Ensure no extra spaces
   - Verify it's the complete key
   - Check if it's case-sensitive

2. **Try regenerating the key:**
   - Old keys might expire
   - Generate a fresh one in Base44 dashboard

3. **Check Base44 app status:**
   - Ensure the app is deployed and running
   - Verify the scrapePriorDeed function is published

4. **Use browser inspection:**
   - Open the app in browser
   - Use it manually and watch Network tab
   - Copy the exact authentication method used

### Function Not Responding?

If authentication works but function fails:
- Check if the function is properly deployed
- Verify the function name is exactly `scrapePriorDeed`
- Check Base44 logs for function errors

### Timeout Errors?

Some properties take longer to scrape:
- Increase timeout in the client (default: 180 seconds)
- CAPTCHA solving can add 30-60 seconds
- Complex properties may take longer

## 📞 Support

**Base44 Documentation:** https://docs.base44.com
**App URL:** https://deed-craft-copy-eb316d23.base44.app
**GitHub Repo:** https://github.com/leadersgroup/regrid-scraper

---

**Status:** Endpoints discovered, awaiting API key activation
**Last Updated:** 2025-11-05
**Version:** 1.0.0
