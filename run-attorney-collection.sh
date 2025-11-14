#!/bin/bash

# California Estate Planning Attorney Collection - Quick Start Script

echo "═══════════════════════════════════════════════════════════════════"
echo "  California Estate Planning Attorney Collection Tool"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js found: $(node --version)"
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check for Attio API key
if [ -z "$ATTIO_API_KEY" ]; then
    echo "⚠️  Warning: ATTIO_API_KEY environment variable not set"
    echo ""
    echo "To upload directly to Attio, please set your API key:"
    echo "  export ATTIO_API_KEY=\"your_api_key_here\""
    echo ""
    echo "Or create a .env file with:"
    echo "  ATTIO_API_KEY=your_api_key_here"
    echo ""
    echo "Get your API key from: https://app.attio.com/settings/api"
    echo ""
    read -p "Continue without Attio upload? (data will be saved to CSV/JSON) [y/N]: " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting. Please set ATTIO_API_KEY and run again."
        exit 1
    fi
else
    echo "✓ ATTIO_API_KEY found"
    echo ""
    echo "Testing Attio connection..."
    node test-attio-connection.js

    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Attio connection test failed"
        echo "Please check your API key and try again"
        exit 1
    fi
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Starting Attorney Collection"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Target: 50 estate planning attorneys in California"
echo "This may take 10-15 minutes..."
echo ""

# Run the enhanced scraper
node enhanced-attorney-scraper.js

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  ✅ SUCCESS!"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "Check your results:"
    echo "  📁 JSON: ./attorney-data/california-estate-attorneys.json"
    echo "  📄 CSV: ./attorney-data/california-estate-attorneys.csv"

    if [ -n "$ATTIO_API_KEY" ]; then
        echo "  ☁️  Attio: Check your workspace at https://app.attio.com"
    fi

    echo ""
    echo "Next steps:"
    echo "  1. Review the CSV file for data quality"
    echo "  2. Log in to Attio to verify imported contacts"
    echo "  3. Add tags and organize contacts into lists"
    echo "  4. Begin your outreach campaign"
    echo ""
else
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  ❌ ERROR"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "The collection process encountered an error."
    echo "Check the output above for details."
    echo ""
    echo "Common issues:"
    echo "  - Network connectivity problems"
    echo "  - Website structure changes"
    echo "  - Rate limiting"
    echo ""
    echo "Try running again, or check the documentation:"
    echo "  cat ATTORNEY_SCRAPER_README.md"
    echo ""
fi

exit $EXIT_CODE
