# Attio CRM Setup Guide

## Quick Start

Follow these steps to set up your Attio API integration:

## Step 1: Get Your Attio API Key

1. **Log in to Attio**
   - Go to https://app.attio.com
   - Log in with your credentials

2. **Navigate to API Settings**
   - Click on your profile/workspace name in the bottom left
   - Select "Settings" from the menu
   - Click on "API" in the left sidebar
   - Or go directly to: https://app.attio.com/settings/api

3. **Create a New API Key**
   - Click the "Create API key" button
   - Give it a descriptive name: "Estate Attorney Scraper"
   - Select the following scopes/permissions:
     - ✅ `record:read-write` (or `person:read-write` and `company:read-write`)
     - ✅ `note:read-write`
   - Click "Create"

4. **Copy Your API Key**
   - The API key will be shown only once
   - Copy it immediately and save it securely
   - Format: `attio_sk_...` (starts with attio_sk_)

## Step 2: Configure Environment Variables

### Option A: Using .env file (Recommended)

1. Copy the example file:
   ```bash
   cp .env.attorney .env
   ```

2. Edit the `.env` file:
   ```bash
   nano .env
   # or
   vim .env
   # or use your preferred text editor
   ```

3. Add your API key:
   ```env
   ATTIO_API_KEY=attio_sk_your_actual_api_key_here
   ATTIO_WORKSPACE_ID=your_workspace_id
   OUTPUT_DIR=./attorney-data
   ```

4. Save and close the file

### Option B: Export Environment Variables

```bash
export ATTIO_API_KEY="attio_sk_your_actual_api_key_here"
export ATTIO_WORKSPACE_ID="your_workspace_id"
```

## Step 3: Find Your Workspace ID (Optional)

The workspace ID is optional but helpful for multi-workspace setups:

1. In Attio, go to Settings > Workspace
2. Your workspace ID is in the URL or workspace settings
3. Format: Usually a UUID like `12345678-1234-1234-1234-123456789abc`

## Step 4: Test the Connection

Run a quick test to verify your API key works:

```bash
node -e "
const axios = require('axios');
const apiKey = process.env.ATTIO_API_KEY;

axios.get('https://api.attio.com/v2/workspaces', {
  headers: { 'Authorization': \`Bearer \${apiKey}\` }
}).then(res => {
  console.log('✓ Attio API connection successful!');
  console.log('Workspace:', res.data.data[0]?.name);
}).catch(err => {
  console.error('✗ Connection failed:', err.response?.data || err.message);
});
"
```

## Step 5: Run the Attorney Scraper

```bash
node estate-attorney-scraper.js
```

## Troubleshooting

### "ATTIO_API_KEY not set"

**Solution**: Make sure you've exported the environment variable or created a `.env` file.

```bash
# Check if it's set
echo $ATTIO_API_KEY

# If empty, set it:
export ATTIO_API_KEY="your_api_key"
```

### "Attio API connection failed: 401 Unauthorized"

**Possible causes**:
1. Invalid API key
2. API key expired or revoked
3. Incorrect key format

**Solution**:
1. Go back to Attio Settings > API
2. Verify the key is active
3. Create a new key if needed
4. Make sure you copied the entire key (starts with `attio_sk_`)

### "Attio API connection failed: 403 Forbidden"

**Possible causes**:
1. Insufficient permissions
2. API key doesn't have required scopes

**Solution**:
1. Recreate the API key with proper scopes:
   - `record:read-write` (or `person:read-write` and `company:read-write`)
   - `note:read-write`

### "Cannot find module 'axios'"

**Solution**: Install dependencies:

```bash
npm install
```

## Attio API Documentation

For more details, refer to the official Attio API documentation:
- API Reference: https://developers.attio.com/reference
- Authentication: https://developers.attio.com/reference/authentication
- Records API: https://developers.attio.com/reference/records

## Security Best Practices

1. **Never commit API keys to Git**
   - The `.env` file is already in `.gitignore`
   - Never share your API key publicly

2. **Use environment-specific keys**
   - Use different API keys for development and production
   - Rotate keys periodically

3. **Limit API key permissions**
   - Only grant the minimum required scopes
   - Create separate keys for different purposes

4. **Monitor API usage**
   - Check Attio's API usage dashboard regularly
   - Set up alerts for unusual activity

## Rate Limits

Attio API has rate limits to prevent abuse:
- Default: 100 requests per minute per API key
- The script includes built-in rate limiting (1 second between calls)
- For large batches, consider running in smaller chunks

## Data Model in Attio

After running the script, your Attio workspace will contain:

### Person Records (Attorneys)
- **Name**: Attorney's full name
- **Email**: Contact email (if available)
- **Phone**: Contact phone number
- **Location**: City and state
- **Job Title**: "Estate Planning Attorney"
- **Company**: Link to law firm company record

### Company Records (Law Firms)
- **Name**: Law firm name
- **Website**: Firm website URL
- **Location**: Office location

### Notes
Each attorney record includes a note with:
- Source (Avvo, Justia, Lawyers.com)
- Original listing URL
- Practice area confirmation
- Data collection date

## Next Steps After Import

1. **Review imported records**
   - Go to Attio > People
   - Filter by job title "Estate Planning Attorney"

2. **Create a List**
   - Create a new list: "California Estate Planning Attorneys"
   - Add all imported contacts to this list

3. **Add Tags**
   - Tag records with: "California", "Estate Planning", "Lead - Cold"
   - Use tags for segmentation in email campaigns

4. **Set up Workflows**
   - Create automated workflows for new attorney contacts
   - Set up email sequences for outreach

5. **Enrich Data**
   - Use Attio's enrichment features to find missing emails
   - Add custom fields for additional tracking

## Support

If you encounter issues:

1. **Check the script output**
   - Look for specific error messages
   - Review the console logs

2. **Verify API credentials**
   - Test connection with the command in Step 4
   - Regenerate API key if needed

3. **Review collected data**
   - Check the CSV file: `./attorney-data/california-estate-attorneys.csv`
   - Verify data quality before uploading

4. **Attio Support**
   - Contact Attio support: support@attio.com
   - Check documentation: https://help.attio.com

## Example: Complete Setup Session

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
export ATTIO_API_KEY="attio_sk_abc123..."

# 3. Test connection
node -e "
const axios = require('axios');
axios.get('https://api.attio.com/v2/workspaces', {
  headers: { Authorization: \`Bearer \${process.env.ATTIO_API_KEY}\` }
}).then(res => console.log('✓ Connected to:', res.data.data[0]?.name))
  .catch(err => console.error('✗ Error:', err.message));
"

# 4. Run the scraper
node estate-attorney-scraper.js

# 5. Check output
ls -lh ./attorney-data/
cat ./attorney-data/california-estate-attorneys.csv
```

## FAQ

**Q: How long does it take to collect 50 attorneys?**
A: Typically 5-10 minutes depending on network speed and site response times.

**Q: Can I collect more than 50 attorneys?**
A: Yes, edit the `TARGET_COUNT` in the script configuration.

**Q: What if some attorneys don't have email addresses?**
A: The script collects all available public information. Not all directories list email addresses. You may need to enrich the data later.

**Q: Can I target specific cities in California?**
A: Yes, edit the `cities` array in the script to focus on specific locations.

**Q: Will this create duplicate records in Attio?**
A: The script deduplicates based on name and firm before uploading, but Attio may still flag potential duplicates. Review and merge as needed.

**Q: Can I run this for other states?**
A: Yes, change the `STATE` configuration and update the `cities` array accordingly.

**Q: Is this legal and ethical?**
A: Yes, the script only collects publicly available professional information from legal directories.
