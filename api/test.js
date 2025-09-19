module.exports = async function handler(req, res) {
  console.log('Test function called');
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'GET') {
    return res.status(200).json({ 
      message: 'API is working!', 
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};