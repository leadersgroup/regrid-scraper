#!/bin/bash

# Georgia Trust & Estate Planning Attorney Collection Script
# Quick start script for collecting 500 Georgia attorneys

echo "═══════════════════════════════════════════════════════════════════"
echo "  Georgia Trust & Estate Planning Attorney Collector"
echo "═══════════════════════════════════════════════════════════════════"
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo
fi

# Check for Attio API key
if [ -z "$ATTIO_API_KEY" ]; then
    if [ -f ".env" ]; then
        echo "📋 Loading environment variables from .env file..."
        export $(cat .env | grep -v '^#' | xargs)
    fi

    if [ -z "$ATTIO_API_KEY" ]; then
        echo "❌ ERROR: ATTIO_API_KEY not set"
        echo
        echo "Please set your Attio API key:"
        echo "  export ATTIO_API_KEY=\"your_api_key_here\""
        echo
        echo "Or create a .env file with:"
        echo "  ATTIO_API_KEY=your_api_key_here"
        echo
        echo "Get your API key from: https://app.attio.com/settings/api"
        exit 1
    fi
fi

echo "✓ Environment configured"
echo "✓ API Key: ${ATTIO_API_KEY:0:20}...${ATTIO_API_KEY: -10}"
echo

# Confirm before running
echo "This script will:"
echo "  • Search for 500 trust & estate planning attorneys in Georgia"
echo "  • Cover major cities across Georgia"
echo "  • Search multiple legal directories (Avvo, Justia, Super Lawyers, etc.)"
echo "  • Upload all collected data to your Attio CRM"
echo "  • Save data to JSON and CSV files"
echo
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo
echo "🚀 Starting collection process..."
echo

# Run the scraper
node georgia-attorney-scraper.js

# Check exit code
if [ $? -eq 0 ]; then
    echo
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  ✅ SUCCESS - Collection completed!"
    echo "═══════════════════════════════════════════════════════════════════"
    echo
    echo "📁 Output files:"
    echo "  • attorney-data/georgia-estate-attorneys.json"
    echo "  • attorney-data/georgia-estate-attorneys.csv"
    echo "  • attorney-data/georgia-collection-summary.json"
    echo
    echo "📊 Next steps:"
    echo "  1. Review the CSV file for data quality"
    echo "  2. Log in to Attio to see imported records"
    echo "  3. Tag and organize the contacts in Attio"
    echo "  4. Begin your outreach campaign"
    echo
else
    echo
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  ❌ ERROR - Collection failed"
    echo "═══════════════════════════════════════════════════════════════════"
    echo
    echo "Check the error messages above for details."
    echo "Common issues:"
    echo "  • Invalid Attio API key"
    echo "  • Network connectivity problems"
    echo "  • Missing dependencies"
    echo
    exit 1
fi
