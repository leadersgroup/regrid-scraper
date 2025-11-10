# Common Development Commands

## Project Setup & Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Start production server
npm start
```

## Testing & Debugging
```bash
# Run specific county test
node test-dallas.js
node test-broward.js

# Debug specific functionality
node debug-captcha.js
node debug-pdf.js

# Test API endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/counties
curl -X POST http://localhost:3000/api/scrape -H "Content-Type: application/json" -d '{"addresses":["123 Main St"]}'
```

## Deployment
```bash
# Configure Railway
railway login
railway init
railway up

# Environment setup
cp .env.example .env
```

## Git Commands
```bash
# Check changes
git status
git diff

# Stage and commit
git add .
git commit -m "description"

# Push changes
git push origin main
```

## System Utils (macOS)
```bash
# Directory operations
ls -la
cd path/to/dir
pwd

# File operations
cp source dest
mv source dest
rm file
mkdir directory

# Search
find . -name "pattern"
grep -r "pattern" .
```