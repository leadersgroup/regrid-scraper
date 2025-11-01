# API Quick Start Guide

## 🚀 Get Started in 3 Minutes

### Step 1: Start the Server

```bash
# Set your 2Captcha API key
export TWOCAPTCHA_TOKEN="your_api_key_here"

# Start the server
node api-server.js
```

You should see:
```
================================================================================
🚀 DEED SCRAPER API SERVER
================================================================================
📡 Server running on: http://localhost:3000
🔧 2Captcha API: ✅ Configured
```

### Step 2: Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# List supported counties
curl http://localhost:3000/api/counties
```

### Step 3: Download a Deed

```bash
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'
```

**Expected response (90-120 seconds):**
```json
{
  "success": true,
  "message": "Deed downloaded successfully",
  "duration": "95.34s",
  "download": {
    "filename": "deed_20170015765_1762024782019.pdf",
    "fileSize": 90551,
    "fileSizeKB": "88.43"
  },
  "cost": "$0.001"
}
```

---

## 📖 Common Use Cases

### Download Multiple Deeds

**JavaScript:**
```javascript
const axios = require('axios');

const addresses = [
  '6431 Swanson St, Windermere, FL 34786',
  '123 Main St, Orlando, FL 32801',
  // ... more addresses
];

async function downloadAll() {
  for (const address of addresses) {
    try {
      const response = await axios.post('http://localhost:3000/api/deed/download', {
        address
      });
      console.log(`✅ Downloaded: ${response.data.download.filename}`);
    } catch (error) {
      console.error(`❌ Failed: ${address}`);
    }

    // Wait 2 seconds between requests
    await new Promise(r => setTimeout(r, 2000));
  }
}

downloadAll();
```

### With Error Handling

```javascript
async function downloadDeed(address) {
  try {
    const response = await axios.post('http://localhost:3000/api/deed/download', {
      address,
      options: {
        headless: true,
        timeout: 120000
      }
    });

    return {
      success: true,
      filename: response.data.download.filename,
      fileSize: response.data.download.fileSizeKB,
      cost: response.data.cost
    };

  } catch (error) {
    if (error.response?.status === 503) {
      return { success: false, error: 'CAPTCHA solver not configured' };
    } else if (error.response?.status === 400) {
      return { success: false, error: 'Invalid address' };
    } else {
      return { success: false, error: error.message };
    }
  }
}
```

---

## 🔒 Production Deployment

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start with PM2
TWOCAPTCHA_TOKEN=your_api_key pm2 start api-server.js --name deed-api

# View logs
pm2 logs deed-api

# Monitor
pm2 monit

# Restart
pm2 restart deed-api

# Stop
pm2 stop deed-api
```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "api-server.js"]
```

Build and run:
```bash
docker build -t deed-scraper-api .

docker run -d \
  -p 3000:3000 \
  -e TWOCAPTCHA_TOKEN=your_api_key \
  --name deed-api \
  deed-scraper-api
```

### Using Environment Variables

Create `.env` file:
```env
TWOCAPTCHA_TOKEN=your_api_key_here
PORT=3000
DEED_DOWNLOAD_PATH=./downloads
NODE_ENV=production
```

---

## 🧪 Testing

Run the complete test suite:

```bash
# In one terminal, start the server
TWOCAPTCHA_TOKEN=your_api_key node api-server.js

# In another terminal, run tests
node test-api.js
```

---

## 💰 Cost Monitoring

Track your spending:

```javascript
let totalCost = 0;

async function downloadAndTrack(address) {
  const result = await downloadDeed(address);

  if (result.success) {
    totalCost += 0.001;
    console.log(`Total cost so far: $${totalCost.toFixed(3)}`);
  }

  return result;
}
```

Set spending alerts:

```javascript
const BUDGET_LIMIT = 10.00; // $10 limit

if (totalCost >= BUDGET_LIMIT) {
  throw new Error('Budget limit reached!');
}
```

---

## 📊 Response Format

**Success:**
```json
{
  "success": true,
  "message": "Deed downloaded successfully",
  "duration": "95.34s",
  "address": "6431 Swanson St, Windermere, FL 34786",
  "parcelId": "282330246500160",
  "county": "Orange",
  "state": "FL",
  "download": {
    "filename": "deed_20170015765_1762024782019.pdf",
    "filepath": "/path/to/deed.pdf",
    "fileSize": 90551,
    "fileSizeKB": "88.43",
    "documentId": "20170015765",
    "pdfUrl": "https://...",
    "timestamp": "2025-11-01T19:19:42.793Z"
  },
  "transactions": [...],
  "captchaSolved": true,
  "cost": "$0.001"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message",
  "duration": "45.12s",
  "timestamp": "2025-11-01T19:20:00.000Z"
}
```

---

## 🆘 Troubleshooting

### Server won't start
```bash
# Check if port is already in use
lsof -i :3000

# Use different port
PORT=4000 node api-server.js
```

### CAPTCHA solver not working
```bash
# Verify API key is set
echo $TWOCAPTCHA_TOKEN

# Check 2Captcha balance
# Visit: https://2captcha.com/enterpage
```

### Slow response times
- Normal: 90-120 seconds per request
- If longer: Check 2Captcha service status
- Consider running multiple instances for parallel requests

---

## 📚 Full Documentation

- [Complete API Documentation](API_DOCUMENTATION.md)
- [CAPTCHA Setup Guide](CAPTCHA_SOLVING_SETUP.md)
- [Orange County Status](ORANGE_COUNTY_DEED_DOWNLOAD_STATUS.md)

---

## ✅ Checklist

Before going to production:

- [ ] 2Captcha API key configured
- [ ] .env file created with credentials
- [ ] Download directory exists and is writable
- [ ] PM2 or Docker setup for process management
- [ ] Error handling implemented in client
- [ ] Rate limiting configured (if needed)
- [ ] Monitoring/logging setup
- [ ] Budget alerts configured

---

**Ready to go!** 🎉

For support, see the full [API Documentation](API_DOCUMENTATION.md).
