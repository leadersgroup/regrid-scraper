/**
 * Debug Wake County after CAPTCHA solving to find PDF
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');

puppeteer.use(StealthPlugin());

// Add reCAPTCHA plugin if 2Captcha API key is available
if (process.env.TWOCAPTCHA_TOKEN) {
  puppeteer.use(
    RecaptchaPlugin({
      provider: {
        id: '2captcha',
        token: process.env.TWOCAPTCHA_TOKEN
      },
      visualFeedback: true
    })
  );
}

async function debug() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Wake County Real Estate Search...');
    await page.goto('https://services.wake.gov/realestate/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill search fields
    console.log('📝 Filling search fields...');
    await page.type('input[name="stnum"]', '4501');
    await page.type('input[name="stname"]', 'rockwood');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click search
    console.log('🔍 Clicking search...');
    await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="image"]'));
      const searchBtn = inputs.find(input => input.name === 'Search by Address');
      if (searchBtn) searchBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click account
    console.log('🖱️  Clicking account...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (/^\d{7}$/.test(link.textContent.trim())) {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click Deeds tab
    console.log('📄 Clicking Deeds tab...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      for (const link of links) {
        if (link.textContent.trim().toLowerCase() === 'deeds') {
          link.click();
          return;
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click page number
    console.log('📑 Clicking page number...');
    await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      for (const table of tables) {
        const headers = Array.from(table.querySelectorAll('th'));
        const pageColIndex = headers.findIndex(th =>
          th.textContent.trim().toLowerCase() === 'page'
        );

        if (pageColIndex !== -1) {
          const rows = Array.from(table.querySelectorAll('tbody tr'));
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells[pageColIndex]) {
              const pageCell = cells[pageColIndex];
              const link = pageCell.querySelector('a');
              if (link) {
                link.click();
                return;
              }
            }
          }
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for CAPTCHA
    console.log('🔍 Checking for CAPTCHA...');
    const captchaInfo = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const hasCaptcha = bodyText.includes('captcha') ||
                        bodyText.includes('recaptcha') ||
                        document.querySelector('[class*="captcha"]') !== null ||
                        document.querySelector('[id*="captcha"]') !== null ||
                        document.querySelector('.g-recaptcha') !== null ||
                        document.querySelector('iframe[src*="recaptcha"]') !== null;
      return { hasCaptcha };
    });

    if (captchaInfo.hasCaptcha) {
      console.log('⚠️  reCAPTCHA detected');

      if (process.env.TWOCAPTCHA_TOKEN) {
        console.log('🔧 Attempting to solve reCAPTCHA using 2Captcha API...');
        try {
          await page.solveRecaptchas();
          console.log('✅ reCAPTCHA solved successfully!');

          // Wait for page to process CAPTCHA solution
          console.log('⏳ Waiting 10 seconds after CAPTCHA solving...');
          await new Promise(resolve => setTimeout(resolve, 10000));

        } catch (captchaError) {
          console.log(`❌ Failed to solve reCAPTCHA: ${captchaError.message}`);
          console.log('⏳ Waiting 120 seconds for manual CAPTCHA solving...');
          await new Promise(resolve => setTimeout(resolve, 120000));
        }
      } else {
        console.log('⏳ No 2Captcha API key found. Waiting 120 seconds for manual CAPTCHA solving...');
        await new Promise(resolve => setTimeout(resolve, 120000));
      }
    } else {
      console.log('✅ No CAPTCHA detected');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Take screenshot
    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: '/Users/ll/Documents/regrid-scraper/debug-wake-after-captcha.png', fullPage: true });

    // Check for new windows/tabs
    const pages = await browser.pages();
    console.log(`\n=== BROWSER WINDOWS/TABS: ${pages.length} ===`);
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      console.log(`Tab ${i}: ${p.url()}`);
    }

    // Analyze the page after CAPTCHA
    const analysis = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyPreview: document.body.innerText.substring(0, 2000),

        // Find all iframes
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          width: iframe.width,
          height: iframe.height,
          visible: iframe.offsetParent !== null
        })),

        // Find all embeds/objects
        embeds: Array.from(document.querySelectorAll('embed, object')).map(embed => ({
          tag: embed.tagName,
          src: embed.src || embed.data,
          type: embed.type,
          visible: embed.offsetParent !== null
        })),

        // Find all links
        links: Array.from(document.querySelectorAll('a'))
          .filter(a => a.offsetParent !== null)
          .map(a => ({
            text: a.textContent.trim().substring(0, 100),
            href: a.href
          })),

        // Find all buttons
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
          .filter(btn => btn.offsetParent !== null)
          .map(btn => ({
            type: btn.type,
            text: btn.textContent.trim() || btn.value,
            id: btn.id,
            className: btn.className
          })),

        // Check for modals/overlays
        modals: Array.from(document.querySelectorAll('[class*="modal"], [class*="popup"], [class*="overlay"], [class*="dialog"]'))
          .filter(el => el.offsetParent !== null)
          .map(el => ({
            className: el.className,
            id: el.id,
            text: el.textContent.trim().substring(0, 200)
          })),

        // Look for PDF-related text
        hasPdfText: document.body.innerText.toLowerCase().includes('pdf'),
        hasDownloadText: document.body.innerText.toLowerCase().includes('download'),
        hasViewText: document.body.innerText.toLowerCase().includes('view'),
        hasDocumentText: document.body.innerText.toLowerCase().includes('document')
      };
    });

    console.log('\n=== PAGE AFTER CAPTCHA ===');
    console.log('URL:', analysis.url);
    console.log('Title:', analysis.title);
    console.log('\nBody preview:');
    console.log(analysis.bodyPreview);
    console.log('\n=== IFRAMES ===');
    console.log(JSON.stringify(analysis.iframes, null, 2));
    console.log('\n=== EMBEDS/OBJECTS ===');
    console.log(JSON.stringify(analysis.embeds, null, 2));
    console.log('\n=== LINKS ===');
    console.log(JSON.stringify(analysis.links.slice(0, 20), null, 2));
    console.log('\n=== BUTTONS ===');
    console.log(JSON.stringify(analysis.buttons, null, 2));
    console.log('\n=== MODALS/OVERLAYS ===');
    console.log(JSON.stringify(analysis.modals, null, 2));
    console.log('\n=== PDF-RELATED TEXT ===');
    console.log('Has "pdf" text:', analysis.hasPdfText);
    console.log('Has "download" text:', analysis.hasDownloadText);
    console.log('Has "view" text:', analysis.hasViewText);
    console.log('Has "document" text:', analysis.hasDocumentText);

    console.log('\n\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debug().catch(console.error);
