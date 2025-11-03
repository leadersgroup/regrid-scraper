# Deed Scraper API Documentation

## Overview

The Deed Scraper API provides a RESTful interface for downloading prior deed PDFs from supported county recorder offices. The API handles all the complexity of web scraping, CAPTCHA solving, and PDF extraction.

## Base URL

```
http://localhost:3000
```

Or when deployed:
```
https://your-domain.com
```

## Authentication

Currently, the API does not require authentication for requests. However, a **2Captcha API key** must be configured on the server via the `TWOCAPTCHA_TOKEN` environment variable.

## Rate Limiting

- No built-in rate limiting currently
- Recommend implementing rate limiting in production
- Each request costs ~$0.001 for CAPTCHA solving
- Average request time: 90-120 seconds

---

## Endpoints

### 1. Health Check

Check if the API server is running and properly configured.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "captchaSolver": "enabled",
  "timestamp": "2025-11-01T19:20:00.000Z"
}
```

**Example:**
```bash
curl http://localhost:3000/api/health
```

---

### 2. List Supported Counties

Get a list of all supported counties and their features.

**Endpoint:** `GET /api/counties`

**Response:**
```json
{
  "success": true,
  "counties": [
    {
      "name": "Orange County",
      "state": "FL",
      "stateCode": "Florida",
      "features": [
        "Automatic CAPTCHA solving",
        "Full PDF download",
        "Transaction history extraction"
      ],
      "cost": "$0.001 per deed (with 2Captcha API)"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3000/api/counties
```

---

### 3. Get Prior Deed (Legacy)

Download a prior deed PDF for a given address. This is the original endpoint format.

**Endpoint:** `POST /api/getPriorDeed`

**Request Body:**

```json
{
  "address": "6431 Swanson St, Windermere, FL 34786",
  "county": "Orange",
  "state": "FL"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | **Yes** | Full street address including city, state, and ZIP |
| `county` | string | No | County name (default: "Orange") |
| `state` | string | No | State code (default: "FL") |

**Success Response (200 OK):**

Returns the full result from the scraper including all steps, transactions, and download information.

```json
{
  "success": true,
  "address": "6431 Swanson St, Windermere, FL 34786",
  "steps": {
    "step1": {
      "parcelId": "282330246500160",
      "county": "Orange",
      "state": "FL"
    },
    "step2": {
      "transactions": [...]
    }
  },
  "download": {
    "success": true,
    "filename": "deed_20170015765_1762024782019.pdf",
    "downloadPath": "./downloads",
    "documentId": "20170015765",
    "fileSize": 90551,
    "pdfUrl": "https://selfservice.or.occompt.com/ssweb/document/servepdf/..."
  },
  "duration": "95.34s",
  "timestamp": "2025-11-03T00:00:00.000Z"
}
```

---

### 4. Download Deed (Recommended)

Download a prior deed PDF for a given address with enhanced response formatting.

**Endpoint:** `POST /api/deed/download`

**Request Body:**

```json
{
  "address": "6431 Swanson St, Windermere, FL 34786",
  "county": "Orange",
  "state": "FL",
  "includeBase64": false,
  "options": {
    "headless": true,
    "timeout": 120000,
    "verbose": false
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | **Yes** | Full street address including city, state, and ZIP |
| `county` | string | No | County name (default: "Orange") |
| `state` | string | No | State code (default: "FL") |
| `includeBase64` | boolean | No | Include PDF as base64 in response (default: false) |
| `options.headless` | boolean | No | Run browser in headless mode (default: true) |
| `options.timeout` | number | No | Timeout in milliseconds (default: 120000) |
| `options.verbose` | boolean | No | Enable verbose logging (default: false) |

**Success Response (200 OK):**

```json
{
  "success": true,
  "message": "Deed downloaded successfully",
  "duration": "95.34s",
  "address": "6431 Swanson St, Windermere, FL 34786",
  "parcelId": "282330246500160",
  "county": "Orange",
  "state": "FL",
  "download": {
    "filename": "deed_20170015765_1762024782019.pdf",
    "filepath": "/Users/ll/Documents/regrid-scraper/downloads/deed_20170015765_1762024782019.pdf",
    "fileSize": 90551,
    "fileSizeKB": "88.43",
    "documentId": "20170015765",
    "pdfUrl": "https://selfservice.or.occompt.com/ssweb/document/servepdf/...",
    "timestamp": "2025-11-01T19:19:42.793Z"
  },
  "transactions": [
    {
      "documentId": "20170015765",
      "type": "document_id",
      "saleDate": "12/30/2016",
      "salePrice": "536000",
      "source": "Orange County Property Appraiser - Sales History"
    }
  ],
  "captchaSolved": true,
  "cost": "$0.001"
}
```

**Error Response (400 Bad Request):**

```json
{
  "success": false,
  "error": "Missing required parameter: address",
  "message": "Please provide an address to search for"
}
```

**Error Response (503 Service Unavailable):**

```json
{
  "success": false,
  "error": "CAPTCHA solver not configured",
  "message": "Set TWOCAPTCHA_TOKEN environment variable to enable deed downloads",
  "documentation": "See CAPTCHA_SOLVING_SETUP.md for setup instructions"
}
```

**Error Response (500 Internal Server Error):**

```json
{
  "success": false,
  "error": "Failed to download deed",
  "duration": "45.12s",
  "timestamp": "2025-11-01T19:20:00.000Z"
}
```

---

## Code Examples

### JavaScript (Node.js)

```javascript
const axios = require('axios');

async function downloadDeed(address) {
  try {
    const response = await axios.post('http://localhost:3000/api/deed/download', {
      address: address
    });

    console.log('Success!', response.data);
    console.log('PDF saved to:', response.data.download.filepath);

    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Usage
downloadDeed('6431 Swanson St, Windermere, FL 34786');
```

### Python

```python
import requests

def download_deed(address):
    url = 'http://localhost:3000/api/deed/download'

    payload = {
        'address': address
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()

        data = response.json()
        print(f"Success! PDF saved to: {data['download']['filepath']}")

        return data
    except requests.exceptions.RequestException as error:
        print(f"Error: {error}")
        raise

# Usage
download_deed('6431 Swanson St, Windermere, FL 34786')
```

### cURL

```bash
# Basic request
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{
    "address": "6431 Swanson St, Windermere, FL 34786"
  }'

# With base64 PDF included
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{
    "address": "6431 Swanson St, Windermere, FL 34786",
    "includeBase64": true
  }'

# Pretty print with jq
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{
    "address": "6431 Swanson St, Windermere, FL 34786"
  }' | jq '.'
```

### PHP

```php
<?php

function downloadDeed($address) {
    $url = 'http://localhost:3000/api/deed/download';

    $data = [
        'address' => $address
    ];

    $options = [
        'http' => [
            'header'  => "Content-type: application/json\r\n",
            'method'  => 'POST',
            'content' => json_encode($data)
        ]
    ];

    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);

    if ($result === FALSE) {
        throw new Exception('Failed to download deed');
    }

    $response = json_decode($result, true);
    echo "PDF saved to: " . $response['download']['filepath'] . "\n";

    return $response;
}

// Usage
downloadDeed('6431 Swanson St, Windermere, FL 34786');
?>
```

---

## Running the Server

### Development

```bash
# Set your 2Captcha API key
export TWOCAPTCHA_TOKEN="your_api_key_here"

# Start the server
node api-server.js
```

### Production

```bash
# Using PM2 process manager
pm2 start api-server.js --name deed-api

# With environment variable
TWOCAPTCHA_TOKEN=your_api_key pm2 start api-server.js --name deed-api

# View logs
pm2 logs deed-api

# Stop server
pm2 stop deed-api
```

### Using .env File

Create a `.env` file:

```env
TWOCAPTCHA_TOKEN=your_api_key_here
PORT=3000
DEED_DOWNLOAD_PATH=./downloads
```

Then start:

```bash
node api-server.js
```

---

## Response Times

| Operation | Average Time |
|-----------|-------------|
| Health check | < 50ms |
| List counties | < 50ms |
| Download deed (with CAPTCHA) | 90-120 seconds |
| Download deed (cached session) | 60-90 seconds |

---

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 400 | Bad request (invalid parameters) |
| 404 | Endpoint not found |
| 500 | Internal server error |
| 503 | Service unavailable (CAPTCHA solver not configured) |

---

## Cost Breakdown

### Per Request
- CAPTCHA solving: $0.001
- Server costs: Variable (based on hosting)
- **Total per deed: ~$0.001**

### Monthly Estimates

| Deeds/Month | CAPTCHA Cost | Recommended Plan |
|-------------|--------------|------------------|
| 100 | $0.10 | Start with $5 |
| 1,000 | $1.00 | $10 balance |
| 10,000 | $10.00 | $25 balance |
| 100,000 | $100.00 | $200 balance |

---

## Best Practices

### 1. Error Handling

Always implement proper error handling:

```javascript
try {
  const result = await downloadDeed(address);
  // Process result
} catch (error) {
  if (error.response?.status === 503) {
    console.error('CAPTCHA solver not configured');
  } else if (error.response?.status === 400) {
    console.error('Invalid address format');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### 2. Retry Logic

Implement exponential backoff for failed requests:

```javascript
async function downloadWithRetry(address, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await downloadDeed(address);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

### 3. Rate Limiting

Don't overwhelm the server:

```javascript
const queue = [];
const CONCURRENT_REQUESTS = 3;

async function processQueue() {
  const batch = queue.splice(0, CONCURRENT_REQUESTS);
  await Promise.all(batch.map(addr => downloadDeed(addr)));

  if (queue.length > 0) {
    await new Promise(r => setTimeout(r, 2000)); // 2s delay
    await processQueue();
  }
}
```

### 4. Monitor Costs

Track your 2Captcha spending:

```javascript
let totalCost = 0;
let totalRequests = 0;

async function downloadDeedTracked(address) {
  const result = await downloadDeed(address);

  if (result.captchaSolved) {
    totalCost += 0.001;
    totalRequests++;
  }

  console.log(`Total cost: $${totalCost.toFixed(3)} (${totalRequests} requests)`);

  return result;
}
```

---

## Webhooks (Future Feature)

Coming soon: Webhook support for long-running requests.

```json
{
  "address": "123 Main St",
  "webhookUrl": "https://your-app.com/webhook",
  "webhookSecret": "your_secret"
}
```

---

## Support

For issues or questions:
1. Check the [main documentation](README.md)
2. Review [CAPTCHA setup guide](CAPTCHA_SOLVING_SETUP.md)
3. Open an issue on GitHub

---

## Changelog

### Version 1.0.0 (2025-11-01)
- Initial API release
- Support for Orange County, FL
- Automatic CAPTCHA solving
- PDF download and extraction
- Transaction history included

---

**Last Updated:** November 1, 2025
