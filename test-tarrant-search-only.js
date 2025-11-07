const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing Tarrant County TAD Search Only\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('📍 Loading TAD website...');
    await page.goto('https://www.tad.org/index', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📝 Looking for Property Search dropdown...');

    // Try to find and set the dropdown
    const dropdownResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));

      // Find "Property Search" text
      for (const element of allElements) {
        const text = element.textContent?.trim() || '';
        if (text === 'Property Search' || text.toLowerCase().includes('property search')) {
          console.log('Found "Property Search" text in', element.tagName);

          // Look for select in parent container
          const parent = element.closest('div, form, section');
          if (parent) {
            const select = parent.querySelector('select');
            if (select) {
              console.log('Found select with options:', Array.from(select.options).map(o => o.textContent));

              // Look for "Property Address" option
              const options = Array.from(select.options);
              for (const option of options) {
                const optionText = option.textContent.toLowerCase();
                console.log('Option:', optionText);
                if (optionText.includes('property address')) {
                  console.log('Setting to Property Address');
                  select.value = option.value;
                  select.dispatchEvent(new Event('change', { bubbles: true }));
                  return { success: true, selectedValue: option.value, selectedText: option.textContent };
                }
              }
            }
          }
        }
      }

      return { success: false };
    });

    console.log('Dropdown result:', JSON.stringify(dropdownResult, null, 2));

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🔍 Looking for search input...');

    // Find search input
    const searchInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input:not([type])'));
      for (const input of inputs) {
        const placeholder = input.placeholder?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const name = input.name?.toLowerCase() || '';

        if (placeholder.includes('search') || placeholder.includes('address') ||
            id.includes('search') || id.includes('address') ||
            name.includes('search') || name.includes('address')) {
          return {
            selector: input.id ? `#${input.id}` : `input[name="${input.name}"]`,
            placeholder: input.placeholder,
            id: input.id,
            name: input.name
          };
        }
      }
      return null;
    });

    console.log('Search input:', JSON.stringify(searchInput, null, 2));

    if (searchInput && searchInput.selector) {
      console.log('✏️ Entering address...');
      const address = '1009 WICKWOOD Ct. FORT WORTH, TX 76131';
      const addressParts = address.replace(/, TX.*/, ''); // Remove city/state

      await page.evaluate((selector) => {
        const input = document.querySelector(selector);
        if (input) {
          input.value = '';
          input.focus();
        }
      }, searchInput.selector);

      await new Promise(resolve => setTimeout(resolve, 500));
      await page.type(searchInput.selector, addressParts, { delay: 50 });

      console.log(`Entered: ${addressParts}`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log('🔍 Looking for submit button...');

      const submitResult = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"], a'));
        for (const button of buttons) {
          const text = (button.textContent || button.value || button.innerText || '').toLowerCase();
          if (text.includes('search') || text.includes('find') || text.includes('go')) {
            console.log('Found button:', text);
            button.click();
            return { clicked: true, buttonText: text };
          }
        }

        // Try form submit
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
          const formText = form.innerText.toLowerCase();
          if (formText.includes('property') || formText.includes('search')) {
            console.log('Found form, submitting');
            form.submit();
            return { clicked: true, buttonText: 'form.submit()' };
          }
        }

        return { clicked: false };
      });

      console.log('Submit result:', JSON.stringify(submitResult, null, 2));

      if (!submitResult.clicked) {
        console.log('⏎ Trying Enter key...');
        await page.keyboard.press('Enter');
      }

      console.log('⏳ Waiting for results...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const resultsInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 1000),
          allLinks: Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
            text: a.textContent.trim().substring(0, 50),
            href: a.href
          })),
          has8DigitNumbers: /\b\d{8}\b/.test(document.body.innerText),
          eightDigitMatches: (document.body.innerText.match(/\b\d{8}\b/g) || []).slice(0, 5)
        };
      });

      console.log('\n📊 Results Page Info:');
      console.log('='.repeat(60));
      console.log('URL:', resultsInfo.url);
      console.log('Title:', resultsInfo.title);
      console.log('Has 8-digit numbers:', resultsInfo.has8DigitNumbers);
      console.log('8-digit matches:', resultsInfo.eightDigitMatches);
      console.log('\nFirst 20 links:');
      resultsInfo.allLinks.forEach((link, i) => {
        console.log(`  ${i + 1}. "${link.text}" -> ${link.href}`);
      });
      console.log('\nBody text (first 1000 chars):');
      console.log(resultsInfo.bodyText);
    }

    console.log('\n⏸️ Browser will stay open for 120 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
