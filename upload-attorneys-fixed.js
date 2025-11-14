/**
 * Upload 50 California Trust & Estate Planning Attorneys to Attio CRM
 * FIXED VERSION with correct Attio API format
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
  ATTIO_API_KEY: process.env.ATTIO_API_KEY,
  INPUT_FILE: './attorney-data/california-attorneys-collected.json',
  OUTPUT_DIR: './attorney-data',
  TARGET_COUNT: 50
};

/**
 * Parse phone number to E.164 format
 */
function parsePhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and has 11 digits, it's already in US format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it has 10 digits, assume US number
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it has 11 digits not starting with 1, assume already international
  if (digits.length === 11) {
    return `+${digits}`;
  }

  // Otherwise return null if invalid
  return null;
}

/**
 * Parse name into first and last name components
 */
function parseName(fullName) {
  if (!fullName) return { first_name: '', last_name: '', full_name: '' };

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: parts[0],
      full_name: fullName.trim()
    };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
    full_name: fullName.trim()
  };
}

/**
 * Attio CRM API Client (Fixed Version)
 */
class AttioClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.attio.com/v2';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Create a person record in Attio (CORRECTED FORMAT)
   */
  async createPerson(attorney) {
    try {
      const nameParts = parseName(attorney.name);

      const values = {
        name: [{
          first_name: nameParts.first_name,
          last_name: nameParts.last_name,
          full_name: nameParts.full_name
        }]
      };

      // Add email if available
      if (attorney.email) {
        values.email_addresses = [{
          email_address: attorney.email
        }];
      }

      // Add phone if available
      if (attorney.phone) {
        const parsedPhone = parsePhoneNumber(attorney.phone);
        if (parsedPhone) {
          values.phone_numbers = [{
            country_code: 'US',
            original_phone_number: parsedPhone
          }];
        }
      }

      // Add job title
      values.job_title = [{
        value: 'Estate Planning Attorney'
      }];

      // Skip primary_location - it requires too many fields

      const payload = {
        data: {
          values: values
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      return { success: true, data: response.data };

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      const details = error.response?.data?.validation_errors || [];
      return { success: false, error: errorMsg, details };
    }
  }

  /**
   * Create a company record in Attio (CORRECTED FORMAT)
   */
  async createCompany(attorney) {
    try {
      const values = {
        name: [{
          value: attorney.firm
        }]
      };

      // Skip website and location - they may not be available as attributes

      const payload = {
        data: {
          values: values
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/objects/companies/records`,
        payload,
        { headers: this.headers }
      );

      return { success: true, data: response.data };

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Add note to a record
   */
  async addNote(recordId, noteContent) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/notes`,
        {
          parent_object: 'people',
          parent_record_id: recordId,
          content: noteContent,
          format: 'plaintext'
        },
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/self`,
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Calculate data quality score for an attorney
 */
function calculateQualityScore(attorney) {
  let score = 0;

  if (attorney.name && attorney.name !== 'Law Office Representative') score += 20;
  else if (attorney.name) score += 5;

  if (attorney.firm) score += 15;
  if (attorney.phone) score += 20;
  if (attorney.email) score += 25;
  if (attorney.website) score += 10;
  if (attorney.location) score += 5;
  if (attorney.practice_areas && attorney.practice_areas.length > 0) score += 5;

  return score;
}

/**
 * Select best 50 attorneys based on data quality
 */
function selectBestAttorneys(attorneys, targetCount) {
  const scoredAttorneys = attorneys.map(attorney => ({
    ...attorney,
    qualityScore: calculateQualityScore(attorney)
  }));

  scoredAttorneys.sort((a, b) => b.qualityScore - a.qualityScore);
  return scoredAttorneys.slice(0, targetCount);
}

/**
 * Upload a single attorney to Attio
 */
async function uploadAttorney(attorney, attioClient, index, total) {
  console.log(`\n[${index + 1}/${total}] ${attorney.name} - ${attorney.firm}`);

  const result = {
    attorney: attorney.name,
    firm: attorney.firm,
    location: attorney.location,
    success: false,
    companyCreated: false,
    personCreated: false,
    noteAdded: false
  };

  try {
    // Step 1: Create company record
    let companyId = null;
    if (attorney.firm) {
      const companyResult = await attioClient.createCompany(attorney);
      if (companyResult.success) {
        companyId = companyResult.data?.data?.id?.record_id;
        result.companyCreated = true;
        console.log(`  ✓ Company: ${attorney.firm}`);
      } else if (companyResult.error?.includes('already exists') || companyResult.error?.includes('duplicate')) {
        console.log(`  ○ Company exists: ${attorney.firm}`);
      } else {
        console.log(`  ⚠ Company: ${companyResult.error}`);
      }
    }

    // Step 2: Create person record
    const personResult = await attioClient.createPerson(attorney);
    if (personResult.success) {
      const personId = personResult.data?.data?.id?.record_id;
      result.personCreated = true;
      result.personId = personId;
      console.log(`  ✓ Person: ${attorney.name}`);

      // Step 3: Add source note
      const practiceAreas = attorney.practice_areas?.join(', ') || 'Estate Planning';
      const sourceNote = `Source: ${attorney.source}
Practice Areas: ${practiceAreas}
Website: ${attorney.website || 'N/A'}
State: California

Lead collected via automated research of California trust and estate planning attorneys.`;

      const noteResult = await attioClient.addNote(personId, sourceNote);
      if (noteResult.success) {
        result.noteAdded = true;
        console.log(`  ✓ Note added`);
      }

      result.success = true;
    } else {
      console.log(`  ✗ Person failed: ${personResult.error}`);
      if (personResult.details && personResult.details.length > 0) {
        console.log(`    Details: ${JSON.stringify(personResult.details)}`);
      }
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
  }

  return result;
}

/**
 * Generate location breakdown
 */
function generateLocationBreakdown(attorneys) {
  const locationCounts = {};
  attorneys.forEach(attorney => {
    const location = attorney.location || 'Unknown';
    locationCounts[location] = (locationCounts[location] || 0) + 1;
  });

  return Object.entries(locationCounts).sort((a, b) => b[1] - a[1]);
}

/**
 * Main execution function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Upload 50 California Trust & Estate Attorneys to Attio CRM');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Verify Attio API connection
    console.log('Step 1: Verifying Attio API connection...');

    if (!CONFIG.ATTIO_API_KEY) {
      console.error('\nError: ATTIO_API_KEY not found\n');
      process.exit(1);
    }

    const attioClient = new AttioClient(CONFIG.ATTIO_API_KEY);
    const connectionTest = await attioClient.testConnection();

    if (!connectionTest.success) {
      console.error(`\nFailed to connect: ${connectionTest.error}\n`);
      process.exit(1);
    }

    console.log('✓ Connected to Attio CRM\n');

    // Step 2: Load attorney data
    console.log('Step 2: Loading attorney data...');
    const inputPath = path.join(__dirname, CONFIG.INPUT_FILE);
    const allAttorneys = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`✓ Loaded ${allAttorneys.length} attorneys\n`);

    // Step 3: Select best 50
    console.log('Step 3: Selecting top 50 attorneys...');
    const selectedAttorneys = selectBestAttorneys(allAttorneys, CONFIG.TARGET_COUNT);
    console.log(`✓ Selected ${selectedAttorneys.length} attorneys\n`);

    const withEmail = selectedAttorneys.filter(a => a.email).length;
    const withPhone = selectedAttorneys.filter(a => a.phone).length;
    console.log(`  - With email: ${withEmail} (${Math.round(withEmail/selectedAttorneys.length*100)}%)`);
    console.log(`  - With phone: ${withPhone} (${Math.round(withPhone/selectedAttorneys.length*100)}%)`);

    // Step 4: Upload attorneys
    console.log('\nStep 4: Uploading to Attio CRM...');

    const uploadResults = [];
    for (let i = 0; i < selectedAttorneys.length; i++) {
      const result = await uploadAttorney(selectedAttorneys[i], attioClient, i, selectedAttorneys.length);
      uploadResults.push(result);
    }

    // Step 5: Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════');

    const successful = uploadResults.filter(r => r.success).length;
    const failed = uploadResults.filter(r => !r.success).length;

    console.log(`\n✓ Successfully uploaded: ${successful}/${selectedAttorneys.length}`);
    console.log(`✗ Failed uploads: ${failed}`);

    // Location breakdown
    console.log('\nGeographic Distribution:');
    const locationBreakdown = generateLocationBreakdown(selectedAttorneys);
    locationBreakdown.slice(0, 10).forEach(([location, count]) => {
      console.log(`  - ${location}: ${count} attorneys`);
    });

    // Save report
    const reportPath = path.join(__dirname, CONFIG.OUTPUT_DIR, 'upload-report-final.json');
    const report = {
      uploadDate: new Date().toISOString(),
      totalUploaded: successful,
      totalFailed: failed,
      attorneys: uploadResults,
      locationBreakdown: Object.fromEntries(locationBreakdown)
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved: ${reportPath}`);

    // Save CSV
    const csvPath = path.join(__dirname, CONFIG.OUTPUT_DIR, 'uploaded-attorneys-final.csv');
    const headers = ['Name', 'Firm', 'Location', 'Phone', 'Email', 'Website', 'Practice Areas', 'Status'];
    const rows = uploadResults.map(r => {
      const attorney = selectedAttorneys.find(a => a.name === r.attorney);
      return [
        r.attorney || '',
        r.firm || '',
        r.location || '',
        attorney?.phone || '',
        attorney?.email || '',
        attorney?.website || '',
        attorney?.practice_areas?.join('; ') || '',
        r.success ? 'Success' : 'Failed'
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    fs.writeFileSync(csvPath, csv);
    console.log(`📄 CSV saved: ${csvPath}`);

    console.log('\n✅ Upload completed!\n');

  } catch (error) {
    console.error('\nError:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { AttioClient, uploadAttorney, selectBestAttorneys };
