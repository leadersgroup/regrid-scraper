#!/usr/bin/env node

/**
 * Navigate to Shelby County property details and examine the page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function examinePropertyDetails() {
  console.log('🔍 Navigating to Shelby County property details...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    // Navigate to assessor
    console.log('📍 Step 1: Navigating to Property Assessor...');
    await page.goto('https://www.assessormelvinburgess.com/propertySearch', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter search criteria
    console.log('🔍 Step 2: Entering search criteria...');
    await page.type('#stNumber', '809');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.type('#stName', 'harbor isle');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit search
    console.log('📤 Step 3: Submitting search...');

    // Click submit button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.click('button[type="submit"]')
    ]);

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Search results page loaded');

    // Take screenshot of search results
    await page.screenshot({ path: 'shelby-search-results.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-search-results.png\n');

    // Check for view buttons
    const viewInfo = await page.evaluate(() => {
      const viewButtons = Array.from(document.querySelectorAll('button, a, input'))
        .filter(el => {
          const text = (el.textContent || el.value || '').toLowerCase().trim();
          return text.includes('view');
        });

      return {
        count: viewButtons.length,
        buttons: viewButtons.map(btn => ({
          tag: btn.tagName,
          text: btn.textContent || btn.value || '',
          onclick: !!btn.onclick
        }))
      };
    });

    console.log(`📊 Found ${viewInfo.count} view buttons:`);
    viewInfo.buttons.forEach((btn, i) => {
      console.log(`   ${i + 1}. <${btn.tag}> "${btn.text}"`);
    });
    console.log();

    // Click View button
    console.log('👁️  Step 4: Clicking View button...');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
      page.evaluate(() => {
        const viewButtons = Array.from(document.querySelectorAll('button, a, input'))
          .filter(el => {
            const text = (el.textContent || el.value || '').toLowerCase().trim();
            return text.includes('view');
          });
        if (viewButtons.length > 0) {
          viewButtons[0].click();
        }
      })
    ]);

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✅ Property details page loaded\n');

    // Take screenshot
    await page.screenshot({ path: 'shelby-property-details.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-property-details.png\n');

    // Examine property details page
    const detailsAnalysis = await page.evaluate(() => {
      const results = {
        allTextElements: [],
        allLinks: [],
        tabElements: [],
        headings: [],
        clickableSalesHistory: []
      };

      // Find headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
        results.headings.push({
          tag: h.tagName,
          text: h.textContent.trim()
        });
      });

      // Find all elements with "sales" or "history" in text
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach(el => {
        const text = (el.textContent || '').toLowerCase();
        if ((text.includes('sales') || text.includes('history')) && el.children.length === 0) {
          results.allTextElements.push({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 100),
            visible: window.getComputedStyle(el).display !== 'none',
            classes: el.className
          });
        }
      });

      // Find all links
      document.querySelectorAll('a[href]').forEach(link => {
        const text = link.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          results.allLinks.push({
            text: text,
            href: link.href,
            visible: window.getComputedStyle(link).display !== 'none'
          });
        }
      });

      // Find all tab-like elements
      document.querySelectorAll('[role="tab"], .tab, .nav-tab, .nav-link, a').forEach(tab => {
        const text = tab.textContent.trim();
        if (text.length > 0 && text.length < 50) {
          results.tabElements.push({
            tag: tab.tagName,
            text: text,
            classes: tab.className,
            role: tab.getAttribute('role'),
            href: tab.href || null
          });
        }
      });

      // Find clickable elements with sales/history
      document.querySelectorAll('a, button, div[onclick], span[onclick], [role="tab"]').forEach(el => {
        const text = (el.textContent || '').toLowerCase().trim();
        if (text.includes('sales') || text.includes('history')) {
          results.clickableSalesHistory.push({
            tag: el.tagName,
            text: el.textContent.trim(),
            onclick: !!el.onclick || !!el.getAttribute('onclick'),
            href: el.href || null,
            visible: window.getComputedStyle(el).display !== 'none',
            classes: el.className
          });
        }
      });

      return results;
    });

    console.log('📊 Property Details Page Analysis:\n');

    console.log('1️⃣  Page headings:');
    detailsAnalysis.headings.forEach((h, i) => {
      console.log(`   ${i + 1}. <${h.tag}> "${h.text}"`);
    });
    console.log();

    console.log('2️⃣  Elements with "sales" or "history" text:');
    detailsAnalysis.allTextElements.slice(0, 15).forEach((el, i) => {
      console.log(`   ${i + 1}. <${el.tag}> "${el.text}" (visible: ${el.visible}, class: ${el.classes})`);
    });
    console.log(`   Total: ${detailsAnalysis.allTextElements.length}\n`);

    console.log('3️⃣  All links on page (first 20):');
    detailsAnalysis.allLinks.slice(0, 20).forEach((link, i) => {
      console.log(`   ${i + 1}. "${link.text}"`);
      console.log(`      -> ${link.href}`);
    });
    console.log(`   Total: ${detailsAnalysis.allLinks.length}\n`);

    console.log('4️⃣  Tab-like elements (first 15):');
    detailsAnalysis.tabElements.slice(0, 15).forEach((tab, i) => {
      console.log(`   ${i + 1}. <${tab.tag}> "${tab.text}" (class: ${tab.classes})`);
      if (tab.href) console.log(`      -> ${tab.href}`);
    });
    console.log(`   Total: ${detailsAnalysis.tabElements.length}\n`);

    console.log('5️⃣  Clickable elements with "sales" or "history":');
    detailsAnalysis.clickableSalesHistory.forEach((el, i) => {
      console.log(`   ${i + 1}. <${el.tag}> "${el.text}"`);
      console.log(`      visible: ${el.visible}, onclick: ${el.onclick}, class: ${el.classes}`);
      if (el.href) console.log(`      -> ${el.href}`);
    });
    console.log(`   Total: ${detailsAnalysis.clickableSalesHistory.length}\n`);

    console.log('✅ Analysis complete!');
    console.log('\n⏸️  Keeping browser open for 3 minutes for manual inspection...');
    console.log('     Check the screenshots and the browser window.');

    await new Promise(resolve => setTimeout(resolve, 180000)); // 3 minutes

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🏁 Done');
  }
}

examinePropertyDetails().catch(console.error);
