/**
 * Debug script to see what's on the Orange County Sales tab
 */

const puppeteer = require('puppeteer');

async function debugSalesTab() {
  console.log('🔍 Debugging Orange County Property Appraiser Sales Tab\n');

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

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Look for sales tab/link
    console.log('\n' + '='.repeat(80));
    console.log('Looking for Sales tab...');
    console.log('='.repeat(80));

    const salesInfo = await page.evaluate(() => {
      // Find all links and buttons
      const allElements = Array.from(document.querySelectorAll('a, button, li, div[role="tab"], [class*="tab"]'));
      const salesElements = [];

      for (const el of allElements) {
        const text = el.textContent?.toLowerCase() || '';
        if (text.includes('sale') && text.length < 100) {
          salesElements.push({
            tag: el.tagName,
            text: el.textContent?.trim(),
            href: el.href || null,
            classes: el.className,
            id: el.id
          });
        }
      }

      return {
        salesElements,
        bodyText: document.body.innerText.substring(0, 2000)
      };
    });

    console.log(`\nFound ${salesInfo.salesElements.length} elements mentioning "sale":`);
    salesInfo.salesElements.forEach((el, i) => {
      console.log(`  ${i + 1}. <${el.tag}> "${el.text}" - class: ${el.classes}, id: ${el.id}`);
      if (el.href) console.log(`     href: ${el.href}`);
    });

    // Try to click on first sales element
    if (salesInfo.salesElements.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('Clicking on Sales element...');
      console.log('='.repeat(80));

      const clicked = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('a, button, li, div[role="tab"]'));
        const salesElement = allElements.find(el => {
          const text = el.textContent?.toLowerCase() || '';
          return text.includes('sale') && text.length < 50;
        });

        if (salesElement) {
          salesElement.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log('✅ Clicked on Sales element');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Extract page content after clicking
        const afterClick = await page.evaluate(() => {
          // Look for all links
          const links = Array.from(document.querySelectorAll('a')).slice(0, 50).map(link => ({
            text: link.textContent?.trim(),
            href: link.href
          }));

          // Look for numeric patterns that might be document IDs
          const text = document.body.innerText;
          const numericPatterns = text.match(/\d{10,12}/g) || [];

          return {
            bodyText: text.substring(0, 3000),
            links,
            numericPatterns: numericPatterns.slice(0, 20)
          };
        });

        console.log('\n' + '='.repeat(80));
        console.log('PAGE CONTENT AFTER CLICKING SALES');
        console.log('='.repeat(80));
        console.log(afterClick.bodyText);

        console.log('\n' + '='.repeat(80));
        console.log('LINKS ON PAGE (first 50):');
        console.log('='.repeat(80));
        afterClick.links.forEach((link, i) => {
          if (link.text && link.text.length < 200) {
            console.log(`  ${i + 1}. "${link.text}"`);
            if (link.href) console.log(`     -> ${link.href}`);
          }
        });

        console.log('\n' + '='.repeat(80));
        console.log('NUMERIC PATTERNS (10-12 digits):');
        console.log('='.repeat(80));
        afterClick.numericPatterns.forEach((pattern, i) => {
          console.log(`  ${i + 1}. ${pattern}`);
        });
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugSalesTab();
