/**
 * Scrape Real California Estate Planning Attorneys
 *
 * This script searches legal directories for verified estate planning attorneys
 * and collects their actual contact information.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
require('dotenv').config();

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

// California cities to target
const CALIFORNIA_CITIES = [
  'Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento',
  'Oakland', 'Fresno', 'Long Beach', 'Bakersfield', 'Anaheim',
  'Santa Ana', 'Riverside', 'Stockton', 'Irvine', 'Chula Vista',
  'Fremont', 'San Bernardino', 'Modesto', 'Fontana', 'Oxnard',
  'Moreno Valley', 'Huntington Beach', 'Glendale', 'Santa Clarita', 'Oceanside'
];

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
      const nameParts = personData.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        data: {
          values: {
            name: [{
              first_name: firstName,
              last_name: lastName,
              full_name: personData.name
            }]
          }
        }
      };

      if (personData.email) {
        payload.data.values.email_addresses = [personData.email];
      }

      if (personData.phone) {
        // Clean and validate phone number
        const cleanPhone = personData.phone.replace(/\D/g, '');
        if (cleanPhone.length === 10 || cleanPhone.length === 11) {
          const e164Phone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;
          payload.data.values.phone_numbers = [{
            country_code: 'US',
            original_phone_number: e164Phone
          }];
        }
      }

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      return { success: true, data: response.data };
    } catch (error) {
      if (error.response?.status === 409 ||
          error.response?.data?.code === 'uniqueness_conflict') {
        return { skipped: true, reason: 'duplicate' };
      }
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }
}

/**
 * Search California State Bar for estate planning attorneys
 * This is a placeholder - the actual implementation would require
 * proper scraping of legal directories
 */
async function searchCaliforniaStateBar(city, limit = 5) {
  console.log(`   Searching California State Bar for attorneys in ${city}...`);

  // Note: This would require actual web scraping
  // For now, return structured placeholder to show the data model
  return [];
}

/**
 * Search Avvo for estate planning attorneys
 */
async function searchAvvo(city, limit = 5) {
  console.log(`   Searching Avvo for attorneys in ${city}...`);

  // Note: This would require proper web scraping with headers and rate limiting
  // For demonstration, returning empty array
  return [];
}

/**
 * Search Justia for estate planning attorneys
 */
async function searchJustia(city, limit = 5) {
  console.log(`   Searching Justia for attorneys in ${city}...`);

  // Note: This would require proper web scraping
  return [];
}

/**
 * Main function to collect attorneys
 */
async function collectAttorneys(targetCount = 50) {
  const attorneys = [];
  const sources = [
    { name: 'California State Bar', fn: searchCaliforniaStateBar },
    { name: 'Avvo', fn: searchAvvo },
    { name: 'Justia', fn: searchJustia }
  ];

  console.log(`\n🔍 Collecting ${targetCount} estate planning attorneys from California...\n`);

  for (const city of CALIFORNIA_CITIES) {
    if (attorneys.length >= targetCount) break;

    console.log(`\n📍 Searching in ${city}...`);

    for (const source of sources) {
      if (attorneys.length >= targetCount) break;

      const results = await source.fn(city, 2);
      attorneys.push(...results);

      // Rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return attorneys.slice(0, targetCount);
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  California Estate Planning Attorney Collector');
  console.log('═'.repeat(70));
  console.log();
  console.log('⚠️  IMPORTANT NOTICE');
  console.log();
  console.log('This script requires proper web scraping implementation to collect');
  console.log('real attorney data from legal directories.');
  console.log();
  console.log('Current status: The existing attorneys-batch-50.json file contains');
  console.log('sample/placeholder data, not real attorney information.');
  console.log();
  console.log('To collect REAL attorney data, you would need to:');
  console.log('  1. Implement proper web scrapers for legal directories');
  console.log('  2. Respect robots.txt and rate limits');
  console.log('  3. Parse attorney profile pages for contact information');
  console.log('  4. Verify data quality and accuracy');
  console.log();
  console.log('Recommended sources for real data:');
  console.log('  - California State Bar Attorney Search');
  console.log('  - Avvo.com (lawyer profiles)');
  console.log('  - Justia.com (lawyer directory)');
  console.log('  - Martindale.com');
  console.log('  - Lawyers.com');
  console.log('  - FindLaw.com');
  console.log();
  console.log('═'.repeat(70));
  console.log();

  // For demonstration, show what would happen with real data
  console.log('📊 Current status:');
  console.log('  - 26 attorneys successfully uploaded to Attio');
  console.log('  - 24 duplicates skipped');
  console.log('  - Note: These appear to be sample/placeholder records');
  console.log();
  console.log('💡 Next steps:');
  console.log('  1. Implement web scrapers for legal directories');
  console.log('  2. Or use a third-party data provider/API');
  console.log('  3. Or manually compile attorney data from public sources');
  console.log();
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
