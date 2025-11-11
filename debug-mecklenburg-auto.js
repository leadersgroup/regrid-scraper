/**
 * Automated debug script to inspect the frame structure
 */

const MecklenburgScraper = require('./county-implementations/mecklenburg-county-north-carolina.js');

async function debug() {
  const scraper = new MecklenburgScraper({ headless: false });

  try {
    await scraper.createBrowser();

    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log('🔍 Searching for property...');
    await scraper.searchProperty(address);

    console.log('📄 Getting deed info...');
    await scraper.getDeedInfo();

    console.log('\n📋 Inspecting page structure...');

    // Wait a bit for page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Inspect frames
    const frameInfo = await scraper.page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('frame, iframe'));
      return {
        totalFrames: frames.length,
        frames: frames.map((f, i) => ({
          index: i,
          tag: f.tagName,
          name: f.name || '(no name)',
          id: f.id || '(no id)',
          src: f.src?.substring(0, 100) || '(no src)'
        }))
      };
    });

    console.log('\n📊 Frame Information:');
    console.log(JSON.stringify(frameInfo, null, 2));

    // Try to access bottom frame
    console.log('\n📋 Inspecting bottom frame...');
    const bottomFrameInfo = await scraper.page.evaluate(() => {
      const frames = Array.from(document.querySelectorAll('frame, iframe'));

      let bottomFrame = frames.find(f =>
        f.name && (f.name.toLowerCase().includes('bottom') || f.name.toLowerCase().includes('main'))
      );

      if (!bottomFrame && frames.length > 0) {
        bottomFrame = frames[frames.length - 1];
      }

      if (!bottomFrame) {
        return { error: 'No frame found' };
      }

      try {
        const frameDoc = bottomFrame.contentDocument || bottomFrame.contentWindow.document;

        // Look for "Image:" text
        const bodyText = frameDoc.body.innerText;
        const hasImageText = bodyText.includes('Image:');

        // Count elements
        const allElements = frameDoc.querySelectorAll('*');
        const allImages = frameDoc.querySelectorAll('img');
        const allLinks = frameDoc.querySelectorAll('a');

        // Get all table cells that might contain "Image:"
        const tableCells = Array.from(frameDoc.querySelectorAll('td, th')).filter(td =>
          td.textContent.trim() === 'Image:' || td.textContent.trim().startsWith('Image:')
        );

        const imageInfo = tableCells.map(td => {
          const row = td.parentElement;
          const nextCell = td.nextElementSibling;
          return {
            cellText: td.textContent.trim(),
            cellHTML: td.outerHTML.substring(0, 200),
            rowHTML: row?.outerHTML.substring(0, 500),
            nextCellHTML: nextCell?.outerHTML.substring(0, 300),
            nextCellHasLink: nextCell?.querySelector('a') !== null,
            nextCellHasImage: nextCell?.querySelector('img') !== null
          };
        });

        // Get all images in the frame
        const images = Array.from(allImages).map(img => ({
          src: img.src?.substring(0, 100),
          alt: img.alt,
          title: img.title,
          parentTag: img.parentElement?.tagName,
          parentIsLink: img.parentElement?.tagName === 'A',
          parentHref: img.parentElement?.tagName === 'A' ? img.parentElement.href : null
        }));

        return {
          frameName: bottomFrame.name,
          hasImageText,
          totalElements: allElements.length,
          totalImages: allImages.length,
          totalLinks: allLinks.length,
          imageLabels: imageInfo,
          images: images.slice(0, 15)
        };

      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('\n📊 Bottom Frame Content:');
    console.log(JSON.stringify(bottomFrameInfo, null, 2));

    console.log('\n⏸️  Pausing for 30 seconds so you can inspect the page...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

debug();
