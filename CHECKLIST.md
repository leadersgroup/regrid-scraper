# Estate Planning Attorney Collection - Quick Checklist

## Before You Start

- [ ] Node.js installed (v18+)
- [ ] Project dependencies installed (`npm install`)
- [ ] Attio CRM account created
- [ ] Internet connection available

## Get Started (5 Minutes)

### 1. Get Attio API Key
- [ ] Go to https://app.attio.com/settings/api
- [ ] Click "Create API key"
- [ ] Name: "Attorney Scraper"
- [ ] Permissions: `record:read-write` + `note:read-write`
- [ ] Copy API key (starts with `attio_sk_`)

### 2. Configure Environment
- [ ] Run: `export ATTIO_API_KEY="attio_sk_your_key_here"`

  OR

- [ ] Create `.env` file with:
  ```
  ATTIO_API_KEY=attio_sk_your_key_here
  ```

### 3. Test Connection
- [ ] Run: `node test-attio-connection.js`
- [ ] Verify: "✓ Attio API connection successful"

### 4. Start Collection
- [ ] Run: `./run-attorney-collection.sh`
- [ ] Wait 10-15 minutes
- [ ] Check for "✅ SUCCESS!" message

## Verify Results

### Check Files
- [ ] File exists: `./attorney-data/california-estate-attorneys.json`
- [ ] File exists: `./attorney-data/california-estate-attorneys.csv`
- [ ] Open CSV and verify data looks correct

### Check Attio
- [ ] Log in to https://app.attio.com
- [ ] Go to People
- [ ] Search for job title: "Estate Planning Attorney"
- [ ] Verify 50 contacts are present
- [ ] Check sample contacts have:
  - [ ] Name
  - [ ] Phone number
  - [ ] Law firm linked
  - [ ] Location (California city)

### Data Quality Check
- [ ] At least 45 contacts have phone numbers
- [ ] At least 45 contacts have law firms
- [ ] At least 20 contacts have email addresses
- [ ] At least 40 contacts have websites
- [ ] No obvious duplicates

## Organize in Attio

### Create Lists
- [ ] Create list: "California Estate Planning Attorneys"
- [ ] Add all 50 attorneys to list

### Add Tags
- [ ] Tag all with: "California"
- [ ] Tag all with: "Estate Planning"
- [ ] Tag all with: "Lead - Cold"
- [ ] Tag all with: "2025-11" (or current month)

### Optional: City Tags
- [ ] Tag Los Angeles attorneys: "Los Angeles"
- [ ] Tag San Francisco attorneys: "San Francisco"
- [ ] Tag San Diego attorneys: "San Diego"
- [ ] (Continue for other cities)

## Enrich Data (Optional)

- [ ] Use Attio enrichment to find missing emails
- [ ] Add LinkedIn profile URLs
- [ ] Verify phone numbers are current
- [ ] Add notes about specializations
- [ ] Research firm sizes

## Plan Outreach

### Email Sequence
- [ ] Draft email 1: Introduction
- [ ] Draft email 2: Value proposition
- [ ] Draft email 3: Follow-up (3 days)
- [ ] Draft email 4: Follow-up (7 days)
- [ ] Draft email 5: Final touch (14 days)

### Prepare Materials
- [ ] Value proposition document
- [ ] Case studies or testimonials
- [ ] Service overview PDF
- [ ] Pricing information
- [ ] Calendar booking link

### Set Up Workflows
- [ ] Auto-tag email responses
- [ ] Create tasks for callbacks
- [ ] Track email opens
- [ ] Track email clicks
- [ ] Schedule follow-up reminders

## Launch Campaign

### Test Phase
- [ ] Select 10-15 attorneys for test batch
- [ ] Send initial emails
- [ ] Monitor response rate (48 hours)
- [ ] Analyze feedback
- [ ] Adjust messaging if needed

### Full Launch
- [ ] Send to remaining attorneys
- [ ] Track metrics:
  - [ ] Open rate
  - [ ] Click rate
  - [ ] Response rate
  - [ ] Conversion rate
