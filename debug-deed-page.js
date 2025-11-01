/**
 * Debug the Self-Service deed page to see why PDF isn't downloading
 * Navigate directly to the deed page and inspect available download options
 */

const puppeteer = require('puppeteer');

async function debugDeedPage() {
  console.log('🔍 Debugging Self-Service Deed Page\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();

  try {
    // Navigate directly to the deed document page
    const deedUrl = 'https://selfservice.or.occompt.com/ssweb/web/integration/document/20170015765';

    console.log(`Navigating to: ${deedUrl}`);
    await page.goto(deedUrl, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('Waiting 5 seconds for page to fully load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n' + '='.repeat(80));
    console.log('DEED PAGE ANALYSIS:');
    console.log('='.repeat(80));

    const pageInfo = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        bodyText: document.body.innerText.substring(0, 5000),

        // All buttons
        buttons: Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]')).map(btn => ({
          text: btn.textContent?.trim() || btn.value,
          id: btn.id,
          className: btn.className,
          visible: btn.offsetParent !== null,
          onclick: btn.onclick ? 'has onclick' : null
        })),

        // All links
        links: Array.from(document.querySelectorAll('a')).map(a => ({
          text: a.textContent?.trim(),
          href: a.href,
          visible: a.offsetParent !== null
        })).filter(l => l.text && l.visible),

        // Look for iframes (PDF might be embedded)
        iframes: Array.from(document.querySelectorAll('iframe')).map(iframe => ({
          src: iframe.src,
          id: iframe.id,
          className: iframe.className
        })),

        // Look for object/embed tags (alternative PDF embedding)
        objects: Array.from(document.querySelectorAll('object, embed')).map(obj => ({
          type: obj.type,
          data: obj.data || obj.src,
          tag: obj.tagName
        })),

        // Check for any disclaimers/terms that need accepting
        hasDisclaimer: !!document.querySelector('input[type="checkbox"]'),

        // Check for forms
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          action: form.action,
          method: form.method,
          id: form.id
        }))
      };
    });

    console.log(`URL: ${pageInfo.url}`);
    console.log(`Title: ${pageInfo.title}`);
    console.log(`Has Disclaimer/Checkbox: ${pageInfo.hasDisclaimer}`);

    console.log(`\nBody Text Preview:\n${pageInfo.bodyText.substring(0, 1000)}`);
    console.log('\n...\n');

    if (pageInfo.buttons.length > 0) {
      console.log('\nBUTTONS FOUND:');
      pageInfo.buttons.forEach((btn, i) => {
        if (btn.visible) {
          console.log(`${i + 1}. "${btn.text}" (ID: ${btn.id}, Class: ${btn.className})`);
          if (btn.onclick) console.log(`   Has onclick handler`);
        }
      });
    }

    if (pageInfo.links.length > 0) {
      console.log('\nLINKS FOUND:');
      pageInfo.links.forEach((link, i) => {
        console.log(`${i + 1}. "${link.text}"`);
        if (link.href.includes('.pdf') || link.text.toLowerCase().includes('download') || link.text.toLowerCase().includes('pdf')) {
          console.log(`   ⭐ ${link.href}`);
        } else {
          console.log(`   -> ${link.href}`);
        }
      });
    }

    if (pageInfo.iframes.length > 0) {
      console.log('\nIFRAMES FOUND:');
      pageInfo.iframes.forEach((iframe, i) => {
        console.log(`${i + 1}. SRC: ${iframe.src}, ID: ${iframe.id}, Class: ${iframe.className}`);
      });
    }

    if (pageInfo.objects.length > 0) {
      console.log('\nOBJECT/EMBED TAGS FOUND:');
      pageInfo.objects.forEach((obj, i) => {
        console.log(`${i + 1}. ${obj.tag}: ${obj.data}, Type: ${obj.type}`);
      });
    }

    if (pageInfo.forms.length > 0) {
      console.log('\nFORMS FOUND:');
      pageInfo.forms.forEach((form, i) => {
        console.log(`${i + 1}. Action: ${form.action}, Method: ${form.method}, ID: ${form.id}`);
      });
    }

    // Check all network requests for PDF URLs
    console.log('\n' + '='.repeat(80));
    console.log('MONITORING NETWORK REQUESTS:');
    console.log('='.repeat(80));
    console.log('Listening for PDF-related requests...\n');

    const pdfRequests = [];

    page.on('response', async (response) => {
      const url = response.url();
      const contentType = response.headers()['content-type'] || '';

      if (url.includes('.pdf') || contentType.includes('pdf')) {
        console.log(`📄 PDF REQUEST DETECTED:`);
        console.log(`   URL: ${url}`);
        console.log(`   Content-Type: ${contentType}`);
        console.log(`   Status: ${response.status()}`);
        pdfRequests.push({ url, contentType, status: response.status() });
      }
    });

    // Try clicking any download/PDF buttons
    console.log('\n' + '='.repeat(80));
    console.log('ATTEMPTING TO TRIGGER DOWNLOAD:');
    console.log('='.repeat(80));

    const downloadAttempt = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));

      for (const el of allElements) {
        const text = (el.textContent || el.value || '').toLowerCase();
        const href = (el.href || '').toLowerCase();

        if (text.includes('download') || text.includes('pdf') ||
            text.includes('view') || text.includes('open') ||
            href.includes('.pdf') || href.includes('download')) {
          console.log('Clicking:', el);
          el.click();
          return { clicked: true, text: el.textContent || el.value, href: el.href };
        }
      }

      return { clicked: false };
    });

    if (downloadAttempt.clicked) {
      console.log(`✅ Clicked: "${downloadAttempt.text}"`);
      if (downloadAttempt.href) {
        console.log(`   HREF: ${downloadAttempt.href}`);
      }

      console.log('\nWaiting 10 seconds to observe download behavior...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      if (pdfRequests.length > 0) {
        console.log('\n📄 PDF REQUESTS CAPTURED:');
        pdfRequests.forEach((req, i) => {
          console.log(`${i + 1}. ${req.url}`);
        });
      } else {
        console.log('\n⚠️ No PDF requests captured during download attempt');
      }
    } else {
      console.log('❌ No download/PDF button found to click');
    }

    console.log('\n' + '='.repeat(80));
    console.log('Browser will stay open for 2 MINUTES for manual inspection...');
    console.log('Please manually:');
    console.log('1. Look for any disclaimers or terms to accept');
    console.log('2. Try clicking download buttons yourself');
    console.log('3. Check browser developer tools for network activity');
    console.log('4. Note any PDF URLs that appear');
    console.log('='.repeat(80));

    await new Promise(resolve => setTimeout(resolve, 120000));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ Complete');
  }
}

debugDeedPage();
