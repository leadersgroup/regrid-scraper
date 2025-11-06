/**
 * Test finding and clicking the "View Deed" button
 */

const DavidsonCountyTennesseeScraper = require('./county-implementations/davidson-county-tennessee.js');

async function testViewDeed() {
  const scraper = new DavidsonCountyTennesseeScraper({
    headless: false,
    verbose: true
  });

  try {
    await scraper.initialize();

    // Navigate through the search flow
    await scraper.page.goto('https://portal.padctn.org/OFS/WP/Home', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select Address mode
    await scraper.page.evaluate(() => {
      const select = document.querySelector('#inputGroupSelect01');
      if (select) {
        select.value = '2';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Enter address
    await scraper.page.evaluate(() => {
      const numInput = document.querySelector('#streetNumber');
      const streetInput = document.querySelector('#singleSearchCriteria');

      if (numInput) {
        numInput.value = '6241';
        numInput.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (streetInput) {
        streetInput.value = 'Del Sol';
        streetInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    console.log('✅ Entered address');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Submit form
    await scraper.page.evaluate(() => {
      const form = document.querySelector('#frmQuick');
      if (form) form.submit();
    });

    console.log('⏳ Waiting for results...');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Click parcel link and wait for navigation
    await Promise.all([
      scraper.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      scraper.page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        for (const link of links) {
          if (link.textContent?.trim().includes('049 14 0A 023.00')) {
            link.click();
            return true;
          }
        }
        return false;
      })
    ]);

    console.log('✅ Navigated to parcel page');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Now analyze the page for "View Deed" button
    const pageAnalysis = await scraper.page.evaluate(() => {
      // Find all buttons and links
      const elements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));

      const clickableElements = elements.map(el => ({
        tag: el.tagName,
        type: el.type,
        text: (el.textContent || el.value || '').trim().substring(0, 100),
        id: el.id,
        className: el.className,
        href: el.getAttribute('href'),
        onclick: el.getAttribute('onclick')
      })).filter(el => el.text.length > 0);

      return {
        url: window.location.href,
        clickableElements,
        bodySnippet: document.body.innerText.substring(0, 2000)
      };
    });

    console.log('\n📍 Current URL:', pageAnalysis.url);
    console.log('\n🔘 All clickable elements:');
    pageAnalysis.clickableElements.forEach((el, i) => {
      console.log(`  ${i + 1}. [${el.tag}] "${el.text}"`);
      if (el.onclick) console.log(`      onclick: ${el.onclick.substring(0, 80)}`);
    });

    // Look specifically for "View Deed"
    const viewDeedElement = pageAnalysis.clickableElements.find(el =>
      el.text.toLowerCase().includes('view deed') ||
      el.text.toLowerCase().includes('deed')
    );

    if (viewDeedElement) {
      console.log('\n✅ Found "View Deed" element:');
      console.log(JSON.stringify(viewDeedElement, null, 2));

      console.log('\n🖱️  Clicking "View Deed"...');

      const clicked = await scraper.page.evaluate((text) => {
        const elements = Array.from(document.querySelectorAll('button, a, input'));
        for (const el of elements) {
          const elText = (el.textContent || el.value || '').trim();
          if (elText.toLowerCase().includes('view deed') || elText === text) {
            el.click();
            return true;
          }
        }
        return false;
      }, viewDeedElement.text);

      if (clicked) {
        console.log('✅ Clicked!');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const newUrl = await scraper.page.url();
        console.log('📍 New URL:', newUrl);
      }
    } else {
      console.log('\n❌ No "View Deed" button found');
    }

    console.log('\n📄 Page body snippet:');
    console.log(pageAnalysis.bodySnippet);

    await scraper.page.screenshot({ path: '/tmp/view-deed-page.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/view-deed-page.png');

    console.log('\n⏸️  Keeping browser open (2 min)...');
    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (scraper.browser) {
      await scraper.browser.close();
    }
  }
}

testViewDeed().catch(console.error);
