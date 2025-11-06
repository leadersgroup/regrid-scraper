#!/usr/bin/env node

/**
 * Click on Sales History and examine the content
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function clickSalesHistory() {
  console.log('🔍 Clicking Sales History and examining content...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1024 });

  try {
    // Go directly to property details
    console.log('📍 Navigating to property details...');
    const parcelId = '001001 A00090';
    const url = `https://www.assessormelvinburgess.com/propertyDetails?parcelid=${encodeURIComponent(parcelId)}&IR=true`;

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Property details page loaded\n');

    // Click on Sales History
    console.log('📋 Clicking on Sales History...');

    const clicked = await page.evaluate(() => {
      // Look for the Sales History element
      const allElements = Array.from(document.querySelectorAll('div, a, button, [role="button"], h1, h2, h3, h4, h5, h6'));

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text === 'Sales History' || text.includes('Sales History')) {
          console.log(`Found element: ${el.tagName} id="${el.id}" class="${el.className}"`);
          el.click();
          return { success: true, text: text, tag: el.tagName, id: el.id, class: el.className };
        }
      }

      return { success: false };
    });

    if (clicked.success) {
      console.log(`✅ Clicked on <${clicked.tag}> "${clicked.text}"`);
      console.log(`   id: ${clicked.id}, class: ${clicked.class}\n`);
    } else {
      console.log('❌ Could not find Sales History element\n');
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot after clicking
    await page.screenshot({ path: 'shelby-sales-history-expanded.png', fullPage: true });
    console.log('📸 Screenshot saved: shelby-sales-history-expanded.png\n');

    // Examine the sales history content
    const salesData = await page.evaluate(() => {
      const results = {
        salesHistoryVisible: false,
        salesTableData: [],
        allLinksInSales: [],
        deedNumbers: []
      };

      // Check if sales history section is visible
      const salesSection = document.getElementById('headingSix');
      if (salesSection) {
        results.salesHistoryVisible = window.getComputedStyle(salesSection).display !== 'none';
      }

      // Find the sales history table
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const headerRow = table.querySelector('tr');
        if (headerRow && headerRow.textContent.includes('Deed Number')) {
          // This is the sales history table
          const rows = table.querySelectorAll('tr');
          rows.forEach((row, i) => {
            const cells = row.querySelectorAll('td, th');
            if (cells.length > 0) {
              const rowData = Array.from(cells).map(cell => cell.textContent.trim());
              results.salesTableData.push(rowData);

              // Look for links in this row
              const links = row.querySelectorAll('a[href]');
              links.forEach(link => {
                results.allLinksInSales.push({
                  text: link.textContent.trim(),
                  href: link.href
                });
              });
            }
          });
        }
      });

      // Look specifically for deed numbers
      document.querySelectorAll('td, th').forEach(cell => {
        const text = cell.textContent.trim();
        // Deed numbers in Shelby County might be in format like "D01234" or just numbers
        if (text.match(/^[A-Z]?\d+$/)) {
          const nextCell = cell.nextElementSibling;
          if (nextCell) {
            results.deedNumbers.push({
              value: text,
              link: cell.querySelector('a') ? cell.querySelector('a').href : null
            });
          }
        }
      });

      return results;
    });

    console.log('📊 Sales History Content:\n');
    console.log(`Sales History Visible: ${salesData.salesHistoryVisible}\n`);

    console.log('1️⃣  Sales History Table Data:');
    salesData.salesTableData.forEach((row, i) => {
      console.log(`   Row ${i + 1}: ${row.join(' | ')}`);
    });
    console.log();

    console.log('2️⃣  Links in Sales History:');
    salesData.allLinksInSales.forEach((link, i) => {
      console.log(`   ${i + 1}. "${link.text}" -> ${link.href}`);
    });
    console.log(`   Total: ${salesData.allLinksInSales.length}\n`);

    console.log('3️⃣  Potential Deed Numbers:');
    salesData.deedNumbers.forEach((deed, i) => {
      console.log(`   ${i + 1}. ${deed.value} -> ${deed.link || 'no link'}`);
    });
    console.log(`   Total: ${salesData.deedNumbers.length}\n`);

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

clickSalesHistory().catch(console.error);
