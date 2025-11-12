/**
 * Final comprehensive debug for Guilford County
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function finalDebug() {
  console.log('🔍 Final Guilford County Debug\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate
    console.log('1. Navigate to Guilford...');
    await page.goto('https://lrcpwa.ncptscloud.com/guilford/', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Location Address tab
    console.log('2. Click Location Address tab...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[data-toggle="tab"]'));
      for (const link of links) {
        if (link.textContent.trim().includes('Location Address')) {
          link.click();
        }
      }
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fill address
    console.log('3. Fill: 1205 Glendale...');
    await page.waitForSelector('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', { visible: true });
    await page.type('#ctl00_ContentPlaceHolder1_StreetNumberTextBox', '1205');
    await page.type('#ctl00_ContentPlaceHolder1_StreetNameTextBox', 'Glendale');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Submit
    console.log('4. Press Enter...');
    await page.keyboard.press('Enter');
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Analyze results
    console.log('\n5. ANALYZING RESULTS PAGE:\n');

    const analysis = await page.evaluate(() => {
      // Get ALL visible text
      const bodyText = document.body.innerText;

      // Get all links with their text
      const allLinks = Array.from(document.querySelectorAll('a'))
        .filter(a => a.offsetParent !== null)
        .map(a => ({
          text: a.textContent.trim(),
          href: a.href
        }))
        .filter(l => l.text.length > 0)
        .slice(0, 50);

      // Find if "60312" exists anywhere
      const has60312 = bodyText.includes('60312');
      const has60312Link = allLinks.find(l => l.text.includes('60312'));

      // Get all numeric-only links
      const numericLinks = allLinks.filter(l => /^\d+$/.test(l.text));

      return {
        currentUrl: window.location.href,
        has60312,
        has60312Link,
        numericLinks,
        allLinks: allLinks.slice(0, 20),
        bodyTextSnippet: bodyText.substring(0, 1000)
      };
    });

    console.log('Current URL:', analysis.currentUrl);
    console.log('\n📊 RESULTS:');
    console.log('  Has "60312" in page:', analysis.has60312);
    console.log('  Has "60312" link:', analysis.has60312Link ? 'YES' : 'NO');
    if (analysis.has60312Link) {
      console.log('  60312 Link:', JSON.stringify(analysis.has60312Link, null, 2));
    }
    console.log('\n🔢 Numeric Links Found:', analysis.numericLinks.length);
    if (analysis.numericLinks.length > 0) {
      console.log(JSON.stringify(analysis.numericLinks, null, 2));
    }
    console.log('\n🔗 All Links (first 20):');
    console.log(JSON.stringify(analysis.allLinks, null, 2));
    console.log('\n📄 Page Text (first 1000 chars):');
    console.log(analysis.bodyTextSnippet);

    // Save screenshot and HTML
    await page.screenshot({ path: 'guilford-final-results.png', fullPage: true });
    const html = await page.content();
    fs.writeFileSync('guilford-final-results.html', html);
    console.log('\n✅ Saved: guilford-final-results.png & guilford-final-results.html');

    console.log('\n⏸️  Browser staying open for inspection...');
    console.log('Press Ctrl+C to close');
    await new Promise(() => {});

  } catch (error) {
    console.error('❌ Error:', error.message);
    await page.screenshot({ path: 'guilford-final-error.png' });
  }
}

finalDebug().catch(console.error);
