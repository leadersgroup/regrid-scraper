/**
 * Debug Mecklenburg - test constructed URL to see what 238-byte response is
 */

const axios = require('axios');

async function debug() {
  // Example URL constructed from captured parameters
  const testUrl = 'https://meckrod.manatron.com/Controls/generator.leadgen?0b0d3b975c184b9286dabc2ab2da6aa7&ICG=/Controls/LTCacheFolder/1ccd22d5de8e41629bd0c054216d086c.tmp&PN=1&WIV=true&SRL=0&SRT=0&SRW=2552&SRH=4273&OIW=2552&OIH=4273&SIW=2552&SIH=4273&DTW=2552&DTH=4273&UD=false&XR=300&YR=300&BIF=0&FGTS=false&';

  console.log('Testing URL:');
  console.log(testUrl);
  console.log('\n');

  try {
    const response = await axios.get(testUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers['content-type']}`);
    console.log(`Content-Length: ${response.headers['content-length'] || response.data.length}`);
    console.log('\n Response body (as text):');
    console.log(response.data.toString());

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${error.response.data.toString()}`);
    }
  }
}

debug().catch(console.error);
