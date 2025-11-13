/**
 * Comprehensive exploration - check for collapsible sections, buttons, etc.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function comprehensiveExplore() {
  console.log('🔍 Comprehensive exploration for Sales History...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  try {
    // Navigate and search
    console.log('📍 Navigating and searching...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Checkbox
    try {
      await page.waitForSelector('#cphContent_checkbox_acknowledge', { timeout: 5000 });
      await page.click('#cphContent_checkbox_acknowledge');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {}

    // Search
    const addressField = 'input[id="cphContent_txtAddress"]';
    await page.waitForSelector(addressField, { timeout: 10000 });
    await page.click(addressField, { clickCount: 3 });
    await page.type(addressField, '7550 41st Ave NE');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log(`✅ At: ${page.url()}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take initial screenshot
    await page.screenshot({ path: 'king-comp-1-initial.png', fullPage: true });
    console.log('📸 Screenshot 1: Initial page');

    // Check HTML for "SALES HISTORY" anywhere in the source
    console.log('\n🔍 Checking HTML source for "SALES HISTORY"...');
    const htmlContent = await page.content();
    const salesHistoryInHtml = htmlContent.toUpperCase().includes('SALES HISTORY');
    console.log(`HTML contains "SALES HISTORY": ${salesHistoryInHtml}`);

    if (salesHistoryInHtml) {
      // Find where it is in HTML
      const salesHistoryMatches = await page.evaluate(() => {
        const html = document.documentElement.outerHTML;
        const upper = html.toUpperCase();
        const index = upper.indexOf('SALES HISTORY');
        if (index === -1) return null;

        // Get context around it
        const start = Math.max(0, index - 200);
        const end = Math.min(html.length, index + 200);
        return {
          found: true,
          context: html.substring(start, end)
        };
      });

      if (salesHistoryMatches) {
        console.log('\n📄 HTML Context around "SALES HISTORY":');
        console.log(salesHistoryMatches.context);
      }
    }

    // Look for all elements with display:none or hidden
    console.log('\n👻 Looking for hidden elements...');
    const hiddenElements = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));
      const hidden = [];

      for (const el of allElements) {
        const text = el.textContent.trim().toUpperCase();
        if ((text.includes('SALES') || text.includes('HISTORY')) && text.length < 100) {
          const style = window.getComputedStyle(el);
          const isHidden = style.display === 'none' || style.visibility === 'hidden' || el.hidden;

          hidden.push({
            text: el.textContent.trim().substring(0, 50),
            tag: el.tagName,
            display: style.display,
            visibility: style.visibility,
            hidden: el.hidden,
            className: el.className || ''
          });
        }
      }

      return hidden.slice(0, 20);
    });

    console.log(`Found ${hiddenElements.length} elements with sales/history:`);
    hiddenElements.forEach((el, i) => {
      console.log(`  ${i + 1}. <${el.tag}> "${el.text}" - display:${el.display}, visibility:${el.visibility}${el.className ? `, class:${el.className}` : ''}`);
    });

    // Look for expandable sections, accordions, or details elements
    console.log('\n🔽 Looking for expandable sections...');
    const expandableElements = await page.evaluate(() => {
      const results = [];

      // Check for <details> elements
      const details = Array.from(document.querySelectorAll('details'));
      details.forEach(d => results.push({
        type: 'details',
        summary: d.querySelector('summary')?.textContent.trim() || '',
        open: d.open
      }));

      // Check for elements with aria-expanded
      const ariaElements = Array.from(document.querySelectorAll('[aria-expanded]'));
      ariaElements.forEach(el => results.push({
        type: 'aria-expanded',
        text: el.textContent.trim().substring(0, 50),
        expanded: el.getAttribute('aria-expanded') === 'true'
      }));

      // Check for elements with common collapse/expand classes
      const collapseElements = Array.from(document.querySelectorAll('[class*="collaps"], [class*="expand"], [class*="accord"]'));
      collapseElements.forEach(el => results.push({
        type: 'collapse-class',
        text: el.textContent.trim().substring(0, 50),
        className: el.className
      }));

      return results;
    });

    console.log(`Found ${expandableElements.length} expandable elements:`);
    expandableElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.type}: ${JSON.stringify(el)}`);
    });

    // Click Property Detail
    console.log('\n📋 Clicking Property Detail tab...');
    await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"], li'));
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.includes('Property Detail') || text === 'Property Detail') {
          el.click();
          return true;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot after clicking Property Detail
    await page.screenshot({ path: 'king-comp-2-property-detail.png', fullPage: true });
    console.log('📸 Screenshot 2: After clicking Property Detail');

    // Check HTML again
    console.log('\n🔍 Checking HTML for "SALES HISTORY" after clicking Property Detail...');
    const htmlContent2 = await page.content();
    const salesHistoryInHtml2 = htmlContent2.toUpperCase().includes('SALES HISTORY');
    console.log(`HTML contains "SALES HISTORY": ${salesHistoryInHtml2}`);

    // Scroll extensively and check at each scroll position
    console.log('\n📜 Scrolling and checking for Sales History at each position...');
    for (let scrollPos = 0; scrollPos <= 3000; scrollPos += 500) {
      await page.evaluate((pos) => window.scrollTo(0, pos), scrollPos);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const found = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const el of allElements) {
          const text = el.textContent.trim().toUpperCase();
          if (text === 'SALES HISTORY' || text === 'SALES HISTORY:') {
            const style = window.getComputedStyle(el);
            return {
              found: true,
              visible: style.display !== 'none' && style.visibility !== 'hidden',
              tag: el.tagName,
              text: el.textContent.trim()
            };
          }
        }
        return { found: false };
      });

      if (found.found) {
        console.log(`  ✅ Found at scroll position ${scrollPos}px: visible=${found.visible}, <${found.tag}> "${found.text}"`);
        break;
      } else {
        console.log(`  ❌ Not found at scroll position ${scrollPos}px`);
      }
    }

    console.log('\n⏸️  Browser open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

comprehensiveExplore();
