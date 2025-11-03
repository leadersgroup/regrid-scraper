# Chrome Executable Path Fix for /api/scrape Endpoint

## Problem

The `/api/scrape` endpoint was failing on Railway with this error:

```
Failed to launch browser: Error: Could not find Chrome (ver. 142.0.7444.59).
This can occur if either
 1. you did not perform an installation before running the script
    (e.g. `npx puppeteer browsers install chrome`) or
 2. your cache path is incorrectly configured
    (which is: /home/railway/.cache/puppeteer).
```

## Root Cause

The [regrid-scraper-railway.js](regrid-scraper-railway.js) file uses `puppeteer` (not `puppeteer-extra`) and was trying to launch Chrome without specifying the `executablePath`.

### Environment Differences

**Railway (Linux):**
- Chrome is installed via Dockerfile at `/usr/bin/google-chrome-stable`
- Puppeteer's default behavior tries to download and use its own Chrome
- Cache path: `/home/railway/.cache/puppeteer`
- Problem: Puppeteer couldn't find its downloaded Chrome

**Local Development (Mac/Windows):**
- Puppeteer downloads Chrome to its cache on first run
- Works fine because cache is accessible

## Solution

Added platform detection in [regrid-scraper-railway.js:16-19](regrid-scraper-railway.js#L16-L19) to use system Chrome on Linux:

```javascript
// Detect if we're on Railway/Linux or local development
const isLinux = process.platform === 'linux';
const executablePath = isLinux
    ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
    : undefined; // Let puppeteer find Chrome on Mac/Windows

// Simple browser launch - Railway handles all dependencies
const launchOptions = {
    headless: true,
    ...(executablePath && { executablePath }),
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
    ]
};
```

### How It Works

1. **On Linux (Railway):**
   - Detects `process.platform === 'linux'`
   - Sets `executablePath` to `/usr/bin/google-chrome-stable`
   - Uses Chrome installed by Dockerfile

2. **On Mac/Windows (Local Dev):**
   - Detects platform is NOT Linux
   - Sets `executablePath` to `undefined`
   - Puppeteer uses its bundled Chrome

3. **Environment Variable Override:**
   - Can set `PUPPETEER_EXECUTABLE_PATH` to override default
   - Useful for custom Chrome installations

## Affected Endpoints

This fix ensures the following endpoint works on Railway:

### POST /api/scrape
Get parcel IDs and owner names from Regrid without downloading deeds.

**Request:**
```json
{
  "addresses": [
    "13109 Tollcross Way, Winter Garden, FL 34787"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "originalAddress": "13109 Tollcross Way, Winter Garden, FL 34787",
      "parcelId": "272429780501010",
      "ownerName": "JOHN DOE",
      "address": "13109 Tollcross Way",
      "city": "Winter Garden",
      "state": "FL",
      "county": "Orange"
    }
  ],
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0
  }
}
```

## Related Files

1. **[regrid-scraper-railway.js](regrid-scraper-railway.js)** - Fixed Chrome path detection
2. **[api-server.js:238-306](api-server.js#L238-L306)** - `/api/scrape` endpoint
3. **[Dockerfile:51-56](Dockerfile#L51-L56)** - Chrome installation
4. **[test-scrape-endpoint.js](test-scrape-endpoint.js)** - Test script

## Comparison: deed-scraper.js vs regrid-scraper-railway.js

Both files use Puppeteer but differently:

| File | Puppeteer Package | Chrome Path | Usage |
|------|------------------|-------------|--------|
| deed-scraper.js | `puppeteer-extra` | Detects platform | Deed downloads with CAPTCHA solving |
| regrid-scraper-railway.js | `puppeteer` | Now detects platform | Regrid parcel ID lookups (no CAPTCHA) |

## Testing

### Local Test (Mac/Windows):
```bash
node test-scrape-endpoint.js
```

### Railway Test:
```bash
curl -X POST https://regrid-scraper-production.up.railway.app/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"addresses": ["13109 Tollcross Way, Winter Garden, FL 34787"]}'
```

## Deployment

- **Commit**: bba194c
- **Branch**: main
- **Railway Status**: ✅ Deployed automatically
- **Status**: ✅ Working on Railway

## Why Two Different Scrapers?

**deed-scraper.js (puppeteer-extra):**
- Needs CAPTCHA solving plugin
- More complex setup
- Used for deed downloads

**regrid-scraper-railway.js (puppeteer):**
- Simpler, no plugins needed
- Faster initialization
- Used for parcel ID lookups only
- No CAPTCHA on Regrid API

## Prevention

To prevent this issue in the future:

1. Always specify `executablePath` when using Puppeteer in Docker
2. Use platform detection for cross-platform development
3. Test both locally and on Railway before deploying
4. Document Chrome installation location in Dockerfile comments
