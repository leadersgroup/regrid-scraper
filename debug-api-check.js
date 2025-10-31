/**
 * Check if Orange County has a public API we can use
 */

const puppeteer = require('puppeteer');

async function checkForAPI() {
  console.log('🔍 Checking for Orange County Property Appraiser API\n');

  const parcelId = '272324542803770';

  const browser = await puppeteer.launch({
    headless: true
  });

  const page = await browser.newPage();

  // Intercept network requests to see if there's an API being called
  const apiRequests = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('api') || url.includes('json') || url.includes('parcel') || url.includes(parcelId)) {
      apiRequests.push({
        method: request.method(),
        url: url,
        postData: request.postData()
      });
    }
  });

  page.on('response', async response => {
    const url = response.url();
    if (url.includes('api') || url.includes('json') || url.includes('parcel') || url.includes(parcelId)) {
      const contentType = response.headers()['content-type'] || '';

      if (contentType.includes('json')) {
        try {
          const data = await response.json();
          console.log('\n' + '='.repeat(80));
          console.log(`API RESPONSE FOUND: ${url}`);
          console.log('='.repeat(80));
          console.log('Data:', JSON.stringify(data, null, 2).substring(0, 2000));
        } catch (e) {
          // Not JSON or error parsing
        }
      }
    }
  });

  try {
    console.log('Navigating and monitoring network traffic...');
    await page.goto(`https://ocpaweb.ocpafl.org/parcelsearch/#/summary/${parcelId}`, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n' + '='.repeat(80));
    console.log('API REQUESTS DETECTED:');
    console.log('='.repeat(80));

    if (apiRequests.length === 0) {
      console.log('No API requests detected');
    } else {
      apiRequests.forEach((req, i) => {
        console.log(`\n${i + 1}. ${req.method} ${req.url}`);
        if (req.postData) {
          console.log(`   POST Data: ${req.postData}`);
        }
      });
    }

    // Try to manually construct potential API URLs
    console.log('\n' + '='.repeat(80));
    console.log('TESTING POTENTIAL API ENDPOINTS:');
    console.log('='.repeat(80));

    const potentialAPIs = [
      `https://ocpaimages.ocpafl.org/api/parcel/${parcelId}`,
      `https://ocpaweb.ocpafl.org/api/parcel/${parcelId}`,
      `https://ocpaweb.ocpafl.org/api/property/${parcelId}`,
      `https://ocpaweb.ocpafl.org/api/summary/${parcelId}`,
      `https://ocpaimages.ocpafl.org/api/PropertyCard/${parcelId}`,
    ];

    for (const apiUrl of potentialAPIs) {
      try {
        console.log(`\nTrying: ${apiUrl}`);
        const response = await page.goto(apiUrl, {
          waitUntil: 'networkidle2',
          timeout: 10000
        });

        const status = response.status();
        const contentType = response.headers()['content-type'] || '';

        console.log(`  Status: ${status}`);
        console.log(`  Content-Type: ${contentType}`);

        if (status === 200) {
          const content = await page.content();
          console.log(`  Content preview: ${content.substring(0, 500)}`);

          if (contentType.includes('json')) {
            try {
              const jsonData = JSON.parse(content);
              console.log('\n  ✅ JSON DATA FOUND:');
              console.log(JSON.stringify(jsonData, null, 2).substring(0, 2000));
            } catch (e) {
              // Not valid JSON
            }
          }
        }
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('\n✅ API check complete');
  }
}

checkForAPI();
