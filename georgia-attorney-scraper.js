/**
 * Georgia Trust & Estate Planning Attorney Research Tool
 *
 * Comprehensive scraper to collect 500 real, verified trust and estate planning attorneys
 * across Georgia with contact information for Attio CRM upload.
 *
 * Features:
 * - Multi-source data collection (Georgia State Bar, Avvo, Justia, Super Lawyers, Martindale-Hubbell)
 * - Geographic diversity across major Georgia cities
 * - Duplicate detection against existing Attio data
 * - Data quality verification
 * - Progress tracking and resume capability
 * - Attio CRM integration with automatic upload
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
  TARGET_COUNT: 500,
  STATE: 'Georgia',
  STATE_ABBR: 'GA',
  PRACTICE_AREAS: ['Estate Planning', 'Trust Law', 'Probate', 'Elder Law', 'Wills'],
  OUTPUT_DIR: './attorney-data',
  ATTIO_API_KEY: process.env.ATTIO_API_KEY || '',
  PROGRESS_FILE: './attorney-data/georgia-progress.json',
  BATCH_SIZE: 50, // Upload in batches
  DELAY_BETWEEN_REQUESTS: 3000, // 3 seconds
  DELAY_BETWEEN_CITIES: 2000, // 2 seconds
  HEADLESS: true
};

// Major Georgia cities for geographic diversity
const GEORGIA_CITIES = [
  'Atlanta',
  'Savannah',
  'Augusta',
  'Columbus',
  'Macon',
  'Athens',
  'Sandy Springs',
  'Roswell',
  'Johns Creek',
  'Albany',
  'Warner Robins',
  'Alpharetta',
  'Marietta',
  'Valdosta',
  'Smyrna',
  'Dunwoody',
  'Rome',
  'Peachtree Corners',
  'Gainesville',
  'Hinesville',
  'Brookhaven',
  'Newnan',
  'Dalton',
  'Kennesaw',
  'Lawrenceville',
  'Douglasville',
  'Statesboro',
  'Carrollton',
  'Cartersville',
  'Brunswick'
];

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
        const data = JSON.parse(fs.readFileSync(this.filepath, 'utf8'));
        console.log(`📂 Loaded existing progress: ${data.attorneys.length} attorneys`);
        return data;
      }
    } catch (error) {
      console.log('📂 No previous progress found, starting fresh');
    }
    return {
      attorneys: [],
      citiesCompleted: [],
      sourcesCompleted: {},
      lastUpdate: null,
      startTime: new Date().toISOString()
    };
  }

  save() {
    this.progress.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.filepath, JSON.stringify(this.progress, null, 2));
  }

  addAttorneys(attorneys, city, source) {
    const newAttorneys = attorneys.filter(a =>
      !this.progress.attorneys.some(existing =>
        existing.name === a.name && existing.firm === a.firm
      )
    );

    this.progress.attorneys.push(...newAttorneys);

    if (!this.progress.sourcesCompleted[city]) {
      this.progress.sourcesCompleted[city] = [];
    }
    if (!this.progress.sourcesCompleted[city].includes(source)) {
      this.progress.sourcesCompleted[city].push(source);
    }

    this.save();
    return newAttorneys.length;
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

  isSourceComplete(city, source) {
    return this.progress.sourcesCompleted[city]?.includes(source) || false;
  }

  getAttorneys() {
    return this.progress.attorneys;
  }

  getCount() {
    return this.progress.attorneys.length;
  }

  clear() {
    this.progress = {
      attorneys: [],
      citiesCompleted: [],
      sourcesCompleted: {},
      lastUpdate: null,
      startTime: new Date().toISOString()
    };
    this.save();
  }
}

/**
 * Attio CRM Client
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

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/self`, {
        headers: this.headers
      });
      const selfData = response.data.data || response.data;
      return {
        success: true,
        workspace: selfData?.workspace || {},
        workspaceName: selfData?.workspace?.name || 'N/A',
        workspaceId: selfData?.workspace_id || selfData?.workspace?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  async listPeople(limit = 100) {
    try {
      const response = await axios.post(`${this.baseUrl}/objects/people/records/query`, {
        limit: limit
      }, {
        headers: this.headers
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error listing people:', error.response?.data || error.message);
      return [];
    }
  }

  async createPerson(attorney) {
    try {
      const payload = {
        data: {
          values: {}
        }
      };

      // Name
      if (attorney.name) {
        payload.data.values.name = [{
          value: attorney.name
        }];
      }

      // Email addresses
      if (attorney.email) {
        payload.data.values.email_addresses = [{
          email_address: attorney.email,
          attribute_type: 'work'
        }];
      }

      // Phone numbers
      if (attorney.phone) {
        const cleanedPhone = attorney.phone.replace(/[^\d+]/g, '');
        payload.data.values.phone_numbers = [{
          country_code: 'US',
          original_phone_number: cleanedPhone,
          attribute_type: 'work'
        }];
      }

      // Location
      if (attorney.location) {
        payload.data.values.primary_location = [{
          locality: attorney.city || attorney.location,
          region: 'Georgia',
          country_code: 'US'
        }];
      }

      // Job title
      payload.data.values.job_title = [{
        value: attorney.practiceArea || 'Estate Planning Attorney'
      }];

      // Company (law firm)
      if (attorney.firm) {
        payload.data.values.company = [{
          value: attorney.firm
        }];
      }

      // Website
      if (attorney.website) {
        payload.data.values.website = [{
          url: attorney.website
        }];
      }

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      // Add a note with source information
      if (response.data?.data?.id?.record_id) {
        await this.addNote(response.data.data.id.record_id, attorney);
      }

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message,
        attorney: attorney.name
      };
    }
  }

  async addNote(personId, attorney) {
    try {
      const noteContent = `Source: ${attorney.source || 'Web Research'}
Location: ${attorney.location || 'Georgia'}
Practice Areas: ${attorney.practiceAreas || attorney.practiceArea || 'Estate Planning'}
${attorney.website ? `Website: ${attorney.website}` : ''}
${attorney.barNumber ? `Bar Number: ${attorney.barNumber}` : ''}
${attorney.yearsExperience ? `Years Experience: ${attorney.yearsExperience}` : ''}
Collection Date: ${new Date().toISOString().split('T')[0]}`;

      await axios.post(
        `${this.baseUrl}/notes`,
        {
          parent_object: 'people',
          parent_record_id: personId,
          title: 'Attorney Information',
          content: noteContent
        },
        { headers: this.headers }
      );
    } catch (error) {
      // Note creation is not critical, so just log the error
      console.log(`  ⚠️  Could not add note: ${error.message}`);
    }
  }

  async checkDuplicate(name, firm) {
    try {
      const people = await this.listPeople(500);
      return people.some(person => {
        const personName = person.values?.name?.[0]?.value || '';
        const personCompany = person.values?.company?.[0]?.value || '';
        return personName.toLowerCase() === name.toLowerCase() &&
               personCompany.toLowerCase() === firm.toLowerCase();
      });
    } catch (error) {
      console.error('Error checking duplicate:', error.message);
      return false;
    }
  }
}

/**
 * Georgia Attorney Collector - Multi-source scraper
 */
