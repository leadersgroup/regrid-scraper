/**
 * Scrape Real California Estate Planning Attorneys from Justia
 *
 * Justia provides a public directory of attorneys with verified information.
 * This script ethically scrapes attorney profiles for estate planning lawyers in California.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// California cities to search
const CALIFORNIA_CITIES = [
  'Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento',
  'Oakland', 'Fresno', 'Santa Ana', 'Irvine', 'Anaheim',
  'Riverside', 'Stockton', 'Bakersfield', 'Glendale', 'Huntington Beach'
];

class JustiaAttorneyScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.attorneys = [];
    this.visitedUrls = new Set();
  }

  async init() {
    console.log('🚀 Launching browser...');
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
  }

  async searchCity(city, limit = 5) {
    console.log(`\n📍 Searching ${city}, California...`);

    // Justia URL format for estate planning attorneys
    const searchUrl = `https://www.justia.com/lawyers/estate-planning/california/${city.toLowerCase().replace(/\s+/g, '-')}`;

    try {
      console.log(`   Navigating to: ${searchUrl}`);
      await this.page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for attorney listings to load
      await this.page.waitForSelector('.lawyer-list-item, .attorney-result', {
        timeout: 10000
      }).catch(() => {
        console.log('   ⚠️  No attorney listings found for this city');
        return [];
      });

      // Extract attorney profile links
      const attorneyLinks = await this.page.evaluate(() => {
        const links = [];
        const items = document.querySelectorAll('.lawyer-list-item a, .attorney-result a');

        items.forEach(item => {
          const href = item.href;
          if (href && href.includes('/attorney/') && !href.includes('#')) {
            links.push(href);
          }
        });

        // Remove duplicates
        return [...new Set(links)];
      });

      console.log(`   Found ${attorneyLinks.length} attorney profiles`);

      // Visit each attorney profile and extract details
      const cityAttorneys = [];
      for (let i = 0; i < Math.min(attorneyLinks.length, limit); i++) {
        const link = attorneyLinks[i];

        // Skip if already visited
        if (this.visitedUrls.has(link)) {
          console.log(`   ⏭️  Skipping duplicate: ${link}`);
          continue;
        }

        this.visitedUrls.add(link);

        try {
          const attorney = await this.scrapeAttorneyProfile(link, city);
          if (attorney) {
            cityAttorneys.push(attorney);
            console.log(`   ✓ [${i + 1}/${limit}] ${attorney.name}`);
          }

          // Rate limiting - be respectful
          await this.sleep(2000);

        } catch (error) {
          console.log(`   ✗ Error scraping ${link}: ${error.message}`);
        }
      }

      return cityAttorneys;

    } catch (error) {
      console.log(`   ✗ Error searching ${city}: ${error.message}`);
      return [];
    }
  }

  async scrapeAttorneyProfile(url, city) {
    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Extract attorney information
      const attorney = await this.page.evaluate((cityName) => {
        const data = {
          name: '',
          firm: '',
          location: cityName + ', CA',
          phone: '',
          email: '',
          website: '',
          practice_areas: [],
          profile_url: window.location.href
        };

        // Extract name
        const nameEl = document.querySelector('h1.attorney-name, h1[itemprop="name"]');
        if (nameEl) data.name = nameEl.textContent.trim();

        // Extract firm
        const firmEl = document.querySelector('.firm-name, [itemprop="affiliation"]');
        if (firmEl) data.firm = firmEl.textContent.trim();

        // Extract phone
        const phoneEl = document.querySelector('[itemprop="telephone"], .phone-number, a[href^="tel:"]');
        if (phoneEl) {
          data.phone = phoneEl.textContent.trim() || phoneEl.getAttribute('href')?.replace('tel:', '');
        }

        // Extract email
        const emailEl = document.querySelector('[itemprop="email"], a[href^="mailto:"]');
        if (emailEl) {
          data.email = emailEl.textContent.trim() || emailEl.getAttribute('href')?.replace('mailto:', '');
        }

        // Extract website
        const websiteEl = document.querySelector('[itemprop="url"], .website-link');
        if (websiteEl) data.website = websiteEl.href || websiteEl.textContent.trim();

        // Extract practice areas
        const practiceEls = document.querySelectorAll('.practice-area, [itemprop="knowsAbout"]');
        practiceEls.forEach(el => {
          const area = el.textContent.trim();
          if (area && !data.practice_areas.includes(area)) {
            data.practice_areas.push(area);
          }
        });

        // Ensure we have estate planning
        if (data.practice_areas.length === 0) {
          data.practice_areas.push('Estate Planning');
        }

        return data;
      }, city);

      // Validate we have minimum required data
      if (!attorney.name || attorney.name.length < 3) {
        return null;
      }

      return attorney;

    } catch (error) {
      throw new Error(`Failed to scrape profile: ${error.message}`);
    }
  }

  async collectAttorneys(targetCount = 50) {
    console.log('\n═'.repeat(70));
    console.log('  Justia Attorney Scraper - California Estate Planning');
    console.log('═'.repeat(70));
    console.log(`\n🎯 Target: ${targetCount} attorneys\n`);

    await this.init();

    const attorneys = [];
    let cityIndex = 0;

    while (attorneys.length < targetCount && cityIndex < CALIFORNIA_CITIES.length) {
      const city = CALIFORNIA_CITIES[cityIndex];
      const needed = targetCount - attorneys.length;
      const perCity = Math.min(5, needed);

      const cityAttorneys = await this.searchCity(city, perCity);
      attorneys.push(...cityAttorneys);

      console.log(`   Progress: ${attorneys.length}/${targetCount} attorneys collected`);

      cityIndex++;

      // Rate limiting between cities
      if (cityIndex < CALIFORNIA_CITIES.length && attorneys.length < targetCount) {
        console.log('   Waiting 3 seconds before next city...');
        await this.sleep(3000);
      }
    }

    await this.close();

    return attorneys.slice(0, targetCount);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('\n✓ Browser closed');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  saveToFile(attorneys, filename = 'california-attorneys-real.json') {
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, JSON.stringify(attorneys, null, 2));
    console.log(`\n💾 Saved ${attorneys.length} attorneys to: ${filepath}`);
    return filepath;
  }
}

async function main() {
  const targetCount = 50;
  const scraper = new JustiaAttorneyScraper();

  try {
    const attorneys = await scraper.collectAttorneys(targetCount);

    console.log('\n═'.repeat(70));
    console.log('  COLLECTION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`✓ Total attorneys collected: ${attorneys.length}`);
    console.log(`✓ Target: ${targetCount}`);
    console.log(`✓ Success rate: ${((attorneys.length / targetCount) * 100).toFixed(1)}%`);

    // Save to file
    const filepath = scraper.saveToFile(attorneys);

    console.log('\n📊 Data Quality:');
    const withEmail = attorneys.filter(a => a.email).length;
    const withPhone = attorneys.filter(a => a.phone).length;
    const withWebsite = attorneys.filter(a => a.website).length;

    console.log(`  - With email: ${withEmail} (${((withEmail / attorneys.length) * 100).toFixed(1)}%)`);
    console.log(`  - With phone: ${withPhone} (${((withPhone / attorneys.length) * 100).toFixed(1)}%)`);
    console.log(`  - With website: ${withWebsite} (${((withWebsite / attorneys.length) * 100).toFixed(1)}%)`);

    console.log('\n💡 Next steps:');
    console.log('  1. Review the collected data in:', filepath);
    console.log('  2. Run the upload script to add to Attio:');
    console.log(`     node upload-real-attorneys-to-attio.js ${filepath}`);
    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = JustiaAttorneyScraper;
