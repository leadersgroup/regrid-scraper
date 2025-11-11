/**
 * Debug script to inspect the exact structure of the "Get image now" button
 */

const MecklenburgScraper = require('./county-implementations/mecklenburg-county-north-carolina.js');

async function debug() {
  const scraper = new MecklenburgScraper({ headless: false });

  try {
    await scraper.createBrowser();

    const address = '17209 ISLAND VIEW DR CORNELIUS NC';
    console.log('🔍 Searching...');
    await scraper.searchProperty(address);

    console.log('📄 Getting deed info...');
    await scraper.getDeedInfo();

    console.log('🖼️ Clicking image icon...');

    const newPagePromise = new Promise(resolve =>
      scraper.browser.once('targetcreated', target => resolve(target))
    );

    await scraper.page.evaluate(() => {
      const tableCells = Array.from(document.querySelectorAll('td, th'));
      for (const cell of tableCells) {
        if (cell.textContent.trim() === 'Image:' || cell.textContent.trim().startsWith('Image:')) {
          const nextCell = cell.nextElementSibling;
          if (nextCell) {
            const link = nextCell.querySelector('a');
            if (link) {
              link.click();
              return;
            }
          }
        }
      }
    });

    const exportTarget = await newPagePromise;
    await new Promise(resolve => setTimeout(resolve, 2000));

    let popupPage = await exportTarget.page();
    if (!popupPage) {
      const pages = await scraper.browser.pages();
      popupPage = pages[pages.length - 1];
    }

    console.log(`✅ Popup opened: ${popupPage.url()}`);
    scraper.page = popupPage;

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Keep Working if needed
    const keepWorking = await scraper.page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));
      for (const el of allElements) {
        if ((el.textContent || '').toLowerCase().trim() === 'keep working') {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (keepWorking) {
      console.log('✅ Clicked "Keep Working"');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Wait a bit more for dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Now inspect ALL elements that might be the "Get image now" button
    console.log('\n📊 Inspecting ALL interactive elements on the page:\n');

    const pageData = await scraper.page.evaluate(() => {
      // Get ALL potentially clickable elements
      const elements = Array.from(document.querySelectorAll('a, button, input, div[onclick], span[onclick], td[onclick]'));

      const mainElements = elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          index,
          tag: el.tagName,
          type: el.type,
          id: el.id,
          name: el.name,
          className: el.className,
          text: (el.textContent || el.value || '').trim().substring(0, 100),
          innerHTML: el.innerHTML?.substring(0, 200),
          onclick: el.onclick ? 'has onclick' : null,
          href: el.href,
          position: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        };
      });

      // Check for iframes
      const iframes = Array.from(document.querySelectorAll('iframe')).map(iframe => ({
        src: iframe.src,
        id: iframe.id,
        name: iframe.name
      }));

      // Get body text to see what's actually on the page
      const bodyText = document.body.innerText;

      return { mainElements, iframes, bodyText };
    });

    console.log('Total interactive elements in main page:', pageData.mainElements.length);
    console.log('Total iframes:', pageData.iframes.length);

    if (pageData.iframes.length > 0) {
      console.log('\n📦 Iframes found:');
      pageData.iframes.forEach((iframe, i) => {
        console.log(`  [${i}] src: ${iframe.src || '(no src)'}`);
        console.log(`      id: ${iframe.id || '(no id)'}, name: ${iframe.name || '(no name)'}`);
      });
    }

    console.log('\n📄 Page body text (first 500 chars):');
    console.log(pageData.bodyText.substring(0, 500));

    console.log('\n🔍 All interactive elements:\n');
    pageData.mainElements.forEach(el => {
      console.log(`[${el.index}] ${el.tag} (${el.className || 'no class'})`);
      console.log(`  Position: x=${el.position.x}, y=${el.position.y} (${el.position.width}x${el.position.height})`);
      console.log(`  Text: "${el.text}"`);
      console.log(`  ID: ${el.id || 'none'}`);
      if (el.onclick) console.log(`  ${el.onclick}`);
      if (el.href) console.log(`  Href: ${el.href.substring(0, 100)}`);
      console.log('');
    });

    console.log('\n⏸️ Pausing for 60 seconds - inspect the page manually...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

debug();
