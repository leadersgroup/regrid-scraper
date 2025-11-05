/**
 * Debug script to see what's on the Palm Beach page for 100 Sunrise Ave
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('Navigating to Palm Beach Property Appraiser...');
    await page.goto('https://pbcpao.gov/index.htm', { waitUntil: 'networkidle2' });
    await wait(3000);

    // Try WITHOUT unit number first
    const address = '100 Sunrise Ave';
    console.log(`\nSearching for: ${address} (without unit number)`);

    await page.waitForSelector('input[type="text"], input[type="search"]', { timeout: 10000 });
    const inputs = await page.$$('input[type="text"], input[type="search"]');

    for (const input of inputs) {
      try {
        await input.type(address, { delay: 100 });
        console.log('✅ Entered address');
        break;
      } catch (e) {
        // Try next input
      }
    }

    await wait(2000);
    await page.keyboard.press('Enter');
    await wait(5000);

    console.log('\nCurrent URL:', page.url());

    // Look for Sales Information
    const salesData = await page.evaluate(() => {
      const results = {
        foundSalesSection: false,
        allLinks: [],
        orBookPageLinks: []
      };

      // Find Sales Information section
      const allElements = Array.from(document.querySelectorAll('*'));
      for (const el of allElements) {
        const text = el.textContent || '';
        if (text.includes('Sales Information') || text.includes('SALES INFORMATION')) {
          results.foundSalesSection = true;
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }

      // Get ALL links and their text
      const allLinks = Array.from(document.querySelectorAll('a'));
      results.allLinks = allLinks.map(link => ({
        text: (link.textContent || '').trim(),
        href: link.href || ''
      })).filter(l => l.text.length > 0 && l.text.length < 100);

      // Look for OR Book/Page patterns
      for (const link of allLinks) {
        const text = (link.textContent || '').trim();
        // Try multiple patterns
        if (/\d{4,6}\s*\/\s*\d{3,6}/.test(text)) {
          results.orBookPageLinks.push({
            text: text,
            href: link.href || ''
          });
        }
      }

      return results;
    });

    console.log('\n=== SALES SECTION ===');
    console.log('Found Sales Information section:', salesData.foundSalesSection);

    console.log('\n=== OR BOOK/PAGE LINKS ===');
    console.log('Found', salesData.orBookPageLinks.length, 'OR Book/Page links:');
    salesData.orBookPageLinks.forEach((link, idx) => {
      console.log(`  ${idx + 1}. "${link.text}" -> ${link.href}`);
    });

    console.log('\n=== ALL LINKS (sample) ===');
    console.log('Showing first 50 links:');
    salesData.allLinks.slice(0, 50).forEach((link, idx) => {
      console.log(`  ${idx + 1}. "${link.text.substring(0, 60)}"`);
    });

    console.log('\n\nBrowser will stay open for inspection. Press Ctrl+C to close.');
    await wait(300000); // Keep open for 5 minutes

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await browser.close();
  }
}

debug();
