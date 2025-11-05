/**
 * Quick test to verify Palm Beach images are valid
 */

const https = require('https');
const fs = require('fs');

const imageUrl = 'https://erec.mypalmbeachclerk.com/Document/GetDocumentImage/?documentId=0&index=0&pageNum=0&type=normal&rotate=0';

console.log('Downloading image from:', imageUrl);

https.get(imageUrl, (res) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);

    console.log('Status:', res.statusCode);
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Size:', buffer.length, 'bytes');

    // Check if it's a PNG
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    console.log('Is PNG:', isPNG);

    if (isPNG) {
      const filename = 'test-palm-beach-page0.png';
      fs.writeFileSync(filename, buffer);
      console.log('✅ Saved to:', filename);
      console.log('You can open this file to verify the image contains deed content');
    } else {
      console.log('❌ Not a valid PNG image');
      console.log('First 200 bytes:', buffer.slice(0, 200).toString());
    }
  });
}).on('error', (err) => {
  console.error('Error:', err.message);
});