- [ ] Follow up with interested prospects
- [ ] Document best practices

## Troubleshooting

### If collection fails:
- [ ] Check error message in console
- [ ] Verify internet connection
- [ ] Check Attio API key is valid
- [ ] Try running again (it will resume)
- [ ] Review `./attorney-data/progress.json`

### If Attio upload fails:
- [ ] Verify API key permissions
- [ ] Check rate limits not exceeded
- [ ] Upload CSV manually to Attio
- [ ] Contact Attio support if needed

### If data quality is poor:
- [ ] Check CSV file manually
- [ ] Verify attorney information online
- [ ] Add missing data manually
- [ ] Consider re-running for specific cities

## Success Metrics

Collection is successful when:
- [ ] 50 unique attorneys collected
- [ ] Data saved to JSON and CSV
- [ ] All uploaded to Attio
- [ ] >90% have phone numbers
- [ ] >90% have law firms
- [ ] >95% have locations
- [ ] No critical errors

Campaign is successful when:
- [ ] >20% open rate on emails
- [ ] >5% response rate
- [ ] >1% conversion rate (meetings booked)
- [ ] Positive feedback received
- [ ] Sales pipeline growing

## Maintenance

### Weekly
- [ ] Review response rates
- [ ] Update contact status in Attio
- [ ] Follow up with warm leads
- [ ] Archive cold leads

### Monthly
- [ ] Collect more attorneys if needed
- [ ] Update email sequences based on performance
- [ ] Analyze conversion data
- [ ] Optimize messaging

### Quarterly
- [ ] Re-verify contact information
- [ ] Remove bounced emails
- [ ] Update firm information
- [ ] Expand to new cities/states

## Need Help?

- [ ] Read `QUICK_START.md`
- [ ] Read `ATTORNEY_SCRAPER_README.md`
- [ ] Read `ATTIO_SETUP_GUIDE.md`
- [ ] Check console output for errors
- [ ] Review CSV file for data issues
- [ ] Test Attio connection: `node test-attio-connection.js`

## Quick Commands Reference

```bash
# Test Attio connection
node test-attio-connection.js

# Run full collection
./run-attorney-collection.sh

# Run without shell script
node enhanced-attorney-scraper.js

# Check progress
cat ./attorney-data/progress.json | jq '.attorneys | length'

# View collected data
cat ./attorney-data/california-estate-attorneys.csv

# Clear progress and start fresh
rm ./attorney-data/progress.json

# Check dependencies
npm list --depth=0 | grep -E "(puppeteer|axios|dotenv)"

# View logs
tail -f output.log  # if logging to file
```

## Files Reference

```
Main scripts:
  ./enhanced-attorney-scraper.js       [Main scraper]
  ./run-attorney-collection.sh         [Quick start]
  ./test-attio-connection.js           [Test API]

Documentation:
  ./QUICK_START.md                     [5-min guide]
  ./ATTORNEY_SCRAPER_README.md         [Full docs]
  ./ATTIO_SETUP_GUIDE.md               [API setup]
  ./CHECKLIST.md                       [This file]

Output:
  ./attorney-data/california-estate-attorneys.json
  ./attorney-data/california-estate-attorneys.csv
  ./attorney-data/progress.json
  ./attorney-data/*.png
```

## Timeline

| Task | Duration | Status |
|------|----------|--------|
| Setup Attio API | 5 min | [ ] |
| Install dependencies | 2 min | [ ] |
| Test connection | 1 min | [ ] |
| Run collection | 15 min | [ ] |
| Verify results | 5 min | [ ] |
| Organize in Attio | 15 min | [ ] |
| Plan outreach | 30 min | [ ] |
| **TOTAL** | **~75 min** | |

## Completion

- [ ] All attorneys collected ✓
- [ ] All uploaded to Attio ✓
- [ ] Data organized and tagged ✓
- [ ] Outreach plan ready ✓
- [ ] Campaign launched ✓

**Date Completed:** _______________

**Notes:**
_____________________________________
_____________________________________
_____________________________________

---

**Ready to start?** Run `./run-attorney-collection.sh`
