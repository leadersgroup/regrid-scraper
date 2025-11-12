/**
 * Debug script to inspect the deed document page content
 * This will help us understand what elements are on the deed page
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina');

async function debugDeedPage() {
  console.log('🐛 Debugging Guilford County deed page content...\n');

  const scraper = new GuilfordCountyScraper({
    headless: false,
    debug: true
  });

  try {
    await scraper.initialize();

    const testAddress = '1637 NW 59TH ST';
    console.log(`📍 Testing with address: ${testAddress}\n`);

    // Parse address
    const { streetNumber, streetName } = scraper.parseAddress(testAddress);
    console.log(`Parsed: ${streetNumber} ${streetName}\n`);

    // Search for property
    console.log('🔍 Searching for property...');
    const searchResult = await scraper.searchProperty(streetNumber, streetName);

    if (!searchResult.success) {
      throw new Error('Property search failed');
    }
    console.log('✅ Property found\n');

    // Get deed info
    console.log('📄 Getting deed information...');
    const deedResult = await scraper.getDeedInfo();

    if (!deedResult.success) {
      throw new Error('Failed to get deed information');
    }
    console.log('✅ Deed info retrieved\n');

    // Check if deedImageUrl was set
    console.log('📋 Deed Image URL:', scraper.deedImageUrl);

    // Now navigate to that URL and inspect the page
    if (scraper.deedImageUrl) {
      console.log('\n🌐 Navigating to deed page...');
      await scraper.page.goto(scraper.deedImageUrl, { waitUntil: 'networkidle0', timeout: 30000 });

      console.log('📸 Taking screenshot of deed page...');
      await scraper.page.screenshot({ path: 'debug-deed-page-full.png', fullPage: true });

      // Inspect page content
      const pageInfo = await scraper.page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          hasIframes: document.querySelectorAll('iframe').length,
          iframeSources: Array.from(document.querySelectorAll('iframe')).map(f => f.src),
          hasImages: document.querySelectorAll('img').length,
          imageSources: Array.from(document.querySelectorAll('img')).map(img => ({
            src: img.src,
            width: img.width,
            height: img.height,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          })),
          hasEmbeds: document.querySelectorAll('embed, object').length,
          embedSources: Array.from(document.querySelectorAll('embed, object')).map(e => e.src || e.data),
          allLinks: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent.trim(),
            href: a.href
          })).filter(l => l.text || l.href),
          bodyText: document.body.innerText.substring(0, 500)
        };
      });

      console.log('\n📊 Page Analysis:');
      console.log('URL:', pageInfo.url);
      console.log('Title:', pageInfo.title);
      console.log('Iframes:', pageInfo.hasIframes);
      if (pageInfo.iframeSources.length > 0) {
        console.log('  Sources:', pageInfo.iframeSources);
      }
      console.log('Images:', pageInfo.hasImages);
      if (pageInfo.imageSources.length > 0) {
        console.log('  Large images (>500px):');
        pageInfo.imageSources
          .filter(img => img.width > 500 || img.naturalWidth > 500)
          .forEach(img => {
            console.log(`    ${img.src}`);
            console.log(`    Size: ${img.width}x${img.height} (natural: ${img.naturalWidth}x${img.naturalHeight})`);
          });
      }
      console.log('Embeds:', pageInfo.hasEmbeds);
      if (pageInfo.embedSources.length > 0) {
        console.log('  Sources:', pageInfo.embedSources);
      }
      console.log('\nAll Links:');
      pageInfo.allLinks.forEach(link => {
        if (link.href.includes('pdf') || link.href.includes('download') ||
            link.href.includes('CustomAttachment') || link.href.includes('ShowDocument')) {
          console.log(`  📎 ${link.text}: ${link.href}`);
        }
      });

      console.log('\n📄 Page Text Preview:');
      console.log(pageInfo.bodyText);

      console.log('\n⏸️  Browser will stay open for manual inspection...');
      console.log('Press Ctrl+C when done.');

      // Keep browser open
      await new Promise(() => {});
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error(error.stack);
  }
}

// Run the debug
debugDeedPage().catch(console.error);
