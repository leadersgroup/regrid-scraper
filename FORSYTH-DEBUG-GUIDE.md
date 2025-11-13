# Forsyth County Scraper - Debugging Guide

## Issue Summary

The scraper is successfully:
✅ Navigating to the property search page
✅ Filling in the street number and street name
✅ Finding and clicking the parcel entry
✅ Getting to the property details page

But it's failing at:
❌ Finding and downloading the PDF deed

**Current Problem:** The scraper ends up on `OutbuildingDetails.aspx` instead of the deed viewer page.

---

## Recent Changes (Commit: 6363a0d)

I've added comprehensive debugging to help diagnose the issue:

### 1. Link Discovery Logging
```
🔍 Looking for Deeds navigation...
Current URL: https://lrcpwa.ncptscloud.com/forsyth/...
Found X links on page
Found Y potential deeds links:
  - "Deeds" (https://...)
  - "Property Deed" (https://...)
```

### 2. Deeds Tab Click Logging
```
✅ Clicked Deeds link: "Deeds" (exact_match)
   Target URL: https://...
New URL after Deeds click: https://...
```

### 3. Table Structure Logging
```
Found X tables on page:
  Table 0: 5 rows, Headers: [Date, Book, Page, Deed Type, Amount]
  Table 1: 3 rows, Headers: [...]
```

### 4. Deed Entries Logging
```
✅ Found 3 deed entries:
  1. WD
  2. DEED
  3. CORR DEED
✅ Clicked first deed type: WD
📄 Deed page URL: https://...
```

---

## What to Look For in the Next Test Run

### Key Questions to Answer:

1. **What links are available on the property page?**
   - Look for the line: `Found X potential deeds links:`
   - Check if "Deeds" is listed
   - Check what the href URL is

2. **Did clicking the Deeds link cause navigation?**
   - Compare `Current URL` with `New URL after Deeds click`
   - If they're the same, the page loaded content dynamically
   - If they're different, we navigated to a new page

3. **What tables are on the Deeds page?**
   - Look for `Found X tables on page:`
   - Check if any table has headers like "Deed Type", "Book", "Page"

4. **Were any deed entries found?**
   - Look for `Found X deed entries:`
   - If X = 0, the table structure might be different
   - If X > 0, check what deed types were found

5. **What happened after clicking the deed entry?**
   - Look for `✅ Navigated in same tab` or `🔍 Checking for new tab`
   - Check the final URL where we ended up

---

## Expected Workflow (Guilford County Reference)

Forsyth County uses the same NCPTS cloud system as Guilford County. Here's how Guilford works:

1. Property search → Find parcel
2. Click parcel → Property details page with tabs
3. Click "Deeds" tab → Deeds section loads (may be inline or navigate)
4. See table with columns: [Date, Book, Page, Deed Type, etc.]
5. Click on deed type link (e.g., "WD", "DEED") → Opens deed viewer
6. Deed viewer may be:
   - New tab
   - Same tab navigation
   - Popup/modal
   - Iframe

---

## Possible Issues and Solutions

### Issue 1: Wrong "Deeds" Link Clicked
**Symptoms:**
- Ends up on wrong page (like OutbuildingDetails.aspx)
- URL doesn't contain "deed" or "gis_viewimage"

**Solution:**
- Need to be more specific about which "Deeds" link to click
- May need to check parent element or href pattern

### Issue 2: Deeds Content Loads Dynamically
**Symptoms:**
- URL doesn't change after clicking "Deeds"
- Tables appear/disappear after click

**Solution:**
- Need to wait longer after clicking
- May need to wait for specific element to appear
- Check if content is in an iframe

### Issue 3: Table Structure Different from Guilford
**Symptoms:**
- `Found 0 deed entries`
- Table headers don't match expected pattern

**Solution:**
- Need to adjust table parsing logic
- Look for different column headers
- May need to find links in different columns

### Issue 4: Deed Opens in Popup/Modal
**Symptoms:**
- No navigation after clicking deed entry
- PDF not found but page didn't change

**Solution:**
- Check for modal/dialog elements
- Look for iframe elements
- May need to switch to iframe context

---

## Next Steps

### Step 1: Run Test with New Debug Logs
```bash
# Make sure you have the latest code
git pull origin claude/forsyth-nc-deed-download-011CV5AUNPrXFQUkqSUhLvMc

# Run the test
node test-forsyth.js 2>&1 | tee forsyth-debug.log
```

### Step 2: Share Debug Output
Look for these sections in the output:
```
📍 STEP 2: Getting deed information...
🔍 Looking for Deeds navigation...
Found X links on page
Found Y potential deeds links:
...
Found X tables on page:
...
✅ Found X deed entries:
...
```

Share the complete output between "STEP 2" and "STEP 3".

### Step 3: Manual Inspection (if needed)
If the logs don't reveal the issue, we may need to:
1. Run with `headless: false` to see the browser
2. Add a pause before the PDF download to inspect the page
3. Take screenshots at each step

---

## Code Changes Made

### File: `forsyth-county-north-carolina.js`

**Lines 367-459: getDeedInfo() Method**

**Added:**
- Log current URL before navigation
- Log all available links on page
- Filter and log links containing "deed"
- Prioritize exact "Deeds" match over case-insensitive
- Log target URL before clicking
- Log new URL after clicking
- Check if page navigated or loaded dynamically

**Lines 464-482: Table Discovery**

**Added:**
- Scan all tables on page
- Log table count, row count, and headers
- Shows table structure for debugging

**Lines 484-559: Deed Entry Finding**

**Added:**
- Collect all deed entries before clicking
- Log total number of entries found
- Log all deed types available
- Click first entry and log which one was clicked

---

## Testing Tips

### Tip 1: Compare with Guilford County
```bash
# Test Guilford (working) to see what logs look like
node -e "
const scraper = require('./county-implementations/guilford-county-north-carolina');
const s = new scraper({verbose: true, headless: false});
s.initialize().then(() => s.getPriorDeed('1205 Glendale Dr'));
"
```

### Tip 2: Enable Browser Visibility
Set `headless: false` in test-forsyth.js (line 15) to watch what happens:
```javascript
const scraper = new ForsythCountyNorthCarolinaScraper({
  headless: false,  // Watch the browser
  verbose: true,
  timeout: 120000
});
```

### Tip 3: Add Pause Before PDF Download
Add this in the scraper code before PDF download:
```javascript
// In downloadDeedPdf(), at the start
if (!this.headless) {
  this.log('⏸️  Pausing for 30 seconds for inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));
}
```

---

## Contact & Support

If you need to share the debug output or have questions:

1. Run the test and save output: `node test-forsyth.js > forsyth-debug.log 2>&1`
2. Share the relevant sections (STEP 2 especially)
3. If possible, provide screenshots of the browser at the failing step

---

**Last Updated:** November 13, 2025
**Branch:** claude/forsyth-nc-deed-download-011CV5AUNPrXFQUkqSUhLvMc
**Commit:** 6363a0d
