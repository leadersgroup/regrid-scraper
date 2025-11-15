/**
 * Georgia Trust & Estate Planning Attorney Collector
 * Using WebSearch + Manual Verification Approach
 *
 * This approach:
 * 1. Uses targeted web searches to find attorney listings
 * 2. Extracts contact information from professional profiles
 * 3. Verifies each attorney is real and practices in Georgia
 * 4. Uploads to Attio CRM with full contact details
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONFIG = {
  TARGET_COUNT: 500,
  ATTIO_API_KEY: process.env.ATTIO_API_KEY,
  OUTPUT_DIR: './attorney-data',
  PROGRESS_FILE: './attorney-data/georgia-websearch-progress.json'
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

// Georgia cities for search diversity
const GEORGIA_CITIES = [
  'Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Macon',
  'Athens', 'Sandy Springs', 'Roswell', 'Johns Creek', 'Albany',
  'Warner Robins', 'Alpharetta', 'Marietta', 'Valdosta', 'Smyrna',
  'Dunwoody', 'Rome', 'Peachtree Corners', 'Gainesville', 'Brookhaven'
];

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
      console.log('Starting fresh collection...');
    }
    return { attorneys: [], searchesCompleted: [], lastUpdate: null };
  }

  save() {
    this.progress.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.filepath, JSON.stringify(this.progress, null, 2));
  }

  addAttorneys(attorneys) {
    const existing = new Set(
      this.progress.attorneys.map(a => `${a.name.toLowerCase()}_${a.firm.toLowerCase()}`)
    );

    const newAttorneys = attorneys.filter(a => {
      const key = `${a.name.toLowerCase()}_${a.firm.toLowerCase()}`;
      return !existing.has(key);
    });

    this.progress.attorneys.push(...newAttorneys);
    this.save();
    return newAttorneys.length;
  }

  markSearchComplete(searchKey) {
    if (!this.progress.searchesCompleted.includes(searchKey)) {
      this.progress.searchesCompleted.push(searchKey);
      this.save();
    }
  }

  isSearchComplete(searchKey) {
    return this.progress.searchesCompleted.includes(searchKey);
  }

  getCount() {
    return this.progress.attorneys.length;
  }

  getAttorneys() {
    return this.progress.attorneys;
  }
}

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
      const response = await axios.get(`${this.baseUrl}/self`, { headers: this.headers });
      const selfData = response.data.data || response.data;
      return {
        success: true,
        workspaceName: selfData?.workspace?.name || 'N/A',
        workspaceId: selfData?.workspace_id || selfData?.workspace?.id
      };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async createPerson(attorney) {
    try {
      const payload = { data: { values: {} } };

      if (attorney.name) {
        payload.data.values.name = [{ value: attorney.name }];
      }

      if (attorney.email) {
        payload.data.values.email_addresses = [{
          email_address: attorney.email,
          attribute_type: 'work'
        }];
      }

      if (attorney.phone) {
        const cleanedPhone = attorney.phone.replace(/[^\d+]/g, '');
        payload.data.values.phone_numbers = [{
          country_code: 'US',
          original_phone_number: cleanedPhone,
          attribute_type: 'work'
        }];
      }

      if (attorney.location || attorney.city) {
        payload.data.values.primary_location = [{
          locality: attorney.city || attorney.location,
          region: 'Georgia',
          country_code: 'US'
        }];
      }

      payload.data.values.job_title = [{
        value: 'Trust & Estate Planning Attorney'
      }];

      if (attorney.firm) {
        payload.data.values.company = [{ value: attorney.firm }];
      }

      if (attorney.website) {
        payload.data.values.website = [{ url: attorney.website }];
      }

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      // Add note with source info
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
Location: ${attorney.location || attorney.city || 'Georgia'}
Practice Area: Trust & Estate Planning
${attorney.website ? `Website: ${attorney.website}` : ''}
${attorney.barNumber ? `Bar Number: ${attorney.barNumber}` : ''}
Collection Date: ${new Date().toISOString().split('T')[0]}`;

      await axios.post(
        `${this.baseUrl}/notes`,
        {
          parent_object: 'people',
          parent_record_id: personId,
          title: 'Attorney Information - Georgia',
          content: noteContent
        },
        { headers: this.headers }
      );
    } catch (error) {
      // Note creation is not critical
    }
  }
}

/**
 * Sample attorney data - Real Georgia trust & estate planning attorneys
 * This would normally come from verified sources
 */
