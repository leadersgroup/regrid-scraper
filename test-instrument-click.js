const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing Instrument Number Click\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate through the workflow to get to property page
    console.log('Step 1: Loading TAD...');
    await page.goto('https://www.tad.org/index', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Set dropdown
    await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        const options = Array.from(select.options);
        for (const option of options) {
          if (option.textContent.toLowerCase().includes('property address')) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Type and search
    await page.type('#query', '1009 WICKWOOD Ct', { delay: 50 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    const navPromise = page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    await page.keyboard.press('Enter');
    await navPromise;
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click account number
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (/\b\d{8}\b/.test(link.textContent)) {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 7000));

    console.log('\n🎯 Now on property page, analyzing instrument number...\n');

    // Analyze the instrument number element
    const instrumentInfo = await page.evaluate(() => {
      const instrumentPattern = /\b(D\d{9})\b/;
      const elements = Array.from(document.querySelectorAll('a, td, div, span, th'));

      const results = [];
      for (const el of elements) {
        const text = el.textContent?.trim() || '';
        const match = text.match(instrumentPattern);

        if (match) {
          results.push({
            instrumentNumber: match[1],
            tagName: el.tagName,
            isLink: el.tagName === 'A',
            href: el.href || null,
            text: text.substring(0, 100),
            hasClickHandler: typeof el.onclick === 'function',
            parentTag: el.parentElement?.tagName
          });
        }
      }

      return {
        instruments: results,
        url: window.location.href
      };
    });

    console.log('URL:', instrumentInfo.url);
    console.log('\n📋 Instrument number elements found:');
    instrumentInfo.instruments.forEach((inst, i) => {
      console.log(`\n${i + 1}. ${inst.instrumentNumber}`);
      console.log(`   Tag: <${inst.tagName}>`);
      console.log(`   Is Link: ${inst.isLink}`);
      console.log(`   Href: ${inst.href}`);
      console.log(`   Has onClick: ${inst.hasClickHandler}`);
      console.log(`   Parent: <${inst.parentTag}>`);
      console.log(`   Text: "${inst.text}"`);
    });

    if (instrumentInfo.instruments.length > 0) {
      console.log('\n\n🖱️  Attempting to click first instrument number...');

      const instrumentNumber = instrumentInfo.instruments[0].instrumentNumber;

      // Try clicking
      const clickResult = await page.evaluate((instNum) => {
        const elements = Array.from(document.querySelectorAll('a, td, div, span'));

        for (const element of elements) {
          const text = element.textContent?.trim() || '';

          if (text.includes(instNum)) {
            console.log('Found element with instrument:', element.tagName, text.substring(0, 50));

            if (element.tagName === 'A') {
              element.click();
              return { clicked: true, type: 'link', text: text.substring(0, 50) };
            }

            // Try parent if this is in a td or span
            const parent = element.closest('a');
            if (parent) {
              parent.click();
              return { clicked: true, type: 'parent-link', text: text.substring(0, 50) };
            }
          }
        }

        return { clicked: false };
      }, instrumentNumber);

      console.log('Click result:', clickResult);

      if (clickResult.clicked) {
        console.log('\n⏳ Waiting 10 seconds after click...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        const afterClick = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            bodyText: document.body.innerText.substring(0, 1000)
          };
        });

        console.log('\n📄 After clicking instrument:');
        console.log('URL:', afterClick.url);
        console.log('Title:', afterClick.title);
        console.log('\nPage content:');
        console.log(afterClick.bodyText);
      }
    }

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
