# Forsyth County - PDF Download Fix

## Problems Identified

The Forsyth County scraper had two critical issues preventing successful PDF downloads:

### Problem 1: Wrong Document Selection
**Issue**: The scraper was clicking on "Misc Improvements" instead of actual deed documents, leading to building details pages (`OutbuildingDetails.aspx`) instead of deed documents.

**Root Cause**: The deed type filtering logic was checking for "IMPROVEMENT" (singular) but the actual text on the page was "Misc Improvements" (plural).

### Problem 2: Direct PDF Serving
**Issue**: After fixing the document selection, the scraper still couldn't download PDFs because the deed viewer serves PDFs directly with `Content-Type: application/pdf`.

**Root Cause**: The URL `http://forsythdeeds.com/view_image.php?file=re/001840/004065.tif&type=pdf` has a `type=pdf` parameter that tells the server to convert the TIFF to PDF and serve it directly. Puppeteer can't render PDFs in the DOM, resulting in a blank page.

## The Fixes

### Fix 1: Enhanced Deed Type Filtering (Lines 473-476, 497)

**Before**:
```javascript
const isBuildingDetail = deedTypeUpper.includes('IMPROVEMENT') ||
                        deedTypeUpper.includes('BUILDING') ||
                        deedTypeUpper.includes('MISC');
```

**After**:
```javascript
const isBuildingDetail = deedTypeUpper.includes('IMPROVEMENT') ||
                        deedTypeUpper.includes('IMPROVEMENTS') ||  // Added plural
                        deedTypeUpper.includes('BUILDING') ||
                        deedTypeUpper.includes('MISC');
```

Also updated the fallback logic:
```javascript
if ((text.includes('DEED') && !text.includes('BUILDING') &&
     !text.includes('IMPROVEMENT') && !text.includes('IMPROVEMENTS')) || // Added plural
    (href.includes('deed') && !href.includes('Building') && !href.includes('Improvement'))) {
```

### Fix 2: Direct PDF Download (Lines 654-711)

**Added new Strategy 1** to detect and download PDFs served directly:

```javascript
// Strategy 1: Check if current page is PDF or serves PDF
if (currentUrl.toLowerCase().includes('.pdf') ||
    currentUrl.includes('type=pdf') ||
    currentUrl.includes('export=pdf')) {
  this.log('✅ Current page serves PDF directly');

  // Use fetch with session credentials to download PDF
  const pdfData = await this.page.evaluate(async (url) => {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Accept': 'application/pdf,*/*'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Convert to base64
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }

      return {
        success: true,
        base64: btoa(binary),
        size: uint8Array.length
      };
    } catch (err) {
      return {
        success: false,
        error: err.message
      };
    }
  }, currentUrl);

  if (pdfData.success) {
    this.log(`✅ PDF downloaded successfully: ${(pdfData.size / 1024).toFixed(2)} KB`);
    // Return PDF data...
  }
}
```

## Key Changes Summary

1. **Enhanced Document Filtering**: Added plural form checking ("IMPROVEMENTS") to properly skip building details
2. **Direct PDF Detection**: Check URL for `type=pdf`, `export=pdf`, or `.pdf` patterns
3. **Fetch-based Download**: Use `fetch` API with `credentials: 'include'` to download PDF while preserving session
4. **Base64 Conversion**: Convert binary PDF data to base64 for storage and transmission

## Why This Works

1. **Plural Form Handling**: Now properly filters out both "Misc Improvement" and "Misc Improvements" entries
2. **Session Preservation**: Using `credentials: 'include'` in fetch ensures PHP session cookies are sent
3. **Direct Download**: Bypasses Puppeteer's inability to render PDFs by downloading the binary data directly
4. **Fallback Strategy**: If direct download fails, falls back to other strategies (iframe, embed, etc.)

## Testing

Run the test script to verify the fix:
```bash
node test-forsyth.js
```

Expected results:
- ✅ Property search completes successfully
- ✅ Correct deed document selected (e.g., "DEED", not "Misc Improvements")
- ✅ PDF downloaded successfully (typically 100-200 KB)
- ✅ Total time: ~30-45 seconds

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
