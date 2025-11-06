const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testNoClick() {
  console.log('🔍 Testing Lee County WITHOUT clicking tab...\n');

  const browser = await puppeteer.launch({
    headless: false,
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

    await page.waitForTimeout(5000);

    // Look for all clerk file numbers WITHOUT clicking any tabs
    console.log('\n🔍 Searching for Clerk file numbers in entire page HTML...');

    const clerkNumbers = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const results = [];

      // Multiple regex patterns for 13-digit clerk file numbers
      const patterns = [
        /\b(\d{13})\b/g,  // Exact 13 digits
        /\b(\d{4}\d{9})\b/g,  // 4+9 format
        /CFN[:\s]*(\d{13})/gi,  // CFN: prefix
        /clerk[\s]*file[\s]*number[:\s]*(\d{13})/gi  // Clerk file number: prefix
      ];

      for (const pattern of patterns) {
        const matches = html.matchAll(pattern);
        for (const match of matches) {
          const number = match[1];
          if (number && number.length === 13 && !results.includes(number)) {
            results.push(number);
          }
        }
      }

      return results;
    });

    console.log('\n📋 Found Clerk file numbers:', clerkNumbers);

    // Also check if there are hidden divs with tab content
    console.log('\n🔍 Looking for tab content divs...');
    const tabDivs = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div[id*="Tab"], div[id*="tab"], div[class*="tab"]'));
      return divs.map(div => ({
        id: div.id,
        className: div.className,
        visible: window.getComputedStyle(div).display !== 'none',
        innerHTML: div.innerHTML.substring(0, 200)  // First 200 chars
      }));
    });

    console.log('\n📋 Tab divs found:', JSON.stringify(tabDivs, null, 2));

    console.log('\n⏸️  Pausing - press Ctrl+C when done inspecting...');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testNoClick().catch(console.error);
