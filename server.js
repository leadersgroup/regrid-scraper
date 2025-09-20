// server.js - Updated with embedded HTML route
const express = require('express');
const path = require('path');
const RegridScraper = require('./regrid-scraper-railway');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Regrid Scraper API (Railway)',
    timestamp: new Date().toISOString(),
    platform: 'railway',
    nodeVersion: process.version
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'working',
    message: 'Railway deployment successful',
    timestamp: new Date().toISOString(),
    platform: 'railway'
  });
});

// GET endpoint for scrape (health check)
app.get('/api/scrape', (req, res) => {
  res.json({
    status: 'ready',
    message: 'Regrid Property Scraper API (Railway)',
    timestamp: new Date().toISOString(),
    platform: 'railway'
  });
});

// Main scraping endpoint
app.post('/api/scrape', async (req, res) => {
  console.log('=== Scraping Request (Railway) ===');
  
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses array is required' });
    }

    if (addresses.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 addresses per request' });
    }

    console.log(`Processing ${addresses.length} addresses:`, addresses);

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
        platform: 'railway'
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

// Serve the frontend - Embedded HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Regrid Property Scraper (Railway)</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
        textarea { width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 14px; resize: vertical; min-height: 100px; box-sizing: border-box; }
        button { background: #7c3aed; color: white; border: none; padding: 12px 30px; border-radius: 5px; cursor: pointer; font-size: 16px; transition: background 0.3s; margin-right: 10px; }
        button:hover { background: #6d28d9; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .test-btn { background: #059669; }
        .test-btn:hover { background: #047857; }
        .results { margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 5px; border-left: 4px solid #7c3aed; }
        .property { background: white; margin: 10px 0; padding: 15px; border-radius: 5px; border: 1px solid #eee; }
        .property h3 { margin: 0 0 10px 0; color: #333; }
        .property-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 14px; }
        .info-item { padding: 5px 0; }
        .label { font-weight: bold; color: #666; }
        .error { color: #dc2626; background: #fef2f2; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { color: #059669; background: #ecfdf5; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .loading { text-align: center; color: #666; padding: 20px; }
        .badge { background: #7c3aed; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-left: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 Regrid Property Scraper <span class="badge">Railway</span></h1>
        
        <div style="margin-bottom: 20px;">
            <button onclick="testAPI()" id="testBtn" class="test-btn">🧪 Test API</button>
            <button onclick="scrapeProperties()" id="scrapeBtn">🔍 Search Properties</button>
        </div>
        
        <div class="form-group">
            <label for="addresses">Enter addresses (one per line, max 10):</label>
            <textarea id="addresses" placeholder="123 Main St, New York, NY&#10;456 Oak Ave, Los Angeles, CA"></textarea>
        </div>
        
        <div id="results"></div>
    </div>

    <script>
        async function testAPI() {
            const button = document.getElementById('testBtn');
            const results = document.getElementById('results');
            
            button.disabled = true;
            button.textContent = '🔄 Testing...';
            results.innerHTML = '<div class="loading">Testing API connection...</div>';
            
            try {
                const response = await fetch('/api/test');
                const data = await response.json();
                
                if (response.ok) {
                    results.innerHTML = '<div class="success">✅ API Test Successful!</div>';
                } else {
                    results.innerHTML = '<div class="error">❌ API Test Failed</div>';
                }
            } catch (error) {
                results.innerHTML = '<div class="error">❌ Test Failed: ' + error.message + '</div>';
            } finally {
                button.disabled = false;
                button.textContent = '🧪 Test API';
            }
        }
        
        async function scrapeProperties() {
            const addresses = document.getElementById('addresses').value.split('\\n').map(a => a.trim()).filter(a => a.length > 0);
            
            if (addresses.length === 0) {
                alert('Please enter at least one address');
                return;
            }
            
            const button = document.getElementById('scrapeBtn');
            const results = document.getElementById('results');
            
            button.disabled = true;
            button.textContent = '🔄 Searching...';
            results.innerHTML = '<div class="loading">Searching properties... This may take a few minutes.</div>';
            
            try {
                const response = await fetch('/api/scrape', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ addresses })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    displayResults(data);
                } else {
                    results.innerHTML = '<div class="error">Error: ' + data.message + '</div>';
                }
            } catch (error) {
                results.innerHTML = '<div class="error">Error: ' + error.message + '</div>';
            } finally {
                button.disabled = false;
                button.textContent = '🔍 Search Properties';
            }
        }
        
        function displayResults(data) {
            const results = document.getElementById('results');
            const { summary, data: properties } = data;
            
            let html = '<div class="results"><h2>📊 Results Summary</h2><p><strong>Total:</strong> ' + summary.total + ' | <strong>Successful:</strong> ' + summary.successful + ' | <strong>Failed:</strong> ' + summary.failed + '</p></div>';
            
            properties.forEach(property => {
                if (property.error) {
                    html += '<div class="property"><h3>❌ ' + property.originalAddress + '</h3><div class="error">Error: ' + property.error + '</div></div>';
                } else {
                    html += '<div class="property"><h3>✅ ' + property.originalAddress + '</h3><div class="property-info">';
                    html += '<div class="info-item"><span class="label">Parcel ID:</span> ' + property.parcelId + '</div>';
                    html += '<div class="info-item"><span class="label">Owner:</span> ' + property.ownerName + '</div>';
                    html += '<div class="info-item"><span class="label">Address:</span> ' + property.address + '</div>';
                    html += '<div class="info-item"><span class="label">City:</span> ' + property.city + '</div>';
                    html += '<div class="info-item"><span class="label">State:</span> ' + property.state + '</div>';
                    html += '<div class="info-item"><span class="label">ZIP:</span> ' + property.zipCode + '</div>';
                    html += '</div></div>';
                }
            });
            
            results.innerHTML = html;
        }
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log(`🚀 Regrid Scraper running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔗 API: http://localhost:${PORT}/api/scrape`);
  console.log(`🚂 Platform: Railway`);
  console.log(`📦 Node: ${process.version}`);
});

module.exports = app;