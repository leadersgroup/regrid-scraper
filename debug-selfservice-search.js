/**
 * Explore Orange County's new Self-Service Official Records system
 */

const puppeteer = require('puppeteer');

async function debugSelfServiceSearch() {
  console.log('🔍 Exploring Official Records Self-Service System\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Self-Service Official Records...');
    await page.goto('https://selfservice.or.occompt.com/ssweb/user/disclaimer', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n' + '='.repeat(80));
    console.log('SELF-SERVICE LANDING PAGE:');
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
          id: btn.id
        })),
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href
        })).filter(l => l.text).slice(0, 30)
      };
    });

    console.log(`URL: ${landingInfo.url}`);
    console.log(`Title: ${landingInfo.title}`);
    console.log(`\nBody Text:\n${landingInfo.bodyText}`);

    console.log('\nINPUTS:');
    landingInfo.inputs.forEach((input, i) => {
      console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: "${input.placeholder}"`);
    });

    console.log('\nBUTTONS:');
    landingInfo.buttons.forEach((btn, i) => {
      console.log(`${i + 1}. "${btn.text}", Type: ${btn.type}, ID: ${btn.id}`);
    });

    console.log('\nLINKS:');
    landingInfo.links.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
    });

    // Look for accept/continue button
    const acceptClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        if (text.includes('accept') || text.includes('agree') || text.includes('continue') || text.includes('proceed')) {
          console.log('Clicking:', btn);
          btn.click();
          return { clicked: true, text: btn.textContent || btn.value };
        }
      }
      return { clicked: false };
    });

    if (acceptClicked.clicked) {
      console.log(`\n✅ Clicked: "${acceptClicked.text}"`);
      await new Promise(resolve => setTimeout(resolve, 5000));

      const searchPageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 5000),
          inputs: Array.from(document.querySelectorAll('input[type="text"], input[type="search"], select')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
            // Get label
            label: (() => {
              const label = document.querySelector(`label[for="${input.id}"]`);
              if (label) return label.textContent?.trim();
              const parent = input.closest('div, td, li');
              const labelInParent = parent?.querySelector('label');
              return labelInParent?.textContent?.trim() || '';
            })()
          })),
          links: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim(),
            href: a.href
          })).filter(l => l.text && l.text.length < 100).slice(0, 40)
        };
      });

      console.log('\n' + '='.repeat(80));
      console.log('SEARCH PAGE:');
      console.log('='.repeat(80));
      console.log(`URL: ${searchPageInfo.url}`);
      console.log(`Title: ${searchPageInfo.title}`);
      console.log(`\nBody Text:\n${searchPageInfo.bodyText}`);

      console.log('\nSEARCH INPUTS:');
      searchPageInfo.inputs.forEach((input, i) => {
        console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}`);
        console.log(`   Label: "${input.label}", Placeholder: "${input.placeholder}"`);
      });

      console.log('\nLINKS:');
      searchPageInfo.links.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
      });

      // Try to search for our test document
      const docId = '20170015765';
      console.log('\n' + '='.repeat(80));
      console.log(`ATTEMPTING DOCUMENT SEARCH: ${docId}`);
      console.log('='.repeat(80));

      const docInputFound = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
        for (const input of inputs) {
          const label = document.querySelector(`label[for="${input.id}"]`)?.textContent?.trim().toLowerCase() || '';
          const name = (input.name || '').toLowerCase();
          const id = (input.id || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();

          if (label.includes('instrument') || label.includes('cfn') || label.includes('document number') ||
              name.includes('instrument') || name.includes('cfn') || name.includes('document') ||
              id.includes('instrument') || id.includes('cfn') || id.includes('document') ||
              placeholder.includes('instrument') || placeholder.includes('cfn') || placeholder.includes('document')) {
            return { found: true, id: input.id, name: input.name, label: label };
          }
        }
        return { found: false };
      });

      if (docInputFound.found) {
        console.log(`✅ Found document input: ID="${docInputFound.id}", Label="${docInputFound.label}"`);

        const selector = docInputFound.id ? `#${docInputFound.id}` : `input[name="${docInputFound.name}"]`;
        await page.click(selector);
        await page.type(selector, docId, { delay: 100 });
        console.log(`✅ Entered: ${docId}`);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Click search or press Enter
        await page.keyboard.press('Enter');
        console.log('✅ Pressed Enter');

        await new Promise(resolve => setTimeout(resolve, 7000));

        const resultsInfo = await page.evaluate(() => {
          return {
            url: window.location.href,
            bodyText: document.body.innerText.substring(0, 5000),
            pdfLinks: Array.from(document.querySelectorAll('a')).filter(a =>
              a.href.includes('.pdf') ||
              a.href.toLowerCase().includes('document') ||
              a.href.toLowerCase().includes('download') ||
              a.href.toLowerCase().includes('view') ||
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
        console.log(`\nResults:\n${resultsInfo.bodyText}`);

        if (resultsInfo.pdfLinks.length > 0) {
          console.log('\n📄 DOCUMENT/PDF LINKS:');
          resultsInfo.pdfLinks.forEach((link, i) => {
            console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
          });
        } else {
          console.log('\n❌ No PDF/document links found');
        }
      } else {
        console.log('❌ Could not find document/instrument number input field');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 90 seconds for manual exploration...');
    console.log('='.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 90000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugSelfServiceSearch();
