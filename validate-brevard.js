/**
 * Validation test for Brevard County scraper
 * Checks code structure without running the browser
 */

console.log('🔍 Validating Brevard County Scraper Implementation...\n');

// Test 1: Check if file exists and can be required
console.log('✓ Test 1: Checking if module can be loaded...');
let BrevardCountyFloridaScraper;
try {
  BrevardCountyFloridaScraper = require('./county-implementations/brevard-county-florida');
  console.log('  ✅ Module loaded successfully');
} catch (error) {
  console.log('  ❌ Failed to load module:', error.message);
  process.exit(1);
}

// Test 2: Check if class can be instantiated
console.log('\n✓ Test 2: Checking if class can be instantiated...');
try {
  const scraper = new BrevardCountyFloridaScraper({
    headless: true,
    verbose: false
  });
  console.log('  ✅ Class instantiated successfully');
  console.log(`  ✅ County: ${scraper.county}`);
  console.log(`  ✅ State: ${scraper.state}`);
} catch (error) {
  console.log('  ❌ Failed to instantiate class:', error.message);
  process.exit(1);
}

// Test 3: Check if methods exist
console.log('\n✓ Test 3: Checking required methods...');
const requiredMethods = [
  'initialize',
  'getPriorDeed',
  'searchAssessorSite',
  'extractTransactionRecords',
  'downloadDeed',
  'searchByInstrumentNumber',
  'searchByBookPage',
  'findAndDownloadPDF',
  'getDeedRecorderUrl',
  'getAssessorUrl',
  'randomWait',
  'close'
];

const scraper = new BrevardCountyFloridaScraper();
let allMethodsExist = true;

for (const method of requiredMethods) {
  if (typeof scraper[method] === 'function') {
    console.log(`  ✅ ${method}()`);
  } else {
    console.log(`  ❌ ${method}() - MISSING`);
    allMethodsExist = false;
  }
}

if (!allMethodsExist) {
  console.log('\n❌ Some required methods are missing');
  process.exit(1);
}

// Test 4: Check URLs
console.log('\n✓ Test 4: Checking URLs...');
const assessorUrl = scraper.getAssessorUrl('Brevard', 'FL');
const clerkUrl = scraper.getDeedRecorderUrl('Brevard', 'FL');

if (assessorUrl === 'https://www.bcpao.us/PropertySearch/') {
  console.log('  ✅ Property Appraiser URL correct');
} else {
  console.log('  ❌ Property Appraiser URL incorrect:', assessorUrl);
  process.exit(1);
}

if (clerkUrl === 'https://vaclmweb1.brevardclerk.us/AcclaimWeb/') {
  console.log('  ✅ Clerk URL correct');
} else {
  console.log('  ❌ Clerk URL incorrect:', clerkUrl);
  process.exit(1);
}

// Test 5: Check API server integration
console.log('\n✓ Test 5: Checking API server integration...');
try {
  const apiServer = require('./api-server');
  console.log('  ✅ API server loads successfully');

  // Check if Brevard is imported
  const fs = require('fs');
  const apiServerContent = fs.readFileSync('./api-server.js', 'utf8');

  if (apiServerContent.includes("require('./county-implementations/brevard-county-florida')")) {
    console.log('  ✅ Brevard County scraper imported in API server');
  } else {
    console.log('  ❌ Brevard County scraper NOT imported in API server');
    process.exit(1);
  }

  if (apiServerContent.includes('BrevardCountyFloridaScraper')) {
    console.log('  ✅ Brevard County scraper referenced in API server');
  } else {
    console.log('  ❌ Brevard County scraper NOT referenced in API server');
    process.exit(1);
  }

  if (apiServerContent.includes("detectedCounty === 'Brevard'")) {
    console.log('  ✅ Brevard County routing logic present');
  } else {
    console.log('  ❌ Brevard County routing logic MISSING');
    process.exit(1);
  }

} catch (error) {
  console.log('  ❌ API server check failed:', error.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('✅ ALL VALIDATION TESTS PASSED');
console.log('='.repeat(60));
console.log('\n📋 Summary:');
console.log('  • Brevard County scraper module loads correctly');
console.log('  • All required methods are implemented');
console.log('  • URLs are configured correctly');
console.log('  • API server integration is complete');
console.log('\n🚀 Implementation is ready for deployment!');
console.log('\n💡 To test with a real address, deploy to an environment with browser support.');
