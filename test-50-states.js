// Test suite for all 50 US states
const axios = require('axios');

const stateAddresses = [
  // Format: [State, Address, Expected City/State]
  ['Alabama', '123 Main St, Birmingham, AL'],
  ['Alaska', '123 Northern Lights Blvd, Anchorage, AK'],
  ['Arizona', '123 Central Ave, Phoenix, AZ'],
  ['Arkansas', '123 Main St, Little Rock, AR'],
  ['California', '123 Sunset Blvd, Los Angeles, CA'],
  ['Colorado', '123 17th St, Denver, CO'],
  ['Connecticut', '123 Main St, Hartford, CT'],
  ['Delaware', '123 Market St, Wilmington, DE'],
  ['Florida', '5000 T Rex Ave, Boca Raton, FL 33431'],
  ['Georgia', '6075 Barfield RD, Sandy Springs, GA'],
  ['Hawaii', '123 Ala Moana Blvd, Honolulu, HI'],
  ['Idaho', '123 State St, Boise, ID'],
  ['Illinois', '123 Michigan Ave, Chicago, IL'],
  ['Indiana', '123 Meridian St, Indianapolis, IN'],
  ['Iowa', '123 Locust St, Des Moines, IA'],
  ['Kansas', '123 Main St, Wichita, KS'],
  ['Kentucky', '123 Main St, Louisville, KY'],
  ['Louisiana', '123 Canal St, New Orleans, LA'],
  ['Maine', '123 Commercial St, Portland, ME'],
  ['Maryland', '123 Charles St, Baltimore, MD'],
  ['Massachusetts', '123 Beacon St, Boston, MA'],
  ['Michigan', '123 Woodward Ave, Detroit, MI'],
  ['Minnesota', '123 Hennepin Ave, Minneapolis, MN'],
  ['Mississippi', '123 High St, Jackson, MS'],
  ['Missouri', '123 Market St, St Louis, MO'],
  ['Montana', '123 Main St, Billings, MT'],
  ['Nebraska', '123 Dodge St, Omaha, NE'],
  ['Nevada', '123 Las Vegas Blvd, Las Vegas, NV'],
  ['New Hampshire', '123 Elm St, Manchester, NH'],
  ['New Jersey', '123 Broad St, Newark, NJ'],
  ['New Mexico', '123 Central Ave, Albuquerque, NM'],
  ['New York', '123 Broadway, New York, NY'],
  ['North Carolina', '123 Tryon St, Charlotte, NC'],
  ['North Dakota', '123 Broadway, Fargo, ND'],
  ['Ohio', '123 Euclid Ave, Cleveland, OH'],
  ['Oklahoma', '123 Main St, Oklahoma City, OK'],
  ['Oregon', '123 SW Morrison St, Portland, OR'],
  ['Pennsylvania', '123 Market St, Philadelphia, PA'],
  ['Rhode Island', '123 Westminster St, Providence, RI'],
  ['South Carolina', '123 King St, Charleston, SC'],
  ['South Dakota', '123 Main St, Sioux Falls, SD'],
  ['Tennessee', '123 Broadway, Nashville, TN'],
  ['Texas', '123 Main St, Houston, TX'],
  ['Utah', '123 State St, Salt Lake City, UT'],
  ['Vermont', '123 Church St, Burlington, VT'],
  ['Virginia', '123 Broad St, Richmond, VA'],
  ['Washington', '123 Pine St, Seattle, WA'],
  ['West Virginia', '123 Capitol St, Charleston, WV'],
  ['Wisconsin', '123 Wisconsin Ave, Milwaukee, WI'],
  ['Wyoming', '123 Central Ave, Cheyenne, WY']
];

async function testState(state, address) {
  try {
    console.log(`\n🏛️  Testing ${state}: ${address}`);

    const response = await axios.post(
      'https://regrid-scraper-production.up.railway.app/api/scrape',
      { addresses: [address] },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000 // 3 minutes
      }
    );

    const result = response.data.data[0];

    if (result.status === 'success') {
      const parcelFound = result.parcelId !== 'Not found' &&
                         !result.parcelId.includes('Base Parcel Styles') &&
                         !result.parcelId.includes('Error');
      const ownerFound = result.ownerName !== 'Not found' &&
                        !result.ownerName.includes('Error');

      console.log(`  ✅ Status: ${result.status}`);
      console.log(`  📋 Parcel ID: ${result.parcelId} ${parcelFound ? '✅' : '❌'}`);
      console.log(`  👤 Owner: ${result.ownerName} ${ownerFound ? '✅' : '❌'}`);

      return {
        state,
        address,
        success: true,
        parcelFound,
        ownerFound,
        parcelId: result.parcelId,
        ownerName: result.ownerName
      };
    } else {
      console.log(`  ❌ Error: ${result.error}`);
      return {
        state,
        address,
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    console.log(`  💥 Request failed: ${error.message}`);
    return {
      state,
      address,
      success: false,
      error: error.message
    };
  }
}

async function runFullTest() {
  console.log('🇺🇸 Testing Regrid Scraper Across All 50 States\n');
  console.log('=' .repeat(60));

  const results = [];
  let successCount = 0;
  let parcelFoundCount = 0;
  let ownerFoundCount = 0;

  for (const [state, address] of stateAddresses) {
    const result = await testState(state, address);
    results.push(result);

    if (result.success) {
      successCount++;
      if (result.parcelFound) parcelFoundCount++;
      if (result.ownerFound) ownerFoundCount++;
    }

    // Wait between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 FINAL RESULTS SUMMARY');
  console.log('=' .repeat(60));
  console.log(`🎯 Total States Tested: ${stateAddresses.length}`);
  console.log(`✅ Successful Requests: ${successCount} (${(successCount/stateAddresses.length*100).toFixed(1)}%)`);
  console.log(`📋 Parcel IDs Found: ${parcelFoundCount} (${(parcelFoundCount/stateAddresses.length*100).toFixed(1)}%)`);
  console.log(`👤 Owner Names Found: ${ownerFoundCount} (${(ownerFoundCount/stateAddresses.length*100).toFixed(1)}%)`);

  console.log('\n🏆 TOP PERFORMING STATES:');
  const successful = results.filter(r => r.success && r.parcelFound && r.ownerFound);
  successful.forEach(r => {
    console.log(`  ✅ ${r.state}: ${r.parcelId} | ${r.ownerName}`);
  });

  console.log('\n⚠️  STATES NEEDING ATTENTION:');
  const problematic = results.filter(r => !r.success || !r.parcelFound || !r.ownerFound);
  problematic.forEach(r => {
    console.log(`  ❌ ${r.state}: ${r.error || 'Data not found'}`);
  });

  return results;
}

// Only run if this file is executed directly
if (require.main === module) {
  runFullTest().catch(console.error);
}

module.exports = { testState, runFullTest, stateAddresses };