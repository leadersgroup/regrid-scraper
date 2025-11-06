#!/usr/bin/env node

/**
 * Examine the Shelby County Register of Deeds search page
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function examineRegisterPage() {
  console.log('🔍 Examining Shelby County Register of Deeds search page...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    // Navigate directly to the deed number search
    console.log('📍 Navigating to Register of Deeds search...');
    const deedNumber = 'CV7848';
    const url = `https://search.register.shelby.tn.us/search/?instnum=${deedNumber}`;

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('✅ Register page loaded\n');

    // Take screenshot of main page
    await page.screenshot({ path: 'shelby-register-page.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-register-page.png\n');

    // Switch to iframe
    console.log('🔄 Switching to content iframe...');
    const frames = page.frames();
    const contentFrame = frames.find(f => f.name() === 'content_frame' || f.url().includes('content.php'));

    if (!contentFrame) {
      console.log('❌ Could not find content iframe');
      throw new Error('No content iframe found');
    }

    console.log(`✅ Found iframe: ${contentFrame.url()}\n`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot after iframe loaded
    await page.screenshot({ path: 'shelby-register-iframe.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-register-iframe.png\n');

    // Examine iframe content
    const pageAnalysis = await contentFrame.evaluate(() => {
      const results = {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 2000),
        allLinks: [],
        pdfLinks: [],
        iframes: [],
        embeds: []
      };

      // Get all links
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.href;
        const text = link.textContent.trim();
        results.allLinks.push({
          text: text.substring(0, 50),
          href: href
        });

        // Check for PDF links
        if (href.includes('.pdf') || href.includes('PDF') || href.includes('document') || href.includes('view')) {
          results.pdfLinks.push({
            text: text,
            href: href
          });
        }
      });

      // Check for iframes (PDF might be embedded)
      document.querySelectorAll('iframe').forEach(iframe => {
        results.iframes.push({
          src: iframe.src,
          id: iframe.id,
          classes: iframe.className
        });
      });

      // Check for embed tags
      document.querySelectorAll('embed, object').forEach(embed => {
        results.embeds.push({
          type: embed.tagName,
          src: embed.src || embed.data,
          id: embed.id
        });
      });

      return results;
    });

    console.log('📊 Register of Deeds Page Analysis:\n');
    console.log(`URL: ${pageAnalysis.url}`);
    console.log(`Title: ${pageAnalysis.title}\n`);

    console.log('1️⃣  All Links (first 20):');
    pageAnalysis.allLinks.slice(0, 20).forEach((link, i) => {
      console.log(`   ${i + 1}. "${link.text}"`);
      console.log(`      -> ${link.href}`);
    });
    console.log(`   Total: ${pageAnalysis.allLinks.length}\n`);

    console.log('2️⃣  PDF-related links:');
    pageAnalysis.pdfLinks.forEach((link, i) => {
      console.log(`   ${i + 1}. "${link.text}"`);
      console.log(`      -> ${link.href}`);
    });
    console.log(`   Total: ${pageAnalysis.pdfLinks.length}\n`);

    console.log('3️⃣  Iframes:');
    pageAnalysis.iframes.forEach((iframe, i) => {
      console.log(`   ${i + 1}. src="${iframe.src}"`);
      console.log(`      id="${iframe.id}", classes="${iframe.classes}"`);
    });
    console.log(`   Total: ${pageAnalysis.iframes.length}\n`);

    console.log('4️⃣  Embeds/Objects:');
    pageAnalysis.embeds.forEach((embed, i) => {
      console.log(`   ${i + 1}. <${embed.type}> src="${embed.src}"`);
    });
    console.log(`   Total: ${pageAnalysis.embeds.length}\n`);

    console.log('5️⃣  Page text preview:');
    console.log(pageAnalysis.bodyText);
    console.log('\n');

    console.log('✅ Analysis complete!');
    console.log('\n⏸️  Keeping browser open for 2 minutes for manual inspection...');

    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
    console.log('\n🏁 Done');
  }
}

examineRegisterPage().catch(console.error);
