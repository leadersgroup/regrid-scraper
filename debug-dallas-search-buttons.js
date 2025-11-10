const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugSearchButtons() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to Dallas County Clerk...');
    await page.goto('https://dallas.tx.publicsearch.us/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Close popup
    try {
      const closeButton = await page.$('button[aria-label="Close"]');
      if (closeButton) {
        console.log('Closing popup...');
        await closeButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log('No popup to close');
    }

    // Click advanced search
    console.log('\n=== Clicking Advanced Search ===');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      const advLink = links.find(link => {
        const text = link.textContent.toLowerCase();
        return text.includes('advanced') && text.includes('search');
      });
      if (advLink) advLink.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Type into volume and page fields
    console.log('\n=== Typing volume and page ===');
    const volumeField = await page.$('#volume');
    await volumeField.click({ clickCount: 3 });
    await volumeField.type('99081');

    const pageField = await page.$('#page');
    await pageField.click({ clickCount: 3 });
    await pageField.type('972');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // List ALL buttons on the page
    console.log('\n=== ALL BUTTONS ON PAGE ===');
    const buttons = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      return allButtons.map((btn, idx) => ({
        index: idx,
        text: btn.textContent.trim().substring(0, 100),
        type: btn.type,
        id: btn.id,
        className: btn.className,
        ariaLabel: btn.getAttribute('aria-label'),
        disabled: btn.disabled,
        visible: btn.offsetParent !== null
      }));
    });

    console.log(JSON.stringify(buttons, null, 2));

    // Which button would we click with current logic?
    const currentLogic = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const searchBtn = buttons.find(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('search') && !text.includes('clear');
      });
      return searchBtn ? {
        text: searchBtn.textContent.trim(),
        type: searchBtn.type,
        id: searchBtn.id,
        className: searchBtn.className
      } : null;
    });

    console.log('\n=== BUTTON CURRENT LOGIC WOULD CLICK ===');
    console.log(JSON.stringify(currentLogic, null, 2));

    await page.screenshot({ path: '/tmp/dallas-buttons-before-search.png', fullPage: true });
    console.log('\nScreenshot saved: /tmp/dallas-buttons-before-search.png');

    console.log('\nWaiting 60 seconds for inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugSearchButtons().catch(console.error);
