/**
 * Test full flow: navigate to Detail, click recording number, download PDF
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testFullFlow() {
  console.log('🧪 Testing full King County flow\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page = await browser.newPage();

  try {
    // Navigate
    console.log('📍 Step 1: Navigate and search...');
    await page.goto('https://blue.kingcounty.com/Assessor/eRealProperty/default.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Checkbox
    try {
      await page.waitForSelector('#cphContent_checkbox_acknowledge', { timeout: 5000 });
      await page.click('#cphContent_checkbox_acknowledge');
      console.log('✅ Checked checkbox');
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {}

    // Search
    const addressField = 'input[id="cphContent_txtAddress"]';
    await page.waitForSelector(addressField, { timeout: 10000 });
    await page.click(addressField, { clickCount: 3 });
    await page.type(addressField, '7550 41st Ave NE');
    await new Promise(resolve => setTimeout(resolve, 1000));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.keyboard.press('Enter')
    ]);

    console.log(`✅ At: ${page.url()}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click Property Detail LINK
    console.log('📍 Step 2: Navigate to Property Detail...');
    const propertyDetailLinkSelector = '#cphContent_LinkButtonDetail';
    await page.waitForSelector(propertyDetailLinkSelector, { timeout: 10000 });

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
      page.click(propertyDetailLinkSelector)
    ]);

    console.log(`✅ At Detail page: ${page.url()}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Find and click recording number
    console.log('📍 Step 3: Find and click recording number...');
    const recordingInfo = await page.evaluate(() => {
      const allCells = Array.from(document.querySelectorAll('td'));

      for (const cell of allCells) {
        const text = cell.textContent.trim();
        if (/^\d{14,}$/.test(text)) {
          const link = cell.querySelector('a');
          if (link) {
            console.log(`Clicking recording number: ${text} -> ${link.href}`);
            link.click();
            return {
              success: true,
              recordingNumber: text,
              href: link.href
            };
          }
        }
      }

      return { success: false };
    });

    if (!recordingInfo.success) {
      throw new Error('Recording number not found');
    }

    console.log(`✅ Clicked recording number: ${recordingInfo.recordingNumber}`);
    console.log(`   URL: ${recordingInfo.href}\n`);

    // Wait for navigation or new tab
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if new tab opened
    const pages = await browser.pages();
    if (pages.length > 1) {
      console.log('✅ New tab opened');
      page = pages[pages.length - 1];
      await page.waitForSelector('body', { timeout: 10000 });
    }

    console.log(`Current URL: ${page.url()}\n`);

    // Try to download PDF
    console.log('📍 Step 4: Download PDF...');
    const currentUrl = page.url();

    const pdfData = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, {
          credentials: 'include',
          headers: { 'Accept': 'application/pdf,*/*' }
        });

        if (!response.ok) {
          return { success: false, error: `HTTP ${response.status}` };
        }

        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Convert to base64
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }

        return {
          success: true,
          base64: btoa(binary),
          size: uint8Array.length
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }, currentUrl);

    if (!pdfData.success) {
      throw new Error(`PDF download failed: ${pdfData.error}`);
    }

    const pdfBuffer = Buffer.from(pdfData.base64, 'base64');
    const signature = pdfBuffer.toString('utf8', 0, 4);

    if (signature !== '%PDF') {
      throw new Error(`Not a valid PDF. Signature: ${signature}`);
    }

    console.log(`✅ PDF downloaded: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    // Save to file
    const filename = `king_test_full_${Date.now()}.pdf`;
    fs.writeFileSync(filename, pdfBuffer);
    console.log(`✅ Saved to: ${filename}\n`);

    console.log('🎉 FULL FLOW SUCCESSFUL!');

    console.log('\n⏸️  Browser open for 15 seconds...');
    await new Promise(resolve => setTimeout(resolve, 15000));

  } catch (error) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n✅ Browser closed');
  }
}

testFullFlow();
