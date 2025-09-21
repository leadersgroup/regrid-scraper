// Simple fix: Add this right after the bodyTextSample extraction
const bodyText = document.body.innerText || '';

// Simple pattern to find Regrid parcel IDs like "17 0036 LL0847"
const parcelMatch = bodyText.match(/\b(\d{2}\s+\d{4}\s+[A-Z0-9]{6})\b/);
if (parcelMatch && !parcelId) {
  parcelId = parcelMatch[1];
  foundElements.push(`Parcel ID found via simple pattern: ${parcelId}`);
}