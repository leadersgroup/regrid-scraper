/**
 * Manual test for Broward County scraper
 * Address: 2611 NE 48 ST LIGHTHOUSE POINT, FL 33064-7111
 *
 * Workflow:
 * 1. Search for address on Property Appraiser
 * 2. Find "Sales History for this Parcel"
 * 3. Find "Book/Page or CIN"
 * 4. Click on latest record
 * 5. Download PDF
 */

const BrowardCountyFloridaScraper = require('./county-implementations/broward-county-florida');

async function testBrowardManual() {
  const scraper = new BrowardCountyFloridaScraper({
    headless: false,
    timeout: 120000,
    verbose: true
  });

  try {
    await scraper.initialize();

    const address = '2611 NE 48 ST, LIGHTHOUSE POINT, FL 33064';
    console.log(`\n🔍 Testing address: ${address}\n`);

    // Navigate to Property Appraiser
    console.log('📍 Step 1: Navigating to Property Appraiser...');
    await scraper.page.goto('https://web.bcpa.net/BcpaClient/#/Record-Search', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot of initial page
    await scraper.page.screenshot({ path: '/tmp/broward_step1_initial.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/broward_step1_initial.png');

    // Extract street address
    const streetAddress = address.split(',')[0].trim();
    console.log(`\n🏠 Searching for: ${streetAddress}`);

    // Look for input fields
    const pageInfo = await scraper.page.evaluate(() => {
      return {
        inputs: Array.from(document.querySelectorAll('input')).map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          visible: input.offsetParent !== null
        })),
        buttons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim(),
          visible: btn.offsetParent !== null
        }))
      };
    });

    console.log('\n📊 Page inputs:', JSON.stringify(pageInfo.inputs.filter(i => i.visible), null, 2));
    console.log('\n📊 Page buttons:', JSON.stringify(pageInfo.buttons.filter(b => b.visible), null, 2));

    // Try to find and fill address field
    const addressFieldSelector = await scraper.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const input of inputs) {
        const placeholder = (input.placeholder || '').toLowerCase();
        const label = input.labels?.[0]?.textContent?.toLowerCase() || '';
        if (placeholder.includes('address') || placeholder.includes('street') ||
            label.includes('address') || label.includes('street')) {
          return input.id ? `#${input.id}` : `.${input.className.split(' ')[0]}`;
        }
      }
      return null;
    });

    if (addressFieldSelector) {
      console.log(`\n✅ Found address field: ${addressFieldSelector}`);
      await scraper.page.click(addressFieldSelector);
      await new Promise(resolve => setTimeout(resolve, 500));
      await scraper.page.type(addressFieldSelector, streetAddress, { delay: 100 });
      console.log(`✅ Typed address: ${streetAddress}`);

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Click search button or press Enter
      await scraper.page.keyboard.press('Enter');
      console.log('⌨️  Pressed Enter');

      // Wait for results
      console.log('\n⏳ Waiting for results...');
      await new Promise(resolve => setTimeout(resolve, 7000));

      await scraper.page.screenshot({ path: '/tmp/broward_step2_results.png', fullPage: true });
      console.log('📸 Screenshot: /tmp/broward_step2_results.png');

      // Look for "Sales History" section
      console.log('\n🔍 Looking for Sales History...');
      const salesHistory = await scraper.page.evaluate(() => {
        const text = document.body.innerText;
        const hasSalesHistory = text.includes('Sales History') || text.includes('sales history');

        // Look for links or clickable elements with "sales" in them
        const salesLinks = Array.from(document.querySelectorAll('a, button, div, span')).filter(el => {
          const elText = el.textContent?.toLowerCase() || '';
          return elText.includes('sales') && elText.includes('history');
        }).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim(),
          clickable: el.tagName === 'A' || el.tagName === 'BUTTON' || el.onclick !== null
        }));

        return {
          hasSalesHistory,
          salesLinks
        };
      });

      console.log('📊 Sales History info:', JSON.stringify(salesHistory, null, 2));

      if (salesHistory.salesLinks.length > 0) {
        // Click on sales history
        console.log('\n🖱️  Clicking on Sales History...');
        await scraper.page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a, button, div, span'));
          for (const el of elements) {
            const text = el.textContent?.toLowerCase() || '';
            if (text.includes('sales') && text.includes('history')) {
              el.click();
              return;
            }
          }
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        await scraper.page.screenshot({ path: '/tmp/broward_step3_sales_history.png', fullPage: true });
        console.log('📸 Screenshot: /tmp/broward_step3_sales_history.png');

        // Look for Book/Page or CIN
        console.log('\n🔍 Looking for Book/Page or CIN...');
        const transactionInfo = await scraper.page.evaluate(() => {
          const text = document.body.innerText;

          // Look for patterns like "Book: 12345 Page: 67890" or "CIN: 123456789"
          const bookPageMatches = text.match(/Book[:\s]+(\d+)[,\s]+Page[:\s]+(\d+)/gi);
          const cinMatches = text.match(/CIN[:\s]+(\d+)/gi);

          // Look for clickable transaction records
          const rows = Array.from(document.querySelectorAll('tr, div[class*="row"], div[class*="item"]'));
          const transactions = rows.map(row => {
            const rowText = row.textContent || '';
            const hasBook = rowText.match(/Book[:\s]+(\d+)/i);
            const hasPage = rowText.match(/Page[:\s]+(\d+)/i);
            const hasCIN = rowText.match(/CIN[:\s]+(\d+)/i);
            const links = Array.from(row.querySelectorAll('a'));

            if (hasBook || hasPage || hasCIN || links.length > 0) {
              return {
                text: rowText.substring(0, 200),
                book: hasBook ? hasBook[1] : null,
                page: hasPage ? hasPage[1] : null,
                cin: hasCIN ? hasCIN[1] : null,
                hasLinks: links.length > 0,
                linkTexts: links.map(a => a.textContent?.trim())
              };
            }
            return null;
          }).filter(t => t !== null);

          return {
            bookPageMatches: bookPageMatches || [],
            cinMatches: cinMatches || [],
            transactions: transactions.slice(0, 5) // First 5 transactions
          };
        });

        console.log('📊 Transaction info:', JSON.stringify(transactionInfo, null, 2));

        // Click on the first transaction link
        if (transactionInfo.transactions.length > 0) {
          console.log('\n🖱️  Clicking on first transaction...');
          const clicked = await scraper.page.evaluate(() => {
            // Look for first clickable transaction
            const rows = Array.from(document.querySelectorAll('tr, div[class*="row"]'));
            for (const row of rows) {
              const rowText = row.textContent || '';
              if (rowText.match(/Book|Page|CIN/i)) {
                const link = row.querySelector('a');
                if (link) {
                  link.click();
                  return { clicked: true, text: link.textContent?.trim() };
                }
              }
            }
            return { clicked: false };
          });

          console.log('📊 Click result:', JSON.stringify(clicked, null, 2));

          if (clicked.clicked) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            await scraper.page.screenshot({ path: '/tmp/broward_step4_transaction.png', fullPage: true });
            console.log('📸 Screenshot: /tmp/broward_step4_transaction.png');

            // Check if PDF opened or if there's a download link
            const pdfInfo = await scraper.page.evaluate(() => {
              const url = window.location.href;
              const isPDF = url.includes('.pdf') || document.contentType === 'application/pdf';

              // Look for PDF download links
              const pdfLinks = Array.from(document.querySelectorAll('a')).filter(a => {
                const href = a.href || '';
                const text = a.textContent?.toLowerCase() || '';
                return href.includes('.pdf') || text.includes('download') || text.includes('pdf');
              }).map(a => ({
                href: a.href,
                text: a.textContent?.trim()
              }));

              return {
                url,
                isPDF,
                pdfLinks
              };
            });

            console.log('\n📊 PDF info:', JSON.stringify(pdfInfo, null, 2));
          }
        }
      }
    }

    console.log('\n⏸️  Browser will stay open for 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

    await scraper.close();
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    await scraper.close();
  }
}

testBrowardManual();
