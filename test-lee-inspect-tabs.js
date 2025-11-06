const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function inspectTabs() {
  console.log('🔍 Inspecting Lee County Sales/Transactions tab structure...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser to see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    // Navigate to the parcel details page directly
    const url = 'https://www.leepa.org/Display/DisplayParcel.aspx?FolioID=10401889';
    console.log('🌐 Navigating to parcel details page...');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Page loaded');

    await page.waitForTimeout(3000);

    // Inspect the tab structure
    const tabInfo = await page.evaluate(() => {
      const tabs = [];

      // Look for tab elements
      const tabElements = document.querySelectorAll('a, li, div, span');

      for (const el of tabElements) {
        const text = (el.textContent || '').trim();
        if (text.includes('Sales') && text.includes('Transaction')) {
          const info = {
            tagName: el.tagName,
            text: text,
            id: el.id || null,
            className: el.className || null,
            href: el.href || null,
            onclick: el.onclick ? el.onclick.toString() : null,
            attributes: {}
          };

          // Get all attributes
          for (const attr of el.attributes) {
            info.attributes[attr.name] = attr.value;
          }

          tabs.push(info);
        }
      }

      return tabs;
    });

    console.log('\n📋 Found tab elements:');
    console.log(JSON.stringify(tabInfo, null, 2));

    // Also check for any WebTab or Telerik controls
    const webTabInfo = await page.evaluate(() => {
      // Look for Telerik RadTabStrip or WebTab controls
      const scripts = Array.from(document.querySelectorAll('script'));
      const relevantScripts = [];

      for (const script of scripts) {
        const content = script.textContent || script.innerText;
        if (content.includes('TabStrip') || content.includes('WebTab') ||
            content.includes('Sales') || content.includes('Transaction')) {
          relevantScripts.push(content.substring(0, 500)); // First 500 chars
        }
      }

      return {
        scripts: relevantScripts,
        webTabElements: Array.from(document.querySelectorAll('[id*="WebTab"], [id*="TabStrip"]')).map(el => ({
          id: el.id,
          tagName: el.tagName,
          className: el.className
        }))
      };
    });

    console.log('\n🔧 WebTab/TabStrip info:');
    console.log(JSON.stringify(webTabInfo, null, 2));

    console.log('\n⏸️  Pausing for manual inspection (press Ctrl+C when done)...');
    await new Promise(() => {}); // Wait forever until manually stopped

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

inspectTabs().catch(console.error);
