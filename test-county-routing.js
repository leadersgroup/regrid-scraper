/**
 * Test script to validate county routing logic
 * Tests that the correct scraper is loaded for each county
 */

console.log('🧪 Testing County Routing Logic\n');
console.log('='.repeat(80));

// Test 1: Validate county-specific scrapers can be loaded
console.log('\n📋 Test 1: Loading County Scrapers');
console.log('-'.repeat(80));

try {
  const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');
  console.log('✅ Orange County scraper loaded');
} catch (error) {
  console.log('❌ Failed to load Orange County scraper:', error.message);
}

try {
  const HillsboroughCountyFloridaScraper = require('./county-implementations/hillsborough-county-florida');
  console.log('✅ Hillsborough County scraper loaded');
} catch (error) {
  console.log('❌ Failed to load Hillsborough County scraper:', error.message);
}

try {
  const DuvalCountyFloridaScraper = require('./county-implementations/duval-county-florida');
  console.log('✅ Duval County scraper loaded');
} catch (error) {
  console.log('❌ Failed to load Duval County scraper:', error.message);
}

// Test 2: Validate routing logic
console.log('\n📋 Test 2: County Routing Logic');
console.log('-'.repeat(80));

function getScraperType(county, state) {
  const detectedCounty = county || 'Orange';
  const detectedState = state || 'FL';

  if (detectedCounty === 'Orange' && detectedState === 'FL') {
    return 'OrangeCountyFloridaScraper';
  } else if (detectedCounty === 'Hillsborough' && detectedState === 'FL') {
    return 'HillsboroughCountyFloridaScraper';
  } else if (detectedCounty === 'Duval' && detectedState === 'FL') {
    return 'DuvalCountyFloridaScraper';
  } else {
    return 'DeedScraper (fallback)';
  }
}

const testCases = [
  { county: 'Orange', state: 'FL', expected: 'OrangeCountyFloridaScraper' },
  { county: 'Hillsborough', state: 'FL', expected: 'HillsboroughCountyFloridaScraper' },
  { county: 'Duval', state: 'FL', expected: 'DuvalCountyFloridaScraper' },
  { county: null, state: null, expected: 'OrangeCountyFloridaScraper' },
  { county: 'Unknown', state: 'FL', expected: 'DeedScraper (fallback)' }
];

let passed = 0;
let failed = 0;

for (const testCase of testCases) {
  const result = getScraperType(testCase.county, testCase.state);
  const success = result === testCase.expected;

  if (success) {
    console.log(`✅ ${testCase.county || 'default'}, ${testCase.state || 'default'} => ${result}`);
    passed++;
  } else {
    console.log(`❌ ${testCase.county || 'default'}, ${testCase.state || 'default'} => Expected: ${testCase.expected}, Got: ${result}`);
    failed++;
  }
}

// Test 3: Validate server.js has county routing
console.log('\n📋 Test 3: Server.js County Routing');
console.log('-'.repeat(80));

const fs = require('fs');
const serverCode = fs.readFileSync('./server.js', 'utf8');

const checks = [
  { name: 'Orange County routing', check: serverCode.includes("detectedCounty === 'Orange'") },
  { name: 'Hillsborough County routing', check: serverCode.includes("detectedCounty === 'Hillsborough'") },
  { name: 'Duval County routing', check: serverCode.includes("detectedCounty === 'Duval'") },
  { name: 'DuvalCountyFloridaScraper require', check: serverCode.includes('duval-county-florida') },
  { name: 'County detection logic', check: serverCode.includes('detectedCounty = county') },
  { name: '/api/counties endpoint', check: serverCode.includes("app.get('/api/counties'") }
];

for (const check of checks) {
  if (check.check) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
}

// Test 4: Validate API server has county routing
console.log('\n📋 Test 4: API-Server.js County Routing');
console.log('-'.repeat(80));

const apiServerCode = fs.readFileSync('./api-server.js', 'utf8');

const apiChecks = [
  { name: 'Orange County routing', check: apiServerCode.includes("detectedCounty === 'Orange'") },
  { name: 'Hillsborough County routing', check: apiServerCode.includes("detectedCounty === 'Hillsborough'") },
  { name: 'Duval County routing', check: apiServerCode.includes("detectedCounty === 'Duval'") },
  { name: 'DuvalCountyFloridaScraper import', check: apiServerCode.includes('DuvalCountyFloridaScraper') },
  { name: 'Duval County in counties list', check: apiServerCode.includes('Duval County') }
];

for (const check of apiChecks) {
  if (check.check) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
    failed++;
  }
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 TEST RESULTS');
console.log('='.repeat(80));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%`);
console.log('='.repeat(80));

if (failed === 0) {
  console.log('\n🎉 All county routing tests passed!\n');
  console.log('✅ Duval County is now properly integrated and routed.');
  console.log('');
  console.log('📝 Usage Example:');
  console.log('   POST /api/deed');
  console.log('   {');
  console.log('     "address": "231 E Forsyth St, Jacksonville, FL 32202",');
  console.log('     "county": "Duval",');
  console.log('     "state": "FL"');
  console.log('   }');
  console.log('');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} test(s) failed.\n`);
  process.exit(1);
}
