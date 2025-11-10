# Project Overview: Regrid Scraper

## Purpose
The Regrid Scraper is a web scraping application designed to extract property data from various county websites. It's built as a serverless service deployed on Railway and offers both batch processing (up to 10 addresses) and single address lookup capabilities.

## Architecture
- **Server**: Express.js based API server (api-server.js)
- **Main Components**:
  - Batch property data scraper
  - Single property lookup API
  - County-specific implementations for different regions
  - Debug utilities for testing scraper components

## Tech Stack
- **Runtime**: Node.js (>=18.0.0)
- **Core Dependencies**:
  - Puppeteer + Puppeteer Extra (with Stealth and reCAPTCHA plugins)
  - Playwright (alternative scraping engine)
  - Express.js (API server)
  - PDF-lib (PDF processing)
  - Axios (HTTP client)
- **Development Dependencies**:
  - Nodemon (development server)

## Main Features
1. Bulk property data extraction (up to 10 addresses)
2. Single address property data lookup
3. County-specific scraping implementations
4. CAPTCHA handling capabilities
5. PDF document processing
6. Stealth scraping mode