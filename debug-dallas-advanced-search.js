const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugAdvancedSearch() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Dallas County Clerk...');
    await page.goto('https://dallas.tx.publicsearch.us/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Close popup
    try {
      const closeButton = await page.$('button[aria-label="Close"]');
      if (closeButton) {
        console.log('Closing popup...');
        await closeButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log('No popup to close');
    }

    // Look for advanced search
    console.log('\n=== Looking for Advanced Search ===');
    const advancedSearchInfo = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div'));
      const advanced = allElements.filter(el => {
        const text = el.textContent.toLowerCase();
        return text.includes('advanced');
      });

      return {
        total: advanced.length,
        elements: advanced.map(el => ({
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 100),
          className: el.className,
          id: el.id
        }))
      };
    });

    console.log('Advanced search elements found:', advancedSearchInfo.total);
    console.log(JSON.stringify(advancedSearchInfo.elements, null, 2));

    // Try to click advanced search
    const clicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const advLink = links.find(link => {
        const text = link.textContent.toLowerCase();
        return text.includes('advanced') && text.includes('search');
      });
      if (advLink) {
        console.log('Found advanced search link:', advLink.textContent);
        advLink.click();
        return true;
      }
      return false;
    });

    console.log('\nAdvanced search clicked:', clicked);

    if (clicked) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Look for book and page fields
      console.log('\n=== Looking for Book/Page fields ===');
      const fieldsInfo = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        return inputs.map((input, idx) => ({
          index: idx,
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          label: input.labels?.[0]?.textContent?.trim() || '',
          className: input.className
        }));
      });

      console.log('Input fields:', JSON.stringify(fieldsInfo, null, 2));

      // Try to fill book and page
      console.log('\n=== Filling book and page ===');
      const bookNum = '99081';
      const pageNum = '0972';

      const filled = await page.evaluate((book, page) => {
        const inputs = Array.from(document.querySelectorAll('input'));

        // Find book field
        const bookInput = inputs.find(input => {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = (input.placeholder || '').toLowerCase();
          const name = (input.name || '').toLowerCase();
          return label.includes('book') || label.includes('volume') ||
                 placeholder.includes('book') || placeholder.includes('volume') ||
                 name.includes('book') || name.includes('vol');
        });

        // Find page field
        const pageInput = inputs.find(input => {
          const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
          const placeholder = (input.placeholder || '').toLowerCase();
          const name = (input.name || '').toLowerCase();
          return label.includes('page') || placeholder.includes('page') ||
                 name.includes('page');
        });

        const result = {
          bookField: bookInput ? {
            id: bookInput.id,
            name: bookInput.name,
            label: bookInput.labels?.[0]?.textContent
          } : null,
          pageField: pageInput ? {
            id: pageInput.id,
            name: pageInput.name,
            label: pageInput.labels?.[0]?.textContent
          } : null
        };

        if (bookInput) {
          bookInput.value = book;
          bookInput.dispatchEvent(new Event('input', { bubbles: true }));
          bookInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        if (pageInput) {
          pageInput.value = page;
          pageInput.dispatchEvent(new Event('input', { bubbles: true }));
          pageInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return result;
      }, bookNum, pageNum);

      console.log('Fields filled:', JSON.stringify(filled, null, 2));

      await page.screenshot({ path: '/tmp/dallas-advanced-search-filled.png', fullPage: true });
      console.log('\nScreenshot saved: /tmp/dallas-advanced-search-filled.png');

      // Click search button
      console.log('\n=== Clicking search button ===');
      const searchClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const searchBtn = buttons.find(btn => {
          const text = btn.textContent.toLowerCase();
          return text.includes('search') && !text.includes('clear') && !text.includes('advanced');
        });
        if (searchBtn) {
          console.log('Found search button:', searchBtn.textContent);
          searchBtn.click();
          return true;
        }
        return false;
      });

      console.log('Search button clicked:', searchClicked);

      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check results
      const results = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return {
          url: window.location.href,
          rowCount: rows.length,
          firstRowText: rows[0]?.textContent?.substring(0, 200) || 'No rows'
        };
      });

      console.log('\n=== Search Results ===');
      console.log('URL:', results.url);
      console.log('Rows found:', results.rowCount);
      console.log('First row:', results.firstRowText);

      await page.screenshot({ path: '/tmp/dallas-advanced-search-results.png', fullPage: true });
      console.log('\nScreenshot saved: /tmp/dallas-advanced-search-results.png');
    }

    console.log('\nWaiting 30 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugAdvancedSearch().catch(console.error);
