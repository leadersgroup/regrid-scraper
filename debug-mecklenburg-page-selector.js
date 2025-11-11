/**
 * Debug Mecklenburg - find page navigation mechanism (thumbnails or page selector)
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating...');
    await page.goto('https://polaris3g.mecklenburgcountync.gov/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter search
    const searchInput = await page.$('input[placeholder*="address"], input[placeholder*="Address"], input[type="text"]');
    await searchInput.click();
    await searchInput.type('17209 island view', { delay: 100 });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click autocomplete
    await page.evaluate(() => {
      const listItems = Array.from(document.querySelectorAll('ul.bg-lienzo li'));
      if (listItems.length > 0) {
        const clickableDiv = listItems[0].querySelector('div.hover\\:cursor-pointer');
        if (clickableDiv) clickableDiv.click();
      }
    });

    console.log('⏳ Waiting for property page...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Setup new tab listener
    const newPagePromise = new Promise(resolve =>
      browser.once('targetcreated', target => resolve(target.page()))
    );

    // Click deed link
    await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a'));
      for (const link of allLinks) {
        const text = link.textContent.trim();
        if (/^\d{4,5}-\d{1,5}$/.test(text)) {
          link.click();
          return;
        }
      }
    });

    console.log('⏳ Waiting for new tab...');
    const rodPage = await newPagePromise;
    await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});

    console.log(`✅ New tab: ${rodPage.url()}`);

    // Accept disclaimer
    await new Promise(resolve => setTimeout(resolve, 3000));

    const disclaimerClicked = await rodPage.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, button'));
      for (const el of allElements) {
        const text = el.textContent.toLowerCase();
        if (text.includes('click here to acknowledge') ||
            text.includes('acknowledge the disclaimer') ||
            text.includes('enter the site')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    if (disclaimerClicked) {
      console.log('✅ Clicked disclaimer');
      await rodPage.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    console.log(`\n📍 Current URL: ${rodPage.url()}`);

    // Find the LTViewer iframe
    const frames = rodPage.frames();
    let viewerFrame = null;

    for (const frame of frames) {
      if (frame.url().includes('LTViewer')) {
        viewerFrame = frame;
        break;
      }
    }

    if (!viewerFrame) {
      console.log('❌ Could not find LTViewer iframe');
      return;
    }

    console.log('✅ Found LTViewer iframe');

    // Look for page navigation elements
    console.log('\n=== SEARCHING FOR PAGE NAVIGATION ===');

    const navInfo = await viewerFrame.evaluate(() => {
      const result = {
        thumbnailStrips: [],
        pageSelectors: [],
        pageNumbers: [],
        divs: [],
        tables: [],
        globalFunctions: []
      };

      // Look for thumbnail strips (divs/tables with multiple images or page indicators)
      const allDivs = document.querySelectorAll('div');
      allDivs.forEach((div, idx) => {
        const id = div.id || '';
        const className = div.className || '';
        const text = (div.innerText || '').substring(0, 50);

        // Check if div contains page-related keywords or multiple items
        if (id.toLowerCase().includes('thumb') ||
            id.toLowerCase().includes('page') ||
            className.toLowerCase().includes('thumb') ||
            className.toLowerCase().includes('page') ||
            text.match(/\d+\s*\/\s*\d+/) || // "1 / 3" pattern
            text.match(/page\s*\d+/i)) {
          result.divs.push({
            index: idx,
            id,
            className,
            text,
            children: div.children.length
          });
        }
      });

      // Look for tables (thumbnail strips often use tables)
      const allTables = document.querySelectorAll('table');
      allTables.forEach((table, idx) => {
        const id = table.id || '';
        const className = table.className || '';

        if (id.toLowerCase().includes('thumb') ||
            id.toLowerCase().includes('page') ||
            className.toLowerCase().includes('thumb') ||
            className.toLowerCase().includes('page')) {
          result.tables.push({
            index: idx,
            id,
            className,
            rows: table.rows.length,
            cells: table.rows[0] ? table.rows[0].cells.length : 0
          });
        }
      });

      // Look for page number text elements
      const allSpans = document.querySelectorAll('span, div');
      allSpans.forEach(el => {
        const text = el.textContent.trim();
        // Look for patterns like "Page 1 of 3" or "1/3" or just "1" "2" "3"
        if (/^(page\s*)?\d+(\s*of\s*\d+)?$/i.test(text) ||
            /^\d+\s*\/\s*\d+$/.test(text)) {
          result.pageNumbers.push({
            tag: el.tagName,
            text,
            id: el.id,
            className: el.className,
            clickable: el.onclick !== null || el.style.cursor === 'pointer'
          });
        }
      });

      // Look for JavaScript functions that might control pages
      for (const key in window) {
        if (typeof window[key] === 'function') {
          const name = key.toLowerCase();
          if (name.includes('page') || name.includes('next') || name.includes('prev') ||
              name.includes('goto') || name.includes('thumb')) {
            result.globalFunctions.push(key);
          }
        }
      }

      return result;
    });

    console.log('\n--- Divs with page/thumbnail indicators ---');
    navInfo.divs.forEach(div => {
      console.log(`\nDiv [${div.index}]:`);
      console.log(`  ID: ${div.id}`);
      console.log(`  Class: ${div.className}`);
      console.log(`  Text: ${div.text}`);
      console.log(`  Children: ${div.children}`);
    });

    console.log('\n--- Tables with page/thumbnail indicators ---');
    navInfo.tables.forEach(table => {
      console.log(`\nTable [${table.index}]:`);
      console.log(`  ID: ${table.id}`);
      console.log(`  Class: ${table.className}`);
      console.log(`  Rows: ${table.rows}, Cells: ${table.cells}`);
    });

    console.log('\n--- Page number elements ---');
    navInfo.pageNumbers.forEach(pn => {
      console.log(`\n${pn.tag}: "${pn.text}"`);
      console.log(`  ID: ${pn.id}`);
      console.log(`  Class: ${pn.className}`);
      console.log(`  Clickable: ${pn.clickable}`);
    });

    console.log('\n--- Global functions for page navigation ---');
    navInfo.globalFunctions.forEach(fn => {
      console.log(`  ${fn}()`);
    });

    // Also check the Thumbnail Strip control if it exists
    console.log('\n=== CHECKING THUMBNAIL STRIP CONTROL ===');
    const thumbnailInfo = await viewerFrame.evaluate(() => {
      const result = {
        found: false,
        id: '',
        thumbnails: []
      };

      // Look for WTV (WebThumbnailViewer) elements
      const wtv = document.querySelector('[id^="WTV"]');
      if (wtv) {
        result.found = true;
        result.id = wtv.id;

        // Look for thumbnail images
        const thumbs = wtv.querySelectorAll('img, div[onclick]');
        thumbs.forEach((thumb, idx) => {
          result.thumbnails.push({
            index: idx,
            tag: thumb.tagName,
            id: thumb.id,
            className: thumb.className,
            onclick: thumb.getAttribute('onclick') || '',
            src: thumb.src || ''
          });
        });
      }

      return result;
    });

    if (thumbnailInfo.found) {
      console.log(`✅ Found Thumbnail Strip: ${thumbnailInfo.id}`);
      console.log(`   Thumbnails: ${thumbnailInfo.thumbnails.length}`);
      thumbnailInfo.thumbnails.forEach(thumb => {
        console.log(`\n   [${thumb.index}] ${thumb.tag}`);
        if (thumb.id) console.log(`      ID: ${thumb.id}`);
        if (thumb.onclick) console.log(`      OnClick: ${thumb.onclick.substring(0, 100)}`);
        if (thumb.src) console.log(`      Src: ${thumb.src.substring(thumb.src.lastIndexOf('/') + 1)}`);
      });
    } else {
      console.log('❌ No Thumbnail Strip found');
    }

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    console.log('💡 Look for the page selector or thumbnail strip in the browser');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
