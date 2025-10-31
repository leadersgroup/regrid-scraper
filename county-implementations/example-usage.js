/**
 * Example: Using County-Specific Deed Scraper Implementations
 *
 * This file demonstrates how to use county-specific scraper classes
 * to download prior deeds with custom logic for different counties.
 */

const LosAngelesCountyScraper = require('./los-angeles-county');
const DeedScraper = require('../deed-scraper'); // Generic scraper

/**
 * Example 1: Using Los Angeles County-Specific Scraper
 */
async function downloadLACountyDeed() {
  console.log('Example 1: Los Angeles County Deed Download\n');

  const scraper = new LosAngelesCountyScraper({
    headless: true,
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    const address = '123 Main St, Los Angeles, CA';
    const result = await scraper.getPriorDeed(address);

    console.log('\n📊 Results:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.download) {
      console.log(`\n✅ Successfully downloaded deed to: ${result.download.filename}`);
    } else {
      console.log('\n❌ Failed to download deed');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

/**
 * Example 2: Automatic County Detection
 */
async function downloadDeedWithAutoDetection(address) {
  console.log('Example 2: Automatic County Detection\n');

  // First, get property data to determine county
  const genericScraper = new DeedScraper({ verbose: true });
  await genericScraper.initialize();

  try {
    // Step 1: Get property data from Regrid
    const propertyData = await genericScraper.getPropertyDataFromRegrid(address);

    if (!propertyData.success) {
      throw new Error('Could not retrieve property data');
    }

    console.log(`\nDetected County: ${propertyData.county}, ${propertyData.state}`);

    await genericScraper.close();

    // Step 2: Create county-specific scraper
    let scraper;
    const countyKey = `${propertyData.county}_${propertyData.state}`;

    switch (countyKey) {
      case 'Los Angeles_CA':
        scraper = new LosAngelesCountyScraper({ verbose: true });
        break;

      // Add more county-specific scrapers as they're implemented
      // case 'Orange_CA':
      //   scraper = new OrangeCountyScraper({ verbose: true });
      //   break;

      default:
        console.log(`\n⚠️ No specific implementation for ${countyKey}, using generic scraper`);
        scraper = new DeedScraper({ verbose: true });
    }

    // Step 3: Run deed download with appropriate scraper
    await scraper.initialize();
    const result = await scraper.getPriorDeed(address);

    console.log('\n📊 Results:');
    console.log(JSON.stringify(result, null, 2));

    await scraper.close();

    return result;

  } catch (error) {
    console.error('Error:', error);
    await genericScraper.close();
  }
}

/**
 * Example 3: Manual Step-by-Step Workflow
 */
async function manualWorkflow() {
  console.log('Example 3: Manual Step-by-Step Workflow\n');

  const scraper = new LosAngelesCountyScraper({
    headless: true,
    verbose: true
  });

  try {
    await scraper.initialize();

    const address = '456 Oak Ave, Los Angeles, CA';

    // Step 1: Get property data from Regrid
    console.log('\n--- STEP 1: Regrid Data Extraction ---');
    const propertyData = await scraper.getPropertyDataFromRegrid(address);
    console.log('Property Data:', JSON.stringify(propertyData, null, 2));

    if (!propertyData.success) {
      throw new Error('Failed to get property data');
    }

    // Step 2: Search property assessor
    console.log('\n--- STEP 2: Property Assessor Search ---');
    const assessorResults = await scraper.searchPropertyAssessor(propertyData);
    console.log('Assessor Results:', JSON.stringify(assessorResults, null, 2));

    if (assessorResults.success && assessorResults.transactions?.length > 0) {
      // Check for direct download links
      const transactionWithLink = assessorResults.transactions.find(t => t.downloadUrl);

      if (transactionWithLink) {
        console.log('\n✅ Found direct download link in assessor records!');
        const download = await scraper.downloadDeed(transactionWithLink);
        console.log('Download Result:', JSON.stringify(download, null, 2));
        return download;
      }

      // Step 3: Search deed recorder with transaction info
      console.log('\n--- STEP 3: Deed Recorder Search ---');
      const deedRecords = await scraper.searchDeedRecorder(assessorResults);
      console.log('Deed Records:', JSON.stringify(deedRecords, null, 2));

      if (deedRecords.success && deedRecords.deedRecords?.length > 0) {
        const download = await scraper.downloadDeed(deedRecords.deedRecords[0]);
        console.log('Download Result:', JSON.stringify(download, null, 2));
        return download;
      }
    }

    // Step 4: Fallback to owner name search
    console.log('\n--- STEP 4: Owner Name Search (Fallback) ---');
    const ownerResults = await scraper.searchByOwnerName(propertyData);
    console.log('Owner Search Results:', JSON.stringify(ownerResults, null, 2));

    if (ownerResults.success && ownerResults.deedRecords?.length > 0) {
      const download = await scraper.downloadDeed(ownerResults.deedRecords[0]);
      console.log('Download Result:', JSON.stringify(download, null, 2));
      return download;
    }

    console.log('\n❌ No deed found through any method');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

/**
 * Example 4: Batch Processing Multiple Addresses
 */
async function batchProcessing() {
  console.log('Example 4: Batch Processing Multiple Addresses\n');

  const addresses = [
    '123 Main St, Los Angeles, CA',
    '456 Oak Ave, Los Angeles, CA',
    '789 Pine Rd, Los Angeles, CA'
  ];

  const scraper = new LosAngelesCountyScraper({
    headless: true,
    verbose: false // Turn off verbose for cleaner batch output
  });

  await scraper.initialize();

  const results = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    console.log(`\nProcessing ${i + 1}/${addresses.length}: ${address}`);

    try {
      const result = await scraper.getPriorDeed(address);
      results.push({
        address,
        success: result.success,
        downloaded: result.download?.filename || null,
        error: result.error || null
      });

      console.log(`✅ Completed: ${address}`);

      // Wait between requests to avoid rate limiting
      if (i < addresses.length - 1) {
        console.log('⏸️ Waiting 10 seconds before next address...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

    } catch (error) {
      console.error(`❌ Error processing ${address}:`, error.message);
      results.push({
        address,
        success: false,
        error: error.message
      });
    }
  }

  await scraper.close();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('BATCH PROCESSING SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Addresses: ${addresses.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('\nDetailed Results:');
  console.log(JSON.stringify(results, null, 2));
}

/**
 * Example 5: Factory Pattern for County Selection
 */
class DeedScraperFactory {
  static createScraper(county, state, options = {}) {
    const countyKey = `${county}_${state}`;

    switch (countyKey) {
      case 'Los Angeles_CA':
        return new LosAngelesCountyScraper(options);

      // Add more counties here as they're implemented
      // case 'Orange_CA':
      //   return new OrangeCountyScraper(options);
      // case 'Miami-Dade_FL':
      //   return new MiamiDadeCountyScraper(options);

      default:
        console.warn(`No specific implementation for ${countyKey}, using generic scraper`);
        return new DeedScraper(options);
    }
  }
}

async function usingFactory() {
  console.log('Example 5: Using Factory Pattern\n');

  const scraper = DeedScraperFactory.createScraper('Los Angeles', 'CA', {
    headless: true,
    verbose: true
  });

  await scraper.initialize();

  try {
    const result = await scraper.getPriorDeed('123 Main St, Los Angeles, CA');
    console.log('Result:', JSON.stringify(result, null, 2));
  } finally {
    await scraper.close();
  }
}

// Run examples
if (require.main === module) {
  const args = process.argv.slice(2);
  const example = args[0] || '1';

  console.log('🏠 Deed Scraper County-Specific Examples\n');
  console.log('='.repeat(80));

  switch (example) {
    case '1':
      downloadLACountyDeed().catch(console.error);
      break;
    case '2':
      downloadDeedWithAutoDetection('123 Main St, Los Angeles, CA').catch(console.error);
      break;
    case '3':
      manualWorkflow().catch(console.error);
      break;
    case '4':
      batchProcessing().catch(console.error);
      break;
    case '5':
      usingFactory().catch(console.error);
      break;
    default:
      console.log('Usage: node example-usage.js [1-5]');
      console.log('  1: LA County deed download');
      console.log('  2: Auto-detect county');
      console.log('  3: Manual step-by-step');
      console.log('  4: Batch processing');
      console.log('  5: Factory pattern');
  }
}

module.exports = {
  downloadLACountyDeed,
  downloadDeedWithAutoDetection,
  manualWorkflow,
  batchProcessing,
  DeedScraperFactory
};
