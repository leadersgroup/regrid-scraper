/**
 * Upload 50 California Trust & Estate Planning Attorneys to Attio CRM
 *
 * This script:
 * 1. Loads the collected attorney data
 * 2. Selects the best 50 attorneys (prioritizing those with complete data)
 * 3. Uploads each attorney to Attio CRM as person and company records
 * 4. Generates a comprehensive summary report
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
 * Attio CRM API Client
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
   * Create a person record in Attio
   */
  async createPerson(personData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        { data: personData },
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`  Error creating person: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Create a company record in Attio
   */
  async createCompany(companyData) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/objects/companies/records`,
        { data: companyData },
        { headers: this.headers }
      );
      return { success: true, data: response.data };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      // Don't log error if company already exists
      if (!errorMsg.includes('already exists') && !errorMsg.includes('duplicate')) {
        console.error(`  Warning - Company: ${errorMsg}`);
      }
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
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`  Warning - Note: ${errorMsg}`);
      return { success: false, error: errorMsg };
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

  // Name is required
  if (attorney.name && attorney.name !== 'Law Office Representative') score += 20;
  else if (attorney.name) score += 5;

  // Firm is valuable
  if (attorney.firm) score += 15;

  // Contact info is critical
  if (attorney.phone) score += 20;
  if (attorney.email) score += 25;
  if (attorney.website) score += 10;

  // Location
  if (attorney.location) score += 5;

  // Practice areas
  if (attorney.practice_areas && attorney.practice_areas.length > 0) score += 5;

  return score;
}

/**
 * Select best 50 attorneys based on data quality
 */
function selectBestAttorneys(attorneys, targetCount) {
  // Calculate quality scores
  const scoredAttorneys = attorneys.map(attorney => ({
    ...attorney,
    qualityScore: calculateQualityScore(attorney)
  }));

  // Sort by quality score (descending)
  scoredAttorneys.sort((a, b) => b.qualityScore - a.qualityScore);

  // Return top N
  return scoredAttorneys.slice(0, targetCount);
}

/**
 * Upload a single attorney to Attio
 */
async function uploadAttorney(attorney, attioClient, index, total) {
  console.log(`\n[${index + 1}/${total}] Processing: ${attorney.name} - ${attorney.firm}`);

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
    // Step 1: Create company record for law firm
    let companyId = null;
    if (attorney.firm) {
      const companyData = {
        name: attorney.firm
      };

      // Add optional fields
      if (attorney.website) {
        companyData.website = attorney.website;
      }
      if (attorney.location) {
        companyData.location = attorney.location;
      }

      const companyResult = await attioClient.createCompany(companyData);
      if (companyResult.success) {
        companyId = companyResult.data?.data?.id?.record_id;
        result.companyCreated = true;
        console.log(`  ✓ Created company: ${attorney.firm}`);
      } else if (companyResult.error?.includes('already exists') || companyResult.error?.includes('duplicate')) {
        console.log(`  ○ Company exists: ${attorney.firm}`);
      }
    }

    // Step 2: Create person record for attorney
    const personData = {
      name: attorney.name
    };

    // Add optional fields
    const attributes = [];

    if (attorney.email) {
      attributes.push({
        attribute: 'email_addresses',
        value: [{ email_address: attorney.email }]
      });
    }

    if (attorney.phone) {
      attributes.push({
        attribute: 'phone_numbers',
        value: [{ original_phone_number: attorney.phone }]
      });
    }

    if (attorney.location) {
      attributes.push({
        attribute: 'location',
        value: attorney.location
      });
    }

    attributes.push({
      attribute: 'job_title',
      value: 'Estate Planning Attorney'
    });

    if (companyId) {
      attributes.push({
        attribute: 'companies',
        value: [{ target_record_id: companyId }]
      });
    }

    if (attributes.length > 0) {
      personData.attributes = attributes;
    }

    const personResult = await attioClient.createPerson(personData);
    if (personResult.success) {
      const personId = personResult.data?.data?.id?.record_id;
      result.personCreated = true;
      result.personId = personId;
      console.log(`  ✓ Created person: ${attorney.name}`);

      // Step 3: Add source information as a note
      const practiceAreas = attorney.practice_areas?.join(', ') || 'Estate Planning';
      const sourceNote = `Source: ${attorney.source}
Practice Areas: ${practiceAreas}
Website: ${attorney.website || 'N/A'}
State: California

Lead collected via automated research of California trust and estate planning attorneys.`;

      const noteResult = await attioClient.addNote(personId, sourceNote);
      if (noteResult.success) {
        result.noteAdded = true;
        console.log(`  ✓ Added source note`);
      }

      result.success = true;
    } else {
      console.log(`  ✗ Failed to create person: ${personResult.error}`);
    }

    // Rate limiting - wait between API calls
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

  // Sort by count
  const sorted = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1]);

  return sorted;
}

/**
 * Main execution function
 */
