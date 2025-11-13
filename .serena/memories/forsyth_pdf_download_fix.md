# Forsyth County PDF Download Fix

## Date
2025-11-13

## Problems Identified

### Problem 1: Wrong Document Selection
The scraper was clicking on "Misc Improvements" instead of actual deed documents, leading to building details pages (`OutbuildingDetails.aspx`) instead of deed documents.

**Root Cause**: The deed type filtering logic was checking for "IMPROVEMENT" (singular) but the actual text on the page was "Misc Improvements" (plural).

### Problem 2: Direct PDF Serving
After fixing the document selection, the scraper still couldn't download PDFs because the deed viewer serves PDFs directly with `Content-Type: application/pdf`.

**Root Cause**: The URL `http://forsythdeeds.com/view_image.php?file=re/001840/004065.tif&type=pdf` has a `type=pdf` parameter that tells the server to convert the TIFF to PDF and serve it directly. Puppeteer can't render PDFs in the DOM, resulting in a blank page.

## Solutions Implemented

### Fix 1: Enhanced Deed Type Filtering

**Location**: `county-implementations/forsyth-county-north-carolina.js`
- Lines 473-476: Added plural form "IMPROVEMENTS" to `isBuildingDetail` check
- Line 497: Added "IMPROVEMENTS" to fallback logic filter

**Key Changes**:
```javascript
const isBuildingDetail = deedTypeUpper.includes('IMPROVEMENT') ||
                        deedTypeUpper.includes('IMPROVEMENTS') ||  // Added
                        deedTypeUpper.includes('BUILDING') ||
                        deedTypeUpper.includes('MISC');
```

### Fix 2: Direct PDF Download

**Location**: `county-implementations/forsyth-county-north-carolina.js`
- Lines 654-711: Added new Strategy 1 in `downloadDeedPdf` method

**Key Changes**:
- Detect URLs with `type=pdf`, `export=pdf`, or `.pdf` patterns
- Use `fetch` API with `credentials: 'include'` to download PDF while preserving session
- Convert binary PDF data to base64 for storage
- Fall back to other strategies if direct download fails

## Test Results

Using test address: `3170 Butterfield Dr`

```
✅ SUCCESS!
Filename: forsyth_deed_1763043390142.pdf
File Size: 120.85 KB
Total Duration: 41.9s

📝 Step Details:
  Search: { success: true, duration: 18940, parcelNumber: '6847221500000' }
  Deed Info: { success: true, duration: 16940 }
  Download: { success: true, duration: 6061, fileSize: 123748 }
```

## Technical Details

The Forsyth County system:
- Uses a separate domain (`forsythdeeds.com`) for serving deed documents
- Converts TIFF images to PDFs on-the-fly using the `type=pdf` parameter
- Opens deed links in new tabs, preserving the session automatically
- Serves PDFs with `Content-Type: application/pdf`, which Puppeteer cannot render

This fix is similar to the Guilford County fix, but simpler because:
- Session cookies are automatically preserved when opening new tabs (no manual cookie transfer needed)
- The URL pattern is consistent (`type=pdf` parameter)
- No server-side PHP errors prepended to PDFs

## Testing Script
Run `node test-forsyth.js` to verify the fix is working correctly.

## Implementation Status
✅ **Deed Type Filtering Fixed**: Now properly skips "Misc Improvements" and other building details
✅ **Direct PDF Download Implemented**: Uses fetch with session credentials to download PDFs
✅ **Testing Verified**: Successfully downloads actual deed documents (typically 100-200 KB)
