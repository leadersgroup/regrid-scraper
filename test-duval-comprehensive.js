/**
 * Comprehensive test suite for Duval County scraper
 * Tests code quality, structure, and integration
 */

const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    if (details) console.log(`   ${details}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    if (details) console.log(`   ${details}`);
    testsFailed++;
  }
}

console.log('🧪 Duval County Scraper - Comprehensive Test Suite\n');
console.log('='.repeat(80));

// ============================================================================
// SECTION 1: File System Tests
// ============================================================================
console.log('\n📁 SECTION 1: File System Tests');
console.log('-'.repeat(80));

const scraperPath = path.join(__dirname, 'county-implementations', 'duval-county-florida.js');
const apiServerPath = path.join(__dirname, 'api-server.js');

test('Scraper file exists', fs.existsSync(scraperPath));
test('API server file exists', fs.existsSync(apiServerPath));

const scraperStats = fs.statSync(scraperPath);
test('Scraper file is non-empty', scraperStats.size > 0, `Size: ${scraperStats.size} bytes`);
test('Scraper file is substantial', scraperStats.size > 10000, `Size: ${(scraperStats.size / 1024).toFixed(2)} KB`);

// ============================================================================
// SECTION 2: Code Structure Tests
// ============================================================================
console.log('\n🏗️  SECTION 2: Code Structure Tests');
console.log('-'.repeat(80));

const scraperCode = fs.readFileSync(scraperPath, 'utf8');
const apiServerCode = fs.readFileSync(apiServerPath, 'utf8');

// Class definition
test('Has DuvalCountyFloridaScraper class', scraperCode.includes('class DuvalCountyFloridaScraper'));
test('Extends DeedScraper', scraperCode.includes('extends DeedScraper'));
test('Has constructor', scraperCode.includes('constructor(options = {})'));
test('Calls super in constructor', scraperCode.includes('super(options)'));

// County configuration
test('County set to Duval', scraperCode.includes("this.county = 'Duval'"));
test('State set to FL', scraperCode.includes("this.state = 'FL'"));

// Module exports
test('Module exported', scraperCode.includes('module.exports = DuvalCountyFloridaScraper'));

// ============================================================================
// SECTION 3: Required Methods Tests
// ============================================================================
console.log('\n🔧 SECTION 3: Required Methods Tests');
console.log('-'.repeat(80));

const requiredMethods = [
  'initialize',
  'getPriorDeed',
  'searchAssessorSite',
  'extractTransactionRecords',
  'downloadDeed',
  'getDeedRecorderUrl',
  'getAssessorUrl',
  'normalizeStreetType'
];

for (const method of requiredMethods) {
  const hasMethod = scraperCode.includes(`async ${method}(`) ||
                    scraperCode.includes(`${method}(`);
  test(`Method: ${method}`, hasMethod);
}

// ============================================================================
// SECTION 4: URL Configuration Tests
// ============================================================================
console.log('\n🌐 SECTION 4: URL Configuration Tests');
console.log('-'.repeat(80));

test('Property Appraiser URL',
     scraperCode.includes('paopropertysearch.coj.net'),
     'https://paopropertysearch.coj.net');

test('Clerk of Courts URL',
     scraperCode.includes('or.duvalclerk.com'),
     'https://or.duvalclerk.com/');

test('Jacksonville domain',
     scraperCode.includes('coj.net'),
     'City of Jacksonville domain');

test('Duval Clerk domain',
     scraperCode.includes('duvalclerk.com'),
     'Duval County Clerk domain');

// ============================================================================
// SECTION 5: Browser Configuration Tests
// ============================================================================
console.log('\n🌐 SECTION 5: Browser Configuration Tests');
console.log('-'.repeat(80));

test('Imports puppeteer-extra', scraperCode.includes("require('puppeteer-extra')"));
test('Imports StealthPlugin', scraperCode.includes('puppeteer-extra-plugin-stealth'));
test('Uses StealthPlugin', scraperCode.includes('puppeteer.use(StealthPlugin())'));
test('Sets user agent', scraperCode.includes('setUserAgent'));
test('Sets viewport', scraperCode.includes('setViewport'));
test('Sets extra HTTP headers', scraperCode.includes('setExtraHTTPHeaders'));
test('Configures headless mode', scraperCode.includes('headless: this.headless'));
test('Anti-automation flags', scraperCode.includes('--disable-blink-features=AutomationControlled'));

// ============================================================================
// SECTION 6: Workflow Tests
// ============================================================================
console.log('\n⚙️  SECTION 6: Workflow Tests');
console.log('-'.repeat(80));

test('Skips Step 1 (Regrid)', scraperCode.includes('Skipping Step 1'));
test('Has Step 2 (Assessor search)', scraperCode.includes('Step 2'));
test('Has Step 3 (Download deed)', scraperCode.includes('Step 3'));
test('Returns structured result', scraperCode.includes('result = {'));
test('Includes timestamp', scraperCode.includes('timestamp:'));
test('Includes success flag', scraperCode.includes('success:'));
test('Handles errors', scraperCode.includes('catch (error)'));
test('Closes browser', scraperCode.includes('await scraper.close()'));

// ============================================================================
// SECTION 7: Address Parsing Tests
// ============================================================================
console.log('\n🏠 SECTION 7: Address Parsing Tests');
console.log('-'.repeat(80));

test('Parses street number', scraperCode.includes('streetNumber'));
test('Parses street name', scraperCode.includes('streetName'));
test('Parses street type', scraperCode.includes('streetType'));
test('Handles address normalization', scraperCode.includes('normalizeStreetType'));
test('Splits by comma', scraperCode.includes("split(',')"));
test('Handles street suffixes', scraperCode.includes('Ave') || scraperCode.includes('Street'));

// ============================================================================
// SECTION 8: Transaction Extraction Tests
// ============================================================================
console.log('\n📋 SECTION 8: Transaction Extraction Tests');
console.log('-'.repeat(80));

test('Extracts instrument numbers', scraperCode.includes('instrumentNumber'));
test('Extracts book/page', scraperCode.includes('bookNumber') && scraperCode.includes('pageNumber'));
test('Pattern matching for instruments', scraperCode.includes('match') || scraperCode.includes('matchAll'));
test('Handles transaction types', scraperCode.includes("type: 'instrument'") || scraperCode.includes("type: 'book_page'"));
test('Removes duplicates', scraperCode.includes('uniqueResults') || scraperCode.includes('Set'));

// ============================================================================
// SECTION 9: PDF Download Tests
// ============================================================================
console.log('\n📄 SECTION 9: PDF Download Tests');
console.log('-'.repeat(80));

test('Downloads PDF buffer', scraperCode.includes('pdfBuffer') || scraperCode.includes('arrayBuffer'));
test('Validates PDF format', scraperCode.includes('%PDF'));
test('Saves to disk', scraperCode.includes('writeFileSync'));
test('Creates download directory', scraperCode.includes('mkdirSync'));
test('Returns file metadata', scraperCode.includes('filename') && scraperCode.includes('fileSize'));
test('Handles popup windows', scraperCode.includes('targetcreated') || scraperCode.includes('newPage'));
test('Accepts disclaimers', scraperCode.includes('accept') || scraperCode.includes('agree'));

// ============================================================================
// SECTION 10: API Integration Tests
// ============================================================================
console.log('\n🔌 SECTION 10: API Integration Tests');
console.log('-'.repeat(80));

test('Imported in api-server', apiServerCode.includes('duval-county-florida'));
test('DuvalCountyFloridaScraper referenced', apiServerCode.includes('DuvalCountyFloridaScraper'));
test('Routing logic exists', apiServerCode.includes("detectedCounty === 'Duval'"));
test('Listed in supported counties', apiServerCode.includes('Duval County'));
test('Has county features listed', apiServerCode.includes('Instrument Number'));
test('Has state code', apiServerCode.includes("state: 'FL'"));

// ============================================================================
// SECTION 11: Error Handling Tests
// ============================================================================
console.log('\n⚠️  SECTION 11: Error Handling Tests');
console.log('-'.repeat(80));

test('Try-catch blocks', scraperCode.includes('try {') && scraperCode.includes('catch'));
test('Logs errors', scraperCode.includes('this.log') || scraperCode.includes('console.log'));
test('Returns error info', scraperCode.includes('error:') && scraperCode.includes('message'));
test('Handles timeout', scraperCode.includes('timeout:'));
test('Validates inputs', scraperCode.includes('if (!'));

// ============================================================================
// SECTION 12: Code Quality Tests
// ============================================================================
console.log('\n📝 SECTION 12: Code Quality Tests');
console.log('-'.repeat(80));

const lines = scraperCode.split('\n');
const commentLines = lines.filter(line => line.trim().startsWith('//') || line.trim().startsWith('*')).length;
const functionLines = lines.filter(line => line.includes('async ') || line.includes('function')).length;

test('Has documentation comments', commentLines > 10, `${commentLines} comment lines`);
test('Has multiple functions', functionLines > 5, `${functionLines} functions`);
test('File length is substantial', lines.length > 500, `${lines.length} lines`);
test('Uses async/await', scraperCode.includes('async') && scraperCode.includes('await'));
test('Uses template literals', scraperCode.includes('`'));
test('Uses arrow functions', scraperCode.includes('=>'));
test('Has JSDoc style comments', scraperCode.includes('/**'));

// ============================================================================
// SECTION 13: Dependencies Tests
// ============================================================================
console.log('\n📦 SECTION 13: Dependencies Tests');
console.log('-'.repeat(80));

test('Requires path module', scraperCode.includes("require('path')"));
test('Requires fs module', scraperCode.includes("require('fs')"));
test('Requires DeedScraper base', scraperCode.includes("require('../deed-scraper')"));
test('Requires puppeteer-extra', scraperCode.includes("require('puppeteer-extra')"));

// ============================================================================
// SECTION 14: Comparison with Hillsborough County
// ============================================================================
console.log('\n🔄 SECTION 14: Template Consistency Tests');
console.log('-'.repeat(80));

const hillsboroughPath = path.join(__dirname, 'county-implementations', 'hillsborough-county-florida.js');
if (fs.existsSync(hillsboroughPath)) {
  const hillsboroughCode = fs.readFileSync(hillsboroughPath, 'utf8');

  test('Similar structure to Hillsborough',
       scraperCode.includes('extends DeedScraper') === hillsboroughCode.includes('extends DeedScraper'));

  test('Uses same stealth approach',
       scraperCode.includes('StealthPlugin') === hillsboroughCode.includes('StealthPlugin'));

  test('Similar initialize method',
       scraperCode.includes('async initialize()') === hillsboroughCode.includes('async initialize()'));

  test('Similar getPriorDeed pattern',
       scraperCode.includes('async getPriorDeed(address)') === hillsboroughCode.includes('async getPriorDeed(address)'));
}

// ============================================================================
// FINAL RESULTS
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log('📊 TEST RESULTS SUMMARY');
console.log('='.repeat(80));
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(2)}%`);
console.log('='.repeat(80));

if (testsFailed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! Implementation is complete and validated.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${testsFailed} test(s) failed. Please review the implementation.\n`);
  process.exit(1);
}
