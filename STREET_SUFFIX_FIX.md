# Street Suffix Normalization Fix

## Problem

Addresses with abbreviated street suffixes were failing to find properties on the Orange County Property Appraiser website, causing cascading errors:

**Example Failed Address:**
```
13109 Tollcross Wy, Winter Garden, FL 34787, USA
```

**Error Sequence:**
1. Step 2: "Could not find property on assessor website"
2. Step 3: "Attempted to use detached Frame" error
3. Step 4: Same detached frame error
4. Overall: "Could not find prior deed through any search method"

## Root Cause

The scraper was searching for "13109 Tollcross Wy" (with abbreviation) but the Orange County Property Appraiser database likely stores the full street name "13109 Tollcross Way". This mismatch caused the search to fail, and subsequent steps tried to interact with iframes that no longer existed.

## Solution

Added `normalizeStreetSuffix()` method to [orange-county-florida.js](county-implementations/orange-county-florida.js) that automatically expands common street suffix abbreviations before searching:

### Supported Abbreviations

| Abbreviation | Expanded To |
|--------------|-------------|
| Wy, Wy.      | Way         |
| St, St.      | Street      |
| Dr, Dr.      | Drive       |
| Ave, Ave.    | Avenue      |
| Rd, Rd.      | Road        |
| Blvd, Blvd.  | Boulevard   |
| Ln, Ln.      | Lane        |
| Ct, Ct.      | Court       |
| Pl, Pl.      | Place       |
| Cir, Cir.    | Circle      |
| Pkwy, Pkwy.  | Parkway     |
| Ter, Ter.    | Terrace     |
| Trl, Trl.    | Trail       |

### Implementation

```javascript
normalizeStreetSuffix(address) {
  const suffixMap = {
    ' St': ' Street',
    ' St.': ' Street',
    ' Ave': ' Avenue',
    ' Ave.': ' Avenue',
    ' Dr': ' Drive',
    ' Dr.': ' Drive',
    ' Rd': ' Road',
    ' Rd.': ' Road',
    ' Blvd': ' Boulevard',
    ' Blvd.': ' Boulevard',
    ' Ln': ' Lane',
    ' Ln.': ' Lane',
    ' Ct': ' Court',
    ' Ct.': ' Court',
    ' Pl': ' Place',
    ' Pl.': ' Place',
    ' Cir': ' Circle',
    ' Cir.': ' Circle',
    ' Way': ' Way',
    ' Wy': ' Way',
    ' Wy.': ' Way',
    ' Pkwy': ' Parkway',
    ' Pkwy.': ' Parkway',
    ' Ter': ' Terrace',
    ' Ter.': ' Terrace',
    ' Trl': ' Trail',
    ' Trl.': ' Trail'
  };

  let normalized = address;
  for (const [abbrev, full] of Object.entries(suffixMap)) {
    const regex = new RegExp(abbrev.replace('.', '\\.') + '(?=\\s|$)', 'gi');
    normalized = normalized.replace(regex, full);
  }

  return normalized;
}
```

### Usage in searchAssessorSite()

```javascript
// Extract just the street address (remove city, state, zip)
const fullAddress = this.currentAddress || '';
let streetAddress = fullAddress.split(',')[0].trim();

// Normalize street suffix abbreviations
const originalAddress = streetAddress;
streetAddress = this.normalizeStreetSuffix(streetAddress);

if (originalAddress !== streetAddress) {
  this.log(`🔄 Normalized address: "${originalAddress}" -> "${streetAddress}"`);
}

this.log(`🏠 Using street address for search: ${streetAddress}`);
```

## Test Results

### Before Fix
```json
{
  "success": false,
  "error": "Could not find prior deed through any search method",
  "steps": {
    "step2": {
      "success": true,
      "message": "Could not find property on assessor website"
    },
    "step3": {
      "success": true,
      "error": "Attempted to use detached Frame 'F412A6BC940841CF1FA145A1294D2E55'."
    }
  }
}
```

### After Fix
```json
{
  "success": true,
  "address": "13109 Tollcross Wy, Winter Garden, FL 34787, USA",
  "download": {
    "success": true,
    "filename": "deed_20240437830_1762134978332.pdf",
    "fileSize": 83030,
    "documentId": "20240437830",
    "pdfUrl": "https://selfservice.or.occompt.com/ssweb/document/servepdf/..."
  },
  "steps": {
    "step1": {
      "success": true,
      "parcelId": "272429780501010",
      "county": "Orange",
      "state": "FL"
    },
    "step2": {
      "success": true,
      "transactions": [
        {
          "documentId": "20240437830",
          "saleDate": "07/19/2024",
          "salePrice": "650000"
        },
        {
          "documentId": "20230286920",
          "saleDate": "02/03/2022",
          "salePrice": "76800"
        }
      ]
    }
  }
}
```

### Console Output
```
🔄 Normalized address: "13109 Tollcross Wy" -> "13109 Tollcross Way"
🏠 Using street address for search: 13109 Tollcross Way
✅ Property found via address search
✅ Clicked on Sales tab (A)
✅ Found 7 transaction record(s) with document IDs
⬇️ Downloading deed: 20240437830
✅ reCAPTCHA solved successfully!
✅ PDF saved to: downloads/deed_20240437830_1762134978332.pdf
📄 File size: 81.08 KB
```

## Performance

- **Duration**: 124 seconds (includes CAPTCHA solving)
- **PDF Size**: 83KB
- **Document ID**: 20240437830
- **CAPTCHA Cost**: $0.001

## Testing

Run the test with:

```bash
TWOCAPTCHA_TOKEN=your_api_key node test-abbreviated-address.js
```

## Impact

This fix ensures that addresses from various sources (user input, Google Maps API, frontend forms) will work correctly even if they use abbreviated street suffixes. The normalization is transparent and logged for debugging.

### Common Real-World Examples

These addresses will now work correctly:

- `123 Main St, Orlando, FL` → `123 Main Street, Orlando, FL`
- `456 Oak Ave, Winter Park, FL` → `456 Oak Avenue, Winter Park, FL`
- `789 Palm Dr, Windermere, FL` → `789 Palm Drive, Windermere, FL`
- `13109 Tollcross Wy, Winter Garden, FL` → `13109 Tollcross Way, Winter Garden, FL`

## Deployment

- **Commit**: 3153cba
- **Branch**: main
- **Railway Status**: Deployed automatically via GitHub integration
- **Status**: ✅ Live in production

## Related Issues

This fix resolves the "detached frame" error that was occurring when:
1. Address search failed due to abbreviation mismatch
2. Scraper continued to subsequent steps
3. Code tried to interact with iframes that were removed when search failed

By ensuring the property search succeeds, we prevent the downstream iframe errors.
