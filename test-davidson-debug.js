/**
 * Debug script for Davidson County TN scraper
 * Tests the property search and captures screenshots/HTML for analysis
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function debugDavidsonSearch() {
  console.log('🔍 Davidson County Debug Test');
  console.log('================================\n');

  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false, // Show browser for debugging
    verbose: true
  });

  try {
    // Initialize browser
    await scraper.initialize();
    console.log('✅ Browser initialized\n');

    // Navigate to the property search page
    const targetUrl = 'https://portal.padctn.org/OFS/WP/Home';
    console.log(`🌐 Navigating to: ${targetUrl}`);

    await scraper.page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot of initial page
    await scraper.page.screenshot({
      path: '/tmp/davidson-1-initial.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved: /tmp/davidson-1-initial.png\n');

    // Try the simple search approach instead
    console.log('🔍 Looking for search input field...');

    const searchInput = await scraper.page.$('input[type="text"]');
    if (searchInput) {
      console.log('✅ Found search input\n');

      // Type the full address
      const address = '6241 Del Sol Dr, Whites Creek, TN 37189';
      console.log(`⌨️  Typing address: ${address}`);
      await searchInput.type(address, { delay: 100 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Take screenshot after typing
      await scraper.page.screenshot({
        path: '/tmp/davidson-2-typed.png',
        fullPage: true
      });
      console.log('📸 Screenshot saved: /tmp/davidson-2-typed.png\n');

      // Press Enter or click search
      console.log('⏎ Pressing Enter...');
      await scraper.page.keyboard.press('Enter');

      // Wait for results
      console.log('⏳ Waiting for results...');
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Take screenshot of results
      await scraper.page.screenshot({
        path: '/tmp/davidson-3-results.png',
        fullPage: true
      });
      console.log('📸 Screenshot saved: /tmp/davidson-3-results.png\n');

      // Extract and log the HTML of the results area
      const resultsHTML = await scraper.page.evaluate(() => {
        // Try to find results table or grid
        const tables = Array.from(document.querySelectorAll('table'));
        if (tables.length > 0) {
          return tables.map((t, i) => ({
            index: i,
            html: t.outerHTML.substring(0, 2000),
            text: t.innerText.substring(0, 1000)
          }));
        }

        // Also check for any grid/results divs
        const grids = Array.from(document.querySelectorAll('[class*="grid"], [class*="result"]'));
        if (grids.length > 0) {
          return grids.map((g, i) => ({
            index: i,
            className: g.className,
            html: g.outerHTML.substring(0, 2000),
            text: g.innerText.substring(0, 1000)
          }));
        }

        return { message: 'No tables or grids found' };
      });

      console.log('📋 Results HTML/Structure:');
      console.log(JSON.stringify(resultsHTML, null, 2));
      console.log('\n');

      // Try to find all links in results
      const links = await scraper.page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll('a'));
        return allLinks
          .filter(a => {
            const text = a.innerText?.trim() || '';
            const href = a.getAttribute('href') || '';
            // Filter out obvious navigation links
            return text.length > 0 &&
                   text.length < 100 &&
                   !text.toLowerCase().includes('home') &&
                   !text.toLowerCase().includes('help') &&
                   !text.toLowerCase().includes('logout');
          })
          .map(a => ({
            text: a.innerText?.trim(),
            href: a.getAttribute('href'),
            onclick: a.getAttribute('onclick')
          }));
      });

      console.log('🔗 All relevant links found:');
      console.log(JSON.stringify(links, null, 2));
      console.log('\n');

      // Keep browser open for manual inspection
      console.log('⏸️  Browser will remain open for 60 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 60000));

    } else {
      console.log('❌ Could not find search input field');

      // Log all input fields
      const inputs = await scraper.page.evaluate(() => {
        return Array.from(document.querySelectorAll('input')).map(i => ({
          type: i.type,
          name: i.name,
          id: i.id,
          placeholder: i.placeholder,
          className: i.className
        }));
      });

      console.log('All input fields on page:');
      console.log(JSON.stringify(inputs, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
      console.log('🔒 Browser closed');
    }
  }
}

// Run the debug test
debugDavidsonSearch().catch(console.error);
