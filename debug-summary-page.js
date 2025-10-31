/**
 * Debug script to see what's on the Orange County Property summary page
 */

const puppeteer = require('puppeteer');

async function debugSummaryPage() {
  console.log('🔍 Debugging Orange County Property Appraiser Summary Page\n');

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

    // Extract all tabs/navigation elements
    const pageInfo = await page.evaluate(() => {
      // Find all navigation tabs
      const navElements = Array.from(document.querySelectorAll('nav a, nav button, [role="tab"], .nav-link, .tab'));
      const tabs = navElements.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim(),
        href: el.href || null,
        classes: el.className,
        id: el.id,
        role: el.getAttribute('role')
      }));

      // Get all links
      const allLinks = Array.from(document.querySelectorAll('a')).map(link => ({
        text: link.textContent?.trim(),
        href: link.href,
        classes: link.className
      })).filter(l => l.text && l.text.length < 200);

      // Look for specific keywords in body
      const bodyText = document.body.innerText;
      const hasSaleInfo = bodyText.toLowerCase().includes('sale');
      const hasDeedInfo = bodyText.toLowerCase().includes('deed');
      const hasDocumentInfo = bodyText.toLowerCase().includes('document');
      const hasORInfo = bodyText.toLowerCase().includes('official record');

      // Find numeric patterns
      const numericPatterns = [...new Set(bodyText.match(/\d{10,12}/g) || [])];

      return {
        tabs,
        hasSaleInfo,
        hasDeedInfo,
        hasDocumentInfo,
        hasORInfo,
        numericPatterns,
        bodyText: bodyText.substring(0, 3000),
        firstLinks: allLinks.slice(0, 30)
      };
    });

    console.log('='.repeat(80));
    console.log('NAVIGATION TABS/ELEMENTS:');
    console.log('='.repeat(80));
    pageInfo.tabs.forEach((tab, i) => {
      console.log(`  ${i + 1}. <${tab.tag}> "${tab.text}"`);
      if (tab.href) console.log(`     href: ${tab.href}`);
      if (tab.classes) console.log(`     class: ${tab.classes}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('CONTENT INDICATORS:');
    console.log('='.repeat(80));
    console.log(`  Sale information: ${pageInfo.hasSaleInfo ? 'YES' : 'NO'}`);
    console.log(`  Deed information: ${pageInfo.hasDeedInfo ? 'YES' : 'NO'}`);
    console.log(`  Document info: ${pageInfo.hasDocumentInfo ? 'YES' : 'NO'}`);
    console.log(`  Official Record: ${pageInfo.hasORInfo ? 'YES' : 'NO'}`);

    console.log('\n' + '='.repeat(80));
    console.log('NUMERIC PATTERNS (10-12 digits):');
    console.log('='.repeat(80));
    pageInfo.numericPatterns.forEach((pattern, i) => {
      console.log(`  ${i + 1}. ${pattern}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('FIRST 30 LINKS:');
    console.log('='.repeat(80));
    pageInfo.firstLinks.forEach((link, i) => {
      console.log(`  ${i + 1}. "${link.text}"`);
      if (link.href && !link.href.startsWith('mailto:') && !link.href.startsWith('tel:')) {
        console.log(`     -> ${link.href}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('PAGE TEXT (first 3000 chars):');
    console.log('='.repeat(80));
    console.log(pageInfo.bodyText);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugSummaryPage();
