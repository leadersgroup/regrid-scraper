/**
 * Unit test for street suffix normalization
 */

const OrangeCountyFloridaScraper = require('./county-implementations/orange-county-florida');

console.log('\n' + '='.repeat(80));
console.log('🧪 TESTING STREET SUFFIX NORMALIZATION');
console.log('='.repeat(80) + '\n');

const scraper = new OrangeCountyFloridaScraper();

const testCases = [
  { input: '123 Main St', expected: '123 Main Street' },
  { input: '123 Main St.', expected: '123 Main Street' },
  { input: '456 Oak Ave', expected: '456 Oak Avenue' },
  { input: '456 Oak Ave.', expected: '456 Oak Avenue' },
  { input: '789 Palm Dr', expected: '789 Palm Drive' },
  { input: '789 Palm Dr.', expected: '789 Palm Drive' },
  { input: '13109 Tollcross Wy', expected: '13109 Tollcross Way' },
  { input: '13109 Tollcross Wy.', expected: '13109 Tollcross Way' },
  { input: '101 Lake Rd', expected: '101 Lake Road' },
  { input: '202 Park Blvd', expected: '202 Park Boulevard' },
  { input: '303 River Ln', expected: '303 River Lane' },
  { input: '404 Forest Ct', expected: '404 Forest Court' },
  { input: '505 Garden Pl', expected: '505 Garden Place' },
  { input: '606 Sunset Cir', expected: '606 Sunset Circle' },
  { input: '707 Ocean Pkwy', expected: '707 Ocean Parkway' },
  { input: '808 Mountain Ter', expected: '808 Mountain Terrace' },
  { input: '909 Nature Trl', expected: '909 Nature Trail' },
  { input: '123 Main Way', expected: '123 Main Way' }, // Already full word
  { input: '456 Oak Street', expected: '456 Oak Street' }, // Already full word
];

let passed = 0;
let failed = 0;

testCases.forEach(({ input, expected }) => {
  const result = scraper.normalizeStreetSuffix(input);
  const status = result === expected ? '✅' : '❌';

  if (result === expected) {
    passed++;
    console.log(`${status} "${input}" → "${result}"`);
  } else {
    failed++;
    console.log(`${status} "${input}" → "${result}" (expected: "${expected}")`);
  }
});

console.log('\n' + '='.repeat(80));
console.log('📊 TEST RESULTS');
console.log('='.repeat(80));
console.log(`Total Tests: ${testCases.length}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log('='.repeat(80) + '\n');

process.exit(failed > 0 ? 1 : 0);
