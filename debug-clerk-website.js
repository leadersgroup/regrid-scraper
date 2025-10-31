/**
 * Debug the Orange County Clerk of Courts website
 * This is where deeds are actually recorded
 */

const puppeteer = require('puppeteer');

async function debugClerkWebsite() {
  console.log('🔍 Testing Orange County Clerk of Courts Official Records\n');

  const parcelId = '272324542803770';
  const address = '12729 HAWKSTONE DR';

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {
    // Navigate to official records search
    console.log('Navigating to Clerk Official Records...');
    await page.goto('https://myorangeclerk.com/official-records/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const pageInfo = await page.evaluate(() => {
      // Find search options
      const links = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent?.trim(),
        href: a.href
      })).filter(l => l.text && l.text.length < 200);

      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        id: b.id,
        classes: b.className
      }));

      const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type,
        name: i.name,
        id: i.id,
        placeholder: i.placeholder
      }));

      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 3000),
        links: links.slice(0, 30),
        buttons,
        inputs
      };
    });

    console.log('='.repeat(80));
    console.log('CLERK WEBSITE INFO:');
    console.log('='.repeat(80));
    console.log(`Title: ${pageInfo.title}`);
    console.log(`URL: ${pageInfo.url}`);

    console.log('\n' + '='.repeat(80));
    console.log('PAGE TEXT:');
    console.log('='.repeat(80));
    console.log(pageInfo.bodyText);

    console.log('\n' + '='.repeat(80));
    console.log('LINKS (first 30):');
    console.log('='.repeat(80));
    pageInfo.links.forEach((link, i) => {
      console.log(`  ${i + 1}. "${link.text}"`);
      if (link.href && !link.href.includes('mailto:') && !link.href.includes('tel:')) {
        console.log(`     -> ${link.href}`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('BUTTONS:');
    console.log('='.repeat(80));
    pageInfo.buttons.forEach((btn, i) => {
      if (btn.text) {
        console.log(`  ${i + 1}. "${btn.text}" (id: ${btn.id})`);
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('INPUT FIELDS:');
    console.log('='.repeat(80));
    pageInfo.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
    });

    // Look for search by address option
    console.log('\n' + '='.repeat(80));
    console.log('Looking for "Search by Address" or similar...');
    console.log('='.repeat(80));

    const searchLinks = pageInfo.links.filter(l =>
      l.text.toLowerCase().includes('search') ||
      l.text.toLowerCase().includes('property') ||
      l.text.toLowerCase().includes('address') ||
      l.text.toLowerCase().includes('parcel')
    );

    if (searchLinks.length > 0) {
      console.log('Found relevant search links:');
      searchLinks.forEach((link, i) => {
        console.log(`  ${i + 1}. "${link.text}" -> ${link.href}`);
      });

      // Try the first one
      if (searchLinks[0].href) {
        console.log(`\nNavigating to: ${searchLinks[0].href}`);
        await page.goto(searchLinks[0].href, {
          waitUntil: 'networkidle2',
          timeout: 60000
        });

        await new Promise(resolve => setTimeout(resolve, 5000));

        const searchPageInfo = await page.evaluate(() => {
          return {
            title: document.title,
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 3000)
          };
        });

        console.log('\n' + '='.repeat(80));
        console.log('SEARCH PAGE INFO:');
        console.log('='.repeat(80));
        console.log(`Title: ${searchPageInfo.title}`);
        console.log(`URL: ${searchPageInfo.url}`);
        console.log(`\n${searchPageInfo.bodyText}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugClerkWebsite();
