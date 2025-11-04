# Deploy Miami-Dade Fix to Railway

## Current Status

✅ **Fix is committed and pushed** to branch: `claude/miami-dade-prior-deed-pdf-011CUoGir2YktKQwHpypJS68`

⚠️ **Railway needs to deploy the latest code** to pick up the fix

---

## Latest Commit

**Commit**: `e41e61a` - Fix Miami-Dade County routing and CAPTCHA check issues

**What's Fixed**:
- ✅ County name normalization (case-insensitive)
- ✅ CAPTCHA only required for Orange County
- ✅ Miami-Dade works without CAPTCHA token

---

## How to Deploy to Railway

### Option 1: Automatic Deployment (If Enabled)

If Railway is set to auto-deploy from your branch, it should deploy automatically within 1-2 minutes after the git push.

**Check deployment status**:
1. Go to Railway dashboard
2. Look for deployment in progress
3. Wait for "Deployed" status

### Option 2: Manual Deployment (Recommended)

If auto-deploy is not enabled or you want to force a deploy:

**Step 1: Go to Railway Dashboard**
- Visit: https://railway.app/
- Select your project

**Step 2: Trigger Deployment**

**Method A - Deploy from GitHub**:
1. Go to your service/deployment
2. Click "Settings"
3. Under "Deploy", click "Deploy Now" or "Redeploy"

**Method B - Deploy Specific Branch**:
1. Go to Settings → Deploy
2. Check "Branch" is set to: `claude/miami-dade-prior-deed-pdf-011CUoGir2YktKQwHpypJS68`
3. Click "Deploy"

**Method C - Use Railway CLI** (if installed):
```bash
# In your project directory
railway up

# Or deploy specific service
railway up --service your-service-name
```

### Option 3: Merge to Main Branch

If Railway deploys from `main` branch:

```bash
# Switch to main
git checkout main

# Merge the fix
git merge claude/miami-dade-prior-deed-pdf-011CUoGir2YktKQwHpypJS68

# Push to main
git push origin main
```

Railway should auto-deploy from main branch.

---

## Verify Deployment

### Step 1: Check Railway Logs

Look for these log lines indicating the fix is deployed:

```
🔍 Routing request: County="Miami-Dade", State="FL"
```

This log line was added in the fix and confirms the new code is running.

### Step 2: Test the API

```bash
curl -X POST https://your-railway-url.app/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{
    "address": "1637 NW 59th St, Miami, FL 33142",
    "county": "Miami-Dade",
    "state": "FL"
  }' | jq .
```

**Expected Response** (should NOT see "not yet supported" error):
```json
{
  "success": true,
  "address": "1637 NW 59th St, Miami, FL 33142",
  ...
}
```

### Step 3: Check Counties Endpoint

```bash
curl https://your-railway-url.app/api/counties | jq .
```

**Expected**: Should list Miami-Dade County with features

---

## Troubleshooting

### Issue: Still Getting "County not supported" Error

**Possible Causes**:

1. **Deployment not complete**
   - Check Railway dashboard for deployment status
   - Wait a few minutes and try again

2. **Wrong branch deployed**
   - Check Railway settings → Deploy → Branch
   - Should be: `claude/miami-dade-prior-deed-pdf-011CUoGir2YktKQwHpypJS68`
   - Or merge to main and deploy from main

3. **Cache issue**
   - Try clearing Railway build cache
   - Railway Settings → Clear Build Cache → Redeploy

4. **Environment restart needed**
   - Sometimes Railway needs a full restart
   - Railway Settings → Restart

### Issue: Logs Don't Show "Routing request" Line

This means the old code is still running.

**Solution**:
1. Force redeploy from Railway dashboard
2. Or restart the service
3. Check deployment logs for errors

### Issue: Build Fails on Railway

**Check for**:
- Node version compatibility (need >= 18.0.0)
- Dependencies installed correctly
- Environment variables set

**View build logs** in Railway dashboard

---

## What Changed in the Fix

### File: `api-server.js`

**Added Function** (line 102-122):
```javascript
function normalizeCountyName(county) {
  if (!county) return '';

  let normalized = county.toLowerCase().trim();
  normalized = normalized.replace(/\s+county$/i, '');

  const countyMap = {
    'miami-dade': 'Miami-Dade',
    'miami dade': 'Miami-Dade',
    'miamidade': 'Miami-Dade',
    'orange': 'Orange',
    'hillsborough': 'Hillsborough'
  };

  return countyMap[normalized] || county;
}
```

**Updated Routing** (line 128-131):
```javascript
const detectedCounty = normalizeCountyName(county) || 'Orange';
const detectedState = (state || 'FL').toUpperCase();

console.log(`🔍 Routing request: County="${detectedCounty}", State="${detectedState}"`);
```

**Updated CAPTCHA Check** (line 188-202):
```javascript
const normalizedCounty = normalizeCountyName(county) || 'Orange';
const normalizedState = (state || 'FL').toUpperCase();

const countiesRequiringCaptcha = ['Orange'];
if (countiesRequiringCaptcha.includes(normalizedCounty) && !process.env.TWOCAPTCHA_TOKEN) {
  return res.status(503).json({
    error: 'CAPTCHA solver not configured',
    message: `${normalizedCounty} County requires CAPTCHA solving...`,
    hint: 'Hillsborough and Miami-Dade counties do not require CAPTCHA'
  });
}
```

---

## Testing After Deployment

### Test 1: Miami-Dade (Exact Case)
```bash
curl -X POST https://your-railway-url.app/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{"address": "1637 NW 59th St, Miami, FL 33142", "county": "Miami-Dade", "state": "FL"}'
```
**Expected**: ✅ Success

### Test 2: Miami-Dade (Lowercase)
```bash
curl -X POST https://your-railway-url.app/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{"address": "1637 NW 59th St, Miami, FL 33142", "county": "miami-dade", "state": "fl"}'
```
**Expected**: ✅ Success

### Test 3: Miami-Dade (Space)
```bash
curl -X POST https://your-railway-url.app/api/getPriorDeed \
  -H "Content-Type: application/json" \
  -d '{"address": "1637 NW 59th St, Miami, FL 33142", "county": "Miami Dade", "state": "FL"}'
```
**Expected**: ✅ Success

---

## Quick Checklist

Before testing from frontend:

- [ ] Check Railway deployment status is "Deployed"
- [ ] Check Railway logs show "Routing request" line
- [ ] Test API endpoint with curl (all 3 variations)
- [ ] Verify counties endpoint lists Miami-Dade
- [ ] Check no "not supported" errors in logs

---

## Still Having Issues?

If you're still seeing the error after deploying:

1. **Share the Railway logs**
   - Look for the "🔍 Routing request" line
   - Share the full error message

2. **Check the deployment**
   - What branch is Railway deploying from?
   - What's the latest commit hash on Railway?

3. **Verify the request**
   - What exact county/state values is frontend sending?
   - Check browser network tab for request payload

---

## Summary

**Current Status**: ✅ Fix is ready in code
**Next Step**: 🚀 Deploy to Railway
**Expected Result**: ✅ Miami-Dade works without CAPTCHA token

The fix is solid and tested. Once Railway deploys the latest code, the error will be gone!
