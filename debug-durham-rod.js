/**
 * Debug script to analyze Register of Deeds search page structure
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugRegisterOfDeeds() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  try {
    console.log('🌐 Navigating to Register of Deeds...');
    await page.goto('https://rodweb.dconc.gov/web/search/DOCSEARCH5S1', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== Checking for disclaimer ===');
    const disclaimerInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
      const disclaimerButtons = buttons.map(btn => ({
        tag: btn.tagName,
        type: btn.type || null,
        text: (btn.textContent || btn.value || '').trim(),
        id: btn.id,
        className: btn.className,
        visible: btn.offsetParent !== null
      })).filter(btn => btn.visible && btn.text);

      return {
        hasButtons: buttons.length,
        visibleButtons: disclaimerButtons
      };
    });

    console.log('Disclaimer info:', JSON.stringify(disclaimerInfo, null, 2));

    // Try to dismiss disclaimer
    const dismissBtn = await page.$('#submitDisclaimerAccept');
    if (dismissBtn) {
      console.log('📝 Clicking "I Accept"...');
      await dismissBtn.click();
      console.log('✅ Clicked, waiting for navigation...');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
        console.log('⚠️ No navigation detected');
      });
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log(`Current URL after disclaimer: ${page.url()}`);
    }

    console.log('\n=== Analyzing input fields ===');
    const inputAnalysis = await page.evaluate(() => {
      const allInputs = Array.from(document.querySelectorAll('input'));

      return {
        url: window.location.href,
        totalInputs: allInputs.length,
        inputs: allInputs.map(input => ({
          type: input.type,
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          value: input.value,
          className: input.className,
          visible: input.offsetParent !== null,
          // Get label if any
          label: (() => {
            const label = input.parentElement?.querySelector('label') ||
                         document.querySelector(`label[for="${input.id}"]`);
            return label ? label.textContent.trim() : null;
          })(),
          // Get surrounding text
          nearbyText: input.parentElement?.textContent.trim().substring(0, 100)
        })).filter(i => i.visible),
        // Also check for forms
        forms: Array.from(document.querySelectorAll('form')).map(form => ({
          id: form.id,
          name: form.name,
          action: form.action,
          inputs: Array.from(form.querySelectorAll('input')).length
        }))
      };
    });

    console.log('\n=== INPUT FIELDS ANALYSIS ===');
    console.log(JSON.stringify(inputAnalysis, null, 2));

    await page.screenshot({ path: '/tmp/durham-rod-page.png', fullPage: true });
    console.log('\n📸 Screenshot: /tmp/durham-rod-page.png');

    console.log('\n⏳ Waiting 60 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 60000));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

debugRegisterOfDeeds().catch(console.error);
