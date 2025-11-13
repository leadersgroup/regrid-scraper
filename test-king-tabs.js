/**
 * Test tab handling after clicking recording number
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function testTabs() {
  console.log('🧪 Testing tab handling\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page = await browser.newPage();

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

    // Check tabs BEFORE clicking
    let pages = await browser.pages();
    console.log(`📋 Tabs BEFORE clicking recording number: ${pages.length}`);
    pages.forEach((p, i) => console.log(`  ${i}: ${p.url()}`));

    // Click recording number
    console.log('\n🔗 Clicking recording number...');
    await page.evaluate(() => {
      const allCells = Array.from(document.querySelectorAll('td'));
      for (const cell of allCells) {
        const text = cell.textContent.trim();
        if (/^\d{14,}$/.test(text)) {
          const link = cell.querySelector('a');
          if (link) {
            link.click();
            return;
          }
        }
      }
    });

    // Wait for new tab
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check tabs AFTER clicking
    pages = await browser.pages();
    console.log(`\n📋 Tabs AFTER clicking recording number: ${pages.length}`);
    for (let i = 0; i < pages.length; i++) {
      const url = pages[i].url();
      console.log(`  ${i}: ${url}`);
    }

    // Find the recordsearch.kingcounty.gov page
    let pdfPage = null;
    for (const p of pages) {
      if (p.url().includes('recordsearch.kingcounty.gov')) {
        pdfPage = p;
        break;
      }
    }

    if (!pdfPage) {
      console.log('\n❌ No recordsearch.kingcounty.gov tab found');
      console.log('Waiting 10 more seconds...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      pages = await browser.pages();
      console.log(`\n📋 Tabs after waiting: ${pages.length}`);
      for (let i = 0; i < pages.length; i++) {
        console.log(`  ${i}: ${pages[i].url()}`);
      }

      // Try again
      for (const p of pages) {
        if (p.url().includes('recordsearch.kingcounty.gov')) {
          pdfPage = p;
          break;
        }
      }
    }

    if (!pdfPage) {
      throw new Error('PDF page never opened');
    }

    console.log(`\n✅ Found PDF page: ${pdfPage.url()}`);

    // Wait for PDF to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to download
    console.log('\n📥 Downloading PDF...');
    const pdfData = await pdfPage.evaluate(async (url) => {
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
    }, pdfPage.url());

    if (!pdfData.success) {
      throw new Error(`PDF download failed: ${pdfData.error}`);
    }

    const pdfBuffer = Buffer.from(pdfData.base64, 'base64');
    const signature = pdfBuffer.toString('utf8', 0, 4);

    console.log(`Signature: "${signature}"`);
    console.log(`Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);

    if (signature !== '%PDF') {
      // Maybe it's a TIF or other format?
      console.log(`\n⚠️  Not a PDF! First 100 bytes:`);
      console.log(pdfBuffer.toString('utf8', 0, 100));
    } else {
      console.log(`\n✅ Valid PDF downloaded!`);
      const filename = `king_deed_${Date.now()}.pdf`;
      fs.writeFileSync(filename, pdfBuffer);
      console.log(`✅ Saved to: ${filename}`);
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

testTabs();
