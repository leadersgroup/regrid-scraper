# README.md
# 🏠 Property Data Extractor

A powerful web application that extracts property data including parcel ID and owner information from addresses using Regrid's database.

## ✨ Features

- 🔍 **Fast Property Lookup** - Extract data from up to 10 addresses at once
- 📊 **Comprehensive Data** - Get parcel ID, owner name, property type, and more
- 🎨 **Modern Interface** - Beautiful, responsive design with real-time feedback
- ⚡ **Serverless Architecture** - Built on Vercel for optimal performance
- 📱 **Mobile Friendly** - Works perfectly on all devices

## 🚀 Live Demo

Visit the live application: [Property Data Extractor](https://your-app.vercel.app)

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Node.js, Puppeteer, Vercel Serverless Functions
- **Deployment**: Vercel with GitHub integration
- **Data Source**: Regrid property database

## 📖 How to Use

1. Enter property addresses (one per line, maximum 10)
2. Click "Extract Property Data"
3. Wait for processing (typically 30-60 seconds)
4. View comprehensive property information

## 🔧 Development

### Prerequisites
- Node.js 18+
- Vercel CLI (optional)

### Local Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/regrid-scraper.git

# Install dependencies
npm install

# Run development server
vercel dev
```

### Deployment
This project auto-deploys to Vercel when pushed to the main branch.

## 📊 API Reference

### POST /api/scrape

Extract property data for multiple addresses.

**Request Body:**
```json
{
  "addresses": [
    "560 Shavano St, Crested Butte, CO 81224, USA",
    "123 Main St, Denver, CO 80202, USA"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "originalAddress": "560 Shavano St, Crested Butte, CO 81224, USA",
      "parcelId": "325728106012",
      "ownerName": "LAMB ERIC, LAMB JOYCE L",
      "address": "560 Shavano St",
      "city": "Crested Butte",
      "state": "CO",
      "propertyType": "Parcel",
      "score": 61.5
    }
  ]
}
```

## ⚖️ Legal & Compliance

- This tool is for educational and research purposes
- Respects rate limits and terms of service
- Data accuracy is not guaranteed
- Users responsible for compliance with local laws

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues or questions:
- Create an issue on GitHub
- Check the documentation
- Review the API reference

---

Built with ❤️ using Vercel Serverless Functions
