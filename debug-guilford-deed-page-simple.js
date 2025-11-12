/**
 * Simple debug script to see what's on the Guilford deed document page
 */

const GuilfordCountyScraper = require('./county-implementations/guilford-county-north-carolina');
const fs = require('fs');

async function debug() {
  const scraper = new GuilfordCountyScraper({ headless: false, debug: true });

  try {
    await scraper.initialize();

    const address = '1637 NW 59TH ST';
    const { streetNumber, streetName } = scraper.parseAddress(address);

    // Search
    console.log('🔍 Searching...');
    const searchResult = await scraper.searchProperty(streetNumber, streetName);
    if (!searchResult.success) throw new Error('Search failed');

    console.log('✅ Found property\n');

    // Navigate to deeds tab and get the deed page URL
    console.log('📄 Getting deed info...');

    // Manually replicate getDeedInfo logic but stop before captcha check
    await scraper.page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button, span, div[role="tab"]'));
      for (const el of allElements) {
        const text = el.textContent.trim().toLowerCase();
        if (text === 'deeds' || text.includes('deed')) {
          el.click();
          return true;
        }
      }
    });

    console.log('✅ Clicked Deeds tab');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Find first deed entry
    const deedTypeInfo = await scraper.page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const table of tables) {
        const rows = Array.from(table.querySelectorAll('tr'));
        let deedTypeColumnIndex = -1;
        let headerRowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
          const headers = Array.from(rows[i].querySelectorAll('th'));
          for (let j = 0; j < headers.length; j++) {
            if (headers[j].textContent.toLowerCase().trim() === 'deed type') {
              deedTypeColumnIndex = j;
              headerRowIndex = i;
              break;
            }
          }
          if (deedTypeColumnIndex !== -1) break;
        }

        if (deedTypeColumnIndex !== -1 && headerRowIndex !== -1) {
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const cells = Array.from(rows[i].querySelectorAll('td'));
            if (cells.length > deedTypeColumnIndex) {
              const link = cells[deedTypeColumnIndex].querySelector('a');
              if (link) {
                const deedType = link.textContent.trim();
                if (deedType.toLowerCase().includes('deed')) {
                  return { success: true, deedType, href: link.href };
                }
              }
            }
          }
        }
      }
      return { success: false };
    });

    if (!deedTypeInfo.success) throw new Error('No deed found');

    console.log(`✅ Found deed: ${deedTypeInfo.deedType}`);
    console.log(`📄 URL: ${deedTypeInfo.href}\n`);

    // Navigate to deed page
    console.log('🌐 Navigating to deed page...');
    await scraper.page.goto(deedTypeInfo.href, { waitUntil: 'networkidle0', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('✅ On deed page\n');

    // Take screenshot
    await scraper.page.screenshot({ path: 'guilford-deed-page-debug.png', fullPage: true });
    console.log('📸 Screenshot saved: guilford-deed-page-debug.png\n');

    // Analyze page
    const pageAnalysis = await scraper.page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      const allImages = Array.from(document.querySelectorAll('img'));
      const allIframes = Array.from(document.querySelectorAll('iframe'));

      return {
        url: window.location.href,
        title: document.title,
        links: allLinks.map(a => ({
          text: a.textContent.trim().substring(0, 50),
          href: a.href
        })).filter(l => l.href),
        images: allImages.map(img => ({
          src: img.src,
          width: img.width,
          height: img.height,
          alt: img.alt
        })),
        iframes: allIframes.map(f => ({ src: f.src })),
        bodyText: document.body.innerText.substring(0, 1000)
      };
    });

    console.log('📊 Page Analysis:');
    console.log('URL:', pageAnalysis.url);
    console.log('Title:', pageAnalysis.title);
    console.log('\n🔗 Links:');
    pageAnalysis.links.forEach(link => {
      if (link.href.includes('ShowDocument') || link.href.includes('ViewDocument') ||
          link.href.includes('pdf') || link.href.includes('image') ||
          link.href.includes('CustomAttachment') || link.href.includes('gis_view')) {
        console.log(`  ⭐ ${link.text}: ${link.href}`);
      }
    });

    console.log('\n🖼️  Images:');
    pageAnalysis.images.forEach(img => {
      if (img.width > 400 || img.height > 400) {
        console.log(`  📷 ${img.src} (${img.width}x${img.height})`);
      }
    });

    console.log('\n📺 Iframes:', pageAnalysis.iframes.length);
    pageAnalysis.iframes.forEach(f => console.log(`  ${f.src}`));

    console.log('\n📄 Page Text (first 500 chars):');
    console.log(pageAnalysis.bodyText.substring(0, 500));

    // Save full analysis to file
    fs.writeFileSync('guilford-deed-page-analysis.json', JSON.stringify(pageAnalysis, null, 2));
    console.log('\n💾 Full analysis saved to: guilford-deed-page-analysis.json');

    console.log('\n⏸️  Browser staying open for manual inspection. Press Ctrl+C to exit.');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

debug().catch(console.error);
