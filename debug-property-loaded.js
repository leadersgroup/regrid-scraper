/**
 * Debug script to wait for property content to load, then inspect it
 */

const puppeteer = require('puppeteer');

async function debugPropertyLoaded() {
  console.log('🔍 Waiting for Orange County Property to fully load\n');

  const parcelId = '272324542803770';
  const url = `https://ocpaweb.ocpafl.org/parcelsearch/#/summary/${parcelId}`;

  console.log(`Parcel ID: ${parcelId}`);
  console.log(`URL: ${url}\n`);

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {
    // Navigate to property page
    console.log('Navigating to property page...');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait much longer for Angular/React to load the property data
    console.log('Waiting for property content to load (15 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Look for indicators that property loaded
    const propertyStatus = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Look for property-related keywords
      const hasPropertyCard = bodyText.includes('Property Card');
      const hasParcelId = bodyText.includes('272324542803770');
      const hasSiteAddress = bodyText.includes('Site Address') || bodyText.includes('Property Address');
      const hasOwner = bodyText.includes('Owner') || bodyText.includes('Mailing');
      const hasSales = bodyText.includes('Sales') || bodyText.includes('Sale');

      // Get all visible text in sections
      const sections = Array.from(document.querySelectorAll('div, section, article')).map(el => ({
        classes: el.className,
        text: el.innerText?.substring(0, 200)
      })).filter(s => s.text && s.text.length > 50);

      // Look for tabs or navigation in the property view
      const tabsAndButtons = Array.from(document.querySelectorAll('button, a, [role="tab"], li')).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        classes: el.className,
        href: el.href,
        role: el.getAttribute('role')
      })).filter(t => t.text && t.text.length < 100 && t.text.length > 0);

      return {
        hasPropertyCard,
        hasParcelId,
        hasSiteAddress,
        hasOwner,
        hasSales,
        bodyText: bodyText.substring(0, 5000),
        sections: sections.slice(0, 20),
        tabsAndButtons: tabsAndButtons.slice(0, 50)
      };
    });

    console.log('='.repeat(80));
    console.log('PROPERTY LOAD STATUS:');
    console.log('='.repeat(80));
    console.log(`  Property Card text found: ${propertyStatus.hasPropertyCard ? 'YES' : 'NO'}`);
    console.log(`  Parcel ID found in page: ${propertyStatus.hasParcelId ? 'YES' : 'NO'}`);
    console.log(`  Site/Property Address: ${propertyStatus.hasSiteAddress ? 'YES' : 'NO'}`);
    console.log(`  Owner information: ${propertyStatus.hasOwner ? 'YES' : 'NO'}`);
    console.log(`  Sales information: ${propertyStatus.hasSales ? 'YES' : 'NO'}`);

    console.log('\n' + '='.repeat(80));
    console.log('PAGE TEXT (first 5000 chars):');
    console.log('='.repeat(80));
    console.log(propertyStatus.bodyText);

    console.log('\n' + '='.repeat(80));
    console.log('TABS AND BUTTONS (first 50):');
    console.log('='.repeat(80));
    propertyStatus.tabsAndButtons.forEach((item, i) => {
      console.log(`  ${i + 1}. <${item.tag}> "${item.text}"`);
      if (item.href && !item.href.includes('mailto:') && !item.href.includes('tel:')) {
        console.log(`     href: ${item.href}`);
      }
      if (item.classes) console.log(`     class: ${item.classes}`);
      if (item.role) console.log(`     role: ${item.role}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugPropertyLoaded();
