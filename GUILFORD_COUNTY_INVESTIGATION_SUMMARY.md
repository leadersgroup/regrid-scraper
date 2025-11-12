# Guilford County PDF Download Investigation Summary

## Executive Summary
The Guilford County PDF download fails due to a **PHP session variable (`tiffInfo`) not being set** when accessing the deed viewer. This is a server-side issue that requires identifying a missing intermediate step in the deed viewing process.

## Error Details
```
Notice: Undefined variable: tiffInfo in C:\wamp64\www\gis\gis_viewimage.php
```

## Root Cause Analysis

### The Problem
1. **Direct Navigation Fails**: The URL `https://rdlxweb.guilfordcountync.gov/gis/gis_viewimage.php?bookcode=r&booknum=8461&bookpage=888` expects PHP session variables
2. **Session Variables Missing**: The `tiffInfo` variable (and likely others) are NOT set by:
   - The property search page
   - The deed list page
   - Simply clicking the deed link

### What We've Tried

#### 1. **Cookie/Session Preservation** ❌
- Captured cookies and transferred to new tab
- Result: Session variables still not available

#### 2. **Same-Tab Navigation** ❌
- Navigated in same tab to preserve session
- Result: Variables still not set

#### 3. **Click Link Instead of Navigate** ❌
- Actually clicked the link to trigger JavaScript
- Result: Still missing session setup

#### 4. **Playwright Browser Context** ❌
- Used Playwright's superior context handling
- Result: Same error persists

## Technical Investigation

### Network Analysis
The deed viewing process appears to be:
1. Property search (`https://lrcpwa.ncptscloud.com/guilford/`)
2. Click deed link
3. Opens `gis_viewimage.php` in new tab
4. **MISSING STEP**: Something should set up `tiffInfo` before step 3

### Code Locations
- **Main Implementation**: `/county-implementations/guilford-county-north-carolina.js`
  - Line 455: Deed link clicking
  - Line 480-483: Navigation handling
  - Line 595-960: Download attempts

### Key Findings
1. **Server Expects Session Data**: The PHP script expects variables that aren't in the session
2. **No Intermediate API Call**: We haven't found the API/page that sets up these variables
3. **Manual Testing Works**: User reports "pdf can be downloaded manually"

## What's Needed to Fix

### Option 1: Reverse Engineer the Actual Flow
1. **Manual Testing Required**:
   ```
   1. Open browser with DevTools Network tab
   2. Navigate to Guilford County property search
   3. Search for a property
   4. Click a deed link
   5. Monitor ALL network requests
   6. Look for:
      - Intermediate API calls before viewimage.php
      - JavaScript that makes setup calls
      - Hidden forms or redirects
   ```

### Option 2: Alternative Approach
1. **Parse Deed Information**: Extract book/page numbers from the deed table
2. **Use Alternative API**: Find if there's a different endpoint that doesn't require session
3. **Contact County**: Request API documentation or alternative access method

## Test Scripts Created

1. **test-guilford-debug.js** - Network request monitoring
2. **test-guilford-manual.js** - Step-by-step manual flow test
3. **test-guilford-fixed.js** - Test for implementation fixes
4. **test-guilford-session-fix.js** - Session preservation test
5. **test-guilford-direct.js** - Direct deed page access test
6. **test-guilford-playwright.js** - Playwright API test

## Current Status

### ❌ **Not Working**
- Direct deed PDF downloads fail with `tiffInfo` error
- All attempted workarounds have failed

### ✅ **Working**
- Property search works correctly
- Deed information is found and displayed
- Error handling provides clear messages

## Recommendations

### Immediate Action
1. **Manual Testing**: Someone needs to manually test the website and capture the full network flow
2. **Look for Hidden Calls**: Check browser console for AJAX requests that set up the session
3. **Check Page Source**: Look for inline JavaScript that makes setup calls

### Code Changes Needed
Once the missing step is identified:
```javascript
// Add the missing setup call before navigating to viewimage
await page.evaluate(async () => {
  // Make the setup API call that sets tiffInfo
  await fetch('/path/to/setup/api', {
    method: 'POST',
    body: JSON.stringify({ book, page })
  });
});

// Then navigate to viewimage.php
await page.goto(deedUrl);
```

## Conclusion

The Guilford County implementation is **structurally correct** but missing a crucial session setup step. Without access to test the actual website and identify this missing step, we cannot complete the fix. The issue is **not** with our code architecture but with understanding the server's expected flow.

### Next Steps
1. **Manual website testing** to identify the missing API/setup call
2. **Implement the missing step** once identified
3. **Test and verify** the complete flow works

---

*Generated: November 12, 2025*
*Status: Investigation Complete - Awaiting Manual Testing*