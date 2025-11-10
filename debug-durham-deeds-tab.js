/**
 * Debug script to analyze the Deeds tab structure on Durham County property page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDeedsTab() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Durham Property search...');
    await page.goto('https://property.spatialest.com/nc/durham-tax/#/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search for address
    console.log('🔍 Typing search term: 6409 winding arch dr');
    await page.waitForSelector('#searchTerm', { timeout: 10000 });
    const searchInput = await page.$('#searchTerm');
    await searchInput.click();
    await new Promise(resolve => setTimeout(resolve, 500));
    await searchInput.type('6409 winding arch dr');
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Click Search button
    console.log('🔍 Clicking Search button...');
    const searchButtonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const searchButton = buttons.find(btn => {
        const text = btn.textContent.trim();
        return text.includes('Search') || btn.querySelector('.fa-search');
      });

      if (searchButton) {
        searchButton.click();
        return true;
      }
      return false;
    });

    if (!searchButtonClicked) {
      console.log('❌ Could not find Search button');
      return;
    }

    console.log('✅ Search button clicked');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Click parcel ID
    console.log('📄 Clicking parcel ID...');
    const parcelClicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll('td'));
        for (const cell of cells) {
          const text = cell.textContent.trim();
          if (/^\d{5,}$/.test(text)) {
            const link = cell.querySelector('a');
            if (link) {
              link.click();
              return { success: true, parcelId: text };
            }
            cell.click();
            return { success: true, parcelId: text };
          }
        }
      }
      return { success: false };
    });

    if (!parcelClicked.success) {
      console.log('❌ Could not click parcel');
      return;
    }

    console.log(`✅ Clicked parcel: ${parcelClicked.parcelId}`);

    // Wait for navigation - this is critical!
    console.log('⏳ Waiting for navigation to property page...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
      console.log('⚠️ No navigation event detected, continuing anyway...');
    });
    await new Promise(resolve => setTimeout(resolve, 4000));

    console.log('Current URL:', page.url());

    // Analyze ALL tab-like elements
    console.log('\n=== ANALYZING TAB STRUCTURE ===\n');
    const tabAnalysis = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        bodyPreview: document.body.innerText.substring(0, 800),
        possibleTabs: []
      };

      // Look for common tab patterns
      const selectors = [
        'a',
        'button',
        'div[role="tab"]',
        'li[role="tab"]',
        '[class*="tab"]',
        '[class*="Tab"]',
        'nav a',
        'ul li a',
        '.nav-link',
        '.nav-item'
      ];

      const seen = new Set();

      for (const selector of selectors) {
        const elements = Array.from(document.querySelectorAll(selector));

        for (const el of elements) {
          const text = el.textContent.trim().toLowerCase();

          // Look for elements that might be tabs
          if (text && text.length < 50 && !seen.has(el)) {
            // Check if text contains any tab-like keywords
            const tabKeywords = ['parcel', 'building', 'improvement', 'land', 'deed', 'note', 'sale', 'photo', 'map'];
            const hasTabKeyword = tabKeywords.some(keyword => text.includes(keyword));

            if (hasTabKeyword) {
              seen.add(el);
              results.possibleTabs.push({
                text: el.textContent.trim(),
                tagName: el.tagName,
                className: el.className,
                id: el.id,
                role: el.getAttribute('role'),
                href: el.href || null,
                innerHTML: el.innerHTML.substring(0, 200),
                visible: el.offsetParent !== null,
                rect: {
                  x: el.getBoundingClientRect().x,
                  y: el.getBoundingClientRect().y,
                  width: el.getBoundingClientRect().width,
                  height: el.getBoundingClientRect().height
                }
              });
            }
          }
        }
      }

      return results;
    });

    console.log('Current URL:', tabAnalysis.url);
    console.log('\nBody Preview:');
    console.log(tabAnalysis.bodyPreview);
    console.log('\n\n=== POSSIBLE TAB ELEMENTS ===\n');
    console.log(JSON.stringify(tabAnalysis.possibleTabs, null, 2));

    // Try to find and click Deeds tab using different strategies
    console.log('\n\n=== ATTEMPTING TO CLICK DEEDS TAB ===\n');

    const strategies = [
      {
        name: 'Strategy 1: Exact text match "Deeds"',
        code: () => {
          const elements = Array.from(document.querySelectorAll('a, button, div, span, li'));
          const deedsTab = elements.find(el => {
            const text = el.textContent.trim();
            return text === 'Deeds' && el.offsetParent !== null;
          });

          if (deedsTab) {
            deedsTab.click();
            return { success: true, element: deedsTab.tagName, text: deedsTab.textContent };
          }
          return { success: false };
        }
      },
      {
        name: 'Strategy 2: Case-insensitive "deeds" with visibility check',
        code: () => {
          const elements = Array.from(document.querySelectorAll('a, button, div, span, li'));
          const deedsTab = elements.find(el => {
            const text = el.textContent.trim().toLowerCase();
            return text === 'deeds' && el.offsetParent !== null;
          });

          if (deedsTab) {
            deedsTab.click();
            return { success: true, element: deedsTab.tagName, text: deedsTab.textContent };
          }
          return { success: false };
        }
      },
      {
        name: 'Strategy 3: Contains "deed" (excluding "deed type")',
        code: () => {
          const elements = Array.from(document.querySelectorAll('a, button, div[role="tab"], span, li'));
          const deedsTab = elements.find(el => {
            const text = el.textContent.trim().toLowerCase();
            return text.includes('deed') && !text.includes('deed type') && text.length < 20 && el.offsetParent !== null;
          });

          if (deedsTab) {
            deedsTab.click();
            return { success: true, element: deedsTab.tagName, text: deedsTab.textContent };
          }
          return { success: false };
        }
      }
    ];

    for (const strategy of strategies) {
      console.log(`\nTrying: ${strategy.name}`);
      const result = await page.evaluate(strategy.code);
      console.log('Result:', JSON.stringify(result, null, 2));

      if (result.success) {
        console.log('✅ SUCCESS! Tab clicked.');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check if Deeds content loaded
        const deedsContent = await page.evaluate(() => {
          const text = document.body.innerText;
          return {
            hasBook: text.includes('book') || text.includes('Book'),
            hasPage: text.includes('page') || text.includes('Page'),
            bodyPreview: text.substring(0, 1000)
          };
        });

        console.log('\n=== DEEDS TAB CONTENT ===');
        console.log(JSON.stringify(deedsContent, null, 2));
        break;
      }
    }

    await page.screenshot({ path: '/tmp/durham-deeds-tab-debug.png', fullPage: true });
    console.log('\n📸 Screenshot saved: /tmp/durham-deeds-tab-debug.png');

    console.log('\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

debugDeedsTab().catch(console.error);
