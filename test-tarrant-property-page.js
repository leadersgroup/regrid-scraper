const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Testing Tarrant County Property Page\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Step 1: Navigate to TAD and search
    console.log('Step 1: Loading TAD and searching...');
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

    console.log('Step 2: Clicking account number...');

    // Click account number
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (/\b\d{8}\b/.test(link.textContent)) {
          console.log('Clicking account:', link.textContent.trim());
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 7000));

    // Analyze the property page
    console.log('\nStep 3: Analyzing property detail page...\n');

    const pageInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText;

      // Look for D followed by 9 digits
      const instrumentPattern = /\b(D\d{9})\b/g;
      const instruments = bodyText.match(instrumentPattern) || [];

      // Look for any heading or section containing "deed" or "instrument"
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, th, td, label, div'));
      const deedRelated = [];
      for (const el of headings) {
        const text = el.textContent.toLowerCase();
        if (text.includes('deed') || text.includes('instrument') || text.includes('document')) {
          deedRelated.push({
            tag: el.tagName,
            text: el.textContent.trim().substring(0, 100)
          });
        }
      }

      return {
        url: window.location.href,
        title: document.title,
        instrumentNumbers: instruments,
        deedRelatedElements: deedRelated.slice(0, 10),
        bodyTextSample: bodyText.substring(0, 1500)
      };
    });

    console.log('URL:', pageInfo.url);
    console.log('Title:', pageInfo.title);
    console.log('Instrument numbers found:', pageInfo.instrumentNumbers);
    console.log('\nDeed-related elements:');
    pageInfo.deedRelatedElements.forEach((el, i) => {
      console.log(`  ${i + 1}. <${el.tag}>: ${el.text}`);
    });
    console.log('\nPage text sample:');
    console.log(pageInfo.bodyTextSample);

    console.log('\n⏸️  Browser will stay open for 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
})();
