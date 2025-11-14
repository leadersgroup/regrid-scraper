/**
 * Upload 1000 California Trust Attorneys to Attio
 * Large Batch Upload with Progress Tracking
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
  const total = attorneys.length;
  console.log(`\n📤 Starting upload of ${total} attorneys to Attio...`);
  console.log(`⏱️  Estimated time: ${Math.round(total * 0.5 / 60)} minutes\n`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  const startTime = Date.now();

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];
    const progress = i + 1;
    const percentage = Math.round((progress / total) * 100);

    // Show progress every 10 attorneys
    if (progress % 10 === 0 || progress === 1 || progress === total) {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const rate = progress / elapsed;
      const remaining = Math.round((total - progress) / rate);

      console.log(`[${progress}/${total}] ${percentage}% | Elapsed: ${elapsed}s | ETA: ${remaining}s | ${attorney.name} - ${attorney.location}`);
    }

    try {
      const personResult = await attioClient.createPerson({
        name: attorney.name,
        email: attorney.email,
        phone: attorney.phone
      });

      if (personResult.skipped) {
        results.skipped++;
      } else {
        results.success++;
      }

      // Rate limiting - 500ms between requests
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      results.failed++;
      if (results.errors.length < 20) {
        results.errors.push({
          attorney: attorney.name,
          error: error.message || 'Unknown error'
        });
      }
    }

    // Save progress every 100 attorneys
    if (progress % 100 === 0) {
      const progressData = {
        total,
        processed: progress,
        success: results.success,
        skipped: results.skipped,
        failed: results.failed,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(
        '/Users/ll/Documents/regrid-scraper/upload-progress.json',
        JSON.stringify(progressData, null, 2)
      );
    }
  }

  return results;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  Uploading 1000 California Trust Attorneys to Attio');
  console.log('  Large Batch Upload');
  console.log('═'.repeat(70));
  console.log();

  const attioClient = new AttioClient(ATTIO_API_KEY);

  console.log('📋 Testing Attio connection...');
  const connected = await attioClient.testConnection();

  if (!connected) {
    console.error('❌ Cannot connect to Attio. Please check your API key.');
    process.exit(1);
  }

  console.log('✓ Attio connection successful\n');

  // Load attorneys
  console.log('📂 Loading attorney data...');
  const attorneys = JSON.parse(
    fs.readFileSync('/Users/ll/Documents/regrid-scraper/attorneys-batch-1000.json', 'utf8')
  );
  console.log(`✓ Loaded ${attorneys.length} attorneys\n`);

  const results = await uploadToAttio(attorneys, attioClient);

  const totalTime = Math.round((Date.now() - Date.now()) / 1000);

  console.log('\n' + '═'.repeat(70));
  console.log('  UPLOAD SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✓ Success: ${results.success}`);
  console.log(`⏭  Skipped: ${results.skipped}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log(`\nErrors (showing first ${Math.min(results.errors.length, 20)}):`);
    results.errors.slice(0, 20).forEach(e => {
      console.log(`  - ${e.attorney}`);
    });
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more errors`);
    }
  }

  const previousTotal = 248;
  const newTotal = previousTotal + results.success;

  console.log('\n✅ Upload completed!');
  console.log(`\nPrevious total: ${previousTotal} attorneys`);
  console.log(`Added this batch: ${results.success} attorneys`);
  console.log(`\n🎯 GRAND TOTAL: ${newTotal} California trust attorneys in Attio!`);
  console.log(`\n💡 View your contacts at: https://app.attio.com`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
