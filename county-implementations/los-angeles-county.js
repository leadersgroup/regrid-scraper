/**
 * Los Angeles County - Deed Scraper Implementation
 *
 * This file demonstrates how to implement county-specific scraping logic
 * for Los Angeles County, California.
 *
 * County Resources:
 * - Property Assessor: https://portal.assessor.lacounty.gov/
 * - Deed Recorder: https://lavote.gov/home/records/real-property-records
 */

const DeedScraper = require('../deed-scraper');

class LosAngelesCountyScraper extends DeedScraper {
  constructor(options = {}) {
    super(options);
    this.county = 'Los Angeles';
    this.state = 'CA';
  }

  /**
   * Search Los Angeles County Assessor website
   * URL: https://portal.assessor.lacounty.gov/
   */
  async searchAssessorSite(parcelId, ownerName) {
    this.log(`🔍 Searching LA County Assessor for Parcel: ${parcelId}`);

    try {
      // Navigate to LA County Assessor portal
      await this.page.goto('https://portal.assessor.lacounty.gov/', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Look for the AIN (Assessor Identification Number) search input
      const searchSelectors = [
        '#ain',
        'input[name="ain"]',
        'input[placeholder*="AIN"]',
        'input[placeholder*="Assessor"]'
      ];

      let searchInput = null;
      for (const selector of searchSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchInput = selector;
          this.log(`✅ Found search input: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }

      if (!searchInput) {
        throw new Error('Could not find AIN search input');
      }

      // Enter parcel ID (AIN)
      await this.page.click(searchInput);
      await this.randomWait(100, 300);

      // Clear and type parcel ID
      await this.page.evaluate((selector) => {
        document.querySelector(selector).value = '';
      }, searchInput);

      for (const char of parcelId) {
        await this.page.keyboard.type(char);
        await this.randomWait(50, 100);
      }

      // Click search button
      const searchButton = await this.page.$('button[type="submit"], input[type="submit"], #searchButton');
      if (searchButton) {
        await searchButton.click();
        await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.timeout });
      } else {
        // Try pressing Enter
        await this.page.keyboard.press('Enter');
        await this.randomWait(3000, 5000);
      }

      // Check if property was found
      const propertyFound = await this.page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        return !text.includes('no results') &&
               !text.includes('not found') &&
               (text.includes('property') || text.includes('parcel'));
      });

      return {
        success: propertyFound,
        message: propertyFound ? 'Property found on assessor website' : 'Property not found'
      };

    } catch (error) {
      this.log(`❌ Assessor search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract transaction records from LA County Assessor page
   */
  async extractTransactionRecords() {
    this.log('📋 Extracting transaction records...');

    try {
      const transactions = await this.page.evaluate(() => {
        const results = [];
        const text = document.body.innerText || '';

        // Look for sales information section
        const salesSection = document.querySelector('.sales-info, .transaction-info, .deed-info');

        if (salesSection) {
          const salesText = salesSection.innerText;

          // Extract document number (typically 8-10 digits)
          const docNumberMatch = salesText.match(/(?:document|doc|recording)\s*(?:number|#)?[:\s]+(\d{8,12})/i);
          if (docNumberMatch) {
            results.push({
              documentId: docNumberMatch[1],
              type: 'document_id',
              source: 'LA County Assessor'
            });
          }

          // Extract book/page if available
          const bookPageMatch = salesText.match(/book[:\s]+(\d+)[,\s]+page[:\s]+(\d+)/i);
          if (bookPageMatch) {
            results.push({
              bookNumber: bookPageMatch[1],
              pageNumber: bookPageMatch[2],
              type: 'book_page',
              source: 'LA County Assessor'
            });
          }

          // Extract sale date
          const saleDateMatch = salesText.match(/(?:sale|transfer|recording)\s*date[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
          if (saleDateMatch && results.length > 0) {
            results[results.length - 1].recordDate = saleDateMatch[1];
          }
        }

        // Also look for links to deeds
        const deedLinks = Array.from(document.querySelectorAll('a')).filter(link => {
          const href = link.href.toLowerCase();
          const text = link.textContent.toLowerCase();
          return href.includes('deed') ||
                 href.includes('document') ||
                 href.includes('recording') ||
                 text.includes('view deed') ||
                 text.includes('download');
        });

        for (const link of deedLinks) {
          const existingTransaction = results[results.length - 1];
          if (existingTransaction) {
            existingTransaction.downloadUrl = link.href;
          }
        }

        return results;
      });

      this.log(`✅ Found ${transactions.length} transaction record(s)`);
      return transactions;

    } catch (error) {
      this.log(`❌ Transaction extraction failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search LA County Deed Recorder by document ID
   * URL: https://lavote.gov/home/records/real-property-records
   */
  async searchByDocumentId(documentId) {
    this.log(`🔍 Searching LA County Recorder for Document ID: ${documentId}`);

    try {
      // Navigate to LA County Recorder/Registrar
      await this.page.goto('https://lavote.gov/home/records/real-property-records', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Note: LA County may redirect to a third-party system
      // This is a generic implementation that may need adjustment

      // Look for document search input
      const docSearchSelectors = [
        'input[name*="document"]',
        'input[placeholder*="Document"]',
        'input[id*="docNumber"]',
        '#documentNumber'
      ];

      let searchInput = null;
      for (const selector of docSearchSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          searchInput = selector;
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!searchInput) {
        this.log('⚠️ Could not find document search input');
        return {
          success: false,
          message: 'Document search input not found'
        };
      }

      // Enter document ID
      await this.page.click(searchInput);
      await this.page.type(searchInput, documentId, { delay: 100 });

      // Click search
      const searchButton = await this.page.$('button[type="submit"], input[type="submit"]');
      if (searchButton) {
        await searchButton.click();
        await this.randomWait(3000, 5000);
      }

      // Look for results and download links
      const result = await this.page.evaluate(() => {
        const downloadLink = document.querySelector('a[href*=".pdf"], a[href*="download"], a[href*="view"]');

        if (downloadLink) {
          return {
            success: true,
            downloadUrl: downloadLink.href,
            documentId: document.querySelector('.document-id, .doc-number')?.textContent || null
          };
        }

        return { success: false };
      });

      return result;

    } catch (error) {
      this.log(`❌ Document search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search by book and page number
   */
  async searchByBookPage(bookNumber, pageNumber) {
    this.log(`🔍 Searching LA County Recorder for Book: ${bookNumber}, Page: ${pageNumber}`);

    try {
      // Similar to document ID search but with book/page fields
      // LA County systems vary - this is a template

      const bookInput = await this.page.$('input[name*="book"], input[id*="book"]');
      const pageInput = await this.page.$('input[name*="page"], input[id*="page"]');

      if (bookInput && pageInput) {
        await bookInput.type(bookNumber, { delay: 100 });
        await pageInput.type(pageNumber, { delay: 100 });

        const searchButton = await this.page.$('button[type="submit"]');
        if (searchButton) {
          await searchButton.click();
          await this.randomWait(3000, 5000);
        }

        // Look for download link
        const downloadLink = await this.page.$('a[href*=".pdf"]');
        if (downloadLink) {
          const href = await this.page.evaluate(el => el.href, downloadLink);
          return {
            success: true,
            downloadUrl: href,
            bookNumber,
            pageNumber
          };
        }
      }

      return {
        success: false,
        message: 'Could not find book/page search or results'
      };

    } catch (error) {
      this.log(`❌ Book/Page search failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search by grantee name (owner/buyer)
   */
  async searchByGranteeName(granteeName) {
    this.log(`🔍 Searching LA County Recorder by Grantee: ${granteeName}`);

    try {
      // Navigate to recorder search
      await this.page.goto('https://lavote.gov/home/records/real-property-records', {
        waitUntil: 'networkidle2',
        timeout: this.timeout
      });

      await this.randomWait(2000, 3000);

      // Look for grantee name field
      const granteeSelectors = [
        'input[name*="grantee"]',
        'input[placeholder*="Grantee"]',
        'input[id*="grantee"]',
        'input[name*="buyer"]'
      ];

      let granteeInput = null;
      for (const selector of granteeSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          granteeInput = selector;
          break;
        } catch (e) {
          // Try next
        }
      }

      if (!granteeInput) {
        return [];
      }

      // Parse name (Last, First or First Last)
      const nameParts = granteeName.split(/[,\s]+/).filter(p => p.length > 0);
      const lastName = nameParts[0];

      // Enter last name (most common search field)
      await this.page.click(granteeInput);
      await this.page.type(granteeInput, lastName, { delay: 100 });

      // Submit search
      const searchButton = await this.page.$('button[type="submit"]');
      if (searchButton) {
        await searchButton.click();
        await this.randomWait(3000, 5000);
      }

      // Extract results
      const results = await this.page.evaluate(() => {
        const records = [];
        const resultRows = document.querySelectorAll('.result-row, .search-result, tr[data-document]');

        for (const row of resultRows) {
          const docId = row.querySelector('.document-id, .doc-number')?.textContent?.trim();
          const recordDate = row.querySelector('.record-date, .date')?.textContent?.trim();
          const downloadLink = row.querySelector('a[href*="pdf"], a[href*="view"], a[href*="download"]');

          if (docId) {
            records.push({
              documentId: docId,
              recordDate: recordDate || null,
              downloadUrl: downloadLink?.href || null,
              source: 'LA County Recorder - Grantee Search'
            });
          }
        }

        return records;
      });

      this.log(`✅ Found ${results.length} deed record(s) for grantee: ${granteeName}`);
      return results;

    } catch (error) {
      this.log(`❌ Grantee search failed: ${error.message}`);
      return [];
    }
  }
}

module.exports = LosAngelesCountyScraper;
