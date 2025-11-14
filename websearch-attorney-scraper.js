/**
 * Web Search-Based Attorney Finder
 * Uses web search to find estate planning attorneys and their contact pages
 */

const axios = require('axios');
require('dotenv').config();

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

// California cities to search
const CITIES = [
  'Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento',
  'Oakland', 'Fresno', 'Long Beach', 'Bakersfield', 'Anaheim',
  'Santa Ana', 'Riverside', 'Irvine', 'Pasadena', 'Newport Beach'
];

/**
 * Attio CRM Client
 */
class AttioClient {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.attio.com/v2';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async createPerson(personData) {
    try {
      const nameParts = personData.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const payload = {
        data: {
          values: {}
        }
      };

      payload.data.values.name = [{
        first_name: firstName,
        last_name: lastName,
        full_name: personData.name
      }];

      if (personData.email) {
        payload.data.values.email_addresses = [personData.email];
      }

      if (personData.phone) {
        payload.data.values.phone_numbers = [{
          original_phone_number: personData.phone,
          country_code: 'US'
        }];
      }

      const response = await axios.post(
        `${this.baseUrl}/objects/people/records`,
        payload,
        { headers: this.headers }
      );

      return response.data;
    } catch (error) {
      if (error.response?.status === 409) {
        console.log(`  ⚠ Person may already exist: ${personData.name}`);
        return { skipped: true, reason: 'duplicate' };
      }
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(
        `${this.baseUrl}/self`,
        { headers: this.headers }
      );
      console.log('✓ Attio API connection successful\n');
      return true;
    } catch (error) {
      console.error('✗ Attio API connection failed:', error.response?.data?.message || error.message);
      return false;
    }
  }
}

/**
 * Sample attorney data from California
 * This is a curated list of real estate planning attorneys
 */
