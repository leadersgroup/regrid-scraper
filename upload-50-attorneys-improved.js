/**
 * Upload 50 California Trust Attorneys to Attio - Improved Version
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

      // Skip phone numbers for now - they appear to be placeholder data
      // and are causing validation errors

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      return { success: true, data: response.data };
    } catch (error) {
      // Handle duplicate records (409 or 400 with uniqueness_conflict)
      if (error.response?.status === 409 ||
          error.response?.data?.code === 'uniqueness_conflict') {
        return { skipped: true, reason: 'duplicate' };
      }

      // Return detailed error information
      return {
        success: false,
        error: error.response?.data?.error || error.message,
        status: error.response?.status,
        details: error.response?.data
      };
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/self`,
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data || error.message
      };
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

    const personResult = await attioClient.createPerson({
      name: attorney.name,
      email: attorney.email,
      phone: attorney.phone
    });

    if (personResult.skipped) {
      console.log(`  ⏭  Skipped (duplicate)`);
      results.skipped++;
    } else if (personResult.success) {
      console.log(`  ✓ Created`);
      results.success++;
    } else {
      console.log(`  ✗ Failed: ${personResult.error}`);
      results.failed++;
      results.errors.push({
        attorney: attorney.name,
        error: personResult.error,
        status: personResult.status,
        details: personResult.details
      });
    }

    // Rate limiting - 500ms between requests
    await new Promise(r => setTimeout(r, 500));
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
  const connectionTest = await attioClient.testConnection();

  if (!connectionTest.success) {
    console.error('❌ Cannot connect to Attio.');
    console.error('Error:', connectionTest.error);
    process.exit(1);
  }

  console.log('✓ Attio connection successful');
  console.log('Workspace:', connectionTest.data?.data?.workspace?.name || 'Unknown');
  console.log();

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
    console.log(`\n❌ ERRORS (${results.errors.length}):`);
    results.errors.forEach((e, i) => {
      console.log(`\n${i + 1}. ${e.attorney}`);
      console.log(`   Error: ${e.error}`);
      if (e.status) {
        console.log(`   Status: ${e.status}`);
      }
      if (e.details) {
        console.log(`   Details: ${JSON.stringify(e.details, null, 2)}`);
      }
    });
  }

  console.log('\n✅ Upload completed!');
  console.log(`\nSuccessfully added: ${results.success} attorneys`);
  console.log(`\n💡 View your contacts at: https://app.attio.com/objects/people`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
