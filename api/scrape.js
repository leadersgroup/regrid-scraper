// api/scrape.js - Vercel serverless function
const RegridScraper = require('../regrid-scraper-vercel');

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        return res.json({
            status: 'ready',
            message: 'Regrid Property Scraper API (Vercel)',
            timestamp: new Date().toISOString(),
            platform: 'vercel'
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== Scraping Request (Vercel) ===');
    
    try {
        const { addresses } = req.body;
        
        if (!addresses || !Array.isArray(addresses)) {
            return res.status(400).json({ error: 'Addresses array is required' });
        }

        if (addresses.length > 5) {
            return res.status(400).json({ error: 'Maximum 5 addresses per request on Vercel' });
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
                platform: 'vercel'
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
}