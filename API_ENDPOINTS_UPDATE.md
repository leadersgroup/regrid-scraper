# API Endpoints Update

## New Endpoint Added: `/api/getPriorDeed`

The legacy `/api/getPriorDeed` endpoint has been added to the API server for compatibility with existing integrations.

## Available Endpoints

### 1. GET `/api/health`
Health check endpoint to verify server status and CAPTCHA solver configuration.

### 2. GET `/api/counties`
List all supported counties and their features.

### 3. POST `/api/getPriorDeed` (Legacy)
Original endpoint format that returns the full scraper result object.

**Request:**
```json
{
  "address": "6431 Swanson St, Windermere, FL 34786",
  "county": "Orange",
  "state": "FL"
}
```

**Response:**
```json
{
  "success": true,
  "address": "6431 Swanson St, Windermere, FL 34786",
  "steps": {
    "step1": { "parcelId": "...", "county": "Orange", "state": "FL" },
    "step2": { "transactions": [...] }
  },
  "download": {
    "success": true,
    "filename": "deed_20170015765_1762024782019.pdf",
    "downloadPath": "./downloads",
    "documentId": "20170015765",
    "fileSize": 90551,
    "pdfUrl": "https://selfservice.or.occompt.com/..."
  },
  "duration": "95.34s",
  "timestamp": "2025-11-03T00:00:00.000Z"
}
```

### 4. POST `/api/deed/download` (Recommended)
Enhanced endpoint with formatted response for better UX.

**Request:**
```json
{
  "address": "6431 Swanson St, Windermere, FL 34786",
  "options": {
    "headless": true,
    "timeout": 120000
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deed downloaded successfully",
  "duration": "95.34s",
  "download": {
    "filename": "deed_20170015765_1762024782019.pdf",
    "filepath": "/path/to/deed.pdf",
    "fileSize": 90551,
    "fileSizeKB": "88.43",
    "documentId": "20170015765"
  },
  "parcelId": "282330246500160",
  "transactions": [...],
  "captchaSolved": true,
  "cost": "$0.001"
}
```

## Key Differences

| Feature | `/api/getPriorDeed` | `/api/deed/download` |
|---------|---------------------|---------------------|
| Response Format | Raw scraper output | Enhanced/formatted |
| Includes Steps | Yes | No (simplified) |
| File Path | Relative | Absolute |
| File Size | Bytes only | KB + bytes |
| Cost Info | No | Yes |
| CAPTCHA Status | No | Yes |
| Message | No | Yes |

## Testing

Both endpoints are now available and functional:

```bash
# Test legacy endpoint
curl -X POST http://localhost:3000/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'

# Test new endpoint
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'
```

## Deployment

When deploying to Railway, make sure to:

1. Push the updated `api-server.js` to your repository
2. Railway will automatically redeploy
3. Verify both endpoints are accessible at your Railway URL:
   - `https://regrid-scraper-production.up.railway.app/api/getPriorDeed`
   - `https://regrid-scraper-production.up.railway.app/api/deed/download`

## Environment Variables Required

```bash
TWOCAPTCHA_TOKEN=your_api_key_here
PORT=3000  # Optional, Railway sets this automatically
DEED_DOWNLOAD_PATH=./downloads  # Optional
```

---

**Status:** ✅ Both endpoints implemented and tested
**Version:** 1.1.0
**Date:** November 3, 2025
