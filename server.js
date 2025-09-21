// server.js - Fixed for Docker with proper signal handling
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting Regrid Scraper server...');
console.log('Port:', PORT);
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

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
  res.status(200).json({
    status: 'healthy',
    message: 'Regrid Scraper API (Railway Docker)',
    timestamp: new Date().toISOString(),
    platform: 'railway-docker',
    nodeVersion: process.version,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid
  });
});

// Railway health check (they sometimes check root for health)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    status: 'working',
    message: 'Railway Docker deployment successful',
    timestamp: new Date().toISOString(),
    platform: 'railway-docker'
  });
});

// Simple home page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Regrid Property Scraper</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .container { text-align: center; }
        .badge { background: #0066cc; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; }
        .link { display: inline-block; margin: 10px; padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px; }
        .link:hover { background: #0052a3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🏠 Regrid Property Scraper <span class="badge">Railway Docker</span></h1>
        <p>Server is running successfully!</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>Platform: Railway with Docker</p>
        <p>Node.js: ${process.version}</p>
        
        <div>
            <a href="/api/test" class="link">🧪 Test API</a>
            <a href="/api/health" class="link">❤️ Health Check</a>
        </div>
        
        <p><small>Chrome and Puppeteer will be added once basic server is working</small></p>
    </div>
</body>
</html>
  `);
});

// Catch all other routes
app.get('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    available_routes: ['/', '/api/test', '/api/health']
  });
});

// Start server with error handling
const server = app.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔗 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🧪 Test endpoint: http://0.0.0.0:${PORT}/api/test`);
  console.log(`❤️ Railway health: http://0.0.0.0:${PORT}/health`);
});

// Handle server errors
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  console.log('Server uptime:', process.uptime(), 'seconds');
  console.log('Memory usage:', process.memoryUsage());

  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    console.log('✅ Server closed successfully');
    process.exit(0);
  });

  // Force shutdown after 30 seconds (Railway needs more time)
  setTimeout(() => {
    console.log('⚠️ Forcing shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;