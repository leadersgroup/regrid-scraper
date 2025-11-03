# README.md
# 🏠 Deed Scraper API - Automated Property Deed Downloads

A production-ready REST API that automatically downloads property deed PDFs from county clerk websites with automatic CAPTCHA solving. Built for Orange County, Florida with support for additional counties coming soon.

## ✨ Features

- 🤖 **Automatic CAPTCHA Solving** - Uses 2Captcha API for fully automated downloads
- 📄 **Full PDF Download** - Retrieves complete deed documents from embedded viewers
- 📊 **Transaction History** - Extracts property sales history and document IDs
- 🚀 **REST API** - Simple HTTP endpoints for easy integration
- 💰 **Cost Effective** - Only $0.001 per deed (1/10th of a penny)
- ⚡ **Fast Processing** - 90-120 seconds average response time
- 🔐 **Secure** - Environment-based API key management

## 🎯 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Get 2Captcha API Key
```bash
# Sign up at https://2captcha.com/
# Add $3 minimum to your account
# Copy your API key
export TWOCAPTCHA_TOKEN="your_api_key_here"
```

### 3. Start API Server
```bash
node api-server.js
```

### 4. Download a Deed
```bash
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, Puppeteer
- **CAPTCHA Solving**: 2Captcha API via puppeteer-extra-plugin-recaptcha
- **Browser Automation**: puppeteer-extra with stealth plugin
- **API Framework**: Express.js with CORS support
- **Deployment**: PM2, Docker, or cloud platforms

## 📖 How It Works

1. Send address via POST request to `/api/deed/download`
2. System searches Orange County Property Appraiser for property
3. Extracts transaction history and most recent deed document ID
4. Navigates to Orange County Clerk website
5. Automatically solves reCAPTCHA using 2Captcha API
6. Downloads deed PDF from embedded viewer
7. Returns PDF file path and metadata

## 📊 API Endpoints

### GET /api/health
Check API server status and CAPTCHA solver configuration.

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "captchaSolver": "enabled",
  "timestamp": "2025-11-01T19:20:00.000Z"
}
```

### GET /api/counties
List supported counties and their features.

**Response:**
```json
{
  "success": true,
  "counties": [{
    "name": "Orange County",
    "state": "FL",
    "features": ["Automatic CAPTCHA solving", "Full PDF download", "Transaction history extraction"],
    "cost": "$0.001 per deed"
  }]
}
```

### POST /api/getPriorDeed
Legacy endpoint for downloading deed PDFs (returns raw scraper output).

**Request:**
```json
{
  "address": "6431 Swanson St, Windermere, FL 34786"
}
```

**Response:**
```json
{
  "success": true,
  "address": "6431 Swanson St, Windermere, FL 34786",
  "steps": {...},
  "download": {...},
  "duration": "95.34s"
}
```

### POST /api/deed/download
Recommended endpoint for downloading deed PDFs (enhanced response format).

**Request:**
```json
{
  "address": "6431 Swanson St, Windermere, FL 34786"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Deed downloaded successfully",
  "duration": "95.34s",
  "download": {
    "filename": "deed_20170015765_1762024782019.pdf",
    "fileSize": 90551,
    "fileSizeKB": "88.43",
    "documentId": "20170015765"
  },
  "parcelId": "282330246500160",
  "county": "Orange",
  "state": "FL",
  "transactions": [...],
  "captchaSolved": true,
  "cost": "$0.001"
}
```

## 💻 Usage Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const response = await axios.post('http://localhost:3000/api/deed/download', {
  address: '6431 Swanson St, Windermere, FL 34786'
});

console.log('PDF downloaded:', response.data.download.filename);
```

### Python
```python
import requests

response = requests.post('http://localhost:3000/api/deed/download', json={
    'address': '6431 Swanson St, Windermere, FL 34786'
})

print('PDF downloaded:', response.json()['download']['filename'])
```

### cURL
```bash
curl -X POST http://localhost:3000/api/deed/download \
  -H "Content-Type: application/json" \
  -d '{"address": "6431 Swanson St, Windermere, FL 34786"}'
```

## 💰 Pricing

### 2Captcha Costs
- **$1.00 per 1,000 CAPTCHAs solved**
- **$0.001 per deed** (1/10th of a penny)

### Monthly Cost Examples
| Deeds/Month | Cost/Month | Recommended Balance |
|-------------|------------|---------------------|
| 100         | $0.10      | $5                  |
| 1,000       | $1.00      | $10                 |
| 10,000      | $10.00     | $25                 |
| 100,000     | $100.00    | $200                |

## 🚀 Deployment

### Option 1: PM2 (Recommended)
```bash
pm2 start api-server.js --name deed-api
pm2 startup
pm2 save
```

### Option 2: Docker
```bash
docker build -t deed-scraper-api .
docker run -d -p 3000:3000 \
  -e TWOCAPTCHA_TOKEN=your_key \
  deed-scraper-api
```

### Option 3: Cloud Platforms
- **Railway**: Auto-deploy from GitHub
- **Heroku**: Add buildpack for Chrome/Puppeteer
- **DigitalOcean**: Use Docker container

## 📚 Documentation

- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Quick Start Guide](API_QUICKSTART.md) - Get started in 3 minutes
- [CAPTCHA Setup Guide](CAPTCHA_SOLVING_SETUP.md) - 2Captcha configuration
- [Usage Examples](examples/api-usage-examples.js) - Code examples
- [Complete Summary](API_COMPLETE_SUMMARY.md) - Full implementation details

## 🎯 Supported Counties

### Currently Supported
- ✅ **Orange County, Florida**
  - Full automation with CAPTCHA solving
  - PDF download
  - Transaction history

### Coming Soon
- Miami-Dade County, FL
- Broward County, FL
- Hillsborough County, FL

## 🔧 Configuration

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `TWOCAPTCHA_TOKEN` | **Yes** | 2Captcha API key |
| `PORT` | No | Server port (default: 3000) |
| `DEED_DOWNLOAD_PATH` | No | Download directory (default: ./downloads) |

## 🆘 Troubleshooting

### "CAPTCHA solver not configured"
```bash
# Set your 2Captcha API key
export TWOCAPTCHA_TOKEN="your_api_key_here"
```

### "ERROR_ZERO_BALANCE"
```bash
# Add funds to your 2Captcha account
# Visit: https://2captcha.com/enterpage
```

### Server not responding
```bash
# Make sure server is running
node api-server.js
```

## ⚖️ Legal & Compliance

- Public records access tool for research purposes
- Respects county clerk website terms of service
- Users responsible for compliance with local laws
- Data accuracy not guaranteed

## 📝 License

MIT License - see LICENSE file for details

---

**Status:** ✅ Production Ready
**Version:** 1.0.0
**Last Updated:** November 1, 2025
