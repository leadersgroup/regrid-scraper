const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  console.log('🔍 Inspecting Harris County Clerk Records form fields...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  console.log('📍 Loading Clerk Records...');
  await page.goto('https://www.cclerk.hctx.net/Applications/WebSearch/RP.aspx', {
    waitUntil: 'networkidle2',
    timeout: 60000
  });

  await new Promise(resolve => setTimeout(resolve, 3000));

  // Inspect all input fields
  const fields = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    return inputs.map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      value: input.value,
      visible: input.offsetParent !== null
    }));
  });

  console.log('📋 All input fields on the page:\n');
  fields.forEach((field, index) => {
    if (field.visible) {
      console.log(`${index + 1}. Type: ${field.type || 'N/A'}`);
      console.log(`   Name: ${field.name || 'N/A'}`);
      console.log(`   ID: ${field.id || 'N/A'}`);
      console.log(`   Placeholder: ${field.placeholder || 'N/A'}`);
      console.log('');
    }
  });

  // Check for grantee-related fields
  console.log('🔍 Looking for Grantee/Owner fields...\n');
  const granteeFields = fields.filter(f =>
    (f.name && f.name.toLowerCase().includes('grantee')) ||
    (f.id && f.id.toLowerCase().includes('grantee')) ||
    (f.name && f.name.toLowerCase().includes('owner')) ||
    (f.id && f.id.toLowerCase().includes('owner'))
  );

  if (granteeFields.length > 0) {
    console.log('✅ Found grantee/owner fields:');
    granteeFields.forEach(f => {
      console.log(`   Name: ${f.name}, ID: ${f.id}`);
    });
  } else {
    console.log('❌ No grantee/owner fields found');
    console.log('\nLet me check all text inputs that might be relevant:\n');
    const textInputs = fields.filter(f => f.type === 'text' && f.visible);
    textInputs.forEach((f, i) => {
      console.log(`${i + 1}. Name: ${f.name || 'none'}, ID: ${f.id || 'none'}`);
    });
  }

  // Check for date fields
  console.log('\n🔍 Looking for Date fields...\n');
  const dateFields = fields.filter(f =>
    (f.name && (f.name.toLowerCase().includes('date') || f.name.toLowerCase().includes('from') || f.name.toLowerCase().includes('to'))) ||
    (f.id && (f.id.toLowerCase().includes('date') || f.id.toLowerCase().includes('from') || f.id.toLowerCase().includes('to')))
  );

  if (dateFields.length > 0) {
    console.log('✅ Found date fields:');
    dateFields.forEach(f => {
      console.log(`   Name: ${f.name}, ID: ${f.id}`);
    });
  }

  console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));

  await browser.close();
})();
