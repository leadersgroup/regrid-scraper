/**
 * Direct test of TIFF to PDF conversion
 * This bypasses the full scraping flow and directly tests the conversion logic
 */

const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function convertTiffToPdf(tiffBuffer) {
  console.log(`📥 Input TIFF size: ${(tiffBuffer.length / 1024).toFixed(2)} KB`);

  const tiffSignature = tiffBuffer.toString('ascii', 0, 2);
  console.log(`🔍 Detected signature: ${tiffSignature}`);

  if (tiffSignature !== 'II' && tiffSignature !== 'MM') {
    throw new Error('Not a valid TIFF file');
  }

  console.log('🔄 Converting TIFF to PDF...');

  // Convert TIFF to PNG using sharp (pdf-lib doesn't support TIFF directly)
  const pngBuffer = await sharp(tiffBuffer)
    .png()
    .toBuffer();

  console.log(`✅ Converted to PNG: ${(pngBuffer.length / 1024).toFixed(2)} KB`);

  // Get image dimensions
  const metadata = await sharp(tiffBuffer).metadata();
  const width = metadata.width || 612;
  const height = metadata.height || 792;
  console.log(`📐 Image dimensions: ${width}x${height}`);

  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();

  // Embed the PNG image
  const pngImage = await pdfDoc.embedPng(pngBuffer);

  // Calculate page size to fit image (maintain aspect ratio)
  const maxWidth = 612; // 8.5 inches at 72 DPI
  const maxHeight = 792; // 11 inches at 72 DPI
  let pageWidth = width;
  let pageHeight = height;

  // Scale down if image is too large
  if (pageWidth > maxWidth || pageHeight > maxHeight) {
    const scale = Math.min(maxWidth / pageWidth, maxHeight / pageHeight);
    pageWidth = pageWidth * scale;
    pageHeight = pageHeight * scale;
    console.log(`📏 Scaled to: ${pageWidth.toFixed(0)}x${pageHeight.toFixed(0)}`);
  }

  // Add a page with the image dimensions
  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  // Draw the image on the page
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  console.log(`✅ PDF created: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

  return Buffer.from(pdfBytes);
}

async function testConversion() {
  console.log('🧪 Testing TIFF to PDF conversion\n');

  try {
    // Create a simple test TIFF image for testing
    console.log('📝 Creating test TIFF image...');

    // Create a test PNG first (100x100 white image with black text)
    const testImageBuffer = await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    })
    .tiff()
    .toBuffer();

    console.log(`✅ Test TIFF created: ${(testImageBuffer.length / 1024).toFixed(2)} KB\n`);

    // Convert it to PDF
    const pdfBuffer = await convertTiffToPdf(testImageBuffer);

    // Verify the output
    const pdfSignature = pdfBuffer.toString('utf8', 0, 4);

    if (pdfSignature === '%PDF') {
      console.log('\n✅ SUCCESS! Converted file is a valid PDF');

      // Save both files for inspection
      fs.writeFileSync('./test-input.tiff', testImageBuffer);
      fs.writeFileSync('./test-output.pdf', pdfBuffer);

      console.log('💾 Saved test-input.tiff and test-output.pdf');
      console.log('\n✨ TIFF to PDF conversion is working correctly!');
    } else {
      console.log(`\n❌ FAILED: Invalid PDF signature: ${pdfSignature}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testConversion().catch(console.error);
