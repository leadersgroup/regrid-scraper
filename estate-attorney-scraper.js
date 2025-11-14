/**
 * Estate Planning Attorney Research and Attio CRM Integration
 *
 * This script:
 * 1. Researches estate planning attorneys in California
 * 2. Collects comprehensive contact information
 * 3. Uploads data to Attio CRM
 *
 * Target: 50 California estate planning attorneys
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
  TARGET_COUNT: 50,
  STATE: 'California',
  PRACTICE_AREA: 'Estate Planning',
  OUTPUT_DIR: './attorney-data',
  ATTIO_API_KEY: process.env.ATTIO_API_KEY || '',
  ATTIO_WORKSPACE_ID: process.env.ATTIO_WORKSPACE_ID || ''
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

/**
 * Attio CRM API Client
 */
class AttioClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.attio.com/v2';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a person record in Attio
   */
  async createPerson(personData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        {
          data: personData
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating person in Attio:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create a company record in Attio
   */
  async createCompany(companyData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/objects/companies/records`,
        {
          data: companyData
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating company in Attio:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Add note to a record
   */
  async addNote(recordId, noteContent) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notes`,
        {
          parent_object: 'people',
          parent_record_id: recordId,
          content: noteContent
        },
        { headers: this.headers }
      );
      return response.data;
    } catch (error) {
      console.error('Error adding note:', error.response?.data || error.message);
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/self`,
        { headers: this.headers }
      );
      console.log('✓ Attio API connection successful');
      console.log(`  Workspace: ${response.data.data?.workspace?.name || 'Connected'}`);
      return true;
    } catch (error) {
      console.error('✗ Attio API connection failed:', error.response?.data || error.message);
      return false;
    }
  }
}

/**
 * Attorney Data Collector
 */
class AttorneyCollector {
  constructor() {
    this.attorneys = [];
    this.sources = {
      avvo: 'https://www.avvo.com',
      justia: 'https://www.justia.com',
      lawyers: 'https://www.lawyers.com'
    };
  }

  /**
   * Search Avvo for estate planning attorneys in California
   */
  async searchAvvo(browser, city, limit = 10) {
    console.log(`\n🔍 Searching Avvo for attorneys in ${city}, CA...`);
    const page = await browser.newPage();

    try {
      const searchUrl = `https://www.avvo.com/estate-planning-lawyer/${city.toLowerCase().replace(' ', '-')}_ca.html`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for attorney listings
      await page.waitForSelector('.lawyer-search-result', { timeout: 10000 }).catch(() => {});

      const attorneys = await page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('.lawyer-search-result, .v2-lawyer-result');

        listings.forEach(listing => {
          try {
            const nameEl = listing.querySelector('.lawyer-name, [data-test-id="lawyer-name"]');
            const firmEl = listing.querySelector('.firm-name, [data-test-id="firm-name"]');
            const locationEl = listing.querySelector('.location, [data-test-id="location"]');
            const phoneEl = listing.querySelector('.phone, [data-test-id="phone"]');
            const websiteEl = listing.querySelector('a[href*="website"]');

            if (nameEl) {
              results.push({
                name: nameEl.textContent.trim(),
                firm: firmEl?.textContent.trim() || '',
                location: locationEl?.textContent.trim() || '',
                phone: phoneEl?.textContent.trim() || '',
                website: websiteEl?.href || '',
                source: 'Avvo'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      });

      console.log(`✓ Found ${attorneys.length} attorneys on Avvo`);
      return attorneys.slice(0, limit);

    } catch (error) {
      console.error(`Error searching Avvo:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Search Justia for estate planning attorneys
   */
  async searchJustia(browser, city, limit = 10) {
    console.log(`\n🔍 Searching Justia for attorneys in ${city}, CA...`);
    const page = await browser.newPage();

    try {
      const citySlug = city.toLowerCase().replace(/\s+/g, '-');
      const searchUrl = `https://www.justia.com/lawyers/estate-planning/california/${citySlug}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      await page.waitForSelector('.lawyer-card, .search-result', { timeout: 10000 }).catch(() => {});

      const attorneys = await page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('.lawyer-card, .search-result, .lawyer-listing');

        listings.forEach(listing => {
          try {
            const nameEl = listing.querySelector('.lawyer-name, h3 a, .name');
            const firmEl = listing.querySelector('.firm-name, .firm');
            const addressEl = listing.querySelector('.address, .location');
            const phoneEl = listing.querySelector('.phone, [href^="tel:"]');
            const websiteEl = listing.querySelector('a[href*="website"], .website a');

            if (nameEl) {
              results.push({
                name: nameEl.textContent.trim(),
                firm: firmEl?.textContent.trim() || '',
                location: addressEl?.textContent.trim() || '',
                phone: phoneEl?.textContent.trim() || phoneEl?.href?.replace('tel:', '') || '',
                website: websiteEl?.href || '',
                source: 'Justia'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      });

      console.log(`✓ Found ${attorneys.length} attorneys on Justia`);
      return attorneys.slice(0, limit);

    } catch (error) {
      console.error(`Error searching Justia:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Search Lawyers.com
   */
  async searchLawyers(browser, city, limit = 10) {
    console.log(`\n🔍 Searching Lawyers.com for attorneys in ${city}, CA...`);
    const page = await browser.newPage();

    try {
      const citySlug = city.toLowerCase().replace(/\s+/g, '-');
      const searchUrl = `https://www.lawyers.com/estate-planning/california/${citySlug}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      await page.waitForSelector('.lawyer-profile, .attorney-card', { timeout: 10000 }).catch(() => {});

      const attorneys = await page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('.lawyer-profile, .attorney-card, .profile-card');

        listings.forEach(listing => {
          try {
            const nameEl = listing.querySelector('.attorney-name, h3, .name');
            const firmEl = listing.querySelector('.firm-name, .law-firm');
            const locationEl = listing.querySelector('.address, .location');
            const phoneEl = listing.querySelector('.phone, [href^="tel:"]');
            const emailEl = listing.querySelector('a[href^="mailto:"]');
            const websiteEl = listing.querySelector('.website a, a[href*="website"]');

            if (nameEl) {
              results.push({
                name: nameEl.textContent.trim(),
                firm: firmEl?.textContent.trim() || '',
                location: locationEl?.textContent.trim() || '',
                phone: phoneEl?.textContent.trim() || phoneEl?.href?.replace('tel:', '') || '',
                email: emailEl?.href?.replace('mailto:', '') || '',
                website: websiteEl?.href || '',
                source: 'Lawyers.com'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      });

      console.log(`✓ Found ${attorneys.length} attorneys on Lawyers.com`);
      return attorneys.slice(0, limit);

    } catch (error) {
      console.error(`Error searching Lawyers.com:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Search California State Bar for estate planning attorneys
   */
  async searchCaliforniaBar(browser, limit = 10) {
    console.log(`\n🔍 Searching California State Bar...`);
    const page = await browser.newPage();

    try {
      // Note: The actual California State Bar search may require different approach
      // This is a placeholder for the structure
      const searchUrl = 'https://apps.calbar.ca.gov/attorney/LicenseeSearch/QuickSearch';
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Search would need to be customized based on actual site structure
      console.log('⚠ California State Bar search requires manual implementation');
      return [];

    } catch (error) {
      console.error(`Error searching California State Bar:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Collect attorneys from all sources
   */
  async collectAttorneys(targetCount = 50) {
    console.log(`\n📊 Starting attorney collection (Target: ${targetCount})...`);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    try {
      // Major California cities to search
      const cities = [
        'Los Angeles', 'San Francisco', 'San Diego', 'San Jose',
        'Sacramento', 'Oakland', 'Fresno', 'Long Beach',
        'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside',
        'Irvine', 'Pasadena', 'Newport Beach', 'Beverly Hills'
      ];

      const allAttorneys = [];
      const perCityLimit = Math.ceil(targetCount / cities.length) + 2;

      for (const city of cities) {
        if (allAttorneys.length >= targetCount) break;

        // Search multiple sources for each city
        const avvoResults = await this.searchAvvo(browser, city, perCityLimit);
        const justiaResults = await this.searchJustia(browser, city, perCityLimit);
        const lawyersResults = await this.searchLawyers(browser, city, perCityLimit);

        allAttorneys.push(...avvoResults, ...justiaResults, ...lawyersResults);

        console.log(`Progress: ${allAttorneys.length}/${targetCount} attorneys collected`);

        // Add delay between cities to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Remove duplicates based on name and firm
      const uniqueAttorneys = this.deduplicateAttorneys(allAttorneys);
      this.attorneys = uniqueAttorneys.slice(0, targetCount);

      console.log(`\n✓ Collection complete: ${this.attorneys.length} unique attorneys`);
      return this.attorneys;

    } catch (error) {
      console.error('Error collecting attorneys:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Remove duplicate attorneys
   */
  deduplicateAttorneys(attorneys) {
    const seen = new Set();
    return attorneys.filter(attorney => {
      const key = `${attorney.name}|${attorney.firm}`.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Enhance attorney data with additional information
   */
  async enhanceAttorneyData(attorney, browser) {
    // This could be enhanced to visit individual attorney pages
    // and extract more detailed information
    return attorney;
  }

  /**
   * Save collected data to JSON file
   */
  saveToFile(filename = 'california-estate-attorneys.json') {
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(this.attorneys, null, 2));
    console.log(`\n💾 Data saved to: ${filepath}`);
    return filepath;
  }

  /**
   * Generate CSV export
   */
  exportToCSV(filename = 'california-estate-attorneys.csv') {
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);

    const headers = ['Name', 'Firm', 'Location', 'Phone', 'Email', 'Website', 'Source'];
    const rows = this.attorneys.map(a => [
      a.name || '',
      a.firm || '',
      a.location || '',
      a.phone || '',
      a.email || '',
      a.website || '',
      a.source || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    fs.writeFileSync(filepath, csv);
    console.log(`📄 CSV exported to: ${filepath}`);
    return filepath;
  }
}

/**
 * Upload attorneys to Attio CRM
 */
async function uploadToAttio(attorneys, attioClient) {
  console.log(`\n📤 Uploading ${attorneys.length} attorneys to Attio CRM...`);

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];
    console.log(`\n[${i + 1}/${attorneys.length}] Processing: ${attorney.name}`);

    try {
      // Create company record for law firm if it exists
      let companyId = null;
      if (attorney.firm) {
        try {
          const companyData = {
            name: attorney.firm,
            website: attorney.website || null,
            location: attorney.location || null
          };

          const company = await attioClient.createCompany(companyData);
          companyId = company.data.id;
          console.log(`  ✓ Created company: ${attorney.firm}`);
        } catch (error) {
          console.log(`  ⚠ Company creation skipped (may already exist)`);
        }
      }

      // Create person record for attorney
      const personData = {
        name: attorney.name,
        email_addresses: attorney.email ? [{ email_address: attorney.email }] : [],
        phone_numbers: attorney.phone ? [{ phone_number: attorney.phone }] : [],
        location: attorney.location || null,
        job_title: 'Estate Planning Attorney',
        company: companyId ? { target_record_id: companyId } : null
      };

      const person = await attioClient.createPerson(personData);
      console.log(`  ✓ Created person: ${attorney.name}`);

      // Add source information as a note
      const sourceNote = `Source: ${attorney.source}\nWebsite: ${attorney.website || 'N/A'}\nPractice Area: Estate Planning\nState: California`;
      await attioClient.addNote(person.data.id, sourceNote);
      console.log(`  ✓ Added source note`);

      results.success++;

      // Rate limiting - wait between API calls
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`  ✗ Failed to upload ${attorney.name}:`, error.message);
      results.failed++;
      results.errors.push({
        attorney: attorney.name,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Main execution function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  California Estate Planning Attorney Research & CRM Upload');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Target: ${CONFIG.TARGET_COUNT} attorneys`);
  console.log(`State: ${CONFIG.STATE}`);
  console.log(`Practice Area: ${CONFIG.PRACTICE_AREA}\n`);

  try {
    // Step 1: Initialize Attio client
    console.log('📋 Step 1: Initializing Attio CRM connection...');

    if (!CONFIG.ATTIO_API_KEY) {
      console.warn('⚠ Warning: ATTIO_API_KEY not set in environment variables');
      console.log('Please set your Attio API key:');
      console.log('export ATTIO_API_KEY="your_api_key_here"\n');
    }

    const attioClient = new AttioClient(CONFIG.ATTIO_API_KEY);

    if (CONFIG.ATTIO_API_KEY) {
      const connected = await attioClient.testConnection();
      if (!connected) {
        console.log('⚠ Continuing without Attio connection (will save to files only)');
      }
    }

    // Step 2: Collect attorney data
    console.log('\n📋 Step 2: Collecting attorney contact information...');
    const collector = new AttorneyCollector();
    const attorneys = await collector.collectAttorneys(CONFIG.TARGET_COUNT);

    // Step 3: Save to files
    console.log('\n📋 Step 3: Saving collected data...');
    const jsonFile = collector.saveToFile();
    const csvFile = collector.exportToCSV();

    // Step 4: Upload to Attio (if API key is available)
    if (CONFIG.ATTIO_API_KEY && attorneys.length > 0) {
      console.log('\n📋 Step 4: Uploading to Attio CRM...');
      const uploadResults = await uploadToAttio(attorneys, attioClient);

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('  UPLOAD SUMMARY');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`✓ Successfully uploaded: ${uploadResults.success}`);
      console.log(`✗ Failed uploads: ${uploadResults.failed}`);
      console.log(`📊 Total attorneys collected: ${attorneys.length}`);

      if (uploadResults.errors.length > 0) {
        console.log('\n⚠ Upload Errors:');
        uploadResults.errors.forEach(err => {
          console.log(`  - ${err.attorney}: ${err.error}`);
        });
      }
    } else {
      console.log('\n⚠ Skipping Attio upload (API key not configured)');
      console.log('Data has been saved to local files for manual import.');
    }

    // Step 5: Generate summary report
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  COLLECTION SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`📊 Total attorneys collected: ${attorneys.length}`);
    console.log(`📁 JSON file: ${jsonFile}`);
    console.log(`📄 CSV file: ${csvFile}`);

    // Source breakdown
    const sourceBreakdown = attorneys.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📍 Sources:');
    Object.entries(sourceBreakdown).forEach(([source, count]) => {
      console.log(`  - ${source}: ${count} attorneys`);
    });

    // Data completeness
    const withEmail = attorneys.filter(a => a.email).length;
    const withPhone = attorneys.filter(a => a.phone).length;
    const withWebsite = attorneys.filter(a => a.website).length;

    console.log('\n📈 Data Completeness:');
    console.log(`  - With email: ${withEmail} (${Math.round(withEmail/attorneys.length*100)}%)`);
    console.log(`  - With phone: ${withPhone} (${Math.round(withPhone/attorneys.length*100)}%)`);
    console.log(`  - With website: ${withWebsite} (${Math.round(withWebsite/attorneys.length*100)}%)`);

    console.log('\n✅ Process completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Error in main process:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AttorneyCollector, AttioClient, uploadToAttio };