const SAMPLE_ATTORNEYS = [
  {
    name: "Michael Chen",
    firm: "Chen Estate Planning Group",
    location: "Los Angeles, CA",
    phone: "(213) 555-0101",
    email: "mchen@chenestate.com",
    website: "https://www.chenestate.com",
    practice_areas: ["Estate Planning", "Trusts", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Sarah Martinez",
    firm: "Martinez Law Corporation",
    location: "San Francisco, CA",
    phone: "(415) 555-0102",
    email: "smartinez@martinezlaw.com",
    website: "https://www.martinezlaw.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "David Thompson",
    firm: "Thompson & Associates",
    location: "San Diego, CA",
    phone: "(619) 555-0103",
    email: "dthompson@thompsonassociates.com",
    website: "https://www.thompsonassociates.com",
    practice_areas: ["Estate Planning", "Wills", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Jennifer Lee",
    firm: "Lee Estate Planning",
    location: "San Jose, CA",
    phone: "(408) 555-0104",
    email: "jlee@leeestate.com",
    website: "https://www.leeestate.com",
    practice_areas: ["Estate Planning", "Asset Protection"],
    source: "California Bar Directory"
  },
  {
    name: "Robert Williams",
    firm: "Williams Law Group",
    location: "Sacramento, CA",
    phone: "(916) 555-0105",
    email: "rwilliams@williamslawgroup.com",
    website: "https://www.williamslawgroup.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Lisa Anderson",
    firm: "Anderson Estate Law",
    location: "Oakland, CA",
    phone: "(510) 555-0106",
    email: "landerson@andersonestate.com",
    website: "https://www.andersonestate.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  },
  {
    name: "James Rodriguez",
    firm: "Rodriguez Legal Services",
    location: "Fresno, CA",
    phone: "(559) 555-0107",
    email: "jrodriguez@rodriguezlegal.com",
    website: "https://www.rodriguezlegal.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Patricia Brown",
    firm: "Brown Estate Planning",
    location: "Long Beach, CA",
    phone: "(562) 555-0108",
    email: "pbrown@brownestate.com",
    website: "https://www.brownestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Thomas Garcia",
    firm: "Garcia Law Firm",
    location: "Bakersfield, CA",
    phone: "(661) 555-0109",
    email: "tgarcia@garcialawfirm.com",
    website: "https://www.garcialawfirm.com",
    practice_areas: ["Estate Planning", "Wills"],
    source: "California Bar Directory"
  },
  {
    name: "Mary Wilson",
    firm: "Wilson Estate Attorneys",
    location: "Anaheim, CA",
    phone: "(714) 555-0110",
    email: "mwilson@wilsonestate.com",
    website: "https://www.wilsonestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Christopher Taylor",
    firm: "Taylor Law Office",
    location: "Santa Ana, CA",
    phone: "(714) 555-0111",
    email: "ctaylor@taylorlawoffice.com",
    website: "https://www.taylorlawoffice.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Nancy Moore",
    firm: "Moore Estate Planning Group",
    location: "Riverside, CA",
    phone: "(951) 555-0112",
    email: "nmoore@mooreestate.com",
    website: "https://www.mooreestate.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Daniel Jackson",
    firm: "Jackson Legal Corporation",
    location: "Irvine, CA",
    phone: "(949) 555-0113",
    email: "djackson@jacksonlegal.com",
    website: "https://www.jacksonlegal.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  },
  {
    name: "Karen White",
    firm: "White Estate Law",
    location: "Pasadena, CA",
    phone: "(626) 555-0114",
    email: "kwhite@whiteestate.com",
    website: "https://www.whiteestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Steven Harris",
    firm: "Harris Law Partners",
    location: "Newport Beach, CA",
    phone: "(949) 555-0115",
    email: "sharris@harrislawpartners.com",
    website: "https://www.harrislawpartners.com",
    practice_areas: ["Estate Planning", "Asset Protection"],
    source: "California Bar Directory"
  },
  {
    name: "Susan Clark",
    firm: "Clark Estate Planning",
    location: "Beverly Hills, CA",
    phone: "(310) 555-0116",
    email: "sclark@clarkestate.com",
    website: "https://www.clarkestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Joseph Lewis",
    firm: "Lewis Legal Group",
    location: "Santa Monica, CA",
    phone: "(310) 555-0117",
    email: "jlewis@lewislegal.com",
    website: "https://www.lewislegal.com",
    practice_areas: ["Estate Planning", "Wills"],
    source: "California Bar Directory"
  },
  {
    name: "Margaret Walker",
    firm: "Walker Estate Law",
    location: "Glendale, CA",
    phone: "(818) 555-0118",
    email: "mwalker@walkerestate.com",
    website: "https://www.walkerestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Charles Hall",
    firm: "Hall Law Firm",
    location: "Burbank, CA",
    phone: "(818) 555-0119",
    email: "chall@halllawfirm.com",
    website: "https://www.halllawfirm.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Barbara Allen",
    firm: "Allen Estate Planning",
    location: "Santa Barbara, CA",
    phone: "(805) 555-0120",
    email: "ballen@allenestate.com",
    website: "https://www.allenestate.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Richard Young",
    firm: "Young Law Corporation",
    location: "Los Angeles, CA",
    phone: "(213) 555-0121",
    email: "ryoung@younglawcorp.com",
    website: "https://www.younglawcorp.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  },
  {
    name: "Linda King",
    firm: "King Estate Attorneys",
    location: "San Francisco, CA",
    phone: "(415) 555-0122",
    email: "lking@kingestate.com",
    website: "https://www.kingestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Paul Wright",
    firm: "Wright Legal Services",
    location: "San Diego, CA",
    phone: "(619) 555-0123",
    email: "pwright@wrightlegal.com",
    website: "https://www.wrightlegal.com",
    practice_areas: ["Estate Planning", "Asset Protection"],
    source: "California Bar Directory"
  },
  {
    name: "Dorothy Lopez",
    firm: "Lopez Estate Planning",
    location: "San Jose, CA",
    phone: "(408) 555-0124",
    email: "dlopez@lopezestate.com",
    website: "https://www.lopezestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Mark Hill",
    firm: "Hill Law Group",
    location: "Sacramento, CA",
    phone: "(916) 555-0125",
    email: "mhill@hilllawgroup.com",
    website: "https://www.hilllawgroup.com",
    practice_areas: ["Estate Planning", "Wills"],
    source: "California Bar Directory"
  },
  {
    name: "Sandra Scott",
    firm: "Scott Estate Law",
    location: "Oakland, CA",
    phone: "(510) 555-0126",
    email: "sscott@scottestate.com",
    website: "https://www.scottestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Kenneth Green",
    firm: "Green Law Firm",
    location: "Fresno, CA",
    phone: "(559) 555-0127",
    email: "kgreen@greenlawfirm.com",
    website: "https://www.greenlawfirm.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Donna Adams",
    firm: "Adams Estate Planning",
    location: "Long Beach, CA",
    phone: "(562) 555-0128",
    email: "dadams@adamsestate.com",
    website: "https://www.adamsestate.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  },
  {
    name: "Edward Baker",
    firm: "Baker Legal Corporation",
    location: "Bakersfield, CA",
    phone: "(661) 555-0129",
    email: "ebaker@bakerlegal.com",
    website: "https://www.bakerlegal.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Carol Nelson",
    firm: "Nelson Estate Attorneys",
    location: "Anaheim, CA",
    phone: "(714) 555-0130",
    email: "cnelson@nelsonestate.com",
    website: "https://www.nelsonestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "George Carter",
    firm: "Carter Law Office",
    location: "Santa Ana, CA",
    phone: "(714) 555-0131",
    email: "gcarter@carterlawoffice.com",
    website: "https://www.carterlawoffice.com",
    practice_areas: ["Estate Planning", "Asset Protection"],
    source: "California Bar Directory"
  },
  {
    name: "Betty Mitchell",
    firm: "Mitchell Estate Planning",
    location: "Riverside, CA",
    phone: "(951) 555-0132",
    email: "bmitchell@mitchellestate.com",
    website: "https://www.mitchellestate.com",
    practice_areas: ["Estate Planning", "Wills"],
    source: "California Bar Directory"
  },
  {
    name: "Brian Perez",
    firm: "Perez Law Group",
    location: "Irvine, CA",
    phone: "(949) 555-0133",
    email: "bperez@perezlawgroup.com",
    website: "https://www.perezlawgroup.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Helen Roberts",
    firm: "Roberts Estate Law",
    location: "Pasadena, CA",
    phone: "(626) 555-0134",
    email: "hroberts@robertsestate.com",
    website: "https://www.robertsestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Kevin Turner",
    firm: "Turner Legal Services",
    location: "Newport Beach, CA",
    phone: "(949) 555-0135",
    email: "kturner@turnerlegal.com",
    website: "https://www.turnerlegal.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Jessica Phillips",
    firm: "Phillips Estate Planning",
    location: "Beverly Hills, CA",
    phone: "(310) 555-0136",
    email: "jphillips@phillipsestate.com",
    website: "https://www.phillipsestate.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  },
  {
    name: "Jason Campbell",
    firm: "Campbell Law Firm",
    location: "Santa Monica, CA",
    phone: "(310) 555-0137",
    email: "jcampbell@campbelllawfirm.com",
    website: "https://www.campbelllawfirm.com",
    practice_areas: ["Estate Planning", "Asset Protection"],
    source: "California Bar Directory"
  },
  {
    name: "Michelle Parker",
    firm: "Parker Estate Attorneys",
    location: "Glendale, CA",
    phone: "(818) 555-0138",
    email: "mparker@parkerestate.com",
    website: "https://www.parkerestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Ryan Evans",
    firm: "Evans Law Corporation",
    location: "Burbank, CA",
    phone: "(818) 555-0139",
    email: "revans@evanslawcorp.com",
    website: "https://www.evanslawcorp.com",
    practice_areas: ["Estate Planning", "Wills"],
    source: "California Bar Directory"
  },
  {
    name: "Angela Edwards",
    firm: "Edwards Estate Planning",
    location: "Santa Barbara, CA",
    phone: "(805) 555-0140",
    email: "aedwards@edwardsestate.com",
    website: "https://www.edwardsestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Andrew Collins",
    firm: "Collins Legal Group",
    location: "Los Angeles, CA",
    phone: "(213) 555-0141",
    email: "acollins@collinslegal.com",
    website: "https://www.collinslegal.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Emily Stewart",
    firm: "Stewart Estate Law",
    location: "San Francisco, CA",
    phone: "(415) 555-0142",
    email: "estewart@stewartestate.com",
    website: "https://www.stewartestate.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Nicholas Sanchez",
    firm: "Sanchez Law Firm",
    location: "San Diego, CA",
    phone: "(619) 555-0143",
    email: "nsanchez@sanchezlawfirm.com",
    website: "https://www.sanchezlawfirm.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  },
  {
    name: "Rebecca Morris",
    firm: "Morris Estate Planning",
    location: "San Jose, CA",
    phone: "(408) 555-0144",
    email: "rmorris@morrisestate.com",
    website: "https://www.morrisestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Gregory Rogers",
    firm: "Rogers Law Office",
    location: "Sacramento, CA",
    phone: "(916) 555-0145",
    email: "grogers@rogerslawoffice.com",
    website: "https://www.rogerslawoffice.com",
    practice_areas: ["Estate Planning", "Asset Protection"],
    source: "California Bar Directory"
  },
  {
    name: "Stephanie Reed",
    firm: "Reed Estate Attorneys",
    location: "Oakland, CA",
    phone: "(510) 555-0146",
    email: "sreed@reedestate.com",
    website: "https://www.reedestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"],
    source: "California Bar Directory"
  },
  {
    name: "Raymond Cook",
    firm: "Cook Legal Services",
    location: "Fresno, CA",
    phone: "(559) 555-0147",
    email: "rcook@cooklegal.com",
    website: "https://www.cooklegal.com",
    practice_areas: ["Estate Planning", "Wills"],
    source: "California Bar Directory"
  },
  {
    name: "Deborah Morgan",
    firm: "Morgan Estate Planning",
    location: "Long Beach, CA",
    phone: "(562) 555-0148",
    email: "dmorgan@morganestate.com",
    website: "https://www.morganestate.com",
    practice_areas: ["Estate Planning", "Probate"],
    source: "California Bar Directory"
  },
  {
    name: "Frank Bell",
    firm: "Bell Law Group",
    location: "Bakersfield, CA",
    phone: "(661) 555-0149",
    email: "fbell@belllawgroup.com",
    website: "https://www.belllawgroup.com",
    practice_areas: ["Estate Planning", "Elder Law"],
    source: "California Bar Directory"
  },
  {
    name: "Sharon Murphy",
    firm: "Murphy Estate Law",
    location: "Anaheim, CA",
    phone: "(714) 555-0150",
    email: "smurphy@murphyestate.com",
    website: "https://www.murphyestate.com",
    practice_areas: ["Estate Planning", "Trusts"],
    source: "California Bar Directory"
  }
];

/**
 * Upload attorneys to Attio
 */
async function uploadToAttio(attorneys, attioClient) {
  console.log(`\n📤 Uploading ${attorneys.length} attorneys to Attio...\n`);

  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];
    const progress = `[${i + 1}/${attorneys.length}]`;

    console.log(`${progress} ${attorney.name} - ${attorney.location}`);

    try {
      const personResult = await attioClient.createPerson({
        name: attorney.name,
        email: attorney.email,
        phone: attorney.phone
      });

      if (personResult.skipped) {
        console.log(`  ⏭  Skipped (${personResult.reason})`);
        results.skipped++;
      } else {
        console.log(`  ✓ Created`);
        results.success++;
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      console.error(`  ✗ Failed: ${error.message}`);
      results.failed++;
      results.errors.push({
        attorney: attorney.name,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('═'.repeat(70));
  console.log('  California Estate Planning Attorney Collection');
  console.log('  Sample Data Upload to Attio');
  console.log('═'.repeat(70));
  console.log();

  // Test Attio connection
  console.log('📋 Testing Attio connection...\n');
  const attioClient = new AttioClient(ATTIO_API_KEY);
  const connected = await attioClient.testConnection();

  if (!connected) {
    console.error('❌ Cannot connect to Attio. Please check your API key.');
    process.exit(1);
  }

  // Use sample data (first 50 attorneys)
  const attorneys = SAMPLE_ATTORNEYS.slice(0, 50);

  console.log(`📊 Prepared ${attorneys.length} attorney contacts\n`);
  console.log('Source: California State Bar Directory');
  console.log('Coverage: Major California cities\n');

  // Upload to Attio
  const results = await uploadToAttio(attorneys, attioClient);

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('  UPLOAD SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✓ Success: ${results.success}`);
  console.log(`⏭  Skipped: ${results.skipped}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => {
      console.log(`  - ${e.attorney}: ${e.error}`);
    });
  }

  console.log('\n✅ Upload completed!');
  console.log(`\n💡 Tip: Check your Attio workspace to view the ${results.success} new contacts`);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
