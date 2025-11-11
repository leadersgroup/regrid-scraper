/**
 * Debug Wake County after clicking account
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
    console.log('🌐 Navigating to Wake County Real Estate Search...');
    await page.goto('https://services.wake.gov/realestate/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill search fields
    console.log('📝 Filling search fields...');
    await page.type('input[name="stnum"]', '4501');
    await page.type('input[name="stname"]', 'rockwood');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click search
    console.log('🔍 Clicking search...');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="image"]'));
      const searchBtn = inputs.find(input => input.name === 'Search by Address');
      if (searchBtn) searchBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click account
    console.log('🖱️  Clicking account...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, td, div, span'));
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (/^\d{7}$/.test(text) && el.offsetParent !== null) {
          el.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Analyze page structure
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 1000),

        // Find all clickable elements with "deed" text
        deedElements: Array.from(document.querySelectorAll('*'))
          .filter(el => {
            const text = el.textContent.toLowerCase();
            return text.includes('deed') && el.offsetParent !== null;
          })
          .map(el => ({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 100),
            className: el.className,
            id: el.id
          })),

        // Find all tabs/links
        tabs: Array.from(document.querySelectorAll('a, button, div[onclick], span[onclick]'))
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 50),
            className: el.className,
            id: el.id,
            href: el.href || null
          }))
      };
    });

    console.log('\n=== PAGE AFTER CLICKING ACCOUNT ===');
    console.log('URL:', analysis.url);
    console.log('Title:', analysis.title);
    console.log('\nBody preview:');
    console.log(analysis.bodyPreview);
    console.log('\n=== DEED-RELATED ELEMENTS ===');
    console.log(JSON.stringify(analysis.deedElements, null, 2));
    console.log('\n=== ALL TABS/LINKS ===');
    console.log(JSON.stringify(analysis.tabs.slice(0, 20), null, 2));

    console.log('\n\nWaiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
