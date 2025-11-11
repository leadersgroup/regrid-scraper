/**
 * Debug Mecklenburg County Search
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Mecklenburg County Property Search...');
    await page.goto('https://polaris3g.mecklenburgcountync.gov/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find the search input
    console.log('📝 Looking for search input...');
    const inputInfo = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(input => ({
        type: input.type,
        placeholder: input.placeholder,
        name: input.name,
        id: input.id,
        visible: input.offsetParent !== null
      }));
    });

    console.log('Available inputs:', JSON.stringify(inputInfo, null, 2));

    // Try to find address search input
    const searchInput = await page.$('input[placeholder*="address"], input[placeholder*="Address"], input[type="text"]');

    if (searchInput) {
      console.log('✅ Found search input');

      // Click and type
      await searchInput.click();
      await searchInput.type('17209 island view', { delay: 100 });

      console.log('⏳ Waiting for autocomplete...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for autocomplete
      const autocompleteInfo = await page.evaluate(() => {
        // Look for various autocomplete patterns
        const selectors = [
          '.pac-item',
          '.autocomplete-item',
          '.suggestion-item',
          '[role="option"]',
          '.ui-menu-item',
          'li[data-value]',
          'div[data-value]'
        ];

        const results = {};
        for (const selector of selectors) {
          const items = Array.from(document.querySelectorAll(selector));
          if (items.length > 0) {
            results[selector] = items.map(item => ({
              text: item.textContent.trim(),
              visible: item.offsetParent !== null
            }));
          }
        }

        // Also check for any recently created elements
        const allElements = Array.from(document.querySelectorAll('*'));
        const recentElements = allElements
          .filter(el => {
            const text = el.textContent;
            return text && text.includes('17209') && el.offsetParent !== null;
          })
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.textContent.trim().substring(0, 100)
          }));

        return {
          foundSelectors: results,
          elementsWithAddress: recentElements
        };
      });

      console.log('\n=== AUTOCOMPLETE INFO ===');
      console.log(JSON.stringify(autocompleteInfo, null, 2));

      console.log('\n\n⏳ Waiting 30 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 30000));

    } else {
      console.log('❌ Could not find search input');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
