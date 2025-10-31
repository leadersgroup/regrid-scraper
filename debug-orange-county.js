/**
 * Debug Orange County Property Appraiser website structure
 */

const puppeteer = require('puppeteer');

async function debugOrangeCounty() {
  console.log('🔍 Debugging Orange County Property Appraiser website\n');

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  try {
    // Test 1: Property Appraiser parcel search
    console.log('Test 1: Navigating to Property Appraiser Parcel Search...');
    await page.goto('https://www.ocpafl.org/searches/ParcelSearch.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const pageData1 = await page.evaluate(() => {
      // Get all input fields
      const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder,
        value: input.value
      }));

      // Get all buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).map(btn => ({
        type: btn.type,
        text: btn.textContent?.trim() || btn.value,
        id: btn.id,
        name: btn.name
      }));

      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 1000),
        inputs,
        buttons
      };
    });

    console.log('\n' + '='.repeat(80));
    console.log('PROPERTY APPRAISER PAGE INFO');
    console.log('='.repeat(80));
    console.log(`Title: ${pageData1.title}`);
    console.log(`URL: ${pageData1.url}`);
    console.log(`\nPage Text (first 1000 chars):\n${pageData1.bodyText}`);
    console.log(`\nInput Fields:`);
    pageData1.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
    });
    console.log(`\nButtons:`);
    pageData1.buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. Type: ${btn.type}, Text: ${btn.text}, ID: ${btn.id}`);
    });

    // Test 2: Clerk of Courts Official Records
    console.log('\n\n' + '='.repeat(80));
    console.log('Test 2: Navigating to Clerk of Courts Official Records...');
    console.log('='.repeat(80));

    await page.goto('https://myorangeclerk.com/official-records/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    const pageData2 = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')).map(input => ({
        type: input.type,
        name: input.name,
        id: input.id,
        placeholder: input.placeholder
      }));

      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a[role="button"]')).map(btn => ({
        type: btn.type,
        text: btn.textContent?.trim(),
        id: btn.id,
        href: btn.href
      }));

      const links = Array.from(document.querySelectorAll('a')).slice(0, 20).map(link => ({
        text: link.textContent?.trim(),
        href: link.href
      }));

      return {
        title: document.title,
        url: window.location.href,
        bodyText: document.body.innerText.substring(0, 1000),
        inputs,
        buttons,
        links
      };
    });

    console.log(`\nTitle: ${pageData2.title}`);
    console.log(`URL: ${pageData2.url}`);
    console.log(`\nPage Text (first 1000 chars):\n${pageData2.bodyText}`);
    console.log(`\nInput Fields:`);
    pageData2.inputs.forEach((input, i) => {
      console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
    });
    console.log(`\nButtons/Links:`);
    pageData2.buttons.forEach((btn, i) => {
      console.log(`  ${i + 1}. Text: ${btn.text}, ID: ${btn.id}, Href: ${btn.href}`);
    });
    console.log(`\nFirst 20 Links:`);
    pageData2.links.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link.text} -> ${link.href}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Debug complete');
  }
}

debugOrangeCounty();
