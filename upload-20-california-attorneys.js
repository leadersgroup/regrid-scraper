const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.attorney' });

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_API_BASE = 'https://api.attio.com/v2';

if (!ATTIO_API_KEY) {
  console.error('Error: ATTIO_API_KEY not found in .env.attorney file');
  process.exit(1);
}

const axiosInstance = axios.create({
  baseURL: ATTIO_API_BASE,
  headers: {
    'Authorization': `Bearer ${ATTIO_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

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

function parsePhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it has 10 digits, assume US number
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it starts with 1 and has 11 digits, it's already in US format
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return null;
}

async function createOrUpdatePerson(attorney) {
  try {
    console.log(`\nProcessing: ${attorney.name} - ${attorney.firm}`);

    // Format practice areas
    const practiceAreasText = Array.isArray(attorney.practice_areas)
      ? attorney.practice_areas.join('; ')
      : attorney.practice_areas;

    // Parse name
    const nameParts = parseName(attorney.name);
    const phoneE164 = parsePhoneNumber(attorney.phone);

    // Prepare the person data with correct format
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
    if (phoneE164) {
      values.phone_numbers = [{
        country_code: 'US',
        original_phone_number: phoneE164
      }];
    }

    // Add job title
    values.job_title = [{
      value: 'Trust & Estate Planning Attorney'
    }];

    // Skip primary_location - it's complex and causes issues

    const personData = {
      data: {
        values: values
      }
    };

    // Create the person
    const response = await axiosInstance.post('/objects/people/records', personData);
    const personId = response.data.data.id.record_id;

    console.log(`  ✓ Created person: ${attorney.name} (ID: ${personId})`);

    // Add firm information as a note
    const noteText = `
**Law Firm:** ${attorney.firm}
**Practice Areas:** ${practiceAreasText}
**Website:** ${attorney.website || 'N/A'}
**Address:** ${attorney.address || attorney.location}
**Source:** ${attorney.source}
**Verified:** ${attorney.verified ? 'Yes' : 'No'}
${attorney.credentials ? `**Credentials:** ${attorney.credentials}` : ''}

Contact verified as of ${new Date().toLocaleDateString()}
    `.trim();

    try {
      await axiosInstance.post(`/notes`, {
        data: {
          parent_object: 'people',
          parent_record_id: personId,
          title: `Attorney Profile - ${attorney.firm}`,
          content: noteText,
          format: 'markdown'
        }
      });
      console.log(`  ✓ Added note with firm and practice area details`);
    } catch (noteError) {
      console.log(`  ! Note creation failed (non-critical):`, noteError.response?.data || noteError.message);
    }

    // Tag the person
    try {
      await axiosInstance.post(`/objects/people/records/${personId}/tags`, {
        data: {
          tags: ['Trust Attorney', 'Estate Planning', 'California', 'Lead - Cold']
        }
      });
      console.log(`  ✓ Tagged as Trust Attorney / Estate Planning`);
    } catch (tagError) {
      console.log(`  ! Tagging failed (non-critical):`, tagError.response?.data || tagError.message);
    }

    return {
      success: true,
      name: attorney.name,
      firm: attorney.firm,
      location: attorney.location,
      personId: personId
    };

  } catch (error) {
    console.error(`  ✗ Error processing ${attorney.name}:`, error.response?.data || error.message);
    return {
      success: false,
      name: attorney.name,
      firm: attorney.firm,
      error: error.response?.data?.errors || error.message
    };
  }
}

async function uploadAttorneys() {
  try {
    console.log('========================================');
    console.log('California Trust Attorney Upload to Attio');
    console.log('========================================\n');

    // Read the attorney data
    const attorneyDataPath = path.join(__dirname, 'attorney-data', 'california-attorneys-new-batch-20.json');
    const attorneys = JSON.parse(fs.readFileSync(attorneyDataPath, 'utf8'));

    console.log(`Found ${attorneys.length} attorneys to upload\n`);
    console.log('Starting upload process...\n');

    const results = [];

    for (const attorney of attorneys) {
      const result = await createOrUpdatePerson(attorney);
      results.push(result);

      // Rate limiting - wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Generate summary
    console.log('\n========================================');
    console.log('UPLOAD SUMMARY');
    console.log('========================================\n');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    console.log(`Total attorneys processed: ${results.length}`);
    console.log(`Successfully uploaded: ${successful.length}`);
    console.log(`Failed: ${failed.length}\n`);

    if (successful.length > 0) {
      console.log('Successfully uploaded attorneys:');
      successful.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name} - ${r.firm} (${r.location})`);
      });
    }

    if (failed.length > 0) {
      console.log('\nFailed uploads:');
      failed.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name} - ${r.firm}`);
        console.log(`     Error: ${JSON.stringify(r.error)}`);
      });
    }

    // Save detailed report
    const reportPath = path.join(__dirname, 'attorney-data', 'upload-report-20-attorneys.json');
    const report = {
      uploadDate: new Date().toISOString(),
      totalProcessed: results.length,
      successful: successful.length,
      failed: failed.length,
      results: results,
      locationBreakdown: getLocationBreakdown(successful),
      firmBreakdown: getFirmBreakdown(successful)
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nDetailed report saved to: ${reportPath}`);

    // Save CSV for successful uploads
    if (successful.length > 0) {
      const csvPath = path.join(__dirname, 'attorney-data', 'uploaded-20-attorneys.csv');
      const csvContent = generateCSV(successful, attorneys);
      fs.writeFileSync(csvPath, csvContent);
      console.log(`CSV export saved to: ${csvPath}`);
    }

    console.log('\n========================================');
    console.log('Upload process completed!');
    console.log('========================================\n');

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function getLocationBreakdown(successful) {
  const breakdown = {};
  successful.forEach(r => {
    const city = r.location.split(',')[0].trim();
    breakdown[city] = (breakdown[city] || 0) + 1;
  });
  return breakdown;
}

function getFirmBreakdown(successful) {
  const breakdown = {};
  successful.forEach(r => {
    breakdown[r.firm] = (breakdown[r.firm] || 0) + 1;
  });
  return breakdown;
}

function generateCSV(successful, attorneys) {
  const header = 'Name,Firm,Location,Phone,Email,Website,Practice Areas,Attio Person ID\n';
  const rows = successful.map(r => {
    const attorney = attorneys.find(a => a.name === r.name);
    const practiceAreas = Array.isArray(attorney.practice_areas)
      ? attorney.practice_areas.join('; ')
      : attorney.practice_areas;

    return `"${r.name}","${r.firm}","${r.location}","${attorney.phone}","${attorney.email}","${attorney.website}","${practiceAreas}","${r.personId}"`;
  }).join('\n');

  return header + rows;
}

// Run the upload
uploadAttorneys().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
