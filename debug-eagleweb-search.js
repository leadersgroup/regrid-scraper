/**
 * Debug Orange County EagleWeb for deed document search
 */

const puppeteer = require('puppeteer');

async function debugEagleWeb() {
  console.log('🔍 Investigating Orange County EagleWeb Search\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to EagleWeb...');
    await page.goto('https://or.occompt.com/recorder/web', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n' + '='.repeat(80));
    console.log('EAGLEWEB LANDING PAGE:');
    console.log('='.repeat(80));

    const landingInfo = await page.evaluate(() => {
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
        buttons: Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(btn => ({
          text: btn.textContent?.trim() || btn.value,
          type: btn.type,
          id: btn.id,
          name: btn.name
        })),
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        })).filter(l => l.text && l.text.length < 100).slice(0, 30)
      };
    });

    console.log(`URL: ${landingInfo.url}`);
    console.log(`Title: ${landingInfo.title}`);
    console.log(`\nBody Text:\n${landingInfo.bodyText}`);

    console.log('\n' + '='.repeat(80));
    console.log('INPUT FIELDS:');
    console.log('='.repeat(80));
    landingInfo.inputs.forEach((input, i) => {
      console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: "${input.placeholder}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('BUTTONS:');
    console.log('='.repeat(80));
    landingInfo.buttons.forEach((btn, i) => {
      console.log(`${i + 1}. Text: "${btn.text}", Type: ${btn.type}, ID: ${btn.id}, Name: ${btn.name}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('LINKS:');
    console.log('='.repeat(80));
    landingInfo.links.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
    });

    // Try searching with a document ID
    const testDocId = '20170015765';
    console.log('\n' + '='.repeat(80));
    console.log(`ATTEMPTING TO SEARCH FOR DOCUMENT ID: ${testDocId}`);
    console.log('='.repeat(80));

    // Look for CFN/Document Number input
    const searchInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const input of inputs) {
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const placeholder = (input.placeholder || '').toLowerCase();

        if (name.includes('cfn') || name.includes('document') || name.includes('number') ||
            id.includes('cfn') || id.includes('document') || id.includes('number') ||
            placeholder.includes('cfn') || placeholder.includes('document') || placeholder.includes('number')) {
          return {
            found: true,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          };
        }
      }
      return { found: false };
    });

    if (searchInput.found) {
      console.log(`✅ Found document search input: Name="${searchInput.name}", ID="${searchInput.id}", Placeholder="${searchInput.placeholder}"`);

      // Try to enter the document ID
      const selector = searchInput.id ? `#${searchInput.id}` : `input[name="${searchInput.name}"]`;
      await page.click(selector);
      await page.type(selector, testDocId, { delay: 100 });
      console.log(`✅ Entered document ID: ${testDocId}`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for and click search button
      const searchButtonClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
        for (const btn of buttons) {
          const text = (btn.textContent || btn.value || '').toLowerCase();
          if (text.includes('search') || text.includes('submit') || text.includes('find')) {
            console.log('Clicking search button:', btn);
            btn.click();
            return { clicked: true, text: btn.textContent || btn.value };
          }
        }
        return { clicked: false };
      });

      if (searchButtonClicked.clicked) {
        console.log(`✅ Clicked search button: "${searchButtonClicked.text}"`);

        // Wait for results
        await new Promise(resolve => setTimeout(resolve, 5000));

        const resultsInfo = await page.evaluate(() => {
          return {
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 5000),
            pdfLinks: Array.from(document.querySelectorAll('a')).filter(a =>
              a.href.includes('.pdf') ||
              a.href.toLowerCase().includes('document') ||
              a.textContent?.toLowerCase().includes('view') ||
              a.textContent?.toLowerCase().includes('download')
            ).map(a => ({
              text: a.textContent?.trim(),
              href: a.href
            }))
          };
        });

        console.log('\n' + '='.repeat(80));
        console.log('SEARCH RESULTS:');
        console.log('='.repeat(80));
        console.log(`URL: ${resultsInfo.url}`);
        console.log(`\nResults Text:\n${resultsInfo.bodyText}`);

        if (resultsInfo.pdfLinks.length > 0) {
          console.log('\n📄 PDF/DOCUMENT LINKS FOUND:');
          resultsInfo.pdfLinks.forEach((link, i) => {
            console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
          });
        }
      }
    } else {
      console.log('❌ Could not find document/CFN search input');
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

debugEagleWeb();
