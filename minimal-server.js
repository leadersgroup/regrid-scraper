// Minimal server for Railway debugging
const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('Starting minimal server...');
console.log('Port:', PORT);
console.log('Time:', new Date().toISOString());

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  res.writeHead(200, { 'Content-Type': 'application/json' });

  if (req.url === '/health') {
    res.end('OK');
  } else if (req.url === '/api/test') {
    res.end(JSON.stringify({
      status: 'working',
      message: 'Minimal server working',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.end(JSON.stringify({
      message: 'Minimal Railway server running',
      timestamp: new Date().toISOString()
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Ready for connections');
});

// Handle shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});