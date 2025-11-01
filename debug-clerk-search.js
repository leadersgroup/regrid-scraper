/**
 * Debug Orange County Clerk website to understand its search structure
 */

const puppeteer = require('puppeteer');

async function debugClerkSearch() {
  console.log('🔍 Investigating Orange County Clerk Website\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Orange County Clerk...');
    await page.goto('https://myeclerk.myorangeclerk.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check what's on the landing page
    console.log('\n' + '='.repeat(80));
    console.log('LANDING PAGE CONTENT:');
    console.log('='.repeat(80));

    const landingInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 2000),
        // Look for search-related links
        searchLinks: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        })).filter(l =>
          l.text && (
            l.text.toLowerCase().includes('search') ||
            l.text.toLowerCase().includes('record') ||
            l.text.toLowerCase().includes('document') ||
            l.text.toLowerCase().includes('official')
          )
        ),
        // Look for any input fields
        inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder
        }))
      };
    });

    console.log(`URL: ${landingInfo.url}`);
    console.log(`Title: ${landingInfo.title}`);
    console.log(`\nBody Text:\n${landingInfo.bodyText}`);

    console.log('\n' + '='.repeat(80));
    console.log('SEARCH-RELATED LINKS:');
    console.log('='.repeat(80));
    landingInfo.searchLinks.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}"`);
      console.log(`   ${link.href}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('INPUT FIELDS ON PAGE:');
    console.log('='.repeat(80));
    landingInfo.inputs.forEach((input, i) => {
      console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
    });

    // Try clicking on "Official Records" or "OR Search" link if available
    const officialRecordsClicked = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        const text = link.textContent?.trim().toLowerCase() || '';
        if (text.includes('official record') || text.includes('or search') || text === 'search') {
          console.log('Clicking:', link.textContent);
          link.click();
          return { clicked: true, text: link.textContent };
        }
      }
      return { clicked: false };
    });

    if (officialRecordsClicked.clicked) {
      console.log(`\n✅ Clicked on: "${officialRecordsClicked.text}"`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      const searchPageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 3000),
          inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            value: input.value
          })),
          buttons: Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
            text: btn.textContent?.trim() || btn.value,
            type: btn.type,
            id: btn.id,
            name: btn.name
          }))
        };
      });

      console.log('\n' + '='.repeat(80));
      console.log('SEARCH PAGE:');
      console.log('='.repeat(80));
      console.log(`URL: ${searchPageInfo.url}`);
      console.log(`Title: ${searchPageInfo.title}`);
      console.log(`\nBody Text:\n${searchPageInfo.bodyText}`);

      console.log('\n' + '='.repeat(80));
      console.log('SEARCH PAGE INPUTS:');
      console.log('='.repeat(80));
      searchPageInfo.inputs.forEach((input, i) => {
        console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
      });

      console.log('\n' + '='.repeat(80));
      console.log('BUTTONS:');
      console.log('='.repeat(80));
      searchPageInfo.buttons.forEach((btn, i) => {
        console.log(`${i + 1}. Text: "${btn.text}", Type: ${btn.type}, ID: ${btn.id}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 60 seconds for manual inspection...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugClerkSearch();
