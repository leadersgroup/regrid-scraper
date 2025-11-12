# Guilford County PDF Download - Version 2 Fixes

## Latest Issues Fixed

### 1. **Frame Context Navigation Error**
- **Problem**: `this.page.goBack is not a function` - frames don't have navigation methods
- **Solution**: Keep separate references - `mainPage` for navigation, `currentContext` for content evaluation

### 2. **"History entry not found" Error**
- **Problem**: Trying to go back from a new tab that has no navigation history
- **Solution**: Removed the goBack() strategy entirely when dealing with new tabs

### 3. **Incorrect Server Blame**
- **Problem**: Code was incorrectly saying "server issue" when the server is actually working fine
- **Solution**: Removed all server blame messages; focused on better content detection

### 4. **Content Detection Too Quick**
- **Problem**: Checking for content immediately before deed images have time to load
- **Solution**: Added intelligent waiting with element detection, waiting up to 10 seconds for deed content

## Improved Content Detection

The scraper now checks for multiple types of deed display:
1. **Images** - Standard `<img>` tags with .tif, .jpg, .png files
2. **Canvas** - Some viewers render deeds to HTML5 canvas elements
3. **Embeds** - PDF or TIFF viewers using `<embed>` or `<object>` tags
4. **Dynamic Loading** - Monitors network requests for dynamically loaded images

## Download Strategies (in order)

1. **Large Image Detection** - Find and download visible images > 400px
2. **Canvas Screenshot** - Take screenshot if deed is rendered to canvas
3. **Embed/Object Download** - Extract URL from embed/object elements
4. **Direct URL Download** - Try downloading from the current viewer URL
5. **Link Search** - Look for alternative deed links on the page
6. **Network Capture** - Try URLs captured from network monitoring

## Key Code Changes

### Frame Handling (Lines 620-639)
```javascript
// Keep reference to main page for navigation
const mainPage = this.page;
let currentContext = this.page;  // This will be either the main page or a frame

// Check frames and switch context if deed viewer found
for (const frame of frames) {
  if (frameUrl.includes('viewimage') || frameUrl.includes('gis_viewimage')) {
    currentContext = frame;  // Use frame for content, but keep mainPage for navigation
    break;
  }
}
```

### Smart Waiting (Lines 620-635)
```javascript
// Try to wait for specific deed elements
await this.page.waitForSelector('img[src*=".tif"], canvas, embed, object', {
  timeout: 10000
});
```

### Enhanced Content Detection (Lines 655-704)
```javascript
// Check for multiple content types
const pageStatus = await currentContext.evaluate(() => {
  // Check for images, canvas, embeds
  const hasLargeImage = images.some(img => img.width > 400);
  const hasCanvas = canvases.some(canvas => canvas.width > 400);
  const hasEmbed = embeds.some(embed => embed.src || embed.data);
  // ...
});
```

## Testing

Run the test to verify all fixes:
```bash
node test-guilford-fixed.js
```

The scraper should now:
- ✅ Wait properly for deed content to load
- ✅ Detect deeds displayed as images, canvas, or embeds
- ✅ Handle frame contexts correctly without navigation errors
- ✅ Not incorrectly blame the server for issues
- ✅ Try multiple strategies to capture the deed

## Files Modified

- **county-implementations/guilford-county-north-carolina.js**
  - Lines 617-635: Smart waiting for content
  - Lines 637-639: Frame context management
  - Lines 655-704: Enhanced content detection
  - Lines 708-741: Removed goBack() strategy
  - Lines 783-845: Added canvas and embed strategies
  - Lines 954-958: Updated error messages