/**
 * Delete All Person Contacts from Attio
 * WARNING: This will permanently delete ALL person records in your Attio workspace
 */

const axios = require('axios');
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

  async listAllPeople(limit = 500) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/objects/people/records/query`,
        {
          limit: limit,
          offset: 0
        },
        { headers: this.headers }
      );

      return response.data.data || [];
    } catch (error) {
      console.error('Error listing people:', error.response?.data || error.message);
      throw error;
    }
  }

  async deletePerson(recordId) {
    try {
      await axios.delete(
        `${this.baseUrl}/objects/people/records/${recordId}`,
        { headers: this.headers }
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
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

async function deleteAllContacts() {
  console.log('═'.repeat(70));
  console.log('  Delete All Person Contacts from Attio');
  console.log('  ⚠️  WARNING: This action is PERMANENT');
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

  // List all people
  console.log('📊 Fetching all person records...\n');
  const people = await attioClient.listAllPeople();

  console.log(`Found ${people.length} person records\n`);

  if (people.length === 0) {
    console.log('✓ No records to delete');
    return;
  }

  // Show first few names
  console.log('First 10 records:');
  people.slice(0, 10).forEach((person, i) => {
    const name = person.values?.name?.[0]?.full_name ||
                 person.values?.name?.[0]?.first_name + ' ' + person.values?.name?.[0]?.last_name ||
                 'Unknown';
    console.log(`  ${i + 1}. ${name}`);
  });

  if (people.length > 10) {
    console.log(`  ... and ${people.length - 10} more`);
  }

  console.log('\n⚠️  PROCEEDING WITH DELETION IN 3 SECONDS...\n');
  await new Promise(r => setTimeout(r, 3000));

  // Delete all records
  console.log('🗑️  Deleting all records...\n');

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const name = person.values?.name?.[0]?.full_name ||
                 person.values?.name?.[0]?.first_name + ' ' + person.values?.name?.[0]?.last_name ||
                 'Unknown';
    const recordId = person.id?.record_id;

    if (!recordId) {
      console.log(`[${i + 1}/${people.length}] ⚠️  ${name} - No record ID, skipping`);
      results.failed++;
      continue;
    }

    const result = await attioClient.deletePerson(recordId);

    if (result.success) {
      console.log(`[${i + 1}/${people.length}] ✓ Deleted: ${name}`);
      results.success++;
    } else {
      console.log(`[${i + 1}/${people.length}] ✗ Failed: ${name} - ${result.error}`);
      results.failed++;
      results.errors.push({ name, error: result.error });
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  DELETION SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✓ Successfully deleted: ${results.success}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.name}: ${e.error}`);
    });
  }

  console.log('\n✅ Deletion completed!');
  console.log('Your Attio workspace is now clean.\n');
}

deleteAllContacts().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
