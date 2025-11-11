// Test URL extraction logic

const url = 'https://rodweb.dconc.gov/web/resources/pdfjs/web/tylerPdfJsViewer.html?file=/web/document/servepdf/SCALED-DOC210S270.1.pdf/2024114785.pdf?index=1&allowDownload=true&allowPrint=true';

const match = url.match(/file=([^&]+)/);
if (match) {
  let extractedPath = decodeURIComponent(match[1]);
  console.log('Extracted (with query params):', extractedPath);

  // Remove any query parameters from the extracted path
  extractedPath = extractedPath.split('?')[0];
  console.log('Extracted (cleaned):', extractedPath);

  // Construct full URL if it's a relative path
  if (extractedPath.startsWith('/')) {
    const baseUrl = new URL(url).origin;
    const pdfUrl = baseUrl + extractedPath;
    console.log('Full PDF URL:', pdfUrl);
  }
}
