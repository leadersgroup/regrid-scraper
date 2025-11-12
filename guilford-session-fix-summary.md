# Guilford County - Session Cookie Fix

## Root Cause Analysis

The PHP error `Notice: Undefined variable: tiffInfo` was occurring because:

1. **Session Loss**: When clicking deed links that open in new tabs (`target="_blank"`), the new tab doesn't automatically inherit the PHP session cookies from the original page
2. **Server Expectation**: The Guilford County server's `gis_viewimage.php` script expects session variables (like `tiffInfo`) that were set during the property search
3. **Missing Session**: Without the session cookies, the PHP script can't access these variables, resulting in the "Undefined variable" error

## The Fix

### Before (Lines 473-520) - BROKEN
```javascript
// Click link (opens new tab)
await this.page.evaluate((href) => {
  const link = document.querySelector(`a[href="${href}"]`);
  link.click();
}, deedTypeInfo.href);

// Wait for new tab
const deedPage = await newPagePromise;
// ❌ New tab has no session cookies!
```

### After (Lines 473-497) - FIXED
```javascript
// Get cookies from current page to preserve PHP session
const cookies = await this.page.cookies();
this.log(`🍪 Captured ${cookies.length} cookies from current session`);

// Open new tab manually
const deedPage = await this.browser.newPage();

// Set cookies BEFORE navigating
if (cookies.length > 0) {
  await deedPage.setCookie(...cookies);
}

// Now navigate with session intact
await deedPage.goto(deedTypeInfo.href, {
  waitUntil: 'networkidle0',
  timeout: 60000
});
// ✅ New tab has all session cookies!
```

## Key Changes

1. **Capture Cookies**: Before opening the new tab, we capture all cookies from the current page (line 477)
2. **Manual Tab Opening**: Instead of clicking the link (which auto-navigates), we manually open a new blank tab (line 481)
3. **Set Cookies First**: We set the captured cookies in the new tab BEFORE navigating (lines 484-487)
4. **Navigate with Session**: Finally, we navigate to the deed URL with the session intact (lines 490-494)

## Why This Works

- PHP sessions typically use a cookie (usually named `PHPSESSID`) to track user sessions
- The server stores session variables (like `tiffInfo`) associated with this session ID
- By copying the session cookie to the new tab, the server can access all the session variables
- This eliminates the "Undefined variable" error and allows the deed viewer to work properly

## Testing

Run the test script to verify the fix:
```bash
node test-guilford-fixed.js
```

Expected results:
- ✅ No more "Undefined variable: tiffInfo" errors
- ✅ Deed viewer page loads with actual content
- ✅ PDFs can be downloaded successfully

## Technical Details

The Guilford County server uses PHP session variables to pass data between pages:
- Property search sets session variables (including `tiffInfo`)
- Deed viewer (`gis_viewimage.php`) expects to read these variables
- Without the session cookie, the variables are undefined
- With the session cookie, everything works as expected

This is a common pattern in older PHP applications that rely heavily on server-side sessions for state management.