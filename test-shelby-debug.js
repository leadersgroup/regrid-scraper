#!/usr/bin/env node

/**
 * Debug Shelby County scraper - take screenshots and log page structure
 */

const ShelbyCountyTennesseeScraper = require('./county-implementations/shelby-county-tennessee');

async function debugShelbyCounty() {
  console.log('🔍 Debug mode: Examining Shelby County page structure...\n');

  const scraper = new ShelbyCountyTennesseeScraper({
    headless: false,
    verbose: true,
    timeout: 120000
  });

  try {
    const testAddress = '809 Harbor Isle Cir W, Memphis, TN 38103, USA';
    console.log(`Testing address: ${testAddress}\n`);

    // Parse address
    const { number, street } = scraper.parseAddress(testAddress);
    console.log(`Parsed: number="${number}", street="${street}"\n`);

    await scraper.initialize();

    // Navigate to assessor
    console.log('📍 Step 1: Navigating to Property Assessor...');
    await scraper.page.goto('https://www.assessormelvinburgess.com/propertySearch', {
      waitUntil: 'networkidle0',
      timeout: scraper.timeout
    });
    await scraper.randomWait(2000, 3000);

    // Enter search criteria
    console.log('🔍 Step 2: Entering search criteria...');
    await scraper.page.type('input[name="streetNumber"]', number);
    await scraper.randomWait(500, 1000);
    await scraper.page.type('input[name="streetName"]', street);
    await scraper.randomWait(1000, 2000);

    // Submit search
    console.log('📤 Step 3: Submitting search...');
    await Promise.all([
      scraper.page.click('button[type="submit"]'),
      scraper.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 })
    ]);
    await scraper.randomWait(2000, 3000);

    // Click View
    console.log('👁️  Step 4: Clicking View button...');
    await scraper.page.click('button:has-text("View"), a:has-text("View")');
    await scraper.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });
    await scraper.randomWait(3000, 4000);

    console.log('✅ Successfully navigated to property details page\n');

    // Take screenshot
    await scraper.page.screenshot({ path: 'shelby-property-details.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-property-details.png\n');

    // Now let's examine the page structure
    console.log('🔍 Examining page structure...\n');

    const pageAnalysis = await scraper.page.evaluate(() => {
      const results = {
        allTextElements: [],
        allLinks: [],
        tabElements: [],
        buttonElements: [],
        clickableElements: []
      };

      // Find all elements with "sales" or "history" in text
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach(el => {
        const text = (el.textContent || '').toLowerCase();
        if ((text.includes('sales') || text.includes('history')) && el.children.length === 0) {
          // Leaf node with sales/history text
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
      document.querySelectorAll('[role="tab"], .tab, .nav-tab, .nav-link').forEach(tab => {
        results.tabElements.push({
          tag: tab.tagName,
          text: tab.textContent.trim().substring(0, 50),
          classes: tab.className,
          role: tab.getAttribute('role')
        });
      });

      // Find all buttons
      document.querySelectorAll('button, [role="button"]').forEach(btn => {
        const text = btn.textContent.trim();
        if (text.length > 0 && text.length < 100) {
          results.buttonElements.push({
            text: text,
            type: btn.type || 'button'
          });
        }
      });

      // Find all clickable elements with sales/history
      document.querySelectorAll('a, button, div[onclick], span[onclick], [role="tab"]').forEach(el => {
        const text = (el.textContent || '').toLowerCase().trim();
        if (text.includes('sales') || text.includes('history')) {
          results.clickableElements.push({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 100),
            onclick: !!el.onclick || !!el.getAttribute('onclick'),
            href: el.href || null,
            visible: window.getComputedStyle(el).display !== 'none'
          });
        }
      });

      return results;
    });

    console.log('📊 Page Analysis Results:\n');

    console.log('1️⃣  Elements with "sales" or "history" text:');
    pageAnalysis.allTextElements.slice(0, 10).forEach((el, i) => {
      console.log(`   ${i + 1}. <${el.tag}> "${el.text}" (visible: ${el.visible})`);
    });
    console.log(`   Total: ${pageAnalysis.allTextElements.length}\n`);

    console.log('2️⃣  All links on page:');
    pageAnalysis.allLinks.slice(0, 15).forEach((link, i) => {
      console.log(`   ${i + 1}. "${link.text}" -> ${link.href.substring(0, 80)}`);
    });
    console.log(`   Total: ${pageAnalysis.allLinks.length}\n`);

    console.log('3️⃣  Tab elements:');
    pageAnalysis.tabElements.forEach((tab, i) => {
      console.log(`   ${i + 1}. <${tab.tag}> "${tab.text}" (role: ${tab.role}, class: ${tab.classes})`);
    });
    console.log(`   Total: ${pageAnalysis.tabElements.length}\n`);

    console.log('4️⃣  Buttons:');
    pageAnalysis.buttonElements.slice(0, 10).forEach((btn, i) => {
      console.log(`   ${i + 1}. "${btn.text}" (type: ${btn.type})`);
    });
    console.log(`   Total: ${pageAnalysis.buttonElements.length}\n`);

    console.log('5️⃣  Clickable elements with sales/history:');
    pageAnalysis.clickableElements.forEach((el, i) => {
      console.log(`   ${i + 1}. <${el.tag}> "${el.text}" (visible: ${el.visible}, onclick: ${el.onclick})`);
      if (el.href) console.log(`      -> ${el.href}`);
    });
    console.log(`   Total: ${pageAnalysis.clickableElements.length}\n`);

    console.log('✅ Debug analysis complete! Check shelby-property-details.png for visual reference.');
    console.log('\n⏸️  Pausing for manual inspection (press Ctrl+C to exit)...');

    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await scraper.close();
    console.log('\n🏁 Debug complete');
  }
}

// Run the debug
debugShelbyCounty().catch(console.error);
