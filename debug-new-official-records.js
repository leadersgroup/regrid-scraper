/**
 * Find and explore the new Official Records Self-Service system
 */

const puppeteer = require('puppeteer');

async function debugNewOfficialRecords() {
  console.log('🔍 Finding New Official Records Self-Service System\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Start at EagleWeb
    console.log('Navigating to EagleWeb...');
    await page.goto('https://or.occompt.com/recorder/web', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Accept disclaimer
    console.log('Accepting disclaimer...');
    await page.click('input[type="submit"][name="submit"]');
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n' + '='.repeat(80));
    console.log('LOOKING FOR "OFFICIAL RECORDS SELF-SERVICE" BUTTON:');
    console.log('='.repeat(80));

    // Look for all buttons/links/inputs
    const allElements = await page.evaluate(() => {
      const elements = [];
      const all = Array.from(document.querySelectorAll('button, input, a, div, span'));

      for (const el of all) {
        const text = (el.textContent || el.value || '').trim();
        if (text.toLowerCase().includes('official') && text.toLowerCase().includes('self-service')) {
          elements.push({
            tag: el.tagName,
            text: text,
            id: el.id,
            name: el.name,
            href: el.href,
            onclick: el.onclick ? el.onclick.toString() : null
          });
        }
      }

      return elements;
    });

    console.log('Elements matching "Official Records Self-Service":');
    allElements.forEach((el, i) => {
      console.log(`${i + 1}. Tag: ${el.tag}, Text: "${el.text}", ID: ${el.id}, Href: ${el.href}`);
      if (el.onclick) console.log(`   OnClick: ${el.onclick}`);
    });

    // Try clicking on it
    const clicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('button, input, a, div'));
      for (const el of all) {
        const text = (el.textContent || el.value || '').trim();
        if (text.toLowerCase().includes('official') && text.toLowerCase().includes('self-service')) {
          console.log('Clicking:', el);
          el.click();
          return { clicked: true, text: text };
        }
      }
      return { clicked: false };
    });

    if (clicked.clicked) {
      console.log(`✅ Clicked: "${clicked.text}"`);

      // Wait for navigation or new page
      await new Promise(resolve => setTimeout(resolve, 5000));

      const newPageInfo = await page.evaluate(() => {
        return {
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText.substring(0, 5000),
          inputs: Array.from(document.querySelectorAll('input[type="text"]')).map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder
          })),
          links: Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.textContent?.trim(),
            href: a.href
          })).filter(l => l.text).slice(0, 30)
        };
      });

      console.log('\n' + '='.repeat(80));
      console.log('NEW OFFICIAL RECORDS SELF-SERVICE PAGE:');
      console.log('='.repeat(80));
      console.log(`URL: ${newPageInfo.url}`);
      console.log(`Title: ${newPageInfo.title}`);
      console.log(`\nBody Text:\n${newPageInfo.bodyText}`);

      console.log('\nINPUT FIELDS:');
      newPageInfo.inputs.forEach((input, i) => {
        console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: "${input.placeholder}"`);
      });

      console.log('\nLINKS:');
      newPageInfo.links.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
      });
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

debugNewOfficialRecords();
