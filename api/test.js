// api/test.js - Ultra minimal version if 503 persists

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS OK' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'working',
      message: 'Minimal test API',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === 'POST') {
    const { addresses } = req.body || {};
    
    // Return your known working data structure but with mock data
    const mockResults = (addresses || ['test']).map(address => ({
      originalAddress: address,
      parcelId: '325728106012',
      ownerName: 'LAMB ERIC, LAMB JOYCE L', 
      address: '560 Shavano St',
      city: 'Crested Butte',
      state: 'CO',
      propertyType: 'Parcel',
      score: 61.5,
      note: 'Mock data - real scraping disabled for testing'
    }));

    return res.status(200).json({
      success: true,
      data: mockResults,
      mode: 'mock'
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};