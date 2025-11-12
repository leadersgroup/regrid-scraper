# Guilford County TIFF to PDF Conversion

## Implementation Date
2025-11-11

## Problem Solved
Guilford County (North Carolina) returns deed documents as TIFF images instead of PDFs via the `gis_viewimage.php` endpoint. The frontend expects PDF format in base64 encoding.

### Root Cause Analysis
The original implementation had two issues:
1. **Wrong Image Source**: The code was downloading from `CustomAttachmentsResource.ashx?parcelPk=...` which returns property photos/parcel maps, NOT the deed document
2. **Missing Navigation**: The code wasn't navigating to the actual deed document page (`gis_viewimage.php`) before attempting download

### The Correct Flow
1. Search for property → Find deeds table
2. Click deed type link → Navigate to `gis_viewimage.php?bookcode=...&booknum=...&bookpage=...`
3. Download image from `gis_viewimage.php` endpoint → Returns TIFF
4. Convert TIFF to PDF → Return to frontend

## Solution
Implemented automatic TIFF to PDF conversion in the `downloadPdfFromUrl` method:

1. **Dependencies Added**:
   - `sharp` (v0.34.5) - for TIFF to PNG conversion
   - `pdf-lib` (already installed) - for PDF creation

2. **Implementation Location**:
   - File: `county-implementations/guilford-county-north-carolina.js`
   - Method: `downloadPdfFromUrl()` (lines 876-951)

3. **Conversion Process**:
   - Detects TIFF signature (`II` or `MM`)
   - Converts TIFF → PNG using `sharp`
   - Embeds PNG in PDF using `pdf-lib`
   - Scales to fit standard page size (8.5" × 11")
   - Returns base64-encoded PDF

## Testing
- Direct conversion test: `test-tiff-to-pdf-direct.js` ✅ PASSED
- Full scraper test: `test-guilford-tiff-conversion.js` (address search dependent)

## Performance
- Input TIFF: ~40 KB
- Output PDF: ~3-5 KB (typical)
- Conversion time: <1 second

## Technical Details
```javascript
// Conversion pipeline:
TIFF Buffer → sharp.png() → PDFDocument.embedPng() → Base64 PDF

// Scaling logic:
maxWidth: 612px (8.5" at 72 DPI)
maxHeight: 792px (11" at 72 DPI)
Maintains aspect ratio when scaling
```

## Benefits
- Frontend receives consistent PDF format
- No frontend changes required
- Automatic scaling for large images
- Preserves image quality
