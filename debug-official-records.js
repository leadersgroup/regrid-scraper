/**
 * Debug Orange County Official Records website for deed search
 */

const puppeteer = require('puppeteer');

async function debugOfficialRecords() {
  console.log('🔍 Investigating Orange County Official Records Website\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Try the official records URL
    const urls = [
      'https://myorangeclerk.com/official-records/',
      'https://or.occompt.com/',  // Comptroller Official Records
      'https://myorangeclerk.com/',
      'https://officialrecords.myorangeclerk.com/'
    ];

    for (const url of urls) {
      console.log('\n' + '='.repeat(80));
      console.log(`TRYING: ${url}`);
      console.log('='.repeat(80));

      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        const pageInfo = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 2000),
            links: Array.from(document.querySelectorAll('a')).map(a => ({
              text: a.textContent?.trim(),
              href: a.href
            })).filter(l => l.text && l.text.length < 100).slice(0, 30),
            inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(input => ({
              type: input.type,
              name: input.name,
              id: input.id,
              placeholder: input.placeholder
            }))
          };
        });

        console.log(`✅ Loaded: ${pageInfo.url}`);
        console.log(`Title: ${pageInfo.title}`);
        console.log(`\nBody Text:\n${pageInfo.bodyText}`);

        console.log('\nINPUT FIELDS:');
        pageInfo.inputs.forEach((input, i) => {
          console.log(`  ${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: ${input.placeholder}`);
        });

        console.log('\nLINKS:');
        pageInfo.links.forEach((link, i) => {
          console.log(`  ${i + 1}. "${link.text}" -> ${link.href}`);
        });

      } catch (error) {
        console.log(`❌ Failed to load: ${error.message}`);
      }
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

debugOfficialRecords();
