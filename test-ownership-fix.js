// Quick test of the ownership extraction fix
const testText = `
Property Address
Owner Name
Business Name
Account Number
 Back to search results
Advanced Search
Print
 Click on any property on the map to view values and property information.
  5019 LYMBAR DR
HOUSTON, TX 77096
2025
 Residential
Account: 0901540000007
Name:
Mailing Address: 4943 WINGTON DR HOUSTON, TX 77096-
 Valuation History
 Ownership History
Owner	Effective Date
XU HUIPING	07/25/2023
XU HUIPING	09/03/2015
ZHOU JING	09/03/2015
IKARD THOMAS W & ANGELA M	03/18/2014
 Building Summary
`;

const lines = testText.split('\n');

let inOwnershipSection = false;
let owner = null;
let effectiveDate = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // Find "Ownership history" section
  if (line.toLowerCase().includes('ownership history')) {
    console.log(`✅ Found "Ownership History" at line ${i}`);
    inOwnershipSection = true;
    continue;
  }

  // If we're in the ownership section, look for first entry
  if (inOwnershipSection) {
    console.log(`  Checking line ${i}: "${line}"`);

    // Skip the header row
    if (line.includes('Owner') && line.includes('Effective Date')) {
      console.log(`    -> Skipping header`);
      continue;
    }

    // Check if line contains both name and date (tab-separated or space-separated)
    // Format: "XU HUIPING	07/25/2023" or "XU HUIPING 07/25/2023"
    const dateMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      effectiveDate = dateMatch[1];
      console.log(`    -> Found date: ${effectiveDate}`);

      // Extract owner name (everything before the date)
      const ownerPart = line.substring(0, line.indexOf(dateMatch[0])).trim();
      if (ownerPart.length > 0 && /[A-Za-z]{2,}/.test(ownerPart)) {
        owner = ownerPart;
        console.log(`    -> Found owner: ${owner}`);
      }
    }

    // If we have both, we're done
    if (owner && effectiveDate) {
      console.log(`✅ Extraction complete!`);
      break;
    }

    // Stop if we hit another section
    if (line.toLowerCase().includes('building summary') ||
        line.toLowerCase().includes('legal disclaimer')) {
      console.log(`    -> Hit another section, stopping`);
      break;
    }
  }
}

console.log('\n=== RESULT ===');
console.log(`Owner: ${owner}`);
console.log(`Effective Date: ${effectiveDate}`);

if (owner && effectiveDate) {
  console.log('\n✅ SUCCESS!');
} else {
  console.log('\n❌ FAILED to extract data');
}
