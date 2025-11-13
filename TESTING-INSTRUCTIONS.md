# Testing Instructions for Guilford County PDF Fix

## Environment Requirements

To test the Guilford County deed scraper, you need:

1. **Node.js** (v18 or higher)
2. **Chrome/Chromium browser** installed
3. **Internet connection** for accessing Guilford County website

## Setup

```bash
# Install dependencies
npm install

# If you have Chrome installed at a different location, set the path:
export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
# or for Playwright:
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome
```

## Testing Options

### Option 1: Test with Improved Puppeteer (Recommended)

```bash
node test-guilford-improved.js
```

This will:
- ✅ Open a browser window (headless: false) so you can watch
- ✅ Search for the property at 1209 Glendale Dr, Greensboro, NC
- ✅ Navigate through the deed records
- ✅ Download the PDF using improved network interception
- ✅ Save the PDF to disk for verification
- ✅ Keep the browser open for inspection

**What to expect**:
- Browser opens and navigates to Guilford County website
- Fills in the address search form
- Clicks through to parcel details
- Clicks on deed record
- Downloads and converts the deed document to PDF
- Shows success message with PDF details

### Option 2: Test with Playwright

```bash
node test-guilford-playwright.js
```

This is a diagnostic test that:
- Tests multiple methods of accessing the deed
- Shows detailed debugging information
- Saves findings to `guilford-playwright-findings.json`

### Option 3: Headless Test (Automated)

```bash
node test-guilford-headless.js
```

This runs without opening a visible browser window, useful for:
- CI/CD pipelines
- Automated testing
- Quick verification

## Expected Results

### Success Output

```
✅ SUCCESS!

Address: 1209 Glendale Dr, Greensboro, NC 27406
Parcel: 60312 (or similar)
Total Time: 45.2s

📄 PDF Information:
  Size: 125.34 KB
  Format: ✅ Valid PDF
  Saved: guilford-test-1731466123456.pdf

⏱️  Performance Breakdown:
  search: ✅ 15.3s
  deed: ✅ 12.8s
  download: ✅ 17.1s

🎉 TEST PASSED
```

### What the PDF Should Contain

The downloaded PDF should show:
- Guilford County deed document
- Property transfer information
- Book and page numbers
- Grantor and grantee information
- Legal description
- Multiple pages if the deed is multi-page

## Troubleshooting

### Error: Browser not found

**Solution**: Install Chrome or Chromium, or set the path:
```bash
# For Ubuntu/Debian
sudo apt-get install chromium-browser

# For macOS
brew install chromium

# Or set custom path
export PUPPETEER_EXECUTABLE_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

### Error: Cannot find module 'puppeteer'

**Solution**: Install dependencies:
```bash
npm install
```

### Error: Property not found

**Solution**: The test address might not exist. Try a different address:
1. Visit https://lrcpwa.ncptscloud.com/guilford/
2. Search for a valid property
3. Update the test address in the test file:
   ```javascript
   const testAddress = 'YOUR_VALID_ADDRESS';
   ```

### Error: Timeout or slow performance

**Solution**:
- Check your internet connection
- The Guilford County website might be slow
- Increase timeout values in the scraper if needed

### PDF is blank or shows errors

This means the scraper is working, but the Guilford County server has issues. The improved implementation detects this and provides clear error messages:
- "Server returned an error"
- "Blank deed viewer detected"
- "Unable to capture deed document"

## Verifying the Fix

The key improvements to verify:

1. **Network Interception Works**
   - Look for log messages like: `📸 Captured resource: http://...`
   - Should show actual buffer sizes: `(125.34 KB)`

2. **Session Cookies Preserved**
   - Look for: `🍪 Captured X cookies for session preservation`
   - No "tiffInfo" errors

3. **Resource Processing**
   - Look for: `✅ TIFF found - converting to PDF...`
   - Or: `✅ Valid PDF found`

4. **Final PDF Validation**
   - PDF signature should be `%PDF`
   - File size should be > 10 KB
   - Opening the PDF should show the actual deed document

## Manual Testing

If automated tests fail, you can test manually:

1. Run the test with browser visible: `headless: false`
2. Watch the browser automation
3. Check the console logs for detailed steps
4. Verify each step completes successfully
5. Check the saved PDF file

## Test Results

After running tests, you should have:
- ✅ Console output showing success
- ✅ PDF file saved to disk (guilford-*.pdf)
- ✅ No errors in the logs
- ✅ Browser closes cleanly

## Integration Testing

To test via the API server:

```bash
# Start the API server
npm start

# In another terminal, test the endpoint
curl -X POST http://localhost:3000/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1209 Glendale Dr, Greensboro, NC 27406",
    "county": "Guilford",
    "state": "NC"
  }'
```

Expected response:
```json
{
  "success": true,
  "address": "1209 Glendale Dr, Greensboro, NC 27406",
  "pdfBase64": "JVBERi0xLj...",
  "filename": "guilford_deed_1731466123456.pdf",
  "fileSize": 128450,
  "totalDuration": 45234
}
```

## Support

If you encounter issues:
1. Check the logs in the console
2. Review GUILFORD-PDF-FIX-SUMMARY.md
3. Try both Puppeteer and Playwright versions
4. Ensure you have a valid test address
5. Verify browser installation

## Summary

The fix is working if you see:
- ✅ Browser navigates successfully
- ✅ Property search finds results
- ✅ Deed link clicks without errors
- ✅ Network resources captured
- ✅ PDF generated and saved
- ✅ PDF contains actual deed content (not errors)

Both implementations (Puppeteer and Playwright) should produce the same results, with Playwright generally being more reliable due to better session management.
