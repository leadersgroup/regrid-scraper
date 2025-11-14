/**
 * Upload Real California Attorneys to Attio
 *
 * This script uploads verified attorney data to Attio CRM
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

class AttioUploader {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.attio.com/v2';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async createPerson(attorney) {
    try {
      const nameParts = attorney.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        data: {
          values: {
            name: [{
              first_name: firstName,
              last_name: lastName,
              full_name: attorney.name
            }]
          }
        }
      };

      // Add email if available
      if (attorney.email && this.isValidEmail(attorney.email)) {
        payload.data.values.email_addresses = [attorney.email];
      }

      // Add phone if available and valid
      if (attorney.phone && this.isValidPhone(attorney.phone)) {
        const cleanPhone = attorney.phone.replace(/\D/g, '');
        const e164Phone = cleanPhone.length === 10 ? `+1${cleanPhone}` : `+${cleanPhone}`;

        payload.data.values.phone_numbers = [{
          country_code: 'US',
          original_phone_number: e164Phone
        }];
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
        error: error.response?.data?.message || error.message,
        status: error.response?.status
      };
    }
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPhone(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    return cleanPhone.length >= 10 && cleanPhone.length <= 11;
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

  async uploadBatch(attorneys) {
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

      const result = await this.createPerson(attorney);

      if (result.skipped) {
        console.log(`  ⏭️  Skipped (duplicate)`);
        results.skipped++;
      } else if (result.success) {
        console.log(`  ✅ Created`);
        results.success++;
      } else {
        console.log(`  ❌ Failed: ${result.error}`);
        results.failed++;
        results.errors.push({
          attorney: attorney.name,
          error: result.error
        });
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));
    }

    return results;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filename = args[0] || 'california-attorneys-real.json';
  const filepath = path.join(__dirname, filename);

  console.log('═'.repeat(70));
  console.log('  Upload Real California Attorneys to Attio');
  console.log('═'.repeat(70));
  console.log();

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    console.error(`❌ File not found: ${filepath}`);
    console.log('\nPlease run the scraper first:');
    console.log('  node scrape-justia-attorneys.js');
    process.exit(1);
  }

  // Load attorneys
  const attorneys = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  console.log(`📊 Loaded ${attorneys.length} attorneys from: ${filename}\n`);

  // Test Attio connection
  const uploader = new AttioUploader(ATTIO_API_KEY);
  console.log('🔌 Testing Attio connection...\n');

  const connectionTest = await uploader.testConnection();
  if (!connectionTest.success) {
    console.error('❌ Cannot connect to Attio');
    console.error('Error:', connectionTest.error);
    process.exit(1);
  }

  console.log('✅ Attio connection successful');
  console.log(`Workspace: ${connectionTest.data?.data?.workspace?.name || 'Unknown'}\n`);

  // Upload attorneys
  const results = await uploader.uploadBatch(attorneys);

  // Summary
  console.log('\n═'.repeat(70));
  console.log('  UPLOAD SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✅ Success: ${results.success}`);
  console.log(`⏭️  Skipped: ${results.skipped}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log(`\n❌ Errors (${results.errors.length}):`);
    results.errors.slice(0, 5).forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.attorney}: ${e.error}`);
    });
    if (results.errors.length > 5) {
      console.log(`  ... and ${results.errors.length - 5} more errors`);
    }
  }

  console.log('\n✅ Upload completed!');
  console.log(`\n💡 View your contacts at: https://app.attio.com/objects/people`);
  console.log();
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
