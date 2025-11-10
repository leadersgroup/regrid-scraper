# Code Conventions & Style Guide

## File Organization
1. API endpoints in api-server.js
2. County-specific implementations in separate files
3. Debug utilities prefixed with 'debug-'
4. Test files prefixed with 'test-'

## Code Style
1. Modern JavaScript with async/await patterns
2. Error Response Format:
```javascript
{
  error: 'ErrorType',
  message: 'Detailed message',
  timestamp: new Date().toISOString()
}
```

3. Success Response Format:
```javascript
{
  success: true,
  data: [...results],
  timestamp: new Date().toISOString()
}
```

## Browser Management
Standard pattern for Puppeteer initialization:
```javascript
browser = await puppeteer.launch({
  args: [...chromium.args],
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
  ignoreHTTPSErrors: true
});
```

## Error Handling
1. Use try-catch blocks for each scraping operation
2. Include CORS headers in responses
3. Implement proper browser cleanup in finally blocks
4. Return detailed error messages

## Rate Limiting & Timeouts
- Maximum 10 addresses per batch request
- 1.5 second delay between searches
- 25 second timeout for serverless functions

## Documentation
- Maintain README files for specific features
- Update API documentation for endpoint changes
- Document county-specific requirements