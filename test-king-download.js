/**
 * Test download handling after clicking recording number
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

async function testDownload() {
  console.log('🧪 Testing download handling\n');

  const downloadPath = path.resolve('./downloads');
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  }

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page = await browser.newPage();

  // Set download behavior
  const client = await page.target().createCDPSession();
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  let downloadedFile = null;

  try {
    // Navigate
    console.log('📍 Navigate and search...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      await page.waitForSelector('#cphContent_checkbox_acknowledge', { timeout: 5000 });
      await page.click('#cphContent_checkbox_acknowledge');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {}

    const addressField = 'input[id="cphContent_txtAddress"]';
    await page.waitForSelector(addressField, { timeout: 10000 });
    await page.click(addressField, { clickCount: 3 });
    await page.type(addressField, '7550 41st Ave NE');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Property Detail
    const propertyDetailLinkSelector = '#cphContent_LinkButtonDetail';
    await page.waitForSelector(propertyDetailLinkSelector, { timeout: 10000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click(propertyDetailLinkSelector)
    ]);

    console.log(`✅ At Detail page\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the recording number link details
    const linkInfo = await page.evaluate(() => {
      const allCells = Array.from(document.querySelectorAll('td'));
      for (const cell of allCells) {
        const text = cell.textContent.trim();
        if (/^\d{14,}$/.test(text)) {
          const link = cell.querySelector('a');
          if (link) {
            return {
              href: link.href,
              target: link.target || '',
              download: link.getAttribute('download') || '',
              text: text
            };
          }
        }
      }
      return null;
    });

    if (!linkInfo) {
      throw new Error('Recording number link not found');
    }

    console.log(`📋 Recording number link info:`);
    console.log(`   Number: ${linkInfo.text}`);
    console.log(`   href: ${linkInfo.href}`);
    console.log(`   target: "${linkInfo.target}"`);
    console.log(`   download attr: "${linkInfo.download}"\n`);

    // Instead of clicking, let's navigate directly to the URL
    console.log('🌐 Navigating directly to deed URL...');

    try {
      await page.goto(linkInfo.href, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      console.log(`✅ Navigated to: ${page.url()}`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if it's a TIF viewer or PDF
      const pageContent = await page.content();
      console.log(`\nPage content length: ${pageContent.length} bytes`);
      console.log(`First 200 chars: ${pageContent.substring(0, 200)}`);

      // Try to get the document
      console.log('\n📥 Trying to fetch document...');
      const docData = await page.evaluate(async (url) => {
        try {
          const response = await fetch(url, {
            credentials: 'include',
            headers: { 'Accept': '*/*' }
          });

          if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
          }

          const contentType = response.headers.get('content-type');
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }

          return {
            success: true,
            base64: btoa(binary),
            size: uint8Array.length,
            contentType: contentType
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      }, linkInfo.href);

      if (!docData.success) {
        throw new Error(`Fetch failed: ${docData.error}`);
      }

      console.log(`✅ Downloaded: ${(docData.size / 1024).toFixed(2)} KB`);
      console.log(`Content-Type: ${docData.contentType}`);

      const buffer = Buffer.from(docData.base64, 'base64');
      const signature = buffer.toString('utf8', 0, 10);
      console.log(`First 10 bytes: "${signature}"`);

      // Check file type
      if (signature.startsWith('%PDF')) {
        console.log('\n✅ It\'s a PDF!');
        const filename = `king_deed_${linkInfo.text}.pdf`;
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Saved as: ${filename}`);
      } else if (signature.startsWith('II') || signature.startsWith('MM')) {
        console.log('\n✅ It\'s a TIF image!');
        const filename = `king_deed_${linkInfo.text}.tif`;
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Saved as: ${filename}`);
      } else {
        console.log(`\n⚠️  Unknown format. First 50 bytes:`);
        console.log(signature);
        const filename = `king_deed_${linkInfo.text}.bin`;
        fs.writeFileSync(filename, buffer);
        console.log(`✅ Saved as: ${filename}`);
      }

    } catch (navError) {
      console.log(`❌ Navigation failed: ${navError.message}`);
    }

    console.log('\n⏸️  Browser open for 30 seconds...');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

testDownload();
