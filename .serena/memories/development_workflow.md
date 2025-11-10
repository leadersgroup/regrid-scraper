# Development Workflow & Commands

## Development Commands
1. Start development server:
```bash
npm run dev
```

2. Start production server:
```bash
npm start
```

3. Build (placeholder):
```bash
npm run build
```

## Testing
The project includes numerous test files for different components:
- County-specific tests (e.g., test-dallas.js, test-broward.js)
- Feature-specific tests (e.g., test-api.js, test-pdf-pages.js)
- Debug scripts (debug-*.js files)

## Deployment
- Platform: Railway
- Configuration: railway.json and Procfile
- Environment: .env file (use .env.example as template)

## API Testing Endpoints
- Health Check: GET /health or GET /api/health
- County List: GET /api/counties
- Property Scraping: POST /api/scrape
- Prior Deed Info: POST /api/getPriorDeed

## Debug Tools
Multiple debug scripts are available for testing different components:
- CAPTCHA handling
- PDF processing
- County-specific implementations
- Search functionality
- Network monitoring