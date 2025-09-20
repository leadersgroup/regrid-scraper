// server.js - Minimal test version
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(express.json());

// Test route - this should work
app.get('/api/test', (req, res) => {
  res.json({
    status: 'working',
    message: 'Railway API is working',
    timestamp: new Date().toISOString()
  });
});

// Simple homepage
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>Regrid Scraper Test</title></head>
      <body>
        <h1>🏠 Regrid Property Scraper</h1>
        <p>Railway deployment is working!</p>
        <p><a href="/api/test">Test API</a></p>
        <p>Current time: ${new Date().toISOString()}</p>
      </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;