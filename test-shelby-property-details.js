#!/usr/bin/env node

/**
 * Navigate to Shelby property details and find Sales History
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function examinePropertyDetails() {
  console.log('🔍 Examining Shelby County property details page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    // Go directly to property details for first property
    console.log('📍 Navigating to property details...');
    const parcelId = '001001 A00090';
    const url = `https://www.assessormelvinburgess.com/propertyDetails?parcelid=${encodeURIComponent(parcelId)}&IR=true`;

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Property details page loaded\n');

    // Take screenshot
    await page.screenshot({ path: 'shelby-property-full.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-property-full.png\n');

    // Examine page in detail
    const pageAnalysis = await page.evaluate(() => {
      const results = {
        url: window.location.href,
        title: document.title,
        headings: [],
        allText: document.body.innerText,
        salesElements: [],
        allClickable: [],
        allLinks: []
      };

      // Get all headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6, th, td, span, div, label').forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          const lowerText = text.toLowerCase();
          if (lowerText.includes('sales') || lowerText.includes('history') ||
              lowerText.includes('deed') || lowerText.includes('transfer') ||
              lowerText.includes('transaction')) {
            results.salesElements.push({
              tag: el.tagName,
              text: text,
              id: el.id || null,
              classes: el.className || null,
              visible: window.getComputedStyle(el).display !== 'none'
            });
          }
        }
      });

      // Get all clickable elements
      document.querySelectorAll('a, button, [onclick], [role="button"], [role="tab"]').forEach(el => {
        const text = el.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          results.allClickable.push({
            tag: el.tagName,
            text: text,
            href: el.href || null,
            onclick: el.getAttribute('onclick') || null,
            id: el.id || null,
            classes: el.className || null
          });
        }
      });

      // Get all links
      document.querySelectorAll('a[href]').forEach(link => {
        results.allLinks.push({
          text: link.textContent.trim().substring(0, 50),
          href: link.href
        });
      });

      return results;
    });

    console.log('📊 Property Details Page Analysis:\n');
    console.log(`URL: ${pageAnalysis.url}`);
    console.log(`Title: ${pageAnalysis.title}\n`);

    console.log('1️⃣  Elements with sales/history/deed/transfer text:');
    pageAnalysis.salesElements.forEach((el, i) => {
      console.log(`\n   ${i + 1}. <${el.tag}> "${el.text}"`);
      console.log(`      id: ${el.id}, class: ${el.classes}`);
      console.log(`      visible: ${el.visible}`);
    });
    console.log(`\n   Total: ${pageAnalysis.salesElements.length}\n`);

    console.log('2️⃣  All clickable elements (first 30):');
    pageAnalysis.allClickable.slice(0, 30).forEach((el, i) => {
      console.log(`\n   ${i + 1}. <${el.tag}> "${el.text}"`);
      if (el.href) console.log(`      href: ${el.href}`);
      if (el.onclick) console.log(`      onclick: ${el.onclick}`);
      if (el.id) console.log(`      id: ${el.id}`);
      if (el.classes) console.log(`      class: ${el.classes}`);
    });
    console.log(`\n   Total clickable: ${pageAnalysis.allClickable.length}\n`);

    console.log('3️⃣  All links (first 20):');
    pageAnalysis.allLinks.slice(0, 20).forEach((link, i) => {
      console.log(`   ${i + 1}. "${link.text}" -> ${link.href}`);
    });
    console.log(`\n   Total links: ${pageAnalysis.allLinks.length}\n`);

    console.log('4️⃣  Page text (first 3000 chars):');
    console.log(pageAnalysis.allText.substring(0, 3000));
    console.log('\n');

    console.log('✅ Analysis complete!');
    console.log('\n⏸️  Keeping browser open for 3 minutes for manual inspection...');

    await new Promise(resolve => setTimeout(resolve, 180000));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🏁 Done');
  }
}

examinePropertyDetails().catch(console.error);
