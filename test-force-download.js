const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Testing forced PDF download (bypass Chrome viewer)...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Navigate to Clerk Records
  console.log('📍 Loading Clerk Records...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Fill and search
  await page.type('input[name*="From"]', '07/25/2023');
  await page.type('input[name*="To"]', '07/25/2023');
  await new Promise(resolve => setTimeout(resolve, 1000));

  const searchButton = await page.$('input[type="submit"]');
  await searchButton.click();
  console.log('✅ Searched\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Get film code URL
  console.log('🔗 Getting film code link URL...\n');
  const filmCodeUrl = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    for (const link of links) {
      if (link.textContent.includes('RP-2023-279211')) {
        return link.href;
      }
    }
    return null;
  });

  console.log(`   Film code URL: ${filmCodeUrl}\n`);

  // Create a new page with download behavior set
  const newPage = await browser.newPage();

  // Set up download path using CDP
  const client = await newPage.target().createCDPSession();
  const downloadPath = path.resolve(__dirname, 'downloads');

  // Ensure download directory exists
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  }

  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: downloadPath
  });

  console.log(`📁 Download path set to: ${downloadPath}\n`);

  // Navigate to login page
  console.log('🔐 Navigating to film code URL and logging in...\n');
  await newPage.goto(filmCodeUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Login
  const isLoginPage = await newPage.evaluate(() => {
    return document.body.innerText.toLowerCase().includes('log in');
  });

  if (isLoginPage) {
    console.log('🔐 Logging in...\n');
    await newPage.waitForSelector('input[name*="UserName"]', { timeout: 5000 });
    await newPage.type('input[name*="UserName"]', 'leaderslaw');
    await newPage.waitForSelector('input[type="password"]', { timeout: 5000 });
    await newPage.type('input[type="password"]', 'Leaders2000@1');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await newPage.click('input[type="submit"][value*="Log"]');

    console.log('⏳ Waiting for PDF viewer to load...\n');
    await new Promise(resolve => setTimeout(resolve, 8000));
  }

  const currentUrl = newPage.url();
  console.log(`📍 Current URL: ${currentUrl}\n`);

  // Method 1: Try to trigger download by injecting a download link
  console.log('📥 Method 1: Attempting to trigger download via injected link...\n');
  try {
    const downloaded = await newPage.evaluate(() => {
      // Look for the PDF source in iframes or embeds
      const iframes = document.querySelectorAll('iframe');
      const embeds = document.querySelectorAll('embed');
      const objects = document.querySelectorAll('object');

      for (const iframe of iframes) {
        if (iframe.src && (iframe.src.includes('pdf') || iframe.type === 'application/pdf')) {
          console.log('Found PDF iframe:', iframe.src);
          // Create download link
          const a = document.createElement('a');
          a.href = iframe.src;
          a.download = 'deed.pdf';
          document.body.appendChild(a);
          a.click();
          return true;
        }
      }

      for (const embed of embeds) {
        if (embed.src && (embed.src.includes('pdf') || embed.type === 'application/pdf')) {
          console.log('Found PDF embed:', embed.src);
          const a = document.createElement('a');
          a.href = embed.src;
          a.download = 'deed.pdf';
          document.body.appendChild(a);
          a.click();
          return true;
        }
      }

      for (const object of objects) {
        if (object.data && (object.data.includes('pdf') || object.type === 'application/pdf')) {
          console.log('Found PDF object:', object.data);
          const a = document.createElement('a');
          a.href = object.data;
          a.download = 'deed.pdf';
          document.body.appendChild(a);
          a.click();
          return true;
        }
      }

      return false;
    });

    if (downloaded) {
      console.log('✅ Download triggered, waiting for file...\n');
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      console.log('❌ Could not find PDF element to download\n');
    }
  } catch (e) {
    console.log(`❌ Method 1 failed: ${e.message}\n`);
  }

  // Method 2: Try to access the PDF URL directly in a new page with different headers
  console.log('📥 Method 2: Attempting direct PDF URL access...\n');
  try {
    // Extract any PDF URLs from the page source
    const pageContent = await newPage.content();
    const pdfUrlMatch = pageContent.match(/https?:\/\/[^"'\s]+\.pdf[^"'\s]*/i);

    if (pdfUrlMatch) {
      const pdfUrl = pdfUrlMatch[0];
      console.log(`   Found PDF URL: ${pdfUrl}\n`);

      // Create another page with download behavior
      const downloadPage = await browser.newPage();
      const dlClient = await downloadPage.target().createCDPSession();
      await dlClient.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath
      });

      // Try to navigate directly to PDF URL
      await downloadPage.goto(pdfUrl, { waitUntil: 'networkidle2' });
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log('   No direct PDF URL found in page source\n');
    }
  } catch (e) {
    console.log(`❌ Method 2 failed: ${e.message}\n`);
  }

  // Check downloads folder
  console.log('📊 Checking downloads folder...\n');
  if (fs.existsSync(downloadPath)) {
    const files = fs.readdirSync(downloadPath);
    if (files.length > 0) {
      console.log(`✅ Found ${files.length} file(s) in downloads:\n`);
      files.forEach(file => {
        const filepath = path.join(downloadPath, file);
        const stats = fs.statSync(filepath);
        const buffer = fs.readFileSync(filepath);
        const isPDF = buffer.slice(0, 4).toString() === '%PDF';
        console.log(`   ${file}: ${stats.size} bytes, isPDF: ${isPDF}`);
      });
    } else {
      console.log('❌ No files downloaded\n');
    }
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
