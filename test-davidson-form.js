/**
 * Find the form and submit mechanism
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testForm() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    scraper.page.on('request', req => {
      const url = req.url();
      if (url.includes('Search') || url.includes('Property')) {
        console.log(`→ ${req.method()} ${url}`);
      }
    });

    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('\n✅ Page loaded\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address mode
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check for forms and their submit buttons
    const formInfo = await scraper.page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'));
      return forms.map((form, i) => ({
        index: i,
        id: form.id,
        action: form.action,
        method: form.method,
        onsubmit: form.getAttribute('onsubmit'),
        inputs: Array.from(form.querySelectorAll('input')).map(inp => ({
          name: inp.name,
          type: inp.type,
          id: inp.id
        })),
        buttons: Array.from(form.querySelectorAll('button, input[type="submit"]')).map(btn => ({
          tag: btn.tagName,
          type: btn.type,
          text: (btn.textContent || btn.value || '').trim()
        }))
      }));
    });

    console.log('📋 Forms on page:');
    console.log(JSON.stringify(formInfo, null, 2));

    // Enter address
    await scraper.page.evaluate(() => {
      const numInput = document.querySelector('#streetNumber');
      const streetInput = document.querySelector('#singleSearchCriteria');

      if (numInput) {
        numInput.value = '6241';
        numInput.dispatchEvent(new Event('input', { bubbles: true }));
        numInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (streetInput) {
        streetInput.value = 'Del Sol';
        streetInput.dispatchEvent(new Event('input', { bubbles: true }));
        streetInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    console.log('\n✅ Entered address\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try to submit the form programmatically
    console.log('🔍 Attempting to submit form...\n');

    const formSubmitted = await scraper.page.evaluate(() => {
      // Try to find and submit the form
      const form = document.querySelector('form');
      if (form) {
        form.submit();
        return { method: 'form.submit()', success: true };
      }

      // Try to find a submit function in the global scope
      if (typeof window.submitSearch === 'function') {
        window.submitSearch();
        return { method: 'window.submitSearch()', success: true };
      }

      if (typeof window.doSearch === 'function') {
        window.doSearch();
        return { method: 'window.doSearch()', success: true };
      }

      return { success: false };
    });

    console.log('Form submit result:', JSON.stringify(formSubmitted));

    console.log('\n⏳ Waiting 10s for results...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    const results = await scraper.page.evaluate(() => {
      return {
        hasNoData: document.body.innerText.includes('No data to display'),
        url: window.location.href
      };
    });

    console.log('📊 Results:', JSON.stringify(results, null, 2));

    await scraper.page.screenshot({ path: '/tmp/form-test.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/form-test.png');

    console.log('\n⏸️  Keeping browser open (2 min)...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testForm().catch(console.error);
