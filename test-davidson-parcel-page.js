/**
 * Test what's on the parcel details page to find deed information
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testParcelPage() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    const result = await scraper.getPriorDeed('6241 Del Sol Dr, Whites Creek, TN 37189, USA');

    console.log('\n' + '='.repeat(80));
    console.log('SCRAPER COMPLETED');
    console.log('='.repeat(80));

    // At this point, the browser should be on the parcel details page
    // Let's examine what's there

    if (scraper.page) {
      console.log('\n📊 Analyzing parcel details page...\n');

      const pageAnalysis = await scraper.page.evaluate(() => {
        const bodyText = document.body.innerText;

        // Look for deed-related keywords
        const hasDeed = bodyText.toLowerCase().includes('deed');
        const hasInstrument = bodyText.toLowerCase().includes('instrument');
        const hasBook = bodyText.toLowerCase().includes('book');
        const hasSale = bodyText.toLowerCase().includes('sale');
        const hasTransfer = bodyText.toLowerCase().includes('transfer');

        // Find all tabs or navigation links
        const tabs = Array.from(document.querySelectorAll('a, button, div[role="tab"], li'))
          .map(el => el.innerText?.trim())
          .filter(text => text && text.length > 0 && text.length < 50)
          .slice(0, 30);

        // Look for tables
        const tables = Array.from(document.querySelectorAll('table'));
        const tableInfo = tables.map((table, i) => ({
          index: i,
          text: table.innerText?.substring(0, 300)
        }));

        return {
          url: window.location.href,
          keywords: { hasDeed, hasInstrument, hasBook, hasSale, hasTransfer },
          tabs,
          tableCount: tables.length,
          tables: tableInfo,
          bodySnippet: bodyText.substring(0, 1500)
        };
      });

      console.log('📍 Current URL:', pageAnalysis.url);
      console.log('\n🔍 Deed-related keywords found:');
      console.log(JSON.stringify(pageAnalysis.keywords, null, 2));

      console.log('\n📑 Tabs/Navigation elements:');
      pageAnalysis.tabs.forEach((tab, i) => {
        console.log(`   ${i + 1}. ${tab}`);
      });

      console.log(`\n📊 Tables found: ${pageAnalysis.tableCount}`);
      if (pageAnalysis.tables.length > 0) {
        pageAnalysis.tables.forEach((table, i) => {
          console.log(`\n   Table ${i}:`);
          console.log(`   ${table.text.substring(0, 200)}`);
        });
      }

      console.log('\n📄 Page body snippet:');
      console.log(pageAnalysis.bodySnippet);

      await scraper.page.screenshot({ path: '/tmp/parcel-details.png', fullPage: true });
      console.log('\n📸 Screenshot saved: /tmp/parcel-details.png');

      console.log('\n⏸️  Keeping browser open for 2 minutes for inspection...');
      await new Promise(resolve => setTimeout(resolve, 120000));
    }

    console.log('\n📊 Final result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testParcelPage().catch(console.error);
