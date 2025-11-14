require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_API_URL = 'https://api.attio.com/v2';

if (!ATTIO_API_KEY) {
  console.error('❌ Error: ATTIO_API_KEY not found in environment variables');
  process.exit(1);
}

// Read the attorney data
const attorneys = JSON.parse(fs.readFileSync('./california-attorneys-real-50.json', 'utf8'));

console.log(`📋 Loaded ${attorneys.length} real California estate planning attorneys`);
console.log('🚀 Starting upload to Attio...\n');

async function uploadAttorneyToAttio(attorney, index) {
  try {
    // Parse name into first and last
    const nameParts = attorney.name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    // Create the person record - simplified without location due to strict Attio requirements
    const personData = {
      data: {
        values: {
          name: [{
            first_name: firstName,
            last_name: lastName,
            full_name: attorney.name
          }],
          email_addresses: attorney.email ? [{
            email_address: attorney.email
          }] : undefined,
          phone_numbers: attorney.phone ? [{
            original_phone_number: attorney.phone,
            country_code: 'US'
          }] : undefined
        }
      }
    };

    // Remove undefined values
    Object.keys(personData.data.values).forEach(key => {
      if (personData.data.values[key] === undefined) {
        delete personData.data.values[key];
      }
    });

    const response = await axios.post(
      `${ATTIO_API_URL}/objects/people/records`,
      personData,
      {
        headers: {
          'Authorization': `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ [${index + 1}/${attorneys.length}] Successfully uploaded: ${attorney.name}`);
    console.log(`   Firm: ${attorney.firm}`);
    console.log(`   Location: ${attorney.city}, ${attorney.state}`);
    if (attorney.email) console.log(`   Email: ${attorney.email}`);
    if (attorney.phone) console.log(`   Phone: ${attorney.phone}`);
    console.log(`   Specialty: ${attorney.specialty}`);
    console.log(`   Record ID: ${response.data.data.id.record_id}\n`);

    return { success: true, attorney: attorney.name };
  } catch (error) {
    if (error.response?.status === 409) {
      console.log(`⚠️  [${index + 1}/${attorneys.length}] Skipped (duplicate): ${attorney.name}`);
      return { success: false, duplicate: true, attorney: attorney.name };
    } else {
      console.error(`❌ [${index + 1}/${attorneys.length}] Failed to upload: ${attorney.name}`);
      console.error(`   Status: ${error.response?.status}`);
      console.error(`   Error: ${error.response?.data?.errors?.[0]?.message || error.message}`);
      if (error.response?.data) {
        console.error(`   Full error data:`, JSON.stringify(error.response.data, null, 2));
      }
      console.log();
      return { success: false, duplicate: false, attorney: attorney.name, error: error.message };
    }
  }
}

async function uploadAllAttorneys() {
  const results = {
    successful: [],
    duplicates: [],
    failed: []
  };

  // Upload attorneys sequentially to avoid rate limiting
  for (let i = 0; i < attorneys.length; i++) {
    const result = await uploadAttorneyToAttio(attorneys[i], i);

    if (result.success) {
      results.successful.push(result.attorney);
    } else if (result.duplicate) {
      results.duplicates.push(result.attorney);
    } else {
      results.failed.push({ name: result.attorney, error: result.error });
    }

    // Add a small delay to avoid rate limiting
    if (i < attorneys.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Successfully uploaded: ${results.successful.length}`);
  console.log(`⚠️  Skipped (duplicates): ${results.duplicates.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📋 Total processed: ${attorneys.length}`);
  console.log('='.repeat(60));

  if (results.failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    results.failed.forEach(f => {
      console.log(`   - ${f.name}: ${f.error}`);
    });
  }

  // Save results to file
  const report = {
    timestamp: new Date().toISOString(),
    total: attorneys.length,
    successful: results.successful.length,
    duplicates: results.duplicates.length,
    failed: results.failed.length,
    successfulAttorneys: results.successful,
    duplicateAttorneys: results.duplicates,
    failedAttorneys: results.failed
  };

  fs.writeFileSync(
    './upload-real-50-attorneys-report.json',
    JSON.stringify(report, null, 2)
  );

  console.log('\n📄 Detailed report saved to: upload-real-50-attorneys-report.json');
  console.log('\n🎉 Upload process completed!');
  console.log('🔗 View your contacts at: https://app.attio.com/objects/people\n');
}

// Run the upload
uploadAllAttorneys().catch(error => {
  console.error('❌ Fatal error during upload:', error.message);
  process.exit(1);
});