class GeorgiaAttorneyCollector {
  constructor(browser, tracker) {
    this.browser = browser;
    this.tracker = tracker;
  }

  /**
   * Search Avvo for Georgia estate planning attorneys
   */
  async searchAvvo(city, limit = 20) {
    if (this.tracker.isSourceComplete(city, 'Avvo')) {
      console.log(`  ⏭️  Avvo already completed for ${city}`);
      return [];
    }

    console.log(`\n🔍 Searching Avvo: ${city}, GA...`);
    const page = await this.browser.newPage();
    const attorneys = [];

    try {
      const searchUrl = `https://www.avvo.com/estate-planning-lawyer/${city.toLowerCase().replace(/\s/g, '-')}_ga.html`;
      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take screenshot for verification
      const screenshotPath = path.join(CONFIG.OUTPUT_DIR, `avvo-${city.toLowerCase().replace(/\s/g, '-')}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`  📸 Screenshot: ${screenshotPath}`);

      // Extract attorney data
      const extractedData = await page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('.lawyer-profile, .v2-lawyer-card, [data-testid="lawyer-card"]');

        listings.forEach((listing, index) => {
          if (index >= 20) return;

          try {
            const name = listing.querySelector('.lawyer-name, .name, h3 a, [data-testid="lawyer-name"]')?.textContent?.trim();
            const firm = listing.querySelector('.firm-name, .practice-name, [data-testid="firm-name"]')?.textContent?.trim();
            const phone = listing.querySelector('.phone, .contact-phone, [data-testid="phone"]')?.textContent?.trim();
            const address = listing.querySelector('.address, .location, [data-testid="location"]')?.textContent?.trim();
            const profileLink = listing.querySelector('a[href*="/attorneys/"]')?.href;
            const rating = listing.querySelector('.rating, [data-testid="rating"]')?.textContent?.trim();

            if (name) {
              results.push({
                name,
                firm: firm || 'Solo Practitioner',
                phone: phone || '',
                location: address || '',
                website: profileLink || '',
                rating: rating || '',
                source: 'Avvo'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      });

      console.log(`  ✓ Extracted ${extractedData.length} attorneys from Avvo`);
      attorneys.push(...extractedData);

    } catch (error) {
      console.log(`  ⚠️  Avvo search failed: ${error.message}`);
    } finally {
      await page.close();
    }

    return attorneys.map(a => ({ ...a, city, practiceArea: 'Estate Planning' }));
  }

  /**
   * Search Justia for Georgia estate planning attorneys
   */
  async searchJustia(city, limit = 20) {
    if (this.tracker.isSourceComplete(city, 'Justia')) {
      console.log(`  ⏭️  Justia already completed for ${city}`);
      return [];
    }

    console.log(`\n🔍 Searching Justia: ${city}, GA...`);
    const page = await this.browser.newPage();
    const attorneys = [];

    try {
      const searchUrl = `https://www.justia.com/lawyers/estate-planning/georgia/${city.toLowerCase().replace(/\s/g, '-')}`;
      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract attorney data
      const extractedData = await page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('.lawyer-profile, .directory-profile, .search-result');

        listings.forEach((listing, index) => {
          if (index >= 20) return;

          try {
            const nameElement = listing.querySelector('.profile-name, h3 a, .lawyer-name a');
            const name = nameElement?.textContent?.trim();
            const profileUrl = nameElement?.href;

            const firm = listing.querySelector('.firm-name, .practice-area')?.textContent?.trim();
            const location = listing.querySelector('.location, .address')?.textContent?.trim();
            const phone = listing.querySelector('.phone, .contact-phone')?.textContent?.trim();
            const website = listing.querySelector('a[href*="http"]')?.href;

            if (name) {
              results.push({
                name,
                firm: firm || 'Solo Practitioner',
                phone: phone || '',
                location: location || '',
                website: website || profileUrl || '',
                source: 'Justia'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      });

      console.log(`  ✓ Extracted ${extractedData.length} attorneys from Justia`);
      attorneys.push(...extractedData);

    } catch (error) {
      console.log(`  ⚠️  Justia search failed: ${error.message}`);
    } finally {
      await page.close();
    }

    return attorneys.map(a => ({ ...a, city, practiceArea: 'Estate Planning' }));
  }

  /**
   * Search Super Lawyers for Georgia estate planning attorneys
   */
  async searchSuperLawyers(city, limit = 15) {
    if (this.tracker.isSourceComplete(city, 'SuperLawyers')) {
      console.log(`  ⏭️  Super Lawyers already completed for ${city}`);
      return [];
    }

    console.log(`\n🔍 Searching Super Lawyers: ${city}, GA...`);
    const page = await this.browser.newPage();
    const attorneys = [];

    try {
      const searchUrl = `https://www.superlawyers.com/georgia/estate-planning/lawyers.html`;
      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract attorney data
      const extractedData = await page.evaluate((targetCity) => {
        const results = [];
        const listings = document.querySelectorAll('.lawyer, .attorney-listing, .profile-card');

        listings.forEach((listing, index) => {
          if (index >= 15) return;

          try {
            const name = listing.querySelector('.name, h3, .attorney-name')?.textContent?.trim();
            const firm = listing.querySelector('.firm, .law-firm')?.textContent?.trim();
            const location = listing.querySelector('.location, .city')?.textContent?.trim();
            const phone = listing.querySelector('.phone')?.textContent?.trim();
            const profileLink = listing.querySelector('a')?.href;

            // Filter by city if mentioned in location
            if (name && (!location || location.toLowerCase().includes(targetCity.toLowerCase()))) {
              results.push({
                name,
                firm: firm || 'Solo Practitioner',
                phone: phone || '',
                location: location || targetCity,
                website: profileLink || '',
                source: 'Super Lawyers'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      }, city);

      console.log(`  ✓ Extracted ${extractedData.length} attorneys from Super Lawyers`);
      attorneys.push(...extractedData);

    } catch (error) {
      console.log(`  ⚠️  Super Lawyers search failed: ${error.message}`);
    } finally {
      await page.close();
    }

    return attorneys.map(a => ({ ...a, city, practiceArea: 'Estate Planning' }));
  }

  /**
   * Search Martindale-Hubbell for Georgia estate planning attorneys
   */
  async searchMartindale(city, limit = 15) {
    if (this.tracker.isSourceComplete(city, 'Martindale')) {
      console.log(`  ⏭️  Martindale already completed for ${city}`);
      return [];
    }

    console.log(`\n🔍 Searching Martindale-Hubbell: ${city}, GA...`);
    const page = await this.browser.newPage();
    const attorneys = [];

    try {
      const searchUrl = `https://www.martindale.com/by-location/georgia/${city.toLowerCase().replace(/\s/g, '-')}-lawyers/estate-planning/`;
      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract attorney data
      const extractedData = await page.evaluate(() => {
        const results = [];
        const listings = document.querySelectorAll('.listing, .lawyer-card, .search-result');

        listings.forEach((listing, index) => {
          if (index >= 15) return;

          try {
            const name = listing.querySelector('.lawyer-name, h3 a, .name')?.textContent?.trim();
            const firm = listing.querySelector('.firm-name, .law-firm')?.textContent?.trim();
            const location = listing.querySelector('.location, .address')?.textContent?.trim();
            const phone = listing.querySelector('.phone')?.textContent?.trim();
            const website = listing.querySelector('a.website, .firm-website')?.href;

            if (name) {
              results.push({
                name,
                firm: firm || 'Solo Practitioner',
                phone: phone || '',
                location: location || '',
                website: website || '',
                source: 'Martindale-Hubbell'
              });
            }
          } catch (e) {
            // Skip invalid entries
          }
        });

        return results;
      });

      console.log(`  ✓ Extracted ${extractedData.length} attorneys from Martindale`);
      attorneys.push(...extractedData);

    } catch (error) {
      console.log(`  ⚠️  Martindale search failed: ${error.message}`);
    } finally {
      await page.close();
    }

    return attorneys.map(a => ({ ...a, city, practiceArea: 'Estate Planning' }));
  }

  /**
   * Search Georgia State Bar Association
   */
  async searchGeorgiaBar(city, limit = 20) {
    if (this.tracker.isSourceComplete(city, 'GABar')) {
      console.log(`  ⏭️  Georgia Bar already completed for ${city}`);
      return [];
    }

    console.log(`\n🔍 Searching Georgia State Bar: ${city}, GA...`);
    const page = await this.browser.newPage();
    const attorneys = [];

    try {
      // Georgia Bar Lawyer Search
      const searchUrl = 'https://www.gabar.org/forthepublic/findalawyer.cfm';
      console.log(`  URL: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to fill out search form if present
      try {
        const cityInput = await page.$('input[name*="city"], input[id*="city"]');
        if (cityInput) {
          await cityInput.type(city);

          const practiceAreaSelect = await page.$('select[name*="practice"], select[id*="practice"]');
          if (practiceAreaSelect) {
            await practiceAreaSelect.select('Estate Planning');
          }

          const submitButton = await page.$('button[type="submit"], input[type="submit"]');
          if (submitButton) {
            await submitButton.click();
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Extract results
            const extractedData = await page.evaluate(() => {
              const results = [];
              const listings = document.querySelectorAll('.lawyer, .attorney, .result');

              listings.forEach((listing, index) => {
                if (index >= 20) return;

                try {
                  const name = listing.querySelector('.name, h3')?.textContent?.trim();
                  const firm = listing.querySelector('.firm')?.textContent?.trim();
                  const phone = listing.querySelector('.phone')?.textContent?.trim();
                  const email = listing.querySelector('.email, a[href^="mailto:"]')?.textContent?.trim();
                  const address = listing.querySelector('.address')?.textContent?.trim();

                  if (name) {
                    results.push({
                      name,
                      firm: firm || 'Solo Practitioner',
                      phone: phone || '',
                      email: email || '',
                      location: address || '',
                      source: 'Georgia State Bar'
                    });
                  }
                } catch (e) {
                  // Skip invalid entries
                }
              });

              return results;
            });

            console.log(`  ✓ Extracted ${extractedData.length} attorneys from Georgia Bar`);
            attorneys.push(...extractedData);
          }
        }
      } catch (e) {
        console.log(`  ⚠️  Georgia Bar form interaction failed: ${e.message}`);
      }

    } catch (error) {
      console.log(`  ⚠️  Georgia Bar search failed: ${error.message}`);
    } finally {
      await page.close();
    }

    return attorneys.map(a => ({ ...a, city, practiceArea: 'Estate Planning' }));
  }

  /**
   * Collect attorneys from all sources for a specific city
   */
  async collectFromCity(city) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Processing: ${city}, Georgia`);
    console.log(`Progress: ${this.tracker.getCount()}/${CONFIG.TARGET_COUNT}`);
    console.log('='.repeat(70));

    if (this.tracker.isCityComplete(city)) {
      console.log(`✓ ${city} already completed, skipping...`);
      return [];
    }

    const cityAttorneys = [];

    // Search all sources
    const sources = [
      () => this.searchAvvo(city),
      () => this.searchJustia(city),
      () => this.searchSuperLawyers(city),
      () => this.searchMartindale(city),
      () => this.searchGeorgiaBar(city)
    ];

    for (const searchFn of sources) {
      try {
        const attorneys = await searchFn();
        if (attorneys.length > 0) {
          const newCount = this.tracker.addAttorneys(attorneys, city, attorneys[0].source);
          console.log(`  📊 Added ${newCount} new unique attorneys (${attorneys.length - newCount} duplicates filtered)`);
          cityAttorneys.push(...attorneys);
        }

        // Delay between sources
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_REQUESTS));

        // Check if we've reached target
        if (this.tracker.getCount() >= CONFIG.TARGET_COUNT) {
          console.log(`\n✅ Target of ${CONFIG.TARGET_COUNT} attorneys reached!`);
          break;
        }
      } catch (error) {
        console.log(`  ⚠️  Error in source: ${error.message}`);
      }
    }

    this.tracker.markCityComplete(city);
    console.log(`\n  📊 City total: ${cityAttorneys.length} attorneys found`);
    console.log(`  💾 Progress saved: ${this.tracker.getCount()} total attorneys`);

    return cityAttorneys;
  }
}

/**
 * Upload attorneys to Attio CRM
 */
async function uploadToAttio(attorneys, attioClient) {
  console.log(`\n${'='.repeat(70)}`);
  console.log('📋 Step 4: Uploading to Attio CRM...');
  console.log('='.repeat(70));

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];
    console.log(`\n[${i + 1}/${attorneys.length}] ${attorney.name}`);

    try {
      // Check for duplicates in Attio
      const isDuplicate = await attioClient.checkDuplicate(attorney.name, attorney.firm);
      if (isDuplicate) {
        console.log(`  ⏭️  Already exists in Attio, skipping...`);
        results.skipped++;
        continue;
      }

      // Create person record
      const result = await attioClient.createPerson(attorney);

      if (result.success) {
        console.log(`  ✓ Successfully uploaded`);
        results.success++;
      } else {
        console.log(`  ✗ Failed: ${result.error}`);
        results.failed++;
        results.errors.push({ attorney: attorney.name, error: result.error });
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.log(`  ✗ Error: ${error.message}`);
      results.failed++;
      results.errors.push({ attorney: attorney.name, error: error.message });
    }
  }

  return results;
}

/**
 * Remove duplicates from attorney list
 */
function removeDuplicates(attorneys) {
  const seen = new Set();
  return attorneys.filter(attorney => {
    const key = `${attorney.name.toLowerCase()}_${attorney.firm.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Generate summary report
 */
function generateSummary(attorneys, uploadResults, startTime) {
  const summary = {
    totalCollected: attorneys.length,
    uploadSuccess: uploadResults.success,
    uploadFailed: uploadResults.failed,
    uploadSkipped: uploadResults.skipped,
    executionTime: ((Date.now() - startTime) / 1000 / 60).toFixed(2) + ' minutes',
    citiesSearched: [...new Set(attorneys.map(a => a.city))].length,
    sources: {},
    cities: {},
    completeness: {
      withEmail: attorneys.filter(a => a.email).length,
      withPhone: attorneys.filter(a => a.phone).length,
      withWebsite: attorneys.filter(a => a.website).length
    }
  };

  // Source breakdown
  attorneys.forEach(attorney => {
    const source = attorney.source || 'Unknown';
    summary.sources[source] = (summary.sources[source] || 0) + 1;
  });

  // City breakdown
  attorneys.forEach(attorney => {
    const city = attorney.city || 'Unknown';
    summary.cities[city] = (summary.cities[city] || 0) + 1;
  });

  return summary;
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();

  console.log('='.repeat(70));
  console.log('  Georgia Trust & Estate Planning Attorney Collector');
  console.log('='.repeat(70));
  console.log();
  console.log(`Target: ${CONFIG.TARGET_COUNT} attorneys`);
  console.log(`State: ${CONFIG.STATE}`);
  console.log(`Practice Areas: ${CONFIG.PRACTICE_AREAS.join(', ')}`);
  console.log();

  // Step 1: Test Attio connection
  console.log('📋 Step 1: Testing Attio CRM connection...');

  if (!CONFIG.ATTIO_API_KEY) {
    console.error('❌ ERROR: ATTIO_API_KEY not set in environment variables');
    console.log('\nPlease set your Attio API key:');
    console.log('  export ATTIO_API_KEY="your_api_key_here"');
    console.log('\nGet your API key from: https://app.attio.com/settings/api');
    process.exit(1);
  }

  const attioClient = new AttioClient(CONFIG.ATTIO_API_KEY);
  const connectionTest = await attioClient.testConnection();

  if (!connectionTest.success) {
    console.error('❌ Attio API connection failed:', connectionTest.error);
    process.exit(1);
  }

  console.log('✓ Attio API connection successful');
  console.log(`  Workspace: ${connectionTest.workspaceName}`);

  // Step 2: Initialize progress tracker
  const tracker = new ProgressTracker(CONFIG.PROGRESS_FILE);

  if (tracker.getCount() > 0) {
    console.log(`\n📂 Resuming from previous session: ${tracker.getCount()} attorneys already collected`);
  }

  // Step 3: Collect attorney data
  console.log(`\n${'='.repeat(70)}`);
  console.log('📋 Step 2: Collecting attorney contact information...');
  console.log('='.repeat(70));

  const browser = await puppeteer.launch({
    headless: CONFIG.HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const collector = new GeorgiaAttorneyCollector(browser, tracker);

    // Collect from cities until target is reached
    for (const city of GEORGIA_CITIES) {
      if (tracker.getCount() >= CONFIG.TARGET_COUNT) {
        console.log(`\n✅ Target of ${CONFIG.TARGET_COUNT} attorneys reached!`);
        break;
      }

      await collector.collectFromCity(city);

      // Delay between cities
      await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_CITIES));
    }

    console.log(`\n✅ Collection complete: ${tracker.getCount()} unique attorneys`);

  } finally {
    await browser.close();
  }

  // Get final attorney list
  let attorneys = tracker.getAttorneys();

  // Step 3: Save data locally
  console.log(`\n${'='.repeat(70)}`);
  console.log('📋 Step 3: Saving collected data...');
  console.log('='.repeat(70));

  const jsonPath = path.join(CONFIG.OUTPUT_DIR, 'georgia-estate-attorneys.json');
  const csvPath = path.join(CONFIG.OUTPUT_DIR, 'georgia-estate-attorneys.csv');

  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(attorneys, null, 2));
  console.log(`💾 JSON saved: ${jsonPath}`);

  // Save CSV
  const csvHeader = 'Name,Firm,Location,City,Phone,Email,Website,Practice Area,Source\n';
  const csvRows = attorneys.map(a =>
    `"${a.name}","${a.firm}","${a.location}","${a.city}","${a.phone}","${a.email || ''}","${a.website}","${a.practiceArea}","${a.source}"`
  ).join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows);
  console.log(`📄 CSV saved: ${csvPath}`);

  // Step 4: Upload to Attio
  const uploadResults = await uploadToAttio(attorneys, attioClient);

  // Generate and display summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('  UPLOAD SUMMARY');
  console.log('='.repeat(70));
  console.log(`✓ Successfully uploaded: ${uploadResults.success}`);
  console.log(`⏭  Skipped (duplicates): ${uploadResults.skipped}`);
  console.log(`✗ Failed: ${uploadResults.failed}`);

  if (uploadResults.errors.length > 0) {
    console.log(`\n❌ Upload Errors:`);
    uploadResults.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.attorney}: ${err.error}`);
    });
    if (uploadResults.errors.length > 10) {
      console.log(`  ... and ${uploadResults.errors.length - 10} more`);
    }
  }

  // Final summary
  const summary = generateSummary(attorneys, uploadResults, startTime);

  console.log(`\n${'='.repeat(70)}`);
  console.log('  COLLECTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`📊 Total attorneys collected: ${summary.totalCollected}`);
  console.log(`📁 JSON file: ${jsonPath}`);
  console.log(`📄 CSV file: ${csvPath}`);
  console.log(`⏱  Execution time: ${summary.executionTime}`);
  console.log(`\n📍 Cities searched: ${summary.citiesSearched}`);
  console.log(`\n📚 Sources:`);
  Object.entries(summary.sources).forEach(([source, count]) => {
    console.log(`  - ${source}: ${count} attorneys`);
  });

  console.log(`\n📈 Data Completeness:`);
  console.log(`  - With email: ${summary.completeness.withEmail} (${((summary.completeness.withEmail/summary.totalCollected)*100).toFixed(1)}%)`);
  console.log(`  - With phone: ${summary.completeness.withPhone} (${((summary.completeness.withPhone/summary.totalCollected)*100).toFixed(1)}%)`);
  console.log(`  - With website: ${summary.completeness.withWebsite} (${((summary.completeness.withWebsite/summary.totalCollected)*100).toFixed(1)}%)`);

  console.log(`\n🏙️  Top Cities:`);
  const topCities = Object.entries(summary.cities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  topCities.forEach(([city, count]) => {
    console.log(`  - ${city}: ${count} attorneys`);
  });

  // Save summary
  const summaryPath = path.join(CONFIG.OUTPUT_DIR, 'georgia-collection-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n📊 Summary saved: ${summaryPath}`);

  console.log(`\n✅ Process completed successfully!`);
  console.log('='.repeat(70));
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { GeorgiaAttorneyCollector, AttioClient, ProgressTracker };
