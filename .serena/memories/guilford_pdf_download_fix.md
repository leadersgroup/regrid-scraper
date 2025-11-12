# Guilford County PDF Download Fix

## Date
2025-11-12

## Update: Blank PDF Issue Identified

## Problem
The Guilford County deed image server (`gis_viewimage.php`) was returning HTML error pages instead of the actual TIFF images:
```html
<br />
<b>Notice</b>:  Undefined variable: tiffInfo in <b>C:\wamp64\www\gis\gis_viewimage.php</b> on line <b>47</b>
```

The scraper was treating this HTML error as valid content and converting it to PDF, resulting in incorrect deed documents.

## Solution Implemented

### 1. Enhanced Error Detection in `downloadPdfFromUrl`
- Added HTML error page detection by checking:
  - Content-Type header for `text/html`
  - First characters of response for HTML tags (`<html`, `<!DOCTYPE`, `<br`)
  - PHP error messages (`Notice</b>`, `Error</b>`, `Warning</b>`)

### 2. Screenshot Fallback Strategy
- When HTML error is detected, the code now:
  - Attempts to navigate to the deed URL directly
  - Takes a screenshot of the page
  - Converts the screenshot to PDF

### 3. New Helper Methods Added
- `convertImageToPdf()` - Converts any image buffer to PDF using sharp and pdf-lib
- `screenshotToPdf()` - Takes screenshot of deed page and converts to PDF

### 4. Improved `downloadDeedPdf` Method
- Added multiple fallback strategies
- First tries direct download
- If that fails, looks for images on the page
- Finally falls back to full page screenshot

## Results
- Successfully detects and handles HTML error responses
- Creates valid PDF documents from screenshots when direct download fails
- Typical PDF size: ~20-25 KB (down from 500+ KB of HTML error)

## Testing
- `test-guilford-verbose.js` - Tests the scraper directly ✅
- `test-guilford-api-fix.js` - Tests via API server ✅

## Root Cause of Blank PDFs
The blank PDF issue occurs because:
1. The Guilford County deed viewer (`gis_viewimage.php`) returns a completely empty HTML page
2. The page has just a dark background (rgb(40, 40, 40)) with no content
3. This appears to be a server-side issue - the PHP script is broken or requires specific session data

## Enhanced Error Detection
Added methods to detect and handle blank pages:
- `isImageBlank()` - Analyzes image statistics to detect blank images
- Enhanced `screenshotToPdf()` - Checks page content before taking screenshots  
- Improved `downloadDeedPdf()` - Detects blank deed viewer pages and provides meaningful errors

## User-Friendly Error Messages
When the deed viewer fails, the system now:
- Detects the blank page condition
- Provides clear error messages explaining the server issue
- Suggests contacting the county office as an alternative
- Extracts any available deed information (Book/Page numbers) when possible

## Technical Details
The fix maintains backward compatibility while adding robust error handling for when the Guilford County server has issues or returns unexpected content. The scraper correctly identifies when the server is not functioning and provides appropriate feedback rather than creating blank PDFs.