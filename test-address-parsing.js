// Quick test to verify address parsing logic

const address = '6409 Winding Arch Dr Durham NC 27713';

// Extract ONLY the street address (number + street name)
let searchTerm = address.toLowerCase().trim();

// Common street suffixes to look for
const streetSuffixes = ['street', 'st', 'drive', 'dr', 'road', 'rd', 'avenue', 'ave',
                        'boulevard', 'blvd', 'lane', 'ln', 'court', 'ct', 'circle', 'cir',
                        'way', 'place', 'pl', 'trail', 'parkway', 'pkwy'];

// Find the first street suffix and cut BEFORE it
for (const suffix of streetSuffixes) {
  const regex = new RegExp(`\\b${suffix}\\b`, 'i');
  const match = searchTerm.match(regex);
  if (match) {
    // Get everything up to (but not including) the suffix
    const index = searchTerm.indexOf(match[0]);
    searchTerm = searchTerm.substring(0, index);
    break;
  }
}

// Clean up
searchTerm = searchTerm
  .replace(/,/g, '') // Remove commas
  .replace(/\s+/g, ' ') // Normalize whitespace
  .trim();

console.log('Original address:', address);
console.log('Search term:', searchTerm);
console.log('Expected: 6409 winding arch');
console.log('Match:', searchTerm === '6409 winding arch' ? '✅ YES' : '❌ NO');
