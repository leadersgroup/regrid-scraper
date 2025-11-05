# Base44 Integration Setup Guide

## Overview

This guide explains how to integrate your `scrapePriorDeed` function with Base44. Base44 can work in two ways:

1. **Outbound Mode**: Your code calls Base44's API
2. **Webhook Mode**: Base44 calls your server via webhooks

## Current Status

✅ **Client Created**: `base44-client.js` - For calling Base44 API
✅ **Webhook Server Created**: `base44-webhook-server.js` - For receiving calls from Base44
✅ **Test Script Created**: `test-base44-integration.js` - For testing the integration
⚠️ **Authentication Issue**: Base44 expects JWT tokens, not simple API keys

## Authentication Problem

When testing, we encountered this error:
```
401 Unauthorized: Jwt is not in the form of Header.Payload.Signature with two dots and 3 sections
```

This means:
- Base44 requires a **JWT token** for authentication
- The API key `c085f441e8ad46ac8d866dc03bc8512f` is not a JWT
- You need to obtain a JWT token from Base44

## How to Get a JWT Token

### Option 1: Base44 Dashboard
1. Log into Base44 at https://app.base44.com
2. Navigate to your app: `68c355d9fe4a6373eb316d23`
3. Look for API keys or authentication tokens
4. Generate or copy a JWT token
5. Replace the API key in the configuration

### Option 2: Authentication Endpoint
Some platforms require you to authenticate first to get a JWT:

```javascript
// Example: Login to get JWT
const axios = require('axios');

async function getJwtToken() {
  const response = await axios.post('https://app.base44.com/api/auth/login', {
    apiKey: 'c085f441e8ad46ac8d866dc03bc8512f'
  });

  return response.data.token; // JWT token
}
```

### Option 3: Contact Base44 Support
- Check Base44 documentation at https://docs.base44.com
- Contact Base44 support for JWT token generation
- Ask about API authentication methods

## Setup Instructions

### Mode 1: Calling Base44 (Outbound)

If Base44 hosts your function and you want to call it:

1. **Get the JWT token** (see above)

2. **Update the API key in your code:**

```javascript
const Base44Client = require('./base44-client');

const client = new Base44Client({
  appId: '68c355d9fe4a6373eb316d23',
  apiKey: 'YOUR_JWT_TOKEN_HERE' // Replace with actual JWT
});
```

3. **Call the function:**

```javascript
const result = await client.scrapePriorDeed({
  address: '1637 NW 59TH ST, Miami, FL',
  county: 'Miami-Dade',
  state: 'FL'
});
```

4. **Test it:**

```bash
node test-base44-integration.js
```

### Mode 2: Webhook Server (Inbound)

If Base44 needs to call YOUR server:

1. **Start the webhook server:**

```bash
node base44-webhook-server.js
```

Output:
```
🚀 Base44 Webhook Server started
📡 Listening on port 3001
🔗 Webhook URL: http://localhost:3001/webhook/scrapePriorDeed
🔑 API Key: c085f441e8ad46ac8d866dc03bc8512f
```

2. **Make the server publicly accessible:**

Option A - Using ngrok (for testing):
```bash
ngrok http 3001
```

This gives you a public URL like: `https://abc123.ngrok.io`

Option B - Deploy to a cloud platform:
- Railway
- Heroku
- DigitalOcean
- AWS

3. **Configure Base44 to call your webhook:**

In Base44 app settings:
- Webhook URL: `https://your-server.com/webhook/scrapePriorDeed`
- Method: `POST`
- Headers: `X-API-Key: c085f441e8ad46ac8d866dc03bc8512f`
- Body format: `{ "address": "...", "county": "...", "state": "..." }`

4. **Test the webhook locally:**

```bash
curl -X POST http://localhost:3001/webhook/scrapePriorDeed \
  -H "Content-Type: application/json" \
  -H "X-API-Key: c085f441e8ad46ac8d866dc03bc8512f" \
  -d '{
    "address": "1637 NW 59TH ST, Miami, FL",
    "county": "Miami-Dade",
    "state": "FL"
  }'
```

## Determining Which Mode to Use

**Use Outbound Mode (base44-client.js) when:**
- Base44 hosts the scraper function
- You want to trigger scraping from your code
- Base44 manages the infrastructure

**Use Webhook Mode (base44-webhook-server.js) when:**
- You host the scraper on your own server
- Base44 triggers the scraping
- You want full control over the infrastructure

## File Structure

```
regrid-scraper/
├── base44-client.js              # Client for calling Base44 API
├── base44-webhook-server.js      # Server for receiving Base44 webhooks
├── test-base44-integration.js    # Test suite
├── BASE44_INTEGRATION.md         # Detailed API documentation
└── BASE44_SETUP_GUIDE.md         # This file
```

## Testing Checklist

- [ ] Obtain JWT token from Base44
- [ ] Update API key in base44-client.js
- [ ] Run `node test-base44-integration.js`
- [ ] Verify authentication succeeds
- [ ] Test with a real address
- [ ] Check if PDF downloads successfully

For webhook mode:
- [ ] Start webhook server
- [ ] Make server publicly accessible
- [ ] Configure webhook URL in Base44
- [ ] Test webhook with curl
- [ ] Verify Base44 can reach your server

## Troubleshooting

### Issue: 401 Unauthorized
- **Problem**: JWT token is invalid or missing
- **Solution**: Get a valid JWT token from Base44 dashboard

### Issue: Cannot connect to Base44
- **Problem**: Wrong URL or app ID
- **Solution**: Verify app ID `68c355d9fe4a6373eb316d23` is correct

### Issue: Webhook not receiving requests
- **Problem**: Server not publicly accessible
- **Solution**: Use ngrok or deploy to cloud platform

### Issue: Function not found
- **Problem**: scrapePriorDeed not deployed in Base44
- **Solution**: Deploy the function or use webhook mode instead

## Next Steps

1. **Contact Base44 support** to clarify authentication method
2. **Get the JWT token** from Base44 dashboard
3. **Choose your mode** (Outbound vs Webhook)
4. **Test the integration** with the test script
5. **Deploy to production** when tests pass

## Support Resources

- Base44 Documentation: https://docs.base44.com
- Base44 Support: https://app.base44.com (check for support option)
- Project Repository: https://github.com/leadersgroup/regrid-scraper

## Configuration Summary

```javascript
// Current Configuration
const config = {
  appId: '68c355d9fe4a6373eb316d23',
  apiKey: 'c085f441e8ad46ac8d866dc03bc8512f', // ⚠️ Not a JWT, needs replacement
  baseUrl: 'https://app.base44.com/api'
};

// What you need to find:
// 1. The correct JWT token
// 2. The correct API endpoint format
// 3. Whether to use outbound or webhook mode
```

---

**Created:** 2025-11-05
**Status:** Authentication pending JWT token resolution
