/**
 * Explore all tabs to find Sales History
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function exploreAllTabs() {
  console.log('🔍 Exploring all tabs to find Sales History...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
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

    // Get all tabs
    console.log('📑 Finding all tabs...');
    const tabs = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div, li'));
      const tabs = [];

      for (const el of allElements) {
        const text = el.textContent.trim();

        // Look for likely tab indicators
        if (text.length > 0 && text.length < 50 &&
            (el.getAttribute('role') === 'tab' ||
             el.classList.contains('tab') ||
             el.tagName === 'A' && el.parentElement.tagName === 'LI')) {

          tabs.push({
            text: text,
            tag: el.tagName,
            role: el.getAttribute('role') || '',
            className: el.className || '',
            clickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick !== null
          });
        }
      }

      return tabs;
    });

    console.log(`Found ${tabs.length} potential tabs:`);
    tabs.forEach((tab, i) => {
      console.log(`  ${i + 1}. "${tab.text}" <${tab.tag}>${tab.clickable ? ' [CLICKABLE]' : ''}`);
    });

    // Look specifically for main navigation tabs at the top
    console.log('\n🔍 Looking for main navigation tabs...');
    const mainTabs = await page.evaluate(() => {
      // Look for the main tab container
      const tabContainers = Array.from(document.querySelectorAll('[role="tablist"], .nav-tabs, ul.nav'));

      if (tabContainers.length === 0) {
        // Try to find tabs by looking for common patterns
        const allLinks = Array.from(document.querySelectorAll('a'));
        return allLinks
          .filter(a => {
            const text = a.textContent.trim();
            return text.length > 0 && text.length < 30 &&
                   (text.includes('Summary') || text.includes('Parcel') ||
                    text.includes('Building') || text.includes('Land') ||
                    text.includes('Property') || text.includes('Detail') ||
                    text.includes('Sales') || text.includes('Value'));
          })
          .map(a => ({
            text: a.textContent.trim(),
            href: a.href || '',
            isActive: a.classList.contains('active') || a.getAttribute('aria-selected') === 'true'
          }));
      }

      // Get tabs from containers
      const tabs = [];
      for (const container of tabContainers) {
        const tabElements = Array.from(container.querySelectorAll('a, button, [role="tab"]'));
        for (const el of tabElements) {
          tabs.push({
            text: el.textContent.trim(),
            href: el.href || '',
            isActive: el.classList.contains('active') || el.getAttribute('aria-selected') === 'true'
          });
        }
      }

      return tabs;
    });

    console.log(`Found ${mainTabs.length} main tabs:`);
    mainTabs.forEach((tab, i) => {
      console.log(`  ${i + 1}. "${tab.text}"${tab.isActive ? ' [ACTIVE]' : ''} - ${tab.href}`);
    });

    // Try clicking each main tab and look for "Sales History"
    console.log('\n🔄 Checking each tab for Sales History...\n');

    const tabsToCheck = ['Summary', 'Parcel', 'Building', 'Land Use', 'Permits', 'Property Detail', 'Value History', 'Sales'];

    for (const tabName of tabsToCheck) {
      console.log(`\n📋 Checking tab: ${tabName}`);

      const clicked = await page.evaluate((name) => {
        const allElements = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        for (const el of allElements) {
          const text = el.textContent.trim();
          if (text === name || text.includes(name)) {
            el.click();
            return true;
          }
        }
        return false;
      }, tabName);

      if (!clicked) {
        console.log(`  ⚠️  Tab "${tabName}" not found`);
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      // Scroll to load content
      await page.evaluate(async () => {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
      });

      // Look for Sales History
      const hasSalesHistory = await page.evaluate(() => {
        const allText = Array.from(document.querySelectorAll('*'))
          .map(el => el.textContent.trim().toUpperCase())
          .filter(text => text.length > 0 && text.length < 200);

        const salesHistoryFound = allText.some(text =>
          text === 'SALES HISTORY' || text === 'SALES HISTORY:' || text.includes('SALES HISTORY')
        );

        // Also look for recording numbers
        const recordingNumbers = allText.filter(text => /\b\d{14,}\b/.test(text));

        return {
          salesHistoryFound,
          recordingCount: recordingNumbers.length,
          samples: recordingNumbers.slice(0, 3)
        };
      });

      console.log(`  Sales History: ${hasSalesHistory.salesHistoryFound ? '✅ FOUND' : '❌'}`);
      if (hasSalesHistory.recordingCount > 0) {
        console.log(`  Recording numbers found: ${hasSalesHistory.recordingCount}`);
        console.log(`  Samples: ${hasSalesHistory.samples.join(', ')}`);
      }

      if (hasSalesHistory.salesHistoryFound) {
        console.log(`\n🎯 FOUND IT! Sales History is in the "${tabName}" tab!`);

        // Take a screenshot
        await page.screenshot({ path: `king-sales-history-found-${tabName}.png`, fullPage: true });
        console.log(`📸 Screenshot saved: king-sales-history-found-${tabName}.png`);
        break;
      }
    }

    console.log('\n⏸️  Browser open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

exploreAllTabs();
