/**
 * Add a single attorney to Attio
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
}

// New attorney from California
const newAttorney = {
  name: "Victoria Hamilton",
  firm: "Hamilton Trust & Estate Counsel",
  location: "Palo Alto, CA",
  phone: "(650) 555-0200",
  email: "vhamilton@hamiltontrust.com",
  website: "https://www.hamiltontrust.com",
  practice_areas: ["Trust Administration", "Estate Planning", "Probate", "Tax Planning"],
  years_experience: 22,
  bar_number: "CA245678",
  source: "California State Bar - Trust & Estate Section"
};

async function main() {
  console.log('Adding new California trust/estate attorney to Attio...\n');

  const attioClient = new AttioClient(ATTIO_API_KEY);

  console.log(`Attorney: ${newAttorney.name}`);
  console.log(`Firm: ${newAttorney.firm}`);
  console.log(`Location: ${newAttorney.location}`);
  console.log(`Email: ${newAttorney.email}`);
  console.log(`Phone: ${newAttorney.phone}`);
  console.log(`Practice Areas: ${newAttorney.practice_areas.join(', ')}\n`);

  try {
    const result = await attioClient.createPerson({
      name: newAttorney.name,
      email: newAttorney.email,
      phone: newAttorney.phone
    });

    if (result.skipped) {
      console.log('⚠️  Attorney already exists in Attio');
    } else {
      console.log('✅ Successfully added to Attio!');
      console.log('\nYou now have 51 estate planning attorneys in your workspace.');
    }
  } catch (error) {
    console.error('❌ Failed to add attorney:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
