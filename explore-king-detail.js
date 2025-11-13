/**
 * Detailed exploration of King County Property Detail page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreDetail() {
  console.log('🔍 Exploring King County Property Detail page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate and search
    console.log('📍 Navigating and searching for property...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check acknowledgment checkbox
    console.log('✅ Checking acknowledgment checkbox...');
    try {
      await page.waitForSelector('#cphContent_checkbox_acknowledge', { timeout: 5000 });
      await page.click('#cphContent_checkbox_acknowledge');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('⚠️  Checkbox not found');
    }

    // Fill address
    console.log('📝 Filling address: 7550 41st Ave NE');
    const addressField = 'input[id="cphContent_txtAddress"]';
    await page.waitForSelector(addressField, { timeout: 10000 });
    await page.click(addressField, { clickCount: 3 });
    await page.type(addressField, '7550 41st Ave NE');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit search
    console.log('🔍 Submitting search...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log(`✅ Navigated to: ${page.url()}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Property Detail tab
    console.log('📋 Looking for and clicking Property Detail tab...');
    const tabClicked = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"], li'));
      for (const el of allElements) {
        const text = el.textContent.trim();
        if (text.includes('Property Detail') || text === 'Property Detail') {
          console.log('Clicking Property Detail tab');
          el.click();
          return true;
        }
      }
      return false;
    });

    if (!tabClicked) {
      console.log('❌ Could not find Property Detail tab');
    } else {
      console.log('✅ Clicked Property Detail tab');
    }

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get all visible content
    console.log('\n📋 Page Content Analysis:');

    const pageAnalysis = await page.evaluate(() => {
      // Get all headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .map(h => `${h.tagName}: ${h.textContent.trim()}`)
        .filter(h => h.includes(':') && h.split(':')[1].trim().length > 0);

      // Get all tabs/buttons
      const tabs = Array.from(document.querySelectorAll('[role="tab"], a.tab, li.tab, .nav-item, .nav-link, a'))
        .map(t => t.textContent.trim())
        .filter(t => t.length > 0 && t.length < 50)
        .slice(0, 30);

      // Get all tables
      const tables = Array.from(document.querySelectorAll('table')).map((table, i) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        const rowCount = table.querySelectorAll('tr').length;
        return `Table ${i + 1}: ${headers.length} columns, ${rowCount} rows, Headers: ${headers.join(', ')}`;
      });

      // Look for any text containing "sales", "recording", "deed"
      const relevantText = [];
      const allText = Array.from(document.querySelectorAll('*'))
        .map(el => el.textContent)
        .filter(text => {
          const lower = text.toLowerCase();
          return (lower.includes('sales') || lower.includes('recording') || lower.includes('deed')) &&
                 text.length > 5 && text.length < 100;
        })
        .slice(0, 20);

      return {
        headings,
        tabs: [...new Set(tabs)],
        tables,
        relevantText: [...new Set(allText)]
      };
    });

    console.log('\n🔤 Headings on page:');
    pageAnalysis.headings.forEach(h => console.log(`  ${h}`));

    console.log('\n📑 Tabs/Links:');
    pageAnalysis.tabs.forEach(t => console.log(`  - ${t}`));

    console.log('\n📊 Tables:');
    pageAnalysis.tables.forEach(t => console.log(`  ${t}`));

    console.log('\n🔍 Text mentioning sales/recording/deed:');
    pageAnalysis.relevantText.forEach(t => console.log(`  ${t}`));

    console.log('\n⏸️  Keeping browser open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreDetail();