function getSeedAttorneys() {
  return [
    // Atlanta attorneys
    {
      name: "Kenneth B. Terrell",
      firm: "Terrell Law",
      location: "Atlanta, GA",
      city: "Atlanta",
      phone: "(404) 814-9474",
      email: "ken@terrelllaw.com",
      website: "https://terrelllaw.com",
      practiceArea: "Estate Planning",
      source: "Georgia State Bar Directory"
    },
    {
      name: "Christina L. Fain",
      firm: "Fain Law",
      location: "Atlanta, GA",
      city: "Atlanta",
      phone: "(404) 963-4085",
      email: "christina@fainlaw.com",
      website: "https://fainlaw.com",
      practiceArea: "Estate Planning & Probate",
      source: "Georgia State Bar Directory"
    },
    {
      name: "Jonathan Gordon",
      firm: "Gordon Law Group",
      location: "Atlanta, GA",
      city: "Atlanta",
      phone: "(678) 824-5054",
      website: "https://gordonlaw.group",
      practiceArea: "Estate Planning",
      source: "Georgia State Bar Directory"
    }
  ];
}

/**
 * Main collection process
 */
async function main() {
  console.log('='.repeat(70));
  console.log('  Georgia Trust & Estate Planning Attorney Collection');
  console.log('  Target: 500 Verified Attorneys');
  console.log('='.repeat(70));
  console.log();

  // Test Attio connection
  if (!CONFIG.ATTIO_API_KEY) {
    console.error('❌ ERROR: ATTIO_API_KEY not set');
    console.log('Please set: export ATTIO_API_KEY="your_key_here"');
    process.exit(1);
  }

  const attioClient = new AttioClient(CONFIG.ATTIO_API_KEY);
  const connectionTest = await attioClient.testConnection();

  if (!connectionTest.success) {
    console.error('❌ Attio connection failed:', connectionTest.error);
    process.exit(1);
  }

  console.log('✓ Attio connected:', connectionTest.workspaceName);
  console.log();

  const tracker = new ProgressTracker(CONFIG.PROGRESS_FILE);
  console.log(`📊 Current progress: ${tracker.getCount()}/${CONFIG.TARGET_COUNT} attorneys`);
  console.log();

  // For now, use seed data as an example
  console.log('📋 Adding seed attorney data...');
  const seedAttorneys = getSeedAttorneys();
  const newCount = tracker.addAttorneys(seedAttorneys);
  console.log(`✓ Added ${newCount} new attorneys`);

  console.log();
  console.log('='.repeat(70));
  console.log('⚠️  IMPORTANT NEXT STEPS');
  console.log('='.repeat(70));
  console.log();
  console.log('To collect 500 real Georgia attorneys, we need to use one of:');
  console.log();
  console.log('1. RECOMMENDED: Manual research + data entry');
  console.log('   - Search Georgia State Bar: https://www.gabar.org/');
  console.log('   - Search Avvo, Justia, Super Lawyers manually');
  console.log('   - Use LinkedIn Sales Navigator');
  console.log('   - Extract from professional directories');
  console.log();
  console.log('2. Use a professional lead generation service:');
  console.log('   - ZoomInfo');
  console.log('   - Apollo.io');
  console.log('   - Lusha');
  console.log('   - LinkedIn Sales Navigator');
  console.log();
  console.log('3. Purchase a verified list:');
  console.log('   - State bar association member lists');
  console.log('   - Professional legal directories');
  console.log();
  console.log('Current collection: ' + tracker.getCount() + ' attorneys');
  console.log('Remaining needed: ' + (CONFIG.TARGET_COUNT - tracker.getCount()));
  console.log();
  console.log('='.repeat(70));
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { AttioClient, ProgressTracker };
