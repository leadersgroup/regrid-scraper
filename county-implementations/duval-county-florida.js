/**
 * Duval County, Florida - Deed Scraper Implementation
 *
 * County Resources:
 * - Property Appraiser: https://paopropertysearch.coj.net/Basic/Search.aspx
 * - Property Results: https://paopropertysearch.coj.net/Basic/Results.aspx
 * - Property Details: https://paopropertysearch.coj.net/Basic/Detail.aspx
 *
 * Workflow:
 * 1. Search by address (break down into components: street #, street name, street type, direction, unit, city)
 * 2. Find RE# link from results (format: 001014-0000)
 * 3. Navigate to detail page and find Sales History section
 * 4. Click on first book/page entry (format: 21348-00475)
 * 5. Download PDF using HTTPS with cookies (Orange County method)
 */

const DeedScraper = require('../deed-scraper');

class DuvalCountyFloridaScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Duval';
    this.state = 'FL';
  }

  /**
   * Override getPriorDeed to skip Step 1 (Regrid)
   * Duval County can search Property Appraiser directly by address
   */
  async getPriorDeed(address) {
    this.log(`🏁 Starting prior deed download for: ${address}`);
    this.currentAddress = address;

    const startTime = Date.now();
    const result = {
      address,
      timestamp: new Date().toISOString(),
      steps: {}
    };

    try {
      // Initialize browser if not already initialized
      if (!this.browser) {
        await this.initialize();
      }

      // SKIP STEP 1 (Regrid) - Duval County doesn't need parcel ID
      // We can search Property Appraiser directly by address
      this.log(`ℹ️  Skipping Step 1 (Regrid) - Duval County supports direct address search`);

      result.steps.step1 = {
        success: true,
        skipped: true,
        message: 'Duval County supports direct address search',
        county: 'Duval',
        state: 'FL',
        originalAddress: address
      };

      // STEP 2: Search Property Appraiser for transaction records
      const step2Result = await this.searchPropertyAssessor({
        originalAddress: address,
        county: 'Duval',
        state: 'FL'
      });

      result.steps.step2 = step2Result;

      if (!step2Result.success || !step2Result.transactions || step2Result.transactions.length === 0) {
        result.success = false;
        result.message = 'No transactions found on Property Appraiser';
        result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
        return result;
      }

      // STEP 3: Download the most recent deed
      const mostRecentDeed = step2Result.transactions[0];
      this.log(`📥 Attempting to download most recent deed: Book ${mostRecentDeed.bookNumber} Page ${mostRecentDeed.pageNumber}`);

      const downloadResult = await this.downloadDeed(mostRecentDeed);

      result.download = downloadResult;
      result.success = downloadResult.success;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

      return result;

    } catch (error) {
      this.log(`❌ Error in getPriorDeed: ${error.message}`);
      result.success = false;
      result.error = error.message;
      result.duration = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      return result;
    }
  }

  /**
   * Parse full address into components needed for Duval County search
   * Example: "18470 WARE AVE Jacksonville FL" breaks down into:
   * - street #: 18470
   * - street name: WARE
   * - street type: AVE
   * - city: Jacksonville
   */
  parseAddress(fullAddress) {
    this.log(`🔍 Parsing address: ${fullAddress}`);

    // First, extract the main components: number, street part, city, state
    // Pattern: [Street #] [Street Part] [Unit?], [City], [State] [Zip]
    const addressPattern = /^(\d+)\s+([^,#]+?)(?:#\s*(\S+))?\s*,\s*([^,]+),\s*([A-Z]{2})/i;

    const match = fullAddress.match(addressPattern);

    if (!match) {
      this.log(`⚠️ Could not parse address: ${fullAddress}`);
      return null;
    }

    const houseNumber = match[1];
    const streetPart = match[2].trim();
    const unit = match[3] || '';
    const city = match[4]?.trim() || '';

    // Now parse the street part into: [Direction?] [Street Name] [Street Type?]
    // Common street types
    const streetTypes = ['AVE', 'AVENUE', 'ST', 'STREET', 'RD', 'ROAD', 'DR', 'DRIVE', 'LN', 'LANE',
                        'CT', 'COURT', 'CIR', 'CIRCLE', 'BLVD', 'BOULEVARD', 'WAY', 'PL', 'PLACE',
                        'TER', 'TERRACE', 'PKWY', 'PARKWAY', 'HWY', 'HIGHWAY', 'TRAIL'];

    const words = streetPart.split(/\s+/);
    let direction = '';
    let streetName = streetPart;
    let streetType = '';

    // Check if first word is a direction (only if it's a standalone word matching direction pattern)
    const firstWord = words[0].toUpperCase();
    if (words.length > 1 && /^(N|S|E|W|NE|NW|SE|SW)$/.test(firstWord)) {
      direction = firstWord;
      // Remove direction from words
      words.shift();
    }

    // Check if last word is a street type
    if (words.length > 0) {
      const lastWord = words[words.length - 1].toUpperCase();
      if (streetTypes.includes(lastWord)) {
        streetType = lastWord;
        // Remove street type from words
        words.pop();
      }
    }

    // Remaining words are the street name
    streetName = words.join(' ');

    const parsed = {
      houseNumber: houseNumber,
      direction: direction,
      streetName: streetName.trim(),
      streetType: streetType,
      unit: unit,
      city: city
    };

    this.log(`✅ Parsed address:`, JSON.stringify(parsed, null, 2));
    return parsed;
  }

  /**
   * Search Duval County Property Appraiser by address
   */
  async searchPropertyAssessor(options) {
    const { originalAddress, county, state } = options;

    try {
      // Parse the address into components
      const parsedAddr = this.parseAddress(originalAddress);

      if (!parsedAddr) {
        return {
          success: false,
          message: 'Could not parse address into required components'
        };
      }

      // Navigate to Property Appraiser search page
      this.log(`🌐 Navigating to Duval County Property Appraiser search...`);
      await this.page.goto('https://paopropertysearch.coj.net/Basic/Search.aspx', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await this.randomWait(2000, 3000);

      // Fill in the address fields
      this.log(`📝 Entering address components...`);

      // Street Number
      const streetNumSelector = '#ctl00_cphBody_tbStreetNumber';
      await this.page.waitForSelector(streetNumSelector, { timeout: 10000 });
      await this.page.click(streetNumSelector);
      await this.page.type(streetNumSelector, parsedAddr.houseNumber, { delay: 100 });
      this.log(`   Street #: ${parsedAddr.houseNumber}`);

      // Street Name
      const streetNameSelector = '#ctl00_cphBody_tbStreetName';
      await this.page.click(streetNameSelector);
      await this.page.type(streetNameSelector, parsedAddr.streetName, { delay: 100 });
      this.log(`   Street Name: ${parsedAddr.streetName}`);

      // Street Suffix/Type (optional)
      if (parsedAddr.streetType) {
        const streetTypeSelector = '#ctl00_cphBody_ddStreetSuffix';
        await this.page.select(streetTypeSelector, parsedAddr.streetType);
        this.log(`   Street Type: ${parsedAddr.streetType}`);
      }

      // Street Prefix/Direction (optional)
      if (parsedAddr.direction) {
        const directionSelector = '#ctl00_cphBody_ddStreetPrefix';
        await this.page.select(directionSelector, parsedAddr.direction);
        this.log(`   Direction: ${parsedAddr.direction}`);
      }

      // Unit # (optional)
      if (parsedAddr.unit) {
        const unitSelector = '#ctl00_cphBody_tbStreetUnit';
        await this.page.click(unitSelector);
        await this.page.type(unitSelector, parsedAddr.unit, { delay: 100 });
        this.log(`   Unit: ${parsedAddr.unit}`);
      }

      // Click Search button
      this.log(`🔍 Clicking Search button...`);
      const searchButtonSelector = '#ctl00_cphBody_bSearch';
      await this.page.click(searchButtonSelector);

      // Wait for results page (use domcontentloaded instead of networkidle2 for faster response)
      try {
        await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
      } catch (error) {
        this.log(`⚠️ Navigation timeout, checking current URL anyway...`);
      }
      await this.randomWait(3000, 5000);

      const currentUrl = this.page.url();
      this.log(`📍 Current URL: ${currentUrl}`);

      // Check if we're on results page
      if (!currentUrl.includes('Results.aspx')) {
        this.log(`⚠️ Not on results page after search`);
        return {
          success: false,
          message: 'Search did not navigate to results page'
        };
      }

      // Extract RE# link from results
      this.log(`🔍 Looking for RE# link in results...`);

      const reLink = await this.page.evaluate(() => {
        // Look for RE# pattern in links: 001014-0000
        const allLinks = Array.from(document.querySelectorAll('a'));

        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // RE# format: 6 digits, hyphen, 4 digits (e.g., 001014-0000)
          const reMatch = text.match(/^(\d{6})-(\d{4})$/);

          if (reMatch && href.includes('Detail.aspx')) {
            return {
              found: true,
              reNumber: text,
              href: href
            };
          }
        }

        return { found: false };
      });

      if (!reLink.found) {
        this.log(`❌ Could not find RE# link in search results`);
        return {
          success: false,
          message: 'No property found with RE# in search results'
        };
      }

      this.log(`✅ Found RE#: ${reLink.reNumber}`);
      this.log(`🔗 Detail page URL: ${reLink.href}`);

      // Navigate to detail page
      this.log(`📄 Navigating to property detail page...`);
      await this.page.goto(reLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.randomWait(2000, 3000);

      // Extract transaction records from Sales History section
      const transactions = await this.extractSalesHistory();

      return {
        success: true,
        transactions: transactions,
        assessorUrl: currentUrl,
        reNumber: reLink.reNumber,
        originalAddress,
        county,
        state
      };

    } catch (error) {
      this.log(`❌ Property Appraiser search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract book/page records from Sales History section
   */
  async extractSalesHistory() {
    this.log(`📋 Extracting transaction records from Sales History section...`);

    try {
      // Scroll to Sales History section
      await this.page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent || '';
          if (text.includes('Sales History') || text.includes('SALES HISTORY')) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });

      await this.randomWait(1000, 2000);

      // Extract book/page entries
      const records = await this.page.evaluate(() => {
        const results = [];
        const allLinks = Array.from(document.querySelectorAll('a'));

        for (const link of allLinks) {
          const text = (link.textContent || '').trim();
          const href = link.href || '';

          // Look for book/page pattern: 21348-00475 (5 digits, hyphen, 5 digits)
          const bookPageMatch = text.match(/^(\d{5})-(\d{5})$/);

          if (bookPageMatch) {
            results.push({
              bookNumber: bookPageMatch[1],
              pageNumber: bookPageMatch[2],
              bookPage: text,
              href: href,
              type: 'book_page',
              source: 'Duval County Property Appraiser - Sales History'
            });
          }
        }

        return results;
      });

      this.log(`✅ Found ${records.length} book/page record(s) in Sales History`);

      records.forEach((record, idx) => {
        this.log(`   ${idx + 1}. Book ${record.bookNumber} Page ${record.pageNumber}`);
      });

      return records;

    } catch (error) {
      this.log(`❌ Failed to extract Sales History: ${error.message}`);
      return [];
    }
  }

  /**
   * Download deed PDF from Duval County
   * Uses Orange County download pattern: click link, extract PDF URL, download via HTTPS
   */
  async downloadDeed(transaction) {
    this.log(`📄 Downloading deed for Book ${transaction.bookNumber} Page ${transaction.pageNumber}...`);

    try {
      const { href, bookNumber, pageNumber } = transaction;

      if (!href) {
        throw new Error('No detail page URL available for this transaction');
      }

      // Set up network request monitoring BEFORE clicking the link
      this.log('📡 Setting up network monitoring to capture PDF requests...');
      const pdfRequests = [];

      const requestHandler = (request) => {
        const url = request.url();
        const resourceType = request.resourceType();

        // Capture any PDF-related requests
        if (url.includes('.pdf') || url.includes('/pdf') || url.includes('document') ||
            url.includes('Image') || url.includes('blob') || url.includes('Document') ||
            resourceType === 'document') {
          pdfRequests.push({
            url,
            resourceType,
            method: request.method()
          });
          this.log(`📥 Captured request: ${resourceType} - ${url.substring(0, 150)}`);
        }
      };

      this.page.on('request', requestHandler);

      // Navigate directly to the Clerk's website using the href URL
      this.log(`🔗 Navigating to Clerk's website: ${transaction.href}`);

      await this.page.goto(transaction.href, { waitUntil: 'networkidle2', timeout: 60000 });
      this.log(`✅ Navigated to Clerk's website`);

      await this.randomWait(3000, 5000);

      // Remove the request handler
      this.page.off('request', requestHandler);

      // Log captured requests
      if (pdfRequests.length > 0) {
        this.log(`📋 Found ${pdfRequests.length} PDF-related network request(s):`);
        pdfRequests.forEach((req, idx) => {
          this.log(`   ${idx + 1}. ${req.resourceType}: ${req.url.substring(0, 150)}`);
        });
      }

      // Look for PDF in iframe or page elements
      this.log(`🔍 Looking for PDF viewer on page...`);

      let pdfUrl = null;

      // Priority 1: Use captured PDF request from network monitoring
      if (pdfRequests.length > 0) {
        // Look for Duval County Clerk PDF URL: /Image/DocumentPdfAllPages/{token}
        const duvalPdfRequest = pdfRequests.find(r => r.url.includes('/DocumentPdfAllPages/'));
        if (duvalPdfRequest) {
          pdfUrl = duvalPdfRequest.url;
          this.log(`✅ Found Duval County PDF URL from network: ${pdfUrl.substring(0, 150)}`);
        } else {
          // Fallback to any PDF-like request
          const pdfRequest = pdfRequests.find(r => r.url.includes('.pdf') || r.url.includes('/pdf')) || pdfRequests[pdfRequests.length - 1];
          pdfUrl = pdfRequest.url;
          this.log(`✅ Found PDF URL from network: ${pdfUrl.substring(0, 150)}`);
        }
      }

      // Priority 2: Look for PDF in iframe
      if (!pdfUrl) {
        const iframeInfo = await this.page.evaluate(() => {
          const iframes = Array.from(document.querySelectorAll('iframe'));
          for (const iframe of iframes) {
            const src = iframe.src || '';
            if (src && (src.includes('.pdf') || src.includes('pdf') || src.includes('document'))) {
              return { found: true, src: src };
            }
          }
          return { found: false };
        });

        if (iframeInfo.found) {
          pdfUrl = iframeInfo.src;
          this.log(`✅ Found PDF URL in iframe: ${pdfUrl.substring(0, 150)}`);
        }
      }

      // Priority 3: Look for PDF embed/object
      if (!pdfUrl) {
        const embedInfo = await this.page.evaluate(() => {
          const embeds = Array.from(document.querySelectorAll('embed, object'));
          for (const embed of embeds) {
            const src = embed.src || embed.data || '';
            if (src && (src.includes('.pdf') || src.includes('pdf'))) {
              return { found: true, src: src };
            }
          }
          return { found: false };
        });

        if (embedInfo.found) {
          pdfUrl = embedInfo.src;
          this.log(`✅ Found PDF URL in embed: ${pdfUrl.substring(0, 150)}`);
        }
      }

      if (!pdfUrl) {
        throw new Error('Could not find PDF URL on the page');
      }

      // Download PDF using HTTPS module with cookies (Orange County method)
      this.log(`📥 Downloading PDF using HTTPS with session cookies...`);

      // Get cookies from current page session
      const cookies = await this.page.cookies();
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      this.log(`📋 Using ${cookies.length} cookies from session`);

      // Download PDF using Node.js https module
      const https = require('https');
      const url = require('url');
      const parsedUrl = url.parse(pdfUrl);

      return await new Promise((resolve, reject) => {
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.path,
          method: 'GET',
          headers: {
            'Cookie': cookieString,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,*/*',
            'Referer': this.page.url(),
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 60000
        };

        this.log(`🌐 GET ${pdfUrl.substring(0, 150)}`);

        const req = https.request(options, (res) => {
          this.log(`📥 Response: ${res.statusCode} ${res.statusMessage}`);
          this.log(`   Content-Type: ${res.headers['content-type']}`);
          this.log(`   Content-Length: ${res.headers['content-length']}`);

          if (res.statusCode === 200) {
            const chunks = [];

            res.on('data', (chunk) => {
              chunks.push(chunk);
            });

            res.on('end', () => {
              const pdfBuffer = Buffer.concat(chunks);

              // Verify it's actually a PDF
              const header = pdfBuffer.slice(0, 5).toString();
              if (header !== '%PDF-') {
                this.log(`❌ Response is not a PDF (header: ${header})`);
                this.log(`   First 100 bytes: ${pdfBuffer.slice(0, 100).toString()}`);
                reject(new Error('Downloaded content is not a PDF file'));
                return;
              }

              this.log(`✅ PDF downloaded successfully`);
              this.log(`📄 File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

              // Convert to base64 for API response
              const pdfBase64 = pdfBuffer.toString('base64');

              resolve({
                success: true,
                pdfBase64: pdfBase64,
                filename: `duval_deed_${bookNumber}_${pageNumber}.pdf`,
                downloadPath: '', // In-memory download, no file saved to disk
                source: 'Duval County - Official Records',
                bookNumber: bookNumber,
                pageNumber: pageNumber,
                timestamp: new Date().toISOString(),
                fileSize: pdfBuffer.length
              });
            });
          } else if (res.statusCode === 302 || res.statusCode === 301) {
            reject(new Error(`Redirect to: ${res.headers.location}`));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });

        req.on('error', (err) => {
          this.log(`❌ Request error: ${err.message}`);
          reject(err);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout after 60 seconds'));
        });

        req.end();
      });

    } catch (error) {
      this.log(`❌ Download failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = DuvalCountyFloridaScraper;
