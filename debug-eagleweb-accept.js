/**
 * Debug Orange County EagleWeb after accepting disclaimer
 */

const puppeteer = require('puppeteer');

async function debugEagleWebAccept() {
  console.log('🔍 EagleWeb - Accepting Disclaimer and Exploring\n');

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

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click "I Accept" button
    console.log('Clicking "I Accept" button...');
    await page.click('input[type="submit"][name="submit"]');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n' + '='.repeat(80));
    console.log('AFTER ACCEPTING DISCLAIMER:');
    console.log('='.repeat(80));

    const mainPageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 5000),
        inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          value: input.value
        })),
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        })).filter(l => l.text).slice(0, 50)
      };
    });

    console.log(`URL: ${mainPageInfo.url}`);
    console.log(`Title: ${mainPageInfo.title}`);
    console.log(`\nBody Text:\n${mainPageInfo.bodyText}`);

    console.log('\n' + '='.repeat(80));
    console.log('INPUT FIELDS:');
    console.log('='.repeat(80));
    mainPageInfo.inputs.forEach((input, i) => {
      console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: "${input.placeholder}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('LINKS:');
    console.log('='.repeat(80));
    mainPageInfo.links.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
    });

    // Try to search for document number
    const docId = '20170015765';
    console.log('\n' + '='.repeat(80));
    console.log(`ATTEMPTING DOCUMENT SEARCH: ${docId}`);
    console.log('='.repeat(80));

    // Look for CFN/Document Number field
    const docFieldFound = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      for (const input of inputs) {
        const label = document.querySelector(`label[for="${input.id}"]`)?.textContent || '';
        const name = (input.name || '').toLowerCase();
        const id = (input.id || '').toLowerCase();

        if (name.includes('cfn') || name.includes('instrument') || name.includes('document') ||
            label.toLowerCase().includes('cfn') || label.toLowerCase().includes('instrument') ||
            label.toLowerCase().includes('document') || label.toLowerCase().includes('number')) {
          return { found: true, id: input.id, name: input.name, label };
        }
      }
      return { found: false };
    });

    if (docFieldFound.found) {
      console.log(`✅ Found document field: ID="${docFieldFound.id}", Name="${docFieldFound.name}", Label="${docFieldFound.label}"`);

      const selector = docFieldFound.id ? `#${docFieldFound.id}` : `input[name="${docFieldFound.name}"]`;
      await page.click(selector);
      await page.type(selector, docId, { delay: 100 });
      console.log(`✅ Entered: ${docId}`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click search
      await page.keyboard.press('Enter');
      console.log('✅ Pressed Enter to search');

      await new Promise(resolve => setTimeout(resolve, 5000));

      const resultsInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          bodyText: document.body.innerText.substring(0, 5000),
          links: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim(),
            href: a.href
          })).filter(l => l.text && l.text.length < 200)
        };
      });

      console.log('\n' + '='.repeat(80));
      console.log('SEARCH RESULTS:');
      console.log('='.repeat(80));
      console.log(`URL: ${resultsInfo.url}`);
      console.log(`\nResults:\n${resultsInfo.bodyText}`);

      console.log('\nLINKS IN RESULTS:');
      resultsInfo.links.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
      });
    } else {
      console.log('❌ Could not find document number field');
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 60 seconds...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugEagleWebAccept();
