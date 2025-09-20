# AI Agent Instructions for regrid-scraper

## Project Overview
This is a web scraping project consisting of two parts:
1. `regrid-scraper/`: A main application that handles bulk property data extraction (up to 10 addresses)
2. `property-scraper-api/`: A simplified API service focusing on single address lookups

## Architecture & Data Flow
- **Entry Points**: 
  - Main app: `regrid-scraper/api/scrape.js` (handles batch processing)
  - API: `property-scraper-api/api/scrape.js` (single address endpoint)
- **Core Logic**: Puppeteer-based web scraping in each project's respective scraper modules
- **Deployment**: Vercel Serverless Functions with specific configurations for Chromium

## Key Development Patterns

### 1. Browser Management Pattern
```javascript
// Use this pattern when initializing Puppeteer
browser = await puppeteer.launch({
  args: [...chromium.args],
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
  ignoreHTTPSErrors: true
});
```

### 2. Error Response Structure
Always follow this error response pattern:
```javascript
{
  error: 'ErrorType',
  message: 'Detailed message',
  timestamp: new Date().toISOString()
}
```

### 3. Success Response Structure
Maintain this response format:
```javascript
{
  success: true,
  data: [...results],
  timestamp: new Date().toISOString()
}
```

## Critical Workflows

### Local Development
1. Install dependencies: `npm install`
2. Start dev server: `vercel dev`
3. Test endpoint: `curl -X POST http://localhost:3000/api/scrape -H "Content-Type: application/json" -d '{"addresses":["123 Main St"]}'`

### Debugging
- Check Chromium setup: `GET /api/scrape` for diagnostics
- Monitor Vercel logs for production issues
- Use `console.log()` statements (they appear in Vercel logs)

## Integration Points

### External Dependencies
- Regrid.com web interface
- Chromium (via @sparticuz/chromium)
- Puppeteer for web scraping

### Rate Limiting
- Maximum 10 addresses per request (main app)
- 1.5 second delay between searches
- 25 second timeout for Vercel functions

## Project-Specific Conventions

### Code Organization
- API endpoints in `/api` directory
- Core scraping logic in `lib/scraper.js`
- Configuration in `vercel.json`

### Error Handling
- Always include CORS headers
- Use try-catch blocks for each address
- Close browser in finally blocks
- Return detailed error messages

## Important Files
- `regrid-scraper/api/scrape.js`: Main scraping endpoint
- `property-scraper-api/lib/scraper.js`: Core scraping logic
- `vercel.json`: Deployment configuration
- `package.json`: Dependencies and scripts

## Common Pitfalls
1. Vercel's 30-second timeout limit
2. Chromium cold starts in serverless
3. Regrid.com structure changes requiring selector updates
4. Memory limits in serverless environment