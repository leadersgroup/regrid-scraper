/**
 * Syntax and structure validation test for Duval County scraper
 * This test validates the code structure without running the browser
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Duval County implementation structure...\n');

// Test 1: Check if file exists
console.log('📋 Test 1: File existence');
const scraperPath = path.join(__dirname, 'county-implementations', 'duval-county-florida.js');
if (fs.existsSync(scraperPath)) {
  console.log('✅ Duval County scraper file exists\n');
} else {
  console.error('❌ Duval County scraper file not found\n');
  process.exit(1);
}

// Test 2: Check if file is valid JavaScript
console.log('📋 Test 2: JavaScript syntax validation');
try {
  const scraperCode = fs.readFileSync(scraperPath, 'utf8');

  // Check for key class definition
  if (scraperCode.includes('class DuvalCountyFloridaScraper')) {
    console.log('✅ Class definition found\n');
  } else {
    console.error('❌ Class definition not found\n');
    process.exit(1);
  }

  // Check for required methods
  const requiredMethods = [
    'getPriorDeed',
    'searchAssessorSite',
    'extractTransactionRecords',
    'downloadDeed',
    'getDeedRecorderUrl',
    'getAssessorUrl'
  ];

  console.log('📋 Test 3: Required methods');
  for (const method of requiredMethods) {
    if (scraperCode.includes(method)) {
      console.log(`✅ Method "${method}" found`);
    } else {
      console.error(`❌ Method "${method}" not found`);
      process.exit(1);
    }
  }
  console.log('');

  // Check for proper URLs
  console.log('📋 Test 4: URL configuration');
  const urls = [
    { name: 'Property Appraiser', url: 'paopropertysearch.coj.net' },
    { name: 'Clerk of Courts', url: 'or.duvalclerk.com' }
  ];

  for (const { name, url } of urls) {
    if (scraperCode.includes(url)) {
      console.log(`✅ ${name} URL (${url}) found`);
    } else {
      console.error(`❌ ${name} URL (${url}) not found`);
      process.exit(1);
    }
  }
  console.log('');

  // Check for county and state configuration
  console.log('📋 Test 5: County/State configuration');
  if (scraperCode.includes("this.county = 'Duval'")) {
    console.log("✅ County set to 'Duval'");
  } else {
    console.error("❌ County not set to 'Duval'");
    process.exit(1);
  }

  if (scraperCode.includes("this.state = 'FL'")) {
    console.log("✅ State set to 'FL'");
  } else {
    console.error("❌ State not set to 'FL'");
    process.exit(1);
  }
  console.log('');

  // Check for module.exports
  console.log('📋 Test 6: Module exports');
  if (scraperCode.includes('module.exports = DuvalCountyFloridaScraper')) {
    console.log('✅ Module properly exported\n');
  } else {
    console.error('❌ Module not properly exported\n');
    process.exit(1);
  }

  // Check for stealth plugin usage
  console.log('📋 Test 7: Stealth plugin configuration');
  if (scraperCode.includes('puppeteer-extra') && scraperCode.includes('StealthPlugin')) {
    console.log('✅ Stealth plugin configured\n');
  } else {
    console.error('❌ Stealth plugin not configured\n');
    process.exit(1);
  }

  // Check for proper inheritance
  console.log('📋 Test 8: Class inheritance');
  if (scraperCode.includes('extends DeedScraper')) {
    console.log('✅ Properly extends DeedScraper\n');
  } else {
    console.error('❌ Does not extend DeedScraper\n');
    process.exit(1);
  }

  console.log('✅ All structure validation tests passed!\n');

} catch (error) {
  console.error('❌ Error reading or parsing file:', error.message);
  process.exit(1);
}

// Test 9: Check api-server.js integration
console.log('📋 Test 9: API server integration');
const apiServerPath = path.join(__dirname, 'api-server.js');
if (fs.existsSync(apiServerPath)) {
  const apiServerCode = fs.readFileSync(apiServerPath, 'utf8');

  if (apiServerCode.includes('duval-county-florida')) {
    console.log('✅ Duval County import found in api-server.js');
  } else {
    console.error('❌ Duval County import not found in api-server.js');
    process.exit(1);
  }

  if (apiServerCode.includes('DuvalCountyFloridaScraper')) {
    console.log('✅ DuvalCountyFloridaScraper class referenced in api-server.js');
  } else {
    console.error('❌ DuvalCountyFloridaScraper class not referenced in api-server.js');
    process.exit(1);
  }

  if (apiServerCode.includes("detectedCounty === 'Duval'")) {
    console.log('✅ Duval County routing logic found');
  } else {
    console.error('❌ Duval County routing logic not found');
    process.exit(1);
  }

  if (apiServerCode.includes('Duval County')) {
    console.log('✅ Duval County listed in supported counties');
  } else {
    console.error('❌ Duval County not listed in supported counties');
    process.exit(1);
  }

  console.log('');
} else {
  console.error('❌ api-server.js not found');
  process.exit(1);
}

// Summary
console.log('='.repeat(80));
console.log('🎉 SUCCESS: Duval County implementation structure is valid!');
console.log('='.repeat(80));
console.log('');
console.log('✅ File structure: PASS');
console.log('✅ Class definition: PASS');
console.log('✅ Required methods: PASS');
console.log('✅ URL configuration: PASS');
console.log('✅ County/State config: PASS');
console.log('✅ Module exports: PASS');
console.log('✅ Stealth plugin: PASS');
console.log('✅ Class inheritance: PASS');
console.log('✅ API integration: PASS');
console.log('');
console.log('📝 Note: This test validates code structure only.');
console.log('   Full browser testing requires dependencies to be installed.');
console.log('   Run "npm install" and then "node test-duval.js" for full testing.');
console.log('');

process.exit(0);
