# Guilford County, North Carolina - Scraper Setup

## Overview

The Guilford County scraper is now fully integrated into the deed scraper system. It follows the same pattern as the Wake County implementation.

## Features

- **Property search by street number and name** (e.g., "1205 Glendale Dr")
- **Location address search integration**
- **Parcel number extraction** (e.g., 60312)
- **Deeds tab navigation**
- **Automatic CAPTCHA solving** (with 2Captcha API)
- **Manual CAPTCHA support** (if API key not configured)
- **Full PDF download**

## Test Address

```
1205 Glendale Dr, Guilford County, NC
```

## Usage

### 1. Standalone Test

Run the test script:

```bash
node test-guilford.js
```

This will:
1. Navigate to https://lrcpwa.ncptscloud.com/guilford/
2. Click on "Location address"
3. Parse "1205 Glendale Dr" into:
   - Street Number: `1205`
   - Street Name: `Glendale`
4. Fill in the search fields
5. Press Enter
6. Click on the first parcel entry
7. Navigate to Deeds tab
8. Click on first Deed Type entry
9. Handle CAPTCHA (if present)
10. Download PDF

### 2. API Endpoint

**Endpoint:** `POST /api/getPriorDeed`

**Request:**
```bash
curl -X POST http://localhost:3000/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1205 Glendale Dr",
    "county": "Guilford",
    "state": "NC"
  }'
```

**Response:**
```json
{
  "success": true,
  "address": "1205 Glendale Dr",
  "timestamp": "2025-11-11T...",
  "steps": {
    "search": {
      "success": true,
      "duration": 12000,
      "parcelNumber": "60312"
    },
    "deed": {
      "success": true,
      "duration": 8000
    },
    "download": {
      "success": true,
      "duration": 5000,
      "fileSize": 245678,
      "pdfBase64": "JVBERi0xLjQK..."
    }
  },
  "pdfBase64": "JVBERi0xLjQK...",
  "filename": "guilford_deed_1731350400000.pdf",
  "fileSize": 245678,
  "totalDuration": 25000,
  "duration": "25.0s"
}
```

## CAPTCHA Configuration

### Option 1: 2Captcha API (Automatic)

Set the environment variable:

```bash
export TWOCAPTCHA_TOKEN=your_api_key_here
```

Then run:
```bash
node api-server.js
```

**Cost:** ~$0.001 per CAPTCHA solve (~$1 per 1000 deeds)

### Option 2: Manual CAPTCHA Solving

If `TWOCAPTCHA_TOKEN` is not set, the scraper will:
1. Detect the CAPTCHA
2. Wait up to 2 minutes for manual solution
3. Log a message: "⚠️ No 2Captcha API key configured - waiting for manual solution..."
4. Continue once CAPTCHA is solved

Run with browser visible:
```bash
node test-guilford.js
# Edit the test file to set headless: false
```

## API Server Integration

The Guilford County scraper is fully integrated into the API server:

### 1. Import Added
```javascript
const GuilfordCountyNorthCarolinaScraper = require('./county-implementations/guilford-county-north-carolina');
```

### 2. County Normalization
```javascript
const countyMap = {
  // ...
  'guilford': 'Guilford'
};
```

### 3. Routing Logic
```javascript
} else if (detectedCounty === 'Guilford' && detectedState === 'NC') {
  scraper = new GuilfordCountyNorthCarolinaScraper(scraperOptions);
```

### 4. CAPTCHA Requirements
```javascript
const countiesRequiringCaptcha = ['Orange', 'Bexar', 'Wake', 'Guilford'];
```

### 5. Counties Endpoint
The scraper is listed in `GET /api/counties`:

```bash
curl http://localhost:3000/api/counties
```

## Implementation Details

### Address Parsing

The scraper parses addresses like "1205 Glendale Dr" into:
- **Street Number:** `1205`
- **Street Name:** `Glendale` (suffix removed)

Supported suffixes: St, Dr, Rd, Ave, Blvd, Ln, Ct, Cir, Way, Pl, Trail, Pkwy

### Search Flow

1. **Navigate** to Guilford County property search
2. **Click** "Location address" option
3. **Fill** street number field
4. **Fill** street name field
5. **Press Enter** to submit
6. **Wait** for results (5 seconds)
7. **Click** first parcel entry

### Deed Retrieval

1. **Find** and click "Deeds" tab
2. **Click** nested "Deeds" tab if present
3. **Find** "Deed Type" column in table
4. **Click** first entry (e.g., "Corr Deed")
5. **Handle** CAPTCHA if present

### PDF Download

Multiple strategies are used:
1. Check if current page is PDF
2. Look for PDF in iframe
3. Check embed/object tags
4. Find download buttons/links
5. Construct PDF URL from page parameters

PDF is downloaded using `fetch()` in browser context to maintain session cookies.

## Files Created

1. **[guilford-county-north-carolina.js](county-implementations/guilford-county-north-carolina.js)** - Main scraper
2. **[test-guilford.js](test-guilford.js)** - Test script
3. **[api-server.js](api-server.js)** - Updated with Guilford County support

## Workflow Diagram

```
Start
  ↓
Navigate to https://lrcpwa.ncptscloud.com/guilford/
  ↓
Click "Location address"
  ↓
Parse Address (1205 Glendale Dr)
  ├─ Street Number: 1205
  └─ Street Name: Glendale
  ↓
Fill Street Number Field
  ↓
Fill Street Name Field
  ↓
Press Enter
  ↓
Wait for Results
  ↓
Click First Parcel Entry (e.g., 60312)
  ↓
Wait for Parcel Page
  ↓
Click "Deeds" Tab
  ↓
Click Nested "Deeds" Tab (if present)
  ↓
Wait for Deeds Table
  ↓
Find "Deed Type" Column
  ↓
Click First Entry (e.g., "Corr Deed")
  ↓
Check for CAPTCHA
  ├─ If Present → Solve CAPTCHA
  └─ If Not Present → Continue
  ↓
Wait for PDF Page
  ↓
Detect PDF
  ├─ Current Page is PDF
  ├─ PDF in iframe
  ├─ PDF in embed/object
  ├─ Download button/link
  └─ Construct PDF URL
  ↓
Download PDF using fetch()
  ↓
Verify PDF Signature (%PDF)
  ↓
Return Base64 Encoded PDF
  ↓
End
```

## Troubleshooting

### CAPTCHA Issues

**Problem:** CAPTCHA not solving automatically

**Solution:**
- Check `TWOCAPTCHA_TOKEN` is set correctly
- Verify 2Captcha account has credits
- Check logs for CAPTCHA solving attempts

### Search Not Finding Property

**Problem:** No results after search

**Solution:**
- Verify address format is correct
- Check if property exists in Guilford County
- Try different address variations
- Check browser console for errors (set `headless: false`)

### PDF Not Downloading

**Problem:** PDF not found or download fails

**Solution:**
- Check if CAPTCHA was solved correctly
- Verify deed exists for the property
- Check network logs (set `headless: false`)
- Try manual navigation to verify workflow

## Support

For issues or questions:
1. Check the logs in the console
2. Set `headless: false` in test file to see browser
3. Verify the workflow manually on the website
4. Check if website structure has changed

## Next Steps

To add support for more counties, follow this pattern:
1. Create new scraper in `county-implementations/`
2. Extend `DeedScraper` base class
3. Implement `parseAddress()`, `searchProperty()`, `getDeedInfo()`, `downloadDeedPdf()`
4. Add to `api-server.js` imports and routing
5. Create test file
6. Update documentation
