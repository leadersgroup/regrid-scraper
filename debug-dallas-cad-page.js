const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function debugDallasCAD() {
  console.log('Launching browser to inspect Dallas CAD...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    console.log('Navigating to Dallas CAD search page...');
    await page.goto('https://www.dallascad.org/SearchAddr.aspx', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\n=== PAGE ANALYSIS ===\n');

    // Get all form elements
    const formInfo = await page.evaluate(() => {
      const result = {
        title: document.title,
        url: window.location.href,
        forms: [],
        inputs: [],
        buttons: []
      };

      // Analyze forms
      const forms = Array.from(document.querySelectorAll('form'));
      forms.forEach((form, idx) => {
        result.forms.push({
          index: idx,
          id: form.id,
          name: form.name,
          action: form.action,
          method: form.method
        });
      });

      // Analyze all input fields
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      inputs.forEach(input => {
        const label = input.labels?.[0]?.textContent?.trim() || '';
        const parent = input.parentElement;
        const parentText = parent?.textContent?.substring(0, 100) || '';
        
        result.inputs.push({
          tagName: input.tagName,
          type: input.type || 'text',
          id: input.id,
          name: input.name,
          placeholder: input.placeholder || '',
          value: input.value || '',
          label: label,
          parentText: parentText,
          visible: input.offsetParent !== null
        });
      });

      // Analyze buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], input[type="button"]'));
      buttons.forEach(btn => {
        result.buttons.push({
          tagName: btn.tagName,
          type: btn.type,
          id: btn.id,
          name: btn.name,
          value: btn.value || btn.textContent?.trim() || '',
          visible: btn.offsetParent !== null
        });
      });

      return result;
    });

    console.log('Page Title:', formInfo.title);
    console.log('URL:', formInfo.url);
    console.log('\n--- FORMS ---');
    formInfo.forms.forEach(form => {
      console.log(`Form ${form.index}:`, form);
    });

    console.log('\n--- VISIBLE INPUT FIELDS ---');
    formInfo.inputs.filter(i => i.visible).forEach(input => {
      console.log(`${input.tagName} [${input.type}]`);
      console.log(`  ID: ${input.id}`);
      console.log(`  Name: ${input.name}`);
      console.log(`  Placeholder: ${input.placeholder}`);
      console.log(`  Label: ${input.label}`);
      console.log(`  Parent text: ${input.parentText}`);
      console.log('');
    });

    console.log('\n--- VISIBLE BUTTONS ---');
    formInfo.buttons.filter(b => b.visible).forEach(btn => {
      console.log(`${btn.tagName} [${btn.type}]`);
      console.log(`  ID: ${btn.id}`);
      console.log(`  Name: ${btn.name}`);
      console.log(`  Value/Text: ${btn.value}`);
      console.log('');
    });

    console.log('\n--- Taking screenshot ---');
    await page.screenshot({ path: '/tmp/dallas-cad-debug.png', fullPage: true });
    console.log('Screenshot saved to /tmp/dallas-cad-debug.png');

    console.log('\nDebug complete!');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

debugDallasCAD().catch(console.error);
