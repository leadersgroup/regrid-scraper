/**
 * Test downloading Palm Beach County deed images and converting to PDF
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const https = require('https');
const url = require('url');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

puppeteer.use(StealthPlugin());

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(imageUrl, cookies, referer) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(imageUrl);
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
        'Referer': referer
      }
    };

    https.get(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    }).on('error', reject);
  });
}

async function testPalmBeachDownload() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    // Navigate directly to a known document page
    const bookNumber = '33358';
    const pageNumber = '1920';
    const documentUrl = `https://erec.mypalmbeachclerk.com/Search/DocumentAndInfoByBookPage?Key=Assessor&booktype=O&booknumber=${bookNumber}&pagenumber=${pageNumber}`;

    console.log('Navigating to document page...');
    await page.goto(documentUrl, { waitUntil: 'networkidle2' });
    await wait(5000);

    // Get page count
    const pageCount = await page.evaluate(() => {
      // Look for page count indicator
      const pageInfo = document.body.innerText;
      const match = pageInfo.match(/Page \d+ of (\d+)/i) || pageInfo.match(/(\d+) pages/i);
      if (match) {
        return parseInt(match[1]);
      }

      // Try to find in carousel or pagination
      const paginationElements = Array.from(document.querySelectorAll('*'));
      for (const el of paginationElements) {
        const text = el.textContent || '';
        const pageMatch = text.match(/of (\d+)/i);
        if (pageMatch) {
          return parseInt(pageMatch[1]);
        }
      }

      return 1; // Default to 1 page
    });

    console.log(`Document has ${pageCount} page(s)`);

    // Extract document ID from network requests
    const pdfRequests = [];
    const requestHandler = (request) => {
      const url = request.url();
      if (url.includes('GetDocumentImage')) {
        pdfRequests.push(url);
        console.log(`📥 Captured: ${url.substring(0, 120)}`);
      }
    };

    page.on('request', requestHandler);
    await wait(3000);
    page.off('request', requestHandler);

    // Find document ID from captured requests
    let documentId = null;
    if (pdfRequests.length > 0) {
      const match = pdfRequests[0].match(/documentId=(\d+)/);
      if (match) {
        documentId = match[1];
      }
    }

    if (!documentId) {
      // Try to find from page
      documentId = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const text = script.textContent || '';
          const match = text.match(/documentId["\s:=]+(\d+)/);
          if (match) {
            return match[1];
          }
        }
        return null;
      });
    }

    console.log(`Document ID: ${documentId}`);

    if (!documentId) {
      throw new Error('Could not find document ID');
    }

    // Download all pages
    console.log(`\nDownloading ${pageCount} page(s)...`);
    const cookies = await page.cookies();
    const referer = page.url();
    const imageBuffers = [];

    for (let pageNum = 0; pageNum < pageCount; pageNum++) {
      const imageUrl = `https://erec.mypalmbeachclerk.com/Document/GetDocumentImage/?documentId=${documentId}&index=0&pageNum=${pageNum}&type=normal&rotate=0`;
      console.log(`  Page ${pageNum + 1}/${pageCount}: ${imageUrl.substring(0, 100)}...`);

      const imageBuffer = await downloadImage(imageUrl, cookies, referer);
      console.log(`    Downloaded: ${(imageBuffer.length / 1024).toFixed(2)} KB`);
      imageBuffers.push(imageBuffer);

      await wait(500); // Small delay between requests
    }

    // Convert images to PDF
    console.log('\nConverting images to PDF...');
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < imageBuffers.length; i++) {
      console.log(`  Adding page ${i + 1}/${imageBuffers.length}...`);
      const image = await pdfDoc.embedPng(imageBuffers[i]);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height
      });
    }

    const pdfBytes = await pdfDoc.save();
    console.log(`\n✅ PDF created: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

    // Save PDF
    const filename = `palm_beach_deed_${bookNumber}_${pageNumber}.pdf`;
    fs.writeFileSync(filename, pdfBytes);
    console.log(`💾 Saved to: ${filename}`);

    await browser.close();
    console.log('\n✅ Success!');

  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

testPalmBeachDownload();
