# Guilford County PDF Download Fixes

## Summary
Fixed the Guilford County, North Carolina PDF download functionality by implementing three critical improvements based on successful patterns from other NC counties (Durham, Wake, Mecklenburg).

## Issues Identified

### 1. **New Tab Handling Issue**
- **Problem**: Deed links use `target="_blank"` and open in new tabs, but the code was using `page.goto()` which doesn't handle new tabs properly
- **Symptom**: Navigation to deed pages resulted in blank pages or errors

### 2. **Missing Frame Detection**
- **Problem**: Deed content might be loaded in iframes which weren't being checked
- **Symptom**: Unable to find deed images even when they existed

### 3. **No Network Monitoring**
- **Problem**: Images loaded dynamically via JavaScript weren't being captured
- **Symptom**: Missing deed images that load after initial page load

## Fixes Implemented

### Fix 1: New Tab Handling (Lines 468-508)
```javascript
// OLD CODE (WRONG):
await this.page.goto(deedTypeInfo.href, { waitUntil: 'networkidle0', timeout: 30000 });

// NEW CODE (CORRECT):
// Set up listener for new tab
const newPagePromise = new Promise(resolve =>
  this.browser.once('targetcreated', target => resolve(target.page()))
);

// Click the deed link in the current page
await this.page.evaluate((href) => {
  const link = Array.from(document.querySelectorAll('a')).find(a => a.href === href);
  if (link) {
    link.click();
  }
}, deedTypeInfo.href);

// Wait for and switch to the new tab
const deedPage = await newPagePromise;
this.page = deedPage;
```

### Fix 2: Frame Detection (Lines 620-644)
```javascript
// Check for frames (deed content might be in an iframe)
const frames = this.page.frames();
if (frames.length > 1) {
  this.log(`Found ${frames.length} frames on page`);

  for (const frame of frames) {
    const frameUrl = frame.url();
    if (frameUrl.includes('viewimage') || frameUrl.includes('gis_viewimage')) {
      this.log('Found deed viewer in frame!');
      this.page = frame; // Switch context to frame
      break;
    }
  }
}
```

### Fix 3: Network Monitoring (Lines 601-615 and 842-874)
```javascript
// Set up network monitoring to capture dynamically loaded images
const capturedImageUrls = [];
const responseHandler = async (response) => {
  const url = response.url();
  const contentType = response.headers()['content-type'] || '';

  if (contentType.includes('image') || contentType.includes('pdf') ||
      url.includes('.tif') || url.includes('.pdf')) {
    capturedImageUrls.push(url);
    this.log(`Captured resource URL: ${url}`);
  }
};
this.page.on('response', responseHandler);

// Later, try downloading from captured URLs
if (capturedImageUrls.length > 0) {
  for (const imageUrl of capturedImageUrls) {
    const pdfBase64 = await this.downloadPdfFromUrl(imageUrl);
    // Verify and return if valid
  }
}
```

## Testing Instructions

1. **Run the test script:**
   ```bash
   node test-guilford-fixed.js
   ```

2. **Expected Results:**
   - Browser should open and navigate to Guilford County property search
   - Should find property for "1205 Glendale Dr"
   - Should properly handle the new tab when clicking deed links
   - Should capture and download the deed PDF
   - Should save a valid PDF file (not blank, not HTML error)

3. **Success Indicators:**
   - PDF size > 10KB (not blank)
   - PDF starts with "%PDF" signature
   - No PHP errors or HTML content in the PDF
   - Deed information (book, page, date) is captured

## Files Modified

1. **county-implementations/guilford-county-north-carolina.js**
   - Lines 468-508: New tab handling in `getDeedInfo()`
   - Lines 601-644: Frame detection and network monitoring in `downloadDeedPdf()`
   - Lines 842-874: Added strategy to try captured image URLs

## Test Files Created

1. **test-guilford-fixed.js** - Comprehensive test of the fixed implementation
2. **guilford-fixes-summary.md** - This documentation file

## Key Improvements

1. **More Robust Navigation**: Properly handles `target="_blank"` links
2. **Better Content Detection**: Checks frames for deed content
3. **Dynamic Content Capture**: Monitors network for dynamically loaded images
4. **Multiple Fallback Strategies**: Tries various methods to get the deed

## Based On Successful Counties

These fixes were inspired by working implementations from:
- Durham County (new tab handling)
- Wake County (frame detection)
- Mecklenburg County (network monitoring)

All three counties successfully download PDFs using these techniques.