/**
 * Enhanced Estate Planning Attorney Research Tool
 *
 * This version includes:
 * - Better error handling
 * - Multiple fallback strategies
 * - Progress saving
 * - Resume capability
 * - Manual data import option
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// Load environment variables
require('dotenv').config();

const CONFIG = {
  TARGET_COUNT: 50,
  STATE: 'California',
  OUTPUT_DIR: './attorney-data',
  ATTIO_API_KEY: process.env.ATTIO_API_KEY || '',
  PROGRESS_FILE: './attorney-data/progress.json',
  MANUAL_DATA_FILE: './manual-attorney-data.json'
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

/**
 * Progress tracker for resumable scraping
 */
class ProgressTracker {
  constructor(filepath) {
    this.filepath = filepath;
    this.progress = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filepath)) {
        return JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
      }
    } catch (error) {
      console.log('No previous progress found, starting fresh');
    }
    return {
      attorneys: [],
      citiesCompleted: [],
      lastUpdate: null
    };
  }

  save() {
    this.progress.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.filepath, JSON.stringify(this.progress, null, 2));
  }

  addAttorneys(attorneys) {
    this.progress.attorneys.push(...attorneys);
    this.save();
  }

  markCityComplete(city) {
    if (!this.progress.citiesCompleted.includes(city)) {
      this.progress.citiesCompleted.push(city);
      this.save();
    }
  }

  isCityComplete(city) {
    return this.progress.citiesCompleted.includes(city);
  }

  getAttorneys() {
    return this.progress.attorneys;
  }

  clear() {
    this.progress = {
      attorneys: [],
      citiesCompleted: [],
      lastUpdate: null
    };
    this.save();
  }
}

/**
 * California State Bar API Client
 * Using official state bar records for verified attorney data
 */
class CaliforniaBarClient {
  constructor() {
    this.baseUrl = 'https://apps.calbar.ca.gov/attorney';
  }

  /**
   * Search attorneys by practice area and location
   * Note: This is a conceptual implementation - actual API may differ
   */
  async searchAttorneys(city, practiceArea = 'Estate Planning', limit = 10) {
    console.log(`🔍 Searching California State Bar: ${city}...`);

    try {
      // This would need to be adapted to the actual California Bar API
      // For now, returning empty array as placeholder
      console.log('⚠ California State Bar API integration pending');
      return [];
    } catch (error) {
      console.error('Error searching California Bar:', error.message);
      return [];
    }
  }
}

/**
 * LinkedIn attorney search (if LinkedIn scraping is desired)
 */
class LinkedInSearcher {
  async searchAttorneys(city, limit = 10) {
    console.log(`🔍 LinkedIn search for ${city} (placeholder)`);
    // LinkedIn scraping requires special handling due to authentication
    // and terms of service considerations
    return [];
  }
}

/**
 * Enhanced Attorney Collector with multiple strategies
 */
class EnhancedAttorneyCollector {
  constructor() {
    this.progressTracker = new ProgressTracker(CONFIG.PROGRESS_FILE);
    this.calBarClient = new CaliforniaBarClient();
  }

  /**
   * Collect from manual JSON file
   */
  loadManualData() {
    try {
      if (fs.existsSync(CONFIG.MANUAL_DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.MANUAL_DATA_FILE, 'utf8'));
        console.log(`📋 Loaded ${data.length} attorneys from manual data file`);
        return data;
      }
    } catch (error) {
      console.log('No manual data file found');
    }
    return [];
  }

  /**
   * Search Avvo with enhanced selectors and error handling
   */
  async searchAvvo(browser, city, limit = 10) {
    const page = await browser.newPage();

    try {
      console.log(`\n🔍 Searching Avvo: ${city}, CA...`);

      const citySlug = city.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const searchUrl = `https://www.avvo.com/estate-planning-lawyer/${citySlug}_ca.html`;

      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait a bit for dynamic content
      await new Promise(r => setTimeout(r, 2000));

      // Take screenshot for debugging
      const screenshotPath = path.join(CONFIG.OUTPUT_DIR, `avvo-${citySlug}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  📸 Screenshot saved: ${screenshotPath}`);

      const attorneys = await page.evaluate(() => {
        const results = [];

        // Try multiple possible selectors
        const selectors = [
          '.lawyer-search-result',
          '.v2-lawyer-result',
          '.lawyer-card',
          '[data-lawyer-id]',
          '.search-result-lawyer'
        ];

        let listings = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            listings = Array.from(elements);
            break;
          }
        }

        console.log(`Found ${listings.length} listings`);

        listings.forEach((listing, index) => {
          try {
            // Try multiple selectors for each field
            const getName = () => {
              const selectors = [
                '.lawyer-name',
                '[data-test-id="lawyer-name"]',
                'h3 a',
                '.name',
                'a[href*="/attorney/"]'
              ];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return null;
            };

            const getFirm = () => {
              const selectors = [
                '.firm-name',
                '[data-test-id="firm-name"]',
                '.law-firm',
                '.office-name'
              ];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return '';
            };

            const getLocation = () => {
              const selectors = [
                '.location',
                '[data-test-id="location"]',
                '.address',
                '.city-state'
              ];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return '';
            };

            const getPhone = () => {
              const selectors = [
                '.phone',
                '[data-test-id="phone"]',
                'a[href^="tel:"]',
                '.contact-phone'
              ];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el) {
                  return el.textContent.trim() || el.href?.replace('tel:', '') || '';
                }
              }
              return '';
            };

            const getWebsite = () => {
              const selectors = [
                'a[href*="website"]',
                'a[href*="attorn"]',
                '.website a'
              ];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.href) return el.href;
              }
              return '';
            };

            const getEmail = () => {
              const emailLink = listing.querySelector('a[href^="mailto:"]');
              return emailLink ? emailLink.href.replace('mailto:', '') : '';
            };

            const name = getName();

            if (name) {
              results.push({
                name: name,
                firm: getFirm(),
                location: getLocation(),
                phone: getPhone(),
                email: getEmail(),
                website: getWebsite(),
                source: 'Avvo',
                city: null // Will be filled in
              });
            }
          } catch (e) {
            console.error(`Error extracting listing ${index}:`, e.message);
          }
        });

        return results;
      });

      // Add city to each attorney
      attorneys.forEach(a => a.city = city);

      console.log(`  ✓ Extracted ${attorneys.length} attorneys from Avvo`);

      return attorneys.slice(0, limit);

    } catch (error) {
      console.error(`  ✗ Error searching Avvo for ${city}:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Search Justia with enhanced error handling
   */
  async searchJustia(browser, city, limit = 10) {
    const page = await browser.newPage();

    try {
      console.log(`\n🔍 Searching Justia: ${city}, CA...`);

      const citySlug = city.toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const searchUrl = `https://www.justia.com/lawyers/estate-planning/california/${citySlug}`;

      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      await new Promise(r => setTimeout(r, 2000));

      const attorneys = await page.evaluate(() => {
        const results = [];

        const selectors = [
          '.lawyer-card',
          '.search-result',
          '.lawyer-listing',
          '.attorney-result'
        ];

        let listings = [];
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            listings = Array.from(elements);
            break;
          }
        }

        listings.forEach((listing, index) => {
          try {
            const getName = () => {
              const selectors = ['h3 a', '.lawyer-name', '.name', 'a[href*="/attorney/"]'];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return null;
            };

            const getFirm = () => {
              const selectors = ['.firm-name', '.firm', '.law-firm', '.office'];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return '';
            };

            const getAddress = () => {
              const selectors = ['.address', '.location', '.city-state'];
              for (const sel of selectors) {
                const el = listing.querySelector(sel);
                if (el && el.textContent.trim()) return el.textContent.trim();
              }
              return '';
            };

            const getPhone = () => {
              const phoneLink = listing.querySelector('a[href^="tel:"]');
              if (phoneLink) {
                return phoneLink.textContent.trim() || phoneLink.href.replace('tel:', '');
              }
              const phoneEl = listing.querySelector('.phone');
              return phoneEl ? phoneEl.textContent.trim() : '';
            };

            const getWebsite = () => {
              const websiteLink = listing.querySelector('a[href*="website"], .website a');
              return websiteLink ? websiteLink.href : '';
            };

            const name = getName();

            if (name) {
              results.push({
                name: name,
                firm: getFirm(),
                location: getAddress(),
                phone: getPhone(),
                email: '',
                website: getWebsite(),
                source: 'Justia',
                city: null
              });
            }
          } catch (e) {
            console.error(`Error extracting Justia listing ${index}:`, e.message);
          }
        });

        return results;
      });

      attorneys.forEach(a => a.city = city);

      console.log(`  ✓ Extracted ${attorneys.length} attorneys from Justia`);

      return attorneys.slice(0, limit);

    } catch (error) {
      console.error(`  ✗ Error searching Justia for ${city}:`, error.message);
      return [];
    } finally {
      await page.close();
    }
  }

  /**
   * Main collection method with progress tracking
   */
  async collectAttorneys(targetCount = 50, resumeProgress = true) {
    console.log(`\n📊 Starting attorney collection...`);
    console.log(`Target: ${targetCount} attorneys`);
    console.log(`Resume previous progress: ${resumeProgress}\n`);

    // Load existing progress if resuming
    let allAttorneys = resumeProgress ? this.progressTracker.getAttorneys() : [];

    if (!resumeProgress && allAttorneys.length > 0) {
      console.log('⚠ Clearing previous progress...');
      this.progressTracker.clear();
      allAttorneys = [];
    }

    if (allAttorneys.length > 0) {
      console.log(`📌 Resuming with ${allAttorneys.length} previously collected attorneys\n`);
    }

    // Load manual data first
    const manualData = this.loadManualData();
    if (manualData.length > 0) {
      allAttorneys.push(...manualData);
      this.progressTracker.addAttorneys(manualData);
    }

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    try {
      // Major California cities
      const cities = [
        'Los Angeles', 'San Francisco', 'San Diego', 'San Jose',
        'Sacramento', 'Oakland', 'Fresno', 'Long Beach',
        'Bakersfield', 'Anaheim', 'Santa Ana', 'Riverside',
        'Irvine', 'Pasadena', 'Newport Beach', 'Beverly Hills',
        'Santa Monica', 'Glendale', 'Burbank', 'Santa Barbara'
      ];

      for (const city of cities) {
        if (allAttorneys.length >= targetCount) {
          console.log(`\n✓ Target reached: ${allAttorneys.length}/${targetCount}`);
          break;
        }

        if (this.progressTracker.isCityComplete(city)) {
          console.log(`\n⏭ Skipping ${city} (already completed)`);
          continue;
        }

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`Processing: ${city}`);
        console.log(`Progress: ${allAttorneys.length}/${targetCount}`);
        console.log(`${'═'.repeat(60)}`);

        const cityAttorneys = [];

        // Try Avvo
        try {
          const avvoResults = await this.searchAvvo(browser, city, 8);
          cityAttorneys.push(...avvoResults);
          await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
          console.error(`Avvo search failed for ${city}:`, error.message);
        }

        // Try Justia
        try {
          const justiaResults = await this.searchJustia(browser, city, 8);
          cityAttorneys.push(...justiaResults);
          await new Promise(r => setTimeout(r, 2000));
        } catch (error) {
          console.error(`Justia search failed for ${city}:`, error.message);
        }

        // Add city attorneys to total
        if (cityAttorneys.length > 0) {
          allAttorneys.push(...cityAttorneys);
          this.progressTracker.addAttorneys(cityAttorneys);
          console.log(`\n  📊 City total: ${cityAttorneys.length} attorneys`);
        }

        this.progressTracker.markCityComplete(city);

        console.log(`  💾 Progress saved: ${allAttorneys.length} total attorneys`);

        // Longer delay between cities
        await new Promise(r => setTimeout(r, 3000));
      }

      // Deduplicate
      const uniqueAttorneys = this.deduplicateAttorneys(allAttorneys);
      console.log(`\n🔄 Removed ${allAttorneys.length - uniqueAttorneys.length} duplicates`);

      const finalAttorneys = uniqueAttorneys.slice(0, targetCount);
      console.log(`\n✅ Collection complete: ${finalAttorneys.length} unique attorneys`);

      return finalAttorneys;

    } catch (error) {
      console.error('\n❌ Error during collection:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  /**
   * Remove duplicates
   */
  deduplicateAttorneys(attorneys) {
    const seen = new Map();

    return attorneys.filter(attorney => {
      // Create key from name and firm (case-insensitive)
      const key = `${attorney.name}|${attorney.firm || 'solo'}`.toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      if (seen.has(key)) {
        // Keep the one with more complete data
        const existing = seen.get(key);
        const newScore = this.calculateCompletenessScore(attorney);
        const existingScore = this.calculateCompletenessScore(existing);

        if (newScore > existingScore) {
          seen.set(key, attorney);
          return false; // Replace existing
        }
        return false; // Skip this one
      }

      seen.set(key, attorney);
      return true;
    });
  }

  /**
   * Calculate data completeness score
   */
  calculateCompletenessScore(attorney) {
    let score = 0;
    if (attorney.name) score += 10;
    if (attorney.firm) score += 5;
    if (attorney.email) score += 15;
    if (attorney.phone) score += 10;
    if (attorney.website) score += 8;
    if (attorney.location) score += 7;
    return score;
  }

  /**
   * Save to JSON
   */
  saveToJSON(attorneys, filename = 'california-estate-attorneys.json') {
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(attorneys, null, 2));
    console.log(`\n💾 JSON saved: ${filepath}`);
    return filepath;
  }

  /**
   * Save to CSV
   */
  saveToCSV(attorneys, filename = 'california-estate-attorneys.csv') {
    const filepath = path.join(CONFIG.OUTPUT_DIR, filename);

    const headers = ['Name', 'Firm', 'City', 'Location', 'Phone', 'Email', 'Website', 'Source'];
    const csvRows = [headers.join(',')];

    attorneys.forEach(a => {
      const row = [
        a.name || '',
        a.firm || '',
        a.city || '',
        a.location || '',
        a.phone || '',
        a.email || '',
        a.website || '',
        a.source || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`);

      csvRows.push(row.join(','));
    });

    fs.writeFileSync(filepath, csvRows.join('\n'));
    console.log(`📄 CSV saved: ${filepath}`);
    return filepath;
  }
}

/**
 * Attio CRM Client (same as before but with better error handling)
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

  async createPerson(personData) {
    try {
      // Parse name into first and last name
      const nameParts = personData.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        data: {
          values: {}
        }
      };

      // Add name (required)
      payload.data.values.name = [{
        first_name: firstName,
        last_name: lastName,
        full_name: personData.name
      }];

      // Add email addresses (array of strings)
      if (personData.email) {
        payload.data.values.email_addresses = [personData.email];
      }

      // Add phone numbers (array of objects with original_phone_number and country_code)
      if (personData.phone) {
        payload.data.values.phone_numbers = [{
          original_phone_number: personData.phone,
          country_code: 'US'
        }];
      }

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        // Record likely already exists
        console.log(`  ⚠ Person may already exist: ${personData.name}`);
        return { skipped: true, reason: 'duplicate' };
      }
      throw error;
    }
  }

  async createCompany(companyData) {
    try {
      const payload = {
        data: {
          values: {
            name: [{ value: companyData.name }]
          }
        }
      };

      if (companyData.website) {
        payload.data.values.website = [{ value: companyData.website }];
      }

      const response = await axios.post(
        `${this.baseUrl}/objects/companies/records`,
        payload,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        return { skipped: true, reason: 'duplicate' };
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/self`,
        { headers: this.headers }
      );
      console.log('✓ Attio API connection successful');
      console.log(`  Workspace: ${response.data.data?.workspace?.name || 'Connected'}\n`);
      return true;
    } catch (error) {
      console.error('✗ Attio API connection failed:', error.response?.data?.message || error.message);
      return false;
    }
  }
}

/**
 * Upload to Attio with retry logic
 */
async function uploadToAttio(attorneys, attioClient) {
  console.log(`\n📤 Uploading ${attorneys.length} attorneys to Attio...`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];
    const progress = `[${i + 1}/${attorneys.length}]`;

    console.log(`\n${progress} ${attorney.name}`);

    try {
      // Create person
      const personResult = await attioClient.createPerson({
        name: attorney.name,
        email: attorney.email,
        phone: attorney.phone
      });

      if (personResult.skipped) {
        console.log(`  ⏭ Skipped (${personResult.reason})`);
        results.skipped++;
      } else {
        console.log(`  ✓ Person created`);
        results.success++;
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));

    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
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
 * Main execution
 */
async function main() {
  console.log('═'.repeat(70));
  console.log('  California Estate Planning Attorney Collector - Enhanced Version');
  console.log('═'.repeat(70));
  console.log();

  try {
    // Step 1: Test Attio connection
    let attioClient = null;
    if (CONFIG.ATTIO_API_KEY) {
      console.log('📋 Step 1: Testing Attio connection...\n');
      attioClient = new AttioClient(CONFIG.ATTIO_API_KEY);
      await attioClient.testConnection();
    } else {
      console.log('⚠ No Attio API key found - will save to files only\n');
    }

    // Step 2: Collect attorneys
    console.log('📋 Step 2: Collecting attorney data...\n');
    const collector = new EnhancedAttorneyCollector();
    const attorneys = await collector.collectAttorneys(CONFIG.TARGET_COUNT, true);

    // Step 3: Save to files
    console.log('\n📋 Step 3: Saving data...\n');
    const jsonPath = collector.saveToJSON(attorneys);
    const csvPath = collector.saveToCSV(attorneys);

    // Step 4: Upload to Attio
    if (attioClient && attorneys.length > 0) {
      console.log('\n📋 Step 4: Uploading to Attio...\n');
      const uploadResults = await uploadToAttio(attorneys, attioClient);

      console.log('\n' + '═'.repeat(70));
      console.log('  UPLOAD SUMMARY');
      console.log('═'.repeat(70));
      console.log(`✓ Success: ${uploadResults.success}`);
      console.log(`⏭ Skipped: ${uploadResults.skipped}`);
      console.log(`✗ Failed: ${uploadResults.failed}`);

      if (uploadResults.errors.length > 0) {
        console.log('\nErrors:');
        uploadResults.errors.slice(0, 10).forEach(err => {
          console.log(`  - ${err.attorney}: ${err.error}`);
        });
        if (uploadResults.errors.length > 10) {
          console.log(`  ... and ${uploadResults.errors.length - 10} more`);
        }
      }
    }

    // Final summary
    console.log('\n' + '═'.repeat(70));
    console.log('  COLLECTION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total collected: ${attorneys.length} attorneys`);
    console.log(`JSON file: ${jsonPath}`);
    console.log(`CSV file: ${csvPath}`);

    // Data quality metrics
    const withEmail = attorneys.filter(a => a.email).length;
    const withPhone = attorneys.filter(a => a.phone).length;
    const withWebsite = attorneys.filter(a => a.website).length;

    console.log('\nData Completeness:');
    console.log(`  Email: ${withEmail} (${Math.round(withEmail/attorneys.length*100)}%)`);
    console.log(`  Phone: ${withPhone} (${Math.round(withPhone/attorneys.length*100)}%)`);
    console.log(`  Website: ${withWebsite} (${Math.round(withWebsite/attorneys.length*100)}%)`);

    // Source breakdown
    const sources = {};
    attorneys.forEach(a => {
      sources[a.source] = (sources[a.source] || 0) + 1;
    });

    console.log('\nSources:');
    Object.entries(sources).forEach(([source, count]) => {
      console.log(`  ${source}: ${count}`);
    });

    console.log('\n✅ Process completed!\n');

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EnhancedAttorneyCollector, AttioClient };
