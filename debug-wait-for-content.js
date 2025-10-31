/**
 * Try waiting for specific property content elements to load
 */

const puppeteer = require('puppeteer');

async function debugWaitForContent() {
  console.log('🔍 Waiting for Property Content Elements to Load\n');

  const parcelId = '272324542803770';
  const url = `https://ocpaweb.ocpafl.org/parcelsearch/#/summary/${parcelId}`;

  const browser = await puppeteer.launch({
    headless: false, // Non-headless to see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Waiting for page to fully load (watching for property content)...');

    // Wait for the search panel to potentially disappear or property content to appear
    let attempts = 0;
    let propertyLoaded = false;

    while (attempts < 30 && !propertyLoaded) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;

      const status = await page.evaluate((pid) => {
        const text = document.body.innerText;

        // Look for signs that property data has loaded
        const hasParcelId = text.includes(pid);
        const hasOwnerInfo = text.includes('Owner') && text.includes('Mailing');
        const hasSiteAddress = text.includes('Site Address') || text.includes('Location');
        const hasAssessedValue = text.includes('Assessed') || text.includes('Market Value');
        const hasSalesData = text.includes('Sale Price') || text.includes('Sale Date');

        // Also check for specific property card elements in the DOM
        const propertyElements = document.querySelectorAll('[class*="property"], [class*="Property"], [id*="property"], [id*="Property"]');

        return {
          hasParcelId,
          hasOwnerInfo,
          hasSiteAddress,
          hasAssessedValue,
          hasSalesData,
          propertyElementsCount: propertyElements.length,
          bodyLength: text.length,
          url: window.location.href
        };
      }, parcelId);

      if (status.hasParcelId || (status.hasOwnerInfo && status.hasSiteAddress)) {
        propertyLoaded = true;
        console.log(`\n✅ Property content loaded after ${attempts} seconds!`);
        console.log(`   - Has Parcel ID: ${status.hasParcelId}`);
        console.log(`   - Has Owner Info: ${status.hasOwnerInfo}`);
        console.log(`   - Has Site Address: ${status.hasSiteAddress}`);
        console.log(`   - Has Assessed Value: ${status.hasAssessedValue}`);
        console.log(`   - Has Sales Data: ${status.hasSalesData}`);
        console.log(`   - Property Elements: ${status.propertyElementsCount}`);
        console.log(`   - Body Length: ${status.bodyLength} chars`);
        break;
      }

      if (attempts % 5 === 0) {
        console.log(`Still waiting... (${attempts}s) - Body length: ${status.bodyLength} chars`);
      }
    }

    if (!propertyLoaded) {
      console.log('\n❌ Property content did not load after 30 seconds');
      console.log('The hash-based routing may not be working properly.');
    } else {
      // If property loaded, now look for sales tab
      console.log('\n' + '='.repeat(80));
      console.log('Looking for Sales Tab...');
      console.log('='.repeat(80));

      const salesInfo = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));

        // Find elements containing "sales" or "sale"
        const salesElements = [];
        for (const el of allElements) {
          const text = el.textContent || '';
          const visible = el.offsetParent !== null; // Check if visible

          if (visible && text.toLowerCase().includes('sale') && text.length < 100) {
            salesElements.push({
              tag: el.tagName,
              text: text.trim(),
              classes: el.className,
              id: el.id,
              href: el.href || null
            });
          }
        }

        // Get all visible tabs/buttons
        const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a[class*="tab"], a[class*="Tab"]'))
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim(),
            role: el.getAttribute('role'),
            classes: el.className
          }));

        return {
          salesElements: salesElements.slice(0, 20),
          tabs: tabs.slice(0, 30),
          bodyText: document.body.innerText.substring(0, 5000)
        };
      });

      console.log(`\nFound ${salesInfo.salesElements.length} elements with "sale":`);
      salesInfo.salesElements.forEach((el, i) => {
        console.log(`  ${i + 1}. <${el.tag}> "${el.text.substring(0, 50)}"`);
        if (el.href) console.log(`     href: ${el.href}`);
      });

      console.log(`\nFound ${salesInfo.tabs.length} tab/button elements:`);
      salesInfo.tabs.forEach((tab, i) => {
        console.log(`  ${i + 1}. <${tab.tag}> "${tab.text}"`);
      });

      console.log('\n' + '='.repeat(80));
      console.log('PAGE TEXT (first 5000 chars):');
      console.log('='.repeat(80));
      console.log(salesInfo.bodyText);
    }

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

debugWaitForContent();
