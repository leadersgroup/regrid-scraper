/**
 * Georgia Attorney Scraper - Test Version
 * Collects 20 attorneys to verify functionality before full run
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());
require('dotenv').config();

const CONFIG = {
  TARGET_COUNT: 20, // Test with 20 attorneys
  ATTIO_API_KEY: process.env.ATTIO_API_KEY || '',
  OUTPUT_DIR: './attorney-data'
};

// Ensure output directory exists
if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
  fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
}

async function testAttioConnection() {
  console.log('🔍 Testing Attio connection...');

  if (!CONFIG.ATTIO_API_KEY) {
    console.error('❌ ATTIO_API_KEY not set');
    return false;
  }

  try {
    const response = await axios.get('https://api.attio.com/v2/self', {
      headers: {
        'Authorization': `Bearer ${CONFIG.ATTIO_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const selfData = response.data.data || response.data;
    console.log('✓ Attio API connection successful');
    console.log(`  Workspace: ${selfData?.workspace?.name || 'N/A'}`);
    console.log(`  Workspace ID: ${selfData?.workspace_id || selfData?.workspace?.id || 'N/A'}`);
    return true;
  } catch (error) {
    console.error('❌ Attio connection failed:', error.response?.data || error.message);
    return false;
  }
}

async function searchAvvoAtlanta() {
  console.log('\n🔍 Testing Avvo search for Atlanta...');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for testing
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const attorneys = [];

  try {
    const url = 'https://www.avvo.com/estate-planning-lawyer/atlanta_ga.html';
    console.log(`  URL: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    const screenshotPath = path.join(CONFIG.OUTPUT_DIR, 'test-avvo-atlanta.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);

    // Extract data
    const extractedData = await page.evaluate(() => {
      const results = [];

      // Try multiple selector patterns
      const selectors = [
        '.lawyer-profile',
        '.v2-lawyer-card',
        '[data-testid="lawyer-card"]',
        '.search-result-lawyer',
        '.lawyer-listing'
      ];

      let listings = [];
      for (const selector of selectors) {
        listings = document.querySelectorAll(selector);
        if (listings.length > 0) {
          console.log(`Found ${listings.length} listings with selector: ${selector}`);
          break;
        }
      }

      // If no specific listings found, try to find any links to attorney profiles
      if (listings.length === 0) {
        console.log('No listings found, trying alternative approach...');
        const links = document.querySelectorAll('a[href*="/attorneys/"]');
        console.log(`Found ${links.length} attorney profile links`);

        links.forEach((link, index) => {
          if (index >= 20) return;

          const parentElement = link.closest('div, li, article');
          if (!parentElement) return;

          const name = link.textContent?.trim() ||
                      parentElement.querySelector('.name, h3, h2')?.textContent?.trim();
          const firm = parentElement.querySelector('.firm, .firm-name, .practice-name')?.textContent?.trim();
          const phone = parentElement.querySelector('.phone, [class*="phone"]')?.textContent?.trim();
          const location = parentElement.querySelector('.location, .address, [class*="location"]')?.textContent?.trim();

          if (name) {
            results.push({
              name,
              firm: firm || 'Solo Practitioner',
              phone: phone || '',
              location: location || 'Atlanta, GA',
              website: link.href,
              source: 'Avvo'
            });
          }
        });
      } else {
        listings.forEach((listing, index) => {
          if (index >= 20) return;

          try {
            const nameElement = listing.querySelector('.lawyer-name, .name, h3 a, h2 a, [data-testid="lawyer-name"], a[href*="/attorneys/"]');
            const name = nameElement?.textContent?.trim();
            const profileLink = nameElement?.href || listing.querySelector('a')?.href;

            const firm = listing.querySelector('.firm-name, .practice-name, .firm, [data-testid="firm-name"]')?.textContent?.trim();
            const phone = listing.querySelector('.phone, .contact-phone, [data-testid="phone"], [class*="phone"]')?.textContent?.trim();
            const location = listing.querySelector('.address, .location, [data-testid="location"], [class*="location"]')?.textContent?.trim();

            if (name) {
              results.push({
                name,
                firm: firm || 'Solo Practitioner',
                phone: phone || '',
                location: location || 'Atlanta, GA',
                website: profileLink || '',
                source: 'Avvo'
              });
            }
          } catch (e) {
            console.log('Error extracting listing:', e.message);
          }
        });
      }

      return results;
    });

    console.log(`  ✓ Extracted ${extractedData.length} attorneys`);

    if (extractedData.length > 0) {
      console.log('\n  Sample data:');
      extractedData.slice(0, 3).forEach((a, i) => {
        console.log(`    ${i + 1}. ${a.name} - ${a.firm}`);
        console.log(`       Phone: ${a.phone || 'N/A'}`);
        console.log(`       Location: ${a.location || 'N/A'}`);
      });
    }

    attorneys.push(...extractedData);

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }

  return attorneys;
}

async function searchJustiaAtlanta() {
  console.log('\n🔍 Testing Justia search for Atlanta...');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const attorneys = [];

  try {
    const url = 'https://www.justia.com/lawyers/estate-planning/georgia/atlanta';
    console.log(`  URL: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot
    const screenshotPath = path.join(CONFIG.OUTPUT_DIR, 'test-justia-atlanta.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  📸 Screenshot saved: ${screenshotPath}`);

    // Extract data
    const extractedData = await page.evaluate(() => {
      const results = [];
      const selectors = [
        '.lawyer-profile',
        '.directory-profile',
        '.search-result',
        '.listing',
        'article'
      ];

      let listings = [];
      for (const selector of selectors) {
        listings = document.querySelectorAll(selector);
        if (listings.length > 0) break;
      }

      listings.forEach((listing, index) => {
        if (index >= 20) return;

        try {
          const nameElement = listing.querySelector('.profile-name, h3 a, h2 a, .lawyer-name a, a[href*="/attorney/"]');
          const name = nameElement?.textContent?.trim();
          const profileUrl = nameElement?.href;

          const firm = listing.querySelector('.firm-name, .practice-area, .firm')?.textContent?.trim();
          const location = listing.querySelector('.location, .address, [class*="location"]')?.textContent?.trim();
          const phone = listing.querySelector('.phone, .contact-phone, [class*="phone"]')?.textContent?.trim();

          if (name) {
            results.push({
              name,
              firm: firm || 'Solo Practitioner',
              phone: phone || '',
              location: location || 'Atlanta, GA',
              website: profileUrl || '',
              source: 'Justia'
            });
          }
        } catch (e) {
          // Skip
        }
      });

      return results;
    });

    console.log(`  ✓ Extracted ${extractedData.length} attorneys`);

    if (extractedData.length > 0) {
      console.log('\n  Sample data:');
      extractedData.slice(0, 3).forEach((a, i) => {
        console.log(`    ${i + 1}. ${a.name} - ${a.firm}`);
      });
    }

    attorneys.push(...extractedData);

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }

  return attorneys;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Georgia Attorney Scraper - TEST MODE');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log();
  console.log('This test will:');
  console.log('  1. Verify Attio API connection');
  console.log('  2. Test Avvo scraping for Atlanta');
  console.log('  3. Test Justia scraping for Atlanta');
  console.log('  4. Show sample data collected');
  console.log();

  // Test 1: Attio connection
  const attioOk = await testAttioConnection();
  if (!attioOk) {
    console.error('\n❌ Attio connection test failed. Please check your API key.');
    process.exit(1);
  }

  // Test 2: Avvo scraping
  const avvoAttorneys = await searchAvvoAtlanta();

  // Test 3: Justia scraping
  const justiaAttorneys = await searchJustiaAtlanta();

  // Combine and deduplicate
  const allAttorneys = [...avvoAttorneys, ...justiaAttorneys];
  const seen = new Set();
  const uniqueAttorneys = allAttorneys.filter(a => {
    const key = `${a.name.toLowerCase()}_${a.firm.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`\nTotal collected: ${uniqueAttorneys.length} unique attorneys`);
  console.log(`  - Avvo: ${avvoAttorneys.length}`);
  console.log(`  - Justia: ${justiaAttorneys.length}`);
  console.log(`  - Duplicates removed: ${allAttorneys.length - uniqueAttorneys.length}`);

  // Save test data
  const testDataPath = path.join(CONFIG.OUTPUT_DIR, 'georgia-test-attorneys.json');
  fs.writeFileSync(testDataPath, JSON.stringify(uniqueAttorneys, null, 2));
  console.log(`\n💾 Test data saved: ${testDataPath}`);

  // Data quality
  const withEmail = uniqueAttorneys.filter(a => a.email).length;
  const withPhone = uniqueAttorneys.filter(a => a.phone).length;
  const withWebsite = uniqueAttorneys.filter(a => a.website).length;

  console.log(`\n📊 Data Quality:`);
  console.log(`  - With email: ${withEmail} (${((withEmail/uniqueAttorneys.length)*100).toFixed(1)}%)`);
  console.log(`  - With phone: ${withPhone} (${((withPhone/uniqueAttorneys.length)*100).toFixed(1)}%)`);
  console.log(`  - With website: ${withWebsite} (${((withWebsite/uniqueAttorneys.length)*100).toFixed(1)}%)`);

  if (uniqueAttorneys.length >= 10) {
    console.log('\n✅ TEST PASSED - Scraping is working!');
    console.log('\nYou can now run the full collection:');
    console.log('  node georgia-attorney-scraper.js');
  } else {
    console.log('\n⚠️  WARNING - Low attorney count. Check screenshots for issues.');
    console.log('Screenshots saved in: ./attorney-data/');
  }

  console.log('\n═══════════════════════════════════════════════════════════════════');
}

main().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
