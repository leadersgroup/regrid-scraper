/**
 * Upload 50 California Trust Attorneys to Attio
 */

const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

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
          values: {}
        }
      };

      payload.data.values.name = [{
        first_name: firstName,
        last_name: lastName,
        full_name: personData.name
      }];

      if (personData.email) {
        payload.data.values.email_addresses = [personData.email];
      }

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
      return true;
    } catch (error) {
      console.error('✗ Attio API connection failed');
      return false;
    }
  }
}

async function uploadToAttio(attorneys, attioClient) {
  console.log(`\n📤 Uploading ${attorneys.length} attorneys to Attio...\n`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];
    const progress = `[${i + 1}/${attorneys.length}]`;

    console.log(`${progress} ${attorney.name} - ${attorney.location}`);

    try {
      const personResult = await attioClient.createPerson({
        name: attorney.name,
        email: attorney.email,
        phone: attorney.phone
      });

      if (personResult.skipped) {
        console.log(`  ⏭  Skipped`);
        results.skipped++;
      } else {
        console.log(`  ✓ Created`);
        results.success++;
      }

      // Rate limiting - 500ms between requests
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.error(`  ✗ Failed`);
      results.failed++;
      results.errors.push({
        attorney: attorney.name,
        error: error.message || 'Unknown error'
      });
    }
  }

  return results;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  Uploading 50 California Trust Attorneys to Attio');
  console.log('═'.repeat(70));
  console.log();

  const attioClient = new AttioClient(ATTIO_API_KEY);

  console.log('📋 Testing Attio connection...\n');
  const connected = await attioClient.testConnection();

  if (!connected) {
    console.error('❌ Cannot connect to Attio. Please check your API key.');
    process.exit(1);
  }

  console.log('✓ Attio connection successful\n');

  // Load attorneys
  const attorneys = JSON.parse(
    fs.readFileSync('/Users/ll/Documents/regrid-scraper/attorneys-batch-50.json', 'utf8')
  );
  console.log(`📊 Loaded ${attorneys.length} attorneys\n`);

  const results = await uploadToAttio(attorneys, attioClient);

  console.log('\n' + '═'.repeat(70));
  console.log('  UPLOAD SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✓ Success: ${results.success}`);
  console.log(`⏭  Skipped: ${results.skipped}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log(`\nErrors:`);
    results.errors.forEach(e => {
      console.log(`  - ${e.attorney}`);
    });
  }

  const previousTotal = 248;
  const newTotal = previousTotal + results.success;

  console.log('\n✅ Upload completed!');
  console.log(`\nPrevious total: ${previousTotal} attorneys`);
  console.log(`Added this batch: ${results.success} attorneys`);
  console.log(`\n🎯 New Total: ${newTotal} California trust attorneys in Attio!`);
  console.log(`\n💡 View your contacts at: https://app.attio.com`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
