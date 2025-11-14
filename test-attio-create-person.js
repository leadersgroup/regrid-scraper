/**
 * Test creating a person in Attio with correct API format
 */

const axios = require('axios');
require('dotenv').config();

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

async function testCreatePerson() {
  console.log('Testing Attio person creation...\n');

  try {
    // First, let's get the attributes for people
    console.log('Step 1: Getting people object attributes...');
    const attributesResponse = await axios.get(
      'https://api.attio.com/v2/objects/people/attributes',
      {
        headers: {
          'Authorization': `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Available attributes:');
    const attributes = attributesResponse.data.data;
    attributes.forEach(attr => {
      console.log(`  - ${attr.api_slug} (${attr.type}): ${attr.title}`);
    });

    // Try simple person creation with minimal data
    console.log('\n\nStep 2: Creating test person with minimal data...');
    const minimalPerson = {
      data: {
        values: {
          name: [{
            first_name: 'Test',
            last_name: 'Attorney',
            full_name: 'Test Attorney'
          }],
          email_addresses: [{
            email_address: 'test@example.com'
          }],
          phone_numbers: [{
            country_code: 'US',
            original_phone_number: '+14155551234'
          }],
          job_title: [{
            value: 'Estate Planning Attorney'
          }]
        }
      }
    };

    console.log('Request payload:', JSON.stringify(minimalPerson, null, 2));

    const response = await axios.post(
      'https://api.attio.com/v2/objects/people/records',
      minimalPerson,
      {
        headers: {
          'Authorization': `Bearer ${ATTIO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✓ Success! Person created:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n✗ Error:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
}

testCreatePerson();
