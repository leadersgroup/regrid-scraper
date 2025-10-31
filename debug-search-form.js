/**
 * Try using the actual search form instead of direct URL
 */

const puppeteer = require('puppeteer');

async function debugSearchForm() {
  console.log('🔍 Testing Orange County Property Search Form\n');

  const parcelId = '272324542803770';

  console.log(`Parcel ID: ${parcelId}\n`);

  const browser = await puppeteer.launch({
    headless: false // Non-headless to see what happens
  });

  const page = await browser.newPage();

  try {
    // Go to search page
    console.log('Navigating to search page...');
    await page.goto('https://ocpaweb.ocpafl.org/parcelsearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to find and fill parcel ID input
    console.log('Looking for Parcel ID input field...');

    const inputFilled = await page.evaluate((pid) => {
      // Look for input with Parcel ID placeholder or label
      const inputs = Array.from(document.querySelectorAll('input'));

      // Log all inputs
      console.log('All inputs found:', inputs.map(i => ({
        id: i.id,
        name: i.name,
        placeholder: i.placeholder,
        type: i.type
      })));

      for (const input of inputs) {
        const placeholder = (input.placeholder || '').toLowerCase();
        const label = input.id || input.name || '';

        if (placeholder.includes('parcel') || label.toLowerCase().includes('parcel')) {
          console.log('Found parcel input:', input);
          input.value = pid;
          input.focus();
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      }

      return false;
    }, parcelId);

    console.log(`Parcel ID input ${inputFilled ? 'filled successfully' : 'NOT FOUND'}`);

    if (inputFilled) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for search/submit button
      console.log('Looking for Search button...');

      const buttonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));

        console.log('All buttons:', buttons.map(b => ({
          text: b.textContent || b.value,
          type: b.type,
          id: b.id
        })));

        for (const button of buttons) {
          const text = (button.textContent || button.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit')) {
            console.log('Clicking search button:', button);
            button.click();
            return true;
          }
        }

        return false;
      });

      console.log(`Search button ${buttonClicked ? 'clicked' : 'NOT FOUND'}`);

      if (buttonClicked) {
        console.log('Waiting for results...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        const pageContent = await page.evaluate(() => {
          return {
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 5000)
          };
        });

        console.log('\n' + '='.repeat(80));
        console.log('AFTER SEARCH:');
        console.log('='.repeat(80));
        console.log(`URL: ${pageContent.url}`);
        console.log(`\nPage Content:\n${pageContent.bodyText}`);
      }
    }

    // Keep browser open for manual inspection
    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 30 seconds for manual inspection...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugSearchForm();