async function main() {
  console.log('═════════════════════════════════════════════════════════════════');
  console.log('  Upload 50 California Trust & Estate Planning Attorneys to Attio');
  console.log('═════════════════════════════════════════════════════════════════\n');

  try {
    // Step 1: Verify Attio API connection
    console.log('📋 Step 1: Verifying Attio API connection...');

    if (!CONFIG.ATTIO_API_KEY) {
      console.error('\n❌ Error: ATTIO_API_KEY not found in environment variables');
      console.log('Please set your API key in the .env file\n');
      process.exit(1);
    }

    const attioClient = new AttioClient(CONFIG.ATTIO_API_KEY);
    const connectionTest = await attioClient.testConnection();

    if (!connectionTest.success) {
      console.error(`\n❌ Failed to connect to Attio: ${connectionTest.error}\n`);
      process.exit(1);
    }

    const workspaceId = connectionTest.data?.data?.workspace_id ||
                        connectionTest.data?.data?.workspace?.id ||
                        'Connected';
    console.log(`✓ Connected to Attio workspace: ${workspaceId}\n`);

    // Step 2: Load attorney data
    console.log('📋 Step 2: Loading attorney data...');
    const inputPath = path.join(__dirname, CONFIG.INPUT_FILE);

    if (!fs.existsSync(inputPath)) {
      console.error(`\n❌ Error: Input file not found: ${inputPath}\n`);
      process.exit(1);
    }

    const allAttorneys = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    console.log(`✓ Loaded ${allAttorneys.length} attorneys from file\n`);

    // Step 3: Select best 50 attorneys
    console.log('📋 Step 3: Selecting top 50 attorneys by data quality...');
    const selectedAttorneys = selectBestAttorneys(allAttorneys, CONFIG.TARGET_COUNT);
    console.log(`✓ Selected ${selectedAttorneys.length} attorneys for upload\n`);

    // Show quality distribution
    const withEmail = selectedAttorneys.filter(a => a.email).length;
    const withPhone = selectedAttorneys.filter(a => a.phone).length;
    const withWebsite = selectedAttorneys.filter(a => a.website).length;
    console.log('Data Quality Preview:');
    console.log(`  - With email: ${withEmail} (${Math.round(withEmail/selectedAttorneys.length*100)}%)`);
    console.log(`  - With phone: ${withPhone} (${Math.round(withPhone/selectedAttorneys.length*100)}%)`);
    console.log(`  - With website: ${withWebsite} (${Math.round(withWebsite/selectedAttorneys.length*100)}%)`);

    // Step 4: Upload attorneys to Attio
    console.log('\n📋 Step 4: Uploading attorneys to Attio CRM...');

    const uploadResults = [];
    for (let i = 0; i < selectedAttorneys.length; i++) {
      const result = await uploadAttorney(selectedAttorneys[i], attioClient, i, selectedAttorneys.length);
      uploadResults.push(result);
    }

    // Step 5: Generate summary report
    console.log('\n═════════════════════════════════════════════════════════════════');
    console.log('  UPLOAD SUMMARY');
    console.log('═════════════════════════════════════════════════════════════════');

    const successful = uploadResults.filter(r => r.success).length;
    const failed = uploadResults.filter(r => !r.success).length;
    const companiesCreated = uploadResults.filter(r => r.companyCreated).length;
    const personsCreated = uploadResults.filter(r => r.personCreated).length;
    const notesAdded = uploadResults.filter(r => r.noteAdded).length;

    console.log(`\n✓ Successfully uploaded: ${successful}/${selectedAttorneys.length}`);
    console.log(`✗ Failed uploads: ${failed}`);
    console.log(`\nDetails:`);
    console.log(`  - Companies created: ${companiesCreated}`);
    console.log(`  - Persons created: ${personsCreated}`);
    console.log(`  - Notes added: ${notesAdded}`);

    // Location breakdown
    console.log('\n📍 Geographic Distribution:');
    const locationBreakdown = generateLocationBreakdown(selectedAttorneys);
    locationBreakdown.forEach(([location, count]) => {
      const percentage = Math.round(count / selectedAttorneys.length * 100);
      console.log(`  - ${location}: ${count} attorneys (${percentage}%)`);
    });

    // Practice area summary
    const allPracticeAreas = new Set();
    selectedAttorneys.forEach(attorney => {
      if (attorney.practice_areas) {
        attorney.practice_areas.forEach(area => allPracticeAreas.add(area));
      }
    });

    console.log('\n🏛️  Practice Areas Represented:');
    const topAreas = Array.from(allPracticeAreas).slice(0, 10);
    topAreas.forEach(area => {
      const count = selectedAttorneys.filter(a =>
        a.practice_areas?.includes(area)
      ).length;
      console.log(`  - ${area}: ${count} attorneys`);
    });

    // Save upload report
    const reportPath = path.join(__dirname, CONFIG.OUTPUT_DIR, 'upload-report.json');
    const report = {
      uploadDate: new Date().toISOString(),
      totalUploaded: successful,
      totalFailed: failed,
      attorneys: uploadResults,
      locationBreakdown: Object.fromEntries(locationBreakdown),
      summary: {
        companiesCreated,
        personsCreated,
        notesAdded,
        withEmail,
        withPhone,
        withWebsite
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Upload report saved to: ${reportPath}`);

    // Save CSV for reference
    const csvPath = path.join(__dirname, CONFIG.OUTPUT_DIR, 'uploaded-attorneys.csv');
    const headers = ['Name', 'Firm', 'Location', 'Phone', 'Email', 'Website', 'Practice Areas', 'Upload Status'];
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
    console.log(`📄 CSV exported to: ${csvPath}`);

    console.log('\n✅ Process completed successfully!\n');

    if (failed > 0) {
      console.log('⚠️  Some uploads failed. Check the report for details.');
      const failedAttorneys = uploadResults.filter(r => !r.success);
      console.log('\nFailed uploads:');
      failedAttorneys.forEach(f => {
        console.log(`  - ${f.attorney} (${f.firm})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error in main process:', error);
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
