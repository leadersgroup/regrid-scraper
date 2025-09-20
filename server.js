// server.js - Express server for Render deployment
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Import your RegridScraper class
const RegridScraper = require('./regrid-scraper-render');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Regrid Scraper API (Render)',
    timestamp: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'working',
    message: 'Render deployment successful',
    timestamp: new Date().toISOString()
  });
});

// GET endpoint for scrape (health check)
app.get('/api/scrape', (req, res) => {
  res.json({
    status: 'ready',
    message: 'Regrid Property Scraper API (Render)',
    timestamp: new Date().toISOString(),
    platform: process.platform
  });
});

// Main scraping endpoint
app.post('/api/scrape', async (req, res) => {
  console.log('=== Scraping Request (Render) ===');
  
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses per request' });
    }

    console.log(`Processing ${addresses.length} addresses:`, addresses);

    // Use your proven RegridScraper logic
    const scraper = new RegridScraper();
    
    try {
      await scraper.initialize();
      await scraper.establishSession();
      
      const results = await scraper.searchMultipleProperties(addresses);
      
      await scraper.close();

      const successCount = results.filter(r => r && !r.error).length;
      
      console.log(`Completed: ${successCount}/${addresses.length} successful`);
      
      res.json({
        success: true,
        data: results,
        summary: {
          total: addresses.length,
          successful: successCount,
          failed: addresses.length - successCount
        },
        timestamp: new Date().toISOString(),
        platform: 'render'
      });

    } catch (error) {
      await scraper.close();
      throw error;
    }

  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({
      error: 'Scraping failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Regrid Scraper running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/scrape`);
  console.log(`💚 Platform: ${process.platform}`);
  console.log(`📦 Node: ${process.version}`);
});

module.exports = app;