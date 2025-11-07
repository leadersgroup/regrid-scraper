const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing PublicSearch Deed Click\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Go directly to the publicsearch results page
    console.log('Loading publicsearch results page...');
    await page.goto('https://tarrant.tx.publicsearch.us/results?department=RP&documentNumberRange=%5B%22D225045226%22%5D&searchType=advancedSearch', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n📊 Analyzing table structure...\n');

    const tableInfo = await page.evaluate(() => {
      // Find all clickable elements with instrument number
      const results = [];
      const elements = Array.from(document.querySelectorAll('a, button, td, tr'));

      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        if (/D225045226/.test(text)) {
          results.push({
            tag: el.tagName,
            text: text.substring(0, 100),
            isLink: el.tagName === 'A',
            href: el.href || null,
            hasClick: typeof el.onclick === 'function',
            id: el.id || null,
            className: el.className || null
          });
        }
      }

      return {
        found: results,
        tableHtml: document.querySelector('table, [role="table"], .results-table')?.outerHTML.substring(0, 2000) || 'No table found'
      };
    });

    console.log('Elements with instrument number:');
    tableInfo.found.forEach((item, i) => {
      console.log(`\n${i + 1}. <${item.tag}>`);
      console.log(`   Text: "${item.text}"`);
      console.log(`   Is Link: ${item.isLink}`);
      console.log(`   Href: ${item.href}`);
      console.log(`   Has onClick: ${item.hasClick}`);
      if (item.id) console.log(`   ID: ${item.id}`);
      if (item.className) console.log(`   Class: ${item.className}`);
    });

    console.log('\n\n📋 Attempting to click instrument number in table...');

    // Listen for new page/tab or navigation
    let newPageOpened = false;
    const newPagePromise = new Promise(resolve => {
      browser.on('targetcreated', async (target) => {
        if (target.type() === 'page') {
          newPageOpened = true;
          const np = await target.page();
          resolve(np);
        }
      });
      setTimeout(() => resolve(null), 15000);
    });

    // Try clicking the instrument number
    const clickResult = await page.evaluate(() => {
      // Strategy 1: Find clickable row or link with instrument number
      const rows = Array.from(document.querySelectorAll('tr, [role="row"]'));

      for (const row of rows) {
        const text = row.textContent || '';
        if (/D225045226/.test(text)) {
          // Check if row itself is clickable
          if (row.onclick || row.style.cursor === 'pointer') {
            row.click();
            return { clicked: true, method: 'row-click', text: text.substring(0, 100) };
          }

          // Look for clickable elements within row
          const links = row.querySelectorAll('a');
          for (const link of links) {
            if (/D225045226/.test(link.textContent)) {
              link.click();
              return { clicked: true, method: 'instrument-link', href: link.href, text: link.textContent.trim() };
            }
          }

          // Try clicking any link in the row
          if (links.length > 0) {
            links[0].click();
            return { clicked: true, method: 'first-link-in-row', href: links[0].href };
          }

          // Try clicking the row itself
          row.click();
          return { clicked: true, method: 'row-general-click' };
        }
      }

      return { clicked: false };
    });

    console.log('Click result:', clickResult);

    if (clickResult.clicked) {
      console.log('\n⏳ Waiting for page change...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check if new page opened
      const newPage = await newPagePromise;

      if (newPage) {
        console.log('\n✅ New page/tab opened!');
        await new Promise(resolve => setTimeout(resolve, 3000));

        const pageInfo = await newPage.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 1500)
          };
        });

        console.log('URL:', pageInfo.url);
        console.log('Title:', pageInfo.title);
        console.log('\nContent:');
        console.log(pageInfo.bodyText);

      } else {
        // Check if current page changed
        const pageInfo = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 1500)
          };
        });

        console.log('\n📄 Current page (no new tab):');
        console.log('URL:', pageInfo.url);
        console.log('Title:', pageInfo.title);
        console.log('\nContent:');
        console.log(pageInfo.bodyText);
      }
    }

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
