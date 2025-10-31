/**
 * Debug test to see what's on the Regrid page
 */

const DeedScraper = require('./deed-scraper');

async function debugTest() {
  const address = '12729 Hawkstone Drive, Windermere, FL 34786';

  console.log(`Debugging Regrid scraper with: ${address}\n`);

  const scraper = new DeedScraper({
    headless: true, // Headless mode for faster debugging
    timeout: 60000,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Navigate to Regrid
    const cleanAddress = address.replace(/[,.]/g, '').trim();
    await scraper.page.goto('https://app.regrid.com/us', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find and use search input
    const searchInput = 'input[placeholder*="Search"]';
    await scraper.page.waitForSelector(searchInput, { timeout: 5000 });
    await scraper.page.click(searchInput);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Type address
    for (const char of cleanAddress) {
      await scraper.page.keyboard.type(char);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for results
    console.log('\nWaiting for results...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to click on first result
    console.log('\nTrying to click on search result...');
    try {
      const resultSelectors = [
        '.search-result:first-child',
        '[class*="result"]:first-child',
        '[class*="SearchResult"]:first-child'
      ];

      for (const selector of resultSelectors) {
        const element = await scraper.page.$(selector);
        if (element) {
          await element.click();
          console.log(`Clicked on: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          break;
        }
      }
    } catch (e) {
      console.log('Could not click:', e.message);
    }

    // Extract and show page content
    const pageData = await scraper.page.evaluate(() => {
      return {
        bodyText: document.body.innerText,
        html: document.body.innerHTML.substring(0, 5000)
      };
    });

    console.log('\n' + '='.repeat(80));
    console.log('PAGE TEXT CONTENT (first 3000 chars):');
    console.log('='.repeat(80));
    console.log(pageData.bodyText.substring(0, 3000));

    console.log('\n' + '='.repeat(80));
    console.log('Debug complete');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await scraper.close();
  }
}

debugTest();
