/**
 * Try alternative URLs and approaches for Orange County FL
 */

const puppeteer = require('puppeteer');

async function tryAlternatives() {
  console.log('🔍 Trying Alternative URLs for Orange County FL\n');

  const parcelId = '272324542803770';

  const browser = await puppeteer.launch({
    headless: true
  });

  const urlsToTry = [
    // Try different URL patterns
    `https://ocpaweb.ocpafl.org/parcelsearch/#/summary/${parcelId}`,
    `https://ocpaweb.ocpafl.org/parcelsearch#/summary/${parcelId}`,
    `https://ocpaweb.ocpafl.org/parcelsearch/summary/${parcelId}`,
    `https://www.ocpafl.org/searches/ParcelSearch.aspx?parcel=${parcelId}`,
    // Try property card direct links
    `https://ocpaimages.ocpafl.org/PropertyCard/DisplayCard.aspx?pid=${parcelId}`,
    // Try the new ocpa dashboard
    `https://ocpaweb.ocpafl.org/dashboard/#/summary/${parcelId}`,
  ];

  for (const url of urlsToTry) {
    console.log('\n' + '='.repeat(80));
    console.log(`Testing URL: ${url}`);
    console.log('='.repeat(80));

    const page = await browser.newPage();

    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 10000));

      const pageInfo = await page.evaluate((pid) => {
        const bodyText = document.body.innerText;

        return {
          title: document.title,
          url: window.location.href,
          hasParcelId: bodyText.includes(pid),
          hasSales: bodyText.toLowerCase().includes('sale'),
          hasDeed: bodyText.toLowerCase().includes('deed'),
          hasOwner: bodyText.toLowerCase().includes('owner'),
          bodyLength: bodyText.length,
          bodyPreview: bodyText.substring(0, 1000)
        };
      }, parcelId);

      console.log(`Title: ${pageInfo.title}`);
      console.log(`Final URL: ${pageInfo.url}`);
      console.log(`Contains Parcel ID: ${pageInfo.hasParcelId ? 'YES ✓' : 'NO'}`);
      console.log(`Has Sales info: ${pageInfo.hasSales ? 'YES' : 'NO'}`);
      console.log(`Has Deed info: ${pageInfo.hasDeed ? 'YES' : 'NO'}`);
      console.log(`Has Owner info: ${pageInfo.hasOwner ? 'YES' : 'NO'}`);
      console.log(`Body length: ${pageInfo.bodyLength} chars`);

      if (pageInfo.hasParcelId) {
        console.log('\n✓✓✓ THIS URL WORKS! ✓✓✓');
        console.log('\nPage Preview:');
        console.log(pageInfo.bodyPreview);
      }

      await page.close();

    } catch (error) {
      console.log(`Error: ${error.message}`);
      await page.close();
    }
  }

  await browser.close();
  console.log('\n✅ Testing complete');
}

tryAlternatives();
