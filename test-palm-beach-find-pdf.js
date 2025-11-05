/**
 * Test to find PDF URL on Palm Beach Clerk page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function findPDF() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    const clerkUrl = 'https://erec.mypalmbeachclerk.com/Search/DocumentAndInfoByBookPage?Key=Assessor&booktype=O&booknumber=33358&pagenumber=1920';

    console.log('Navigating to:', clerkUrl);
    await page.goto(clerkUrl, { waitUntil: 'networkidle2' });
    await wait(5000);

    console.log('\\n=== Looking for PDF download options ===\\n');

    //Check for download buttons or links
    const downloadInfo = await page.evaluate(() => {
      const results = [];

      // Look for any buttons
      const buttons = Array.from(document.querySelectorAll('button, a, input[type="button"], [role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        if (text.includes('download') || text.includes('pdf') || text.includes('print') || text.includes('view')) {
          results.push({
            type: 'button',
            text: text.substring(0, 100),
            href: btn.href || '',
            id: btn.id,
            className: btn.className
          });
        }
      }

      // Look for iframes
      const iframes = Array.from(document.querySelectorAll('iframe'));
      for (const iframe of iframes) {
        results.push({
          type: 'iframe',
          src: iframe.src,
          id: iframe.id,
          className: iframe.className
        });
      }

      return results;
    });

    console.log('Found elements:', JSON.stringify(downloadInfo, null, 2));

    console.log('\\nKeeping browser open for manual inspection...');
    console.log('Check the browser to see the page structure');
    console.log('Press Ctrl+C to close\\n');

    await wait(300000); // 5 minutes

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

findPDF();
