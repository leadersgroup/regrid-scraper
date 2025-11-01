/**
 * Manual exploration of Self-Service system with extended wait times
 */

const puppeteer = require('puppeteer');

async function manualExplore() {
  console.log('🔍 Manual Self-Service Exploration\n');

  const browser = await puppeteer.launch({
    headless: false, // Keep visible
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Self-Service...');
    await page.goto('https://selfservice.or.occompt.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Waiting 10 seconds for page to settle...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('\n' + '='.repeat(80));
    console.log('CURRENT PAGE STATE:');
    console.log('='.repeat(80));

    const pageState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText,
        hasReCAPTCHA: !!document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]'),
        buttons: Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]')).map(btn => ({
          text: btn.textContent?.trim() || btn.value,
          id: btn.id,
          type: btn.type,
          visible: btn.offsetParent !== null
        })),
        inputs: Array.from(document.querySelectorAll('input, textarea, select')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          visible: input.offsetParent !== null
        }))
      };
    });

    console.log(`URL: ${pageState.url}`);
    console.log(`Title: ${pageState.title}`);
    console.log(`Has reCAPTCHA: ${pageState.hasReCAPTCHA}`);
    console.log(`\nBody Text:\n${pageState.bodyText.substring(0, 2000)}`);

    console.log('\nVISIBLE BUTTONS:');
    pageState.buttons.filter(b => b.visible).forEach((btn, i) => {
      console.log(`${i + 1}. "${btn.text}", Type: ${btn.type}, ID: ${btn.id}`);
    });

    console.log('\nVISIBLE INPUTS:');
    pageState.inputs.filter(inp => inp.visible).forEach((input, i) => {
      console.log(`${i + 1}. Type: ${input.type}, Name: ${input.name}, ID: ${input.id}, Placeholder: "${input.placeholder}"`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('MANUAL ACTIONS:');
    console.log('='.repeat(80));
    console.log('The browser will stay open for 5 MINUTES.');
    console.log('Please manually:');
    console.log('1. Accept the disclaimer if needed');
    console.log('2. Navigate to the search page');
    console.log('3. Note the URL and form structure');
    console.log('4. Try searching for document: 20170015765');
    console.log('5. Observe what happens');
    console.log('='.repeat(80));

    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

manualExplore();
