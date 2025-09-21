// api/test.js - Simple test endpointlee shen
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'working',
            message: 'Vercel API is working',
            timestamp: new Date().toISOString(),
            method: req.method,
            url: req.url
        });
    }
    
    if (req.method === 'POST') {
        return res.status(200).json({
            status: 'working',
            message: 'POST request received',
            body: req.body,
            timestamp: new Date().toISOString()
        });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
};