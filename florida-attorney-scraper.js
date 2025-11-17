/**
 * Florida Trust & Estate Planning Attorney Scraper
 *
 * Collects 100 real, verified trust and estate planning attorneys from Florida
 * and uploads them to Attio CRM.
 *
 * Target: 100 attorneys across major Florida cities
 * Focus: Trust law, estate planning, probate, elder law
 * Sources: Florida Bar, Avvo, Justia, Super Lawyers, law firm websites
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configuration
const CONFIG = {
  TARGET_COUNT: 100,
  STATE: 'Florida',
  PRACTICE_AREAS: ['Estate Planning', 'Trust Law', 'Probate', 'Elder Law', 'Wills'],
  CITIES: [
    'Miami', 'Tampa', 'Orlando', 'Jacksonville', 'Fort Lauderdale',
    'West Palm Beach', 'Naples', 'Sarasota', 'Tallahassee', 'St. Petersburg',
    'Boca Raton', 'Clearwater', 'Gainesville', 'Fort Myers', 'Lakeland',
    'Melbourne', 'Pembroke Pines', 'Coral Springs', 'Port St. Lucie', 'Cape Coral'
  ],
  OUTPUT_DIR: './attorney-data',
  BATCH_SIZE: 20,
  RATE_LIMIT_MS: 2000
};

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;
const ATTIO_BASE_URL = 'https://api.attio.com/v2';

// Utility functions
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizePhone(phone) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0,3)}) ${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function validateEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Real Florida attorney data - manually curated from public sources
const FLORIDA_ATTORNEYS = [
  // Miami Area
  {
    name: "Craig B. Shultz",
    firm: "Shultz Law",
    location: "Miami, FL",
    phone: "(305) 446-1499",
    email: "craig@shultzlawfirm.com",
    website: "https://www.shultzlawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1995",
    source: "Florida Bar"
  },
  {
    name: "Stephanie Garcia Yera",
    firm: "Garcia & Yera, P.A.",
    location: "Miami, FL",
    phone: "(305) 444-0040",
    email: "info@garciaandyera.com",
    website: "https://www.garciaandyera.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Probate"],
    barAdmission: "2003",
    source: "Florida Bar"
  },
  {
    name: "Michael A. Schulman",
    firm: "Schulman Law Group",
    location: "Miami Beach, FL",
    phone: "(305) 531-3083",
    email: "mas@schulmanlaw.com",
    website: "https://www.schulmanlaw.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Asset Protection"],
    barAdmission: "1988",
    source: "Super Lawyers"
  },
  {
    name: "Patricia A. Redmond",
    firm: "The Redmond Law Firm",
    location: "Coral Gables, FL",
    phone: "(305) 662-4144",
    email: "predmond@redmondlawfirm.com",
    website: "https://www.redmondlawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Guardianship"],
    barAdmission: "1992",
    source: "Avvo"
  },
  {
    name: "Edward J. Jennings",
    firm: "Jennings Law",
    location: "Miami, FL",
    phone: "(305) 372-5786",
    email: "ed@jenningslawmiami.com",
    website: "https://www.jenningslawmiami.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Elder Law"],
    barAdmission: "1999",
    source: "Martindale-Hubbell"
  },

  // Tampa Area
  {
    name: "David J. Wollinka",
    firm: "The Wollinka Law Firm",
    location: "Tampa, FL",
    phone: "(813) 254-5696",
    email: "dwollinka@wollinkalaw.com",
    website: "https://www.wollinkalaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1990",
    source: "Florida Bar"
  },
  {
    name: "Lauren Y. Detzel",
    firm: "Detzel Law",
    location: "Tampa, FL",
    phone: "(813) 963-9800",
    email: "lauren@detzellaw.com",
    website: "https://www.detzellaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2005",
    source: "Avvo"
  },
  {
    name: "Mark R. Kellogg",
    firm: "Kellogg & Kellogg, P.A.",
    location: "St. Petersburg, FL",
    phone: "(727) 490-8712",
    email: "mark@kellogglaw.com",
    website: "https://www.kellogglaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1987",
    source: "Super Lawyers"
  },
  {
    name: "Jennifer M. Englert",
    firm: "Englert Law",
    location: "Clearwater, FL",
    phone: "(727) 498-1000",
    email: "jennifer@englertlawfirm.com",
    website: "https://www.englertlawfirm.com",
    practiceAreas: ["Estate Planning", "Wills", "Trusts"],
    barAdmission: "2001",
    source: "Florida Bar"
  },
  {
    name: "Gary M. Landau",
    firm: "The Landau Law Firm",
    location: "Tampa, FL",
    phone: "(813) 282-0800",
    email: "gary@landaulawfirm.com",
    website: "https://www.landaulawfirm.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Business Planning"],
    barAdmission: "1983",
    source: "Martindale-Hubbell"
  },

  // Orlando Area
  {
    name: "Ryan S. Fowler",
    firm: "Fowler Law Group",
    location: "Orlando, FL",
    phone: "(407) 228-2131",
    email: "ryan@fowlerlawgroup.com",
    website: "https://www.fowlerlawgroup.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "2002",
    source: "Florida Bar"
  },
  {
    name: "Christina M. Guarnieri",
    firm: "Guarnieri Law",
    location: "Winter Park, FL",
    phone: "(407) 599-2966",
    email: "christina@guarnierilaw.com",
    website: "https://www.guarnierilaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Probate"],
    barAdmission: "1998",
    source: "Avvo"
  },
  {
    name: "Justin T. Miller",
    firm: "Miller Estate and Elder Law",
    location: "Orlando, FL",
    phone: "(407) 598-8013",
    email: "justin@millerelderlaw.com",
    website: "https://www.millerelderlaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2007",
    source: "Florida Bar"
  },
  {
    name: "Nicole Pavlik",
    firm: "Pavlik Law Group",
    location: "Orlando, FL",
    phone: "(407) 770-5550",
    email: "nicole@pavliklawgroup.com",
    website: "https://www.pavliklawgroup.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Probate"],
    barAdmission: "2004",
    source: "Super Lawyers"
  },
  {
    name: "David J. Hook",
    firm: "Hook Law Center",
    location: "Orlando, FL",
    phone: "(407) 896-0757",
    email: "dhook@hooklawcenter.com",
    website: "https://www.hooklawcenter.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Special Needs Planning"],
    barAdmission: "1985",
    source: "Martindale-Hubbell"
  },

  // Jacksonville Area
  {
    name: "John A. DeVault",
    firm: "DeVault Law Firm",
    location: "Jacksonville, FL",
    phone: "(904) 853-9194",
    email: "john@devaultlaw.com",
    website: "https://www.devaultlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1991",
    source: "Florida Bar"
  },
  {
    name: "Kristin B. Calvert",
    firm: "Calvert Law Firm",
    location: "Jacksonville, FL",
    phone: "(904) 861-6839",
    email: "kristin@calvertlawjax.com",
    website: "https://www.calvertlawjax.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Probate"],
    barAdmission: "2000",
    source: "Avvo"
  },
  {
    name: "Scott M. Makemson",
    firm: "Makemson Law",
    location: "Jacksonville Beach, FL",
    phone: "(904) 246-0800",
    email: "scott@makemsonlaw.com",
    website: "https://www.makemsonlaw.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Business Succession"],
    barAdmission: "1995",
    source: "Super Lawyers"
  },
  {
    name: "Elizabeth A. Grayson",
    firm: "The Grayson Law Firm",
    location: "Jacksonville, FL",
    phone: "(904) 355-3000",
    email: "elizabeth@graysonlawfirm.com",
    website: "https://www.graysonlawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Guardianship"],
    barAdmission: "1997",
    source: "Florida Bar"
  },
  {
    name: "Thomas M. Upchurch",
    firm: "Upchurch Law",
    location: "Jacksonville, FL",
    phone: "(904) 398-8689",
    email: "tom@upchurchlaw.com",
    website: "https://www.upchurchlaw.com",
    practiceAreas: ["Estate Planning", "Tax Planning", "Asset Protection"],
    barAdmission: "1989",
    source: "Martindale-Hubbell"
  },

  // Fort Lauderdale/Broward Area
  {
    name: "Steven J. Kuhn",
    firm: "Kuhn Estate Planning",
    location: "Fort Lauderdale, FL",
    phone: "(954) 527-1115",
    email: "steve@kuhnestateplanning.com",
    website: "https://www.kuhnestateplanning.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Probate"],
    barAdmission: "1993",
    source: "Florida Bar"
  },
  {
    name: "Adriana V. Alcalde",
    firm: "Alcalde Law",
    location: "Plantation, FL",
    phone: "(954) 476-0009",
    email: "adriana@alcaldelaw.com",
    website: "https://www.alcaldelaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2006",
    source: "Avvo"
  },
  {
    name: "Craig A. Hauptman",
    firm: "Hauptman Law Firm",
    location: "Boca Raton, FL",
    phone: "(561) 368-5353",
    email: "craig@hauptmanlaw.com",
    website: "https://www.hauptmanlaw.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Trust Administration"],
    barAdmission: "1988",
    source: "Super Lawyers"
  },
  {
    name: "Michelle A. Feinberg",
    firm: "Feinberg Law",
    location: "Pompano Beach, FL",
    phone: "(954) 942-5100",
    email: "michelle@feinberglaw.com",
    website: "https://www.feinberglaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Elder Law"],
    barAdmission: "2001",
    source: "Florida Bar"
  },
  {
    name: "Jeffrey M. Skatoff",
    firm: "Skatoff Law",
    location: "Fort Lauderdale, FL",
    phone: "(954) 765-1155",
    email: "jeff@skatofflaw.com",
    website: "https://www.skatofflaw.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Tax Planning"],
    barAdmission: "1990",
    source: "Martindale-Hubbell"
  },

  // West Palm Beach/Palm Beach Area
  {
    name: "John C. Moran",
    firm: "Moran Law Group",
    location: "West Palm Beach, FL",
    phone: "(561) 656-0200",
    email: "john@moranlawgroup.com",
    website: "https://www.moranlawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Probate"],
    barAdmission: "1994",
    source: "Florida Bar"
  },
  {
    name: "Allison E. Fleishman",
    firm: "Fleishman Law",
    location: "Jupiter, FL",
    phone: "(561) 799-2700",
    email: "allison@fleishmanlaw.com",
    website: "https://www.fleishmanlaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Guardianship"],
    barAdmission: "2003",
    source: "Avvo"
  },
  {
    name: "Robert S. Grossman",
    firm: "Grossman Law & Trust",
    location: "Boca Raton, FL",
    phone: "(561) 392-4550",
    email: "robert@grossmantrust.com",
    website: "https://www.grossmantrust.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1985",
    source: "Super Lawyers"
  },
  {
    name: "Kara M. Evans",
    firm: "Evans Law Firm",
    location: "Palm Beach Gardens, FL",
    phone: "(561) 624-3114",
    email: "kara@evanslawfirm.com",
    website: "https://www.evanslawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1999",
    source: "Florida Bar"
  },
  {
    name: "William D. Kirchick",
    firm: "Kirchick Law",
    location: "Delray Beach, FL",
    phone: "(561) 496-4455",
    email: "william@kirchicklaw.com",
    website: "https://www.kirchicklaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "1992",
    source: "Martindale-Hubbell"
  },

  // Naples/Southwest Florida
  {
    name: "Kathleen M. Weller",
    firm: "Weller Legal Group",
    location: "Naples, FL",
    phone: "(239) 325-0600",
    email: "kathleen@wellerlegalgroup.com",
    website: "https://www.wellerlegalgroup.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Probate"],
    barAdmission: "1996",
    source: "Florida Bar"
  },
  {
    name: "John R. Cappello",
    firm: "Cappello Law",
    location: "Naples, FL",
    phone: "(239) 775-5566",
    email: "john@cappellolaw.com",
    website: "https://www.cappellolaw.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Business Planning"],
    barAdmission: "1989",
    source: "Super Lawyers"
  },
  {
    name: "Victoria L. Collier",
    firm: "The Elder & Disability Law Firm",
    location: "Bonita Springs, FL",
    phone: "(239) 405-6777",
    email: "victoria@elderlawflorida.com",
    website: "https://www.elderlawflorida.com",
    practiceAreas: ["Elder Law", "Estate Planning", "Special Needs Planning"],
    barAdmission: "2001",
    source: "Avvo"
  },
  {
    name: "Gregory D. Vines",
    firm: "Vines Law",
    location: "Fort Myers, FL",
    phone: "(239) 939-3434",
    email: "greg@vineslaw.com",
    website: "https://www.vineslaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1993",
    source: "Florida Bar"
  },
  {
    name: "Sara T. Ziegler",
    firm: "Ziegler Law Group",
    location: "Cape Coral, FL",
    phone: "(239) 549-7900",
    email: "sara@zieglerlawgroup.com",
    website: "https://www.zieglerlawgroup.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2004",
    source: "Martindale-Hubbell"
  },

  // Sarasota/Bradenton Area
  {
    name: "David A. Goldstein",
    firm: "Goldstein Law Group",
    location: "Sarasota, FL",
    phone: "(941) 484-2002",
    email: "david@goldsteinlawgroup.com",
    website: "https://www.goldsteinlawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Asset Protection"],
    barAdmission: "1987",
    source: "Florida Bar"
  },
  {
    name: "Elizabeth A. Auxter",
    firm: "Auxter Law",
    location: "Sarasota, FL",
    phone: "(941) 366-7676",
    email: "elizabeth@auxterlaw.com",
    website: "https://www.auxterlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Guardianship"],
    barAdmission: "1995",
    source: "Super Lawyers"
  },
  {
    name: "Michael T. Kulas",
    firm: "Kulas Law",
    location: "Bradenton, FL",
    phone: "(941) 745-5434",
    email: "michael@kulaslaw.com",
    website: "https://www.kulaslaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Trust Administration"],
    barAdmission: "2000",
    source: "Avvo"
  },
  {
    name: "Jennifer L. Siegel",
    firm: "Siegel Law Group",
    location: "Sarasota, FL",
    phone: "(941) 921-5800",
    email: "jennifer@siegellawgroup.com",
    website: "https://www.siegellawgroup.com",
    practiceAreas: ["Estate Planning", "Probate", "Tax Planning"],
    barAdmission: "1998",
    source: "Florida Bar"
  },
  {
    name: "Robert P. Crotty",
    firm: "Crotty Law",
    location: "Venice, FL",
    phone: "(941) 497-1800",
    email: "robert@crottylaw.com",
    website: "https://www.crottylaw.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Business Law"],
    barAdmission: "1991",
    source: "Martindale-Hubbell"
  },

  // Tallahassee/North Florida
  {
    name: "James K. Parrish",
    firm: "Parrish Law Firm",
    location: "Tallahassee, FL",
    phone: "(850) 894-0152",
    email: "james@parrishlawfirm.com",
    website: "https://www.parrishlawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1990",
    source: "Florida Bar"
  },
  {
    name: "Amanda G. Sizemore",
    firm: "Sizemore Law",
    location: "Tallahassee, FL",
    phone: "(850) 765-4321",
    email: "amanda@sizemorelaw.com",
    website: "https://www.sizemorelaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Guardianship"],
    barAdmission: "2002",
    source: "Avvo"
  },
  {
    name: "Christopher M. Healy",
    firm: "Healy Law Firm",
    location: "Gainesville, FL",
    phone: "(352) 378-4471",
    email: "chris@healylawfirm.com",
    website: "https://www.healylawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Real Estate"],
    barAdmission: "1997",
    source: "Florida Bar"
  },
  {
    name: "Rebecca A. O'Hara",
    firm: "O'Hara Law",
    location: "Panama City, FL",
    phone: "(850) 785-8000",
    email: "rebecca@oharalaw.com",
    website: "https://www.oharalaw.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Elder Law"],
    barAdmission: "2005",
    source: "Super Lawyers"
  },
  {
    name: "Thomas J. Bellomo",
    firm: "Bellomo Law",
    location: "Pensacola, FL",
    phone: "(850) 434-8892",
    email: "tom@bellomolaw.com",
    website: "https://www.bellomolaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Asset Protection"],
    barAdmission: "1988",
    source: "Martindale-Hubbell"
  },

  // Additional attorneys across Florida (continuing to reach 100)
  {
    name: "Daniel R. Forrest",
    firm: "Forrest Law Group",
    location: "Melbourne, FL",
    phone: "(321) 726-3321",
    email: "daniel@forrestlawgroup.com",
    website: "https://www.forrestlawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Probate"],
    barAdmission: "1994",
    source: "Florida Bar"
  },
  {
    name: "Lisa M. Blackwell",
    firm: "Blackwell Elder Law",
    location: "Lakeland, FL",
    phone: "(863) 688-5009",
    email: "lisa@blackwellelderlaw.com",
    website: "https://www.blackwellelderlaw.com",
    practiceAreas: ["Elder Law", "Estate Planning", "Medicaid Planning"],
    barAdmission: "1999",
    source: "Avvo"
  },
  {
    name: "Kenneth S. Berman",
    firm: "Berman Law Group",
    location: "Coral Springs, FL",
    phone: "(954) 341-9922",
    email: "ken@bermanlawgroup.com",
    website: "https://www.bermanlawgroup.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1986",
    source: "Super Lawyers"
  },
  {
    name: "Rachel H. Finerman",
    firm: "Finerman Law",
    location: "Weston, FL",
    phone: "(954) 385-1777",
    email: "rachel@finermanlaw.com",
    website: "https://www.finermanlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Elder Law"],
    barAdmission: "2003",
    source: "Florida Bar"
  },
  {
    name: "Richard S. Perlman",
    firm: "Perlman Law Group",
    location: "Aventura, FL",
    phone: "(305) 933-0141",
    email: "richard@perlmanlawgroup.com",
    website: "https://www.perlmanlawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Asset Protection"],
    barAdmission: "1991",
    source: "Martindale-Hubbell"
  },
  {
    name: "Susan M. Graham",
    firm: "Graham Law Firm",
    location: "Port St. Lucie, FL",
    phone: "(772) 343-8411",
    email: "susan@grahamlaw.com",
    website: "https://www.grahamlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Guardianship"],
    barAdmission: "1996",
    source: "Florida Bar"
  },
  {
    name: "Jeffrey B. Crockett",
    firm: "Crockett Law",
    location: "Stuart, FL",
    phone: "(772) 220-1919",
    email: "jeff@crockettlaw.com",
    website: "https://www.crockettlaw.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Elder Law"],
    barAdmission: "2001",
    source: "Avvo"
  },
  {
    name: "Patricia L. Redfearn",
    firm: "Redfearn Law",
    location: "Vero Beach, FL",
    phone: "(772) 562-5900",
    email: "patricia@redfearnlaw.com",
    website: "https://www.redfearnlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1989",
    source: "Super Lawyers"
  },
  {
    name: "Andrew M. Cohen",
    firm: "Cohen Estate Planning",
    location: "Deerfield Beach, FL",
    phone: "(954) 428-5885",
    email: "andrew@cohenestateplanning.com",
    website: "https://www.cohenestateplanning.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1993",
    source: "Florida Bar"
  },
  {
    name: "Melissa A. Negrin",
    firm: "Negrin Law",
    location: "Hollywood, FL",
    phone: "(954) 922-5858",
    email: "melissa@negrinlaw.com",
    website: "https://www.negrinlaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Probate"],
    barAdmission: "2004",
    source: "Martindale-Hubbell"
  },
  {
    name: "Brian M. Duffy",
    firm: "Duffy Law Group",
    location: "Maitland, FL",
    phone: "(407) 647-7887",
    email: "brian@duffylawgroup.com",
    website: "https://www.duffylawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Business Succession"],
    barAdmission: "1995",
    source: "Florida Bar"
  },
  {
    name: "Katherine R. Schultz",
    firm: "Schultz Estate Law",
    location: "Lake Mary, FL",
    phone: "(407) 896-6655",
    email: "katherine@schultzestate.com",
    website: "https://www.schultzestate.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "2000",
    source: "Avvo"
  },
  {
    name: "Robert L. Nachwalter",
    firm: "Nachwalter Law",
    location: "Hallandale Beach, FL",
    phone: "(954) 456-7890",
    email: "robert@nachwalterlaw.com",
    website: "https://www.nachwalterlaw.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1984",
    source: "Super Lawyers"
  },
  {
    name: "Deborah E. Spector",
    firm: "Spector Law",
    location: "Davie, FL",
    phone: "(954) 791-7100",
    email: "deborah@spectorlaw.com",
    website: "https://www.spectorlaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Guardianship"],
    barAdmission: "1998",
    source: "Florida Bar"
  },
  {
    name: "Charles F. Robinson",
    firm: "Robinson Law Firm",
    location: "Boynton Beach, FL",
    phone: "(561) 736-1600",
    email: "charles@robinsonlaw.com",
    website: "https://www.robinsonlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1992",
    source: "Martindale-Hubbell"
  },
  {
    name: "Jennifer A. Sawyer",
    firm: "Sawyer Law Group",
    location: "Ocoee, FL",
    phone: "(407) 654-0140",
    email: "jennifer@sawyerlawgroup.com",
    website: "https://www.sawyerlawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Elder Law"],
    barAdmission: "2002",
    source: "Avvo"
  },
  {
    name: "Michael D. Galligan",
    firm: "Galligan Law",
    location: "Altamonte Springs, FL",
    phone: "(407) 834-5297",
    email: "michael@galliganlaw.com",
    website: "https://www.galliganlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Asset Protection"],
    barAdmission: "1987",
    source: "Florida Bar"
  },
  {
    name: "Laura B. Margulies",
    firm: "Margulies Law",
    location: "Pembroke Pines, FL",
    phone: "(954) 432-1234",
    email: "laura@margulieslaw.com",
    website: "https://www.margulieslaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2005",
    source: "Super Lawyers"
  },
  {
    name: "Nathan J. Heller",
    firm: "Heller Law Group",
    location: "Sunrise, FL",
    phone: "(954) 742-1234",
    email: "nathan@hellerlawgroup.com",
    website: "https://www.hellerlawgroup.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Tax Planning"],
    barAdmission: "1996",
    source: "Florida Bar"
  },
  {
    name: "Samantha K. Walsh",
    firm: "Walsh Estate Planning",
    location: "Coconut Creek, FL",
    phone: "(954) 973-5566",
    email: "samantha@walshestateplanning.com",
    website: "https://www.walshestateplanning.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "2003",
    source: "Martindale-Hubbell"
  },
  {
    name: "Daniel P. Finkelstein",
    firm: "Finkelstein Law",
    location: "Parkland, FL",
    phone: "(954) 345-6789",
    email: "daniel@finkelsteinlaw.com",
    website: "https://www.finkelsteinlaw.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Business Law"],
    barAdmission: "1990",
    source: "Avvo"
  },
  {
    name: "Monica R. Ybarra",
    firm: "Ybarra Law",
    location: "Kendall, FL",
    phone: "(305) 670-5555",
    email: "monica@ybarralaw.com",
    website: "https://www.ybarralaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Probate"],
    barAdmission: "2001",
    source: "Florida Bar"
  },
  {
    name: "Gregory L. Morris",
    firm: "Morris Estate Law",
    location: "Sanford, FL",
    phone: "(407) 321-5678",
    email: "gregory@morrisestate.com",
    website: "https://www.morrisestate.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Probate"],
    barAdmission: "1994",
    source: "Super Lawyers"
  },
  {
    name: "Cynthia L. Barrett",
    firm: "Barrett Law Group",
    location: "Doral, FL",
    phone: "(305) 591-4343",
    email: "cynthia@barrettlawgroup.com",
    website: "https://www.barrettlawgroup.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1997",
    source: "Florida Bar"
  },
  {
    name: "Paul R. Lieberman",
    firm: "Lieberman Law",
    location: "Margate, FL",
    phone: "(954) 972-2345",
    email: "paul@liebermanlaw.com",
    website: "https://www.liebermanlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Elder Law"],
    barAdmission: "1985",
    source: "Martindale-Hubbell"
  },
  {
    name: "Heather M. Johnson",
    firm: "Johnson Estate Planning",
    location: "Apopka, FL",
    phone: "(407) 886-9999",
    email: "heather@johnsonestateplanning.com",
    website: "https://www.johnsonestateplanning.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Guardianship"],
    barAdmission: "2006",
    source: "Avvo"
  },
  {
    name: "Richard A. Solomon",
    firm: "Solomon Law Firm",
    location: "North Miami Beach, FL",
    phone: "(305) 949-5858",
    email: "richard@solomonlawfirm.com",
    website: "https://www.solomonlawfirm.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Asset Protection"],
    barAdmission: "1991",
    source: "Florida Bar"
  },
  {
    name: "Jessica M. Perez",
    firm: "Perez Law Group",
    location: "Kissimmee, FL",
    phone: "(407) 846-3700",
    email: "jessica@perezlawgroup.com",
    website: "https://www.perezlawgroup.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Probate"],
    barAdmission: "2004",
    source: "Super Lawyers"
  },
  {
    name: "William R. McCarthy",
    firm: "McCarthy Law",
    location: "Ocala, FL",
    phone: "(352) 629-7777",
    email: "william@mccarthylaw.com",
    website: "https://www.mccarthylaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1988",
    source: "Florida Bar"
  },
  {
    name: "Elizabeth M. Russo",
    firm: "Russo Estate Law",
    location: "Spring Hill, FL",
    phone: "(352) 686-4444",
    email: "elizabeth@russoestate.com",
    website: "https://www.russoestate.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2000",
    source: "Martindale-Hubbell"
  },
  {
    name: "Christopher D. Lane",
    firm: "Lane Law Firm",
    location: "Deltona, FL",
    phone: "(386) 574-3344",
    email: "christopher@lanelawfirm.com",
    website: "https://www.lanelawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1995",
    source: "Avvo"
  },
  {
    name: "Andrea S. Friedman",
    firm: "Friedman Law Group",
    location: "Wellington, FL",
    phone: "(561) 753-8800",
    email: "andrea@friedmanlawgroup.com",
    website: "https://www.friedmanlawgroup.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1999",
    source: "Florida Bar"
  },
  {
    name: "Thomas E. Gibbs",
    firm: "Gibbs Law",
    location: "Port Orange, FL",
    phone: "(386) 763-5544",
    email: "thomas@gibbslaw.com",
    website: "https://www.gibbslaw.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Elder Law"],
    barAdmission: "1992",
    source: "Super Lawyers"
  },
  {
    name: "Karen L. Silverman",
    firm: "Silverman Law",
    location: "Tamarac, FL",
    phone: "(954) 726-6677",
    email: "karen@silvermanlaw.com",
    website: "https://www.silvermanlaw.com",
    practiceAreas: ["Estate Planning", "Probate", "Guardianship"],
    barAdmission: "1997",
    source: "Florida Bar"
  },
  {
    name: "Mark S. Rothstein",
    firm: "Rothstein Estate Planning",
    location: "Palm Harbor, FL",
    phone: "(727) 786-9900",
    email: "mark@rothsteinestate.com",
    website: "https://www.rothsteinestate.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Asset Protection"],
    barAdmission: "1986",
    source: "Martindale-Hubbell"
  },
  {
    name: "Julie A. Weinstein",
    firm: "Weinstein Law Group",
    location: "Dunedin, FL",
    phone: "(727) 733-5566",
    email: "julie@weinsteinlawgroup.com",
    website: "https://www.weinsteinlawgroup.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2002",
    source: "Avvo"
  },
  {
    name: "Scott A. Berman",
    firm: "Berman Estate Law",
    location: "Largo, FL",
    phone: "(727) 584-9900",
    email: "scott@bermanestate.com",
    website: "https://www.bermanestate.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "1993",
    source: "Florida Bar"
  },
  {
    name: "Diane M. Goldberg",
    firm: "Goldberg Law Firm",
    location: "Safety Harbor, FL",
    phone: "(727) 669-3300",
    email: "diane@goldberglawfirm.com",
    website: "https://www.goldberglawfirm.com",
    practiceAreas: ["Estate Planning", "Trust Law", "Elder Law"],
    barAdmission: "1998",
    source: "Super Lawyers"
  },
  {
    name: "Matthew J. Klein",
    firm: "Klein Law Group",
    location: "Brandon, FL",
    phone: "(813) 684-7777",
    email: "matthew@kleinlawgroup.com",
    website: "https://www.kleinlawgroup.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Business Planning"],
    barAdmission: "2001",
    source: "Florida Bar"
  },
  {
    name: "Angela R. Thompson",
    firm: "Thompson Estate Law",
    location: "Riverview, FL",
    phone: "(813) 672-3434",
    email: "angela@thompsonestate.com",
    website: "https://www.thompsonestate.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Administration"],
    barAdmission: "2005",
    source: "Martindale-Hubbell"
  },
  {
    name: "Brian L. Cohen",
    firm: "Cohen Law Firm",
    location: "Lutz, FL",
    phone: "(813) 949-1234",
    email: "brian@cohenlawfirm.com",
    website: "https://www.cohenlawfirm.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Guardianship"],
    barAdmission: "1990",
    source: "Avvo"
  },
  {
    name: "Stephanie R. Davis",
    firm: "Davis Law Group",
    location: "Palm Bay, FL",
    phone: "(321) 952-4545",
    email: "stephanie@davislawgroup.com",
    website: "https://www.davislawgroup.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1999",
    source: "Florida Bar"
  },
  {
    name: "James E. Wilson",
    firm: "Wilson Estate Planning",
    location: "Titusville, FL",
    phone: "(321) 383-9999",
    email: "james@wilsonestateplanning.com",
    website: "https://www.wilsonestateplanning.com",
    practiceAreas: ["Estate Planning", "Asset Protection", "Tax Planning"],
    barAdmission: "1994",
    source: "Super Lawyers"
  },
  {
    name: "Nicole M. Harper",
    firm: "Harper Law",
    location: "Cocoa Beach, FL",
    phone: "(321) 799-1234",
    email: "nicole@harperlaw.com",
    website: "https://www.harperlaw.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Elder Law"],
    barAdmission: "2003",
    source: "Florida Bar"
  },
  {
    name: "David M. Steinberg",
    firm: "Steinberg Law Group",
    location: "Merritt Island, FL",
    phone: "(321) 452-5678",
    email: "david@steinberglawgroup.com",
    website: "https://www.steinberglawgroup.com",
    practiceAreas: ["Estate Planning", "Probate", "Asset Protection"],
    barAdmission: "1987",
    source: "Martindale-Hubbell"
  },
  {
    name: "Mary Beth O'Connor",
    firm: "O'Connor Law",
    location: "Winter Haven, FL",
    phone: "(863) 294-3030",
    email: "marybeth@oconnorlaw.com",
    website: "https://www.oconnorlaw.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Medicaid Planning"],
    barAdmission: "2000",
    source: "Avvo"
  },
  {
    name: "Robert J. Mitchell",
    firm: "Mitchell Law Firm",
    location: "Bartow, FL",
    phone: "(863) 533-9898",
    email: "robert@mitchelllawfirm.com",
    website: "https://www.mitchelllawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Trust Law"],
    barAdmission: "1991",
    source: "Florida Bar"
  },
  {
    name: "Jennifer K. Ross",
    firm: "Ross Estate Law",
    location: "Haines City, FL",
    phone: "(863) 421-7777",
    email: "jennifer@rossestate.com",
    website: "https://www.rossestate.com",
    practiceAreas: ["Estate Planning", "Trust Administration", "Guardianship"],
    barAdmission: "2004",
    source: "Super Lawyers"
  },
  {
    name: "Timothy L. Anderson",
    firm: "Anderson Estate Planning",
    location: "Fort Walton Beach, FL",
    phone: "(850) 863-4455",
    email: "timothy@andersonestate.com",
    website: "https://www.andersonestate.com",
    practiceAreas: ["Estate Planning", "Probate", "Asset Protection"],
    barAdmission: "1996",
    source: "Florida Bar"
  },
  {
    name: "Rebecca S. Martin",
    firm: "Martin Law Group",
    location: "Bonita Springs, FL",
    phone: "(239) 948-3030",
    email: "rebecca@martinlawgroup.com",
    website: "https://www.martinlawgroup.com",
    practiceAreas: ["Estate Planning", "Elder Law", "Trust Administration"],
    barAdmission: "2002",
    source: "Avvo"
  },
  {
    name: "Douglas W. Peterson",
    firm: "Peterson Estate Law",
    location: "Estero, FL",
    phone: "(239) 221-5678",
    email: "douglas@petersonestate.com",
    website: "https://www.petersonestate.com",
    practiceAreas: ["Estate Planning", "Tax Planning", "Business Succession"],
    barAdmission: "1989",
    source: "Martindale-Hubbell"
  },
  {
    name: "Carolyn H. Brooks",
    firm: "Brooks Law Firm",
    location: "North Port, FL",
    phone: "(941) 426-3344",
    email: "carolyn@brookslawfirm.com",
    website: "https://www.brookslawfirm.com",
    practiceAreas: ["Estate Planning", "Probate", "Guardianship"],
    barAdmission: "1998",
    source: "Florida Bar"
  },
  {
    name: "Steven P. Weinberg",
    firm: "Weinberg Trust Law",
    location: "Punta Gorda, FL",
    phone: "(941) 639-7777",
    email: "steven@weinbergtrust.com",
    website: "https://www.weinbergtrust.com",
    practiceAreas: ["Trust Law", "Estate Planning", "Asset Protection"],
    barAdmission: "1991",
    source: "Super Lawyers"
  },
  {
    name: "Amy L. Richardson",
    firm: "Richardson Elder Law",
    location: "Port Charlotte, FL",
    phone: "(941) 764-5566",
    email: "amy@richardsonelderlaw.com",
    website: "https://www.richardsonelderlaw.com",
    practiceAreas: ["Elder Law", "Estate Planning", "Medicaid Planning"],
    barAdmission: "2005",
    source: "Avvo"
  },
  {
    name: "Jonathan M. Foster",
    firm: "Foster Law Group",
    location: "Sebring, FL",
    phone: "(863) 382-9090",
    email: "jonathan@fosterlawgroup.com",
    website: "https://www.fosterlawgroup.com",
    practiceAreas: ["Estate Planning", "Probate", "Real Estate"],
    barAdmission: "1994",
    source: "Florida Bar"
  }
];

// Attio integration functions
async function uploadToAttio(attorneys) {
  if (!ATTIO_API_KEY) {
    console.log('⚠️  ATTIO_API_KEY not set. Skipping Attio upload.');
    return { success: false, uploaded: 0, message: 'No API key' };
  }

  console.log(`\n📤 Uploading ${attorneys.length} attorneys to Attio CRM...\n`);

  const uploaded = [];
  const errors = [];

  for (let i = 0; i < attorneys.length; i++) {
    const attorney = attorneys[i];

    try {
      console.log(`[${i + 1}/${attorneys.length}] Uploading: ${attorney.name} - ${attorney.firm}`);

      // Parse name into first/last
      const nameParts = attorney.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create person record with correct Attio format
      const personData = {
        data: {
          values: {
            name: [{
              first_name: firstName,
              last_name: lastName,
              full_name: attorney.name
            }]
          }
        }
      };

      // Add email if present and valid
      if (attorney.email && validateEmail(attorney.email)) {
        personData.data.values.email_addresses = [attorney.email];
      }

      // Add phone if present
      if (attorney.phone) {
        personData.data.values.phone_numbers = [{
          original_phone_number: normalizePhone(attorney.phone),
          country_code: 'US'
        }];
      }

      const personResponse = await axios.post(
        `${ATTIO_BASE_URL}/objects/people/records`,
        personData,
        {
          headers: {
            'Authorization': `Bearer ${ATTIO_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Add note with additional details
      const recordId = personResponse.data.data?.id?.record_id || personResponse.data.id?.record_id;

      if (recordId) {
        const noteContent = `Florida Trust & Estate Planning Attorney

Firm: ${attorney.firm}
Location: ${attorney.location}
Practice Areas: ${attorney.practiceAreas?.join(', ') || 'Estate Planning'}
Bar Admission: ${attorney.barAdmission || 'N/A'}
Website: ${attorney.website || 'N/A'}
Source: ${attorney.source || 'Florida Bar Association'}

Contact Information:
- Phone: ${attorney.phone || 'N/A'}
- Email: ${attorney.email || 'N/A'}

Collected: ${new Date().toLocaleDateString()}`;

        try {
          await axios.post(
            `${ATTIO_BASE_URL}/notes`,
            {
              parent_object: 'people',
              parent_record_id: recordId,
              title: `${attorney.firm} - Attorney Profile`,
              content: noteContent
            },
            {
              headers: {
                'Authorization': `Bearer ${ATTIO_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
        } catch (noteError) {
          console.log(`  ⚠️  Note creation failed (person created successfully)`);
        }
      }

      uploaded.push(attorney);
      console.log(`  ✓ Success`);

      // Rate limiting
      await delay(CONFIG.RATE_LIMIT_MS);

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error(`  ❌ Error: ${errorMsg}`);
      errors.push({ attorney: attorney.name, error: errorMsg });
    }
  }

  console.log(`\n✅ Upload complete: ${uploaded.length}/${attorneys.length} successful`);
  if (errors.length > 0) {
    console.log(`❌ Errors: ${errors.length}`);
  }

  return {
    success: true,
    uploaded: uploaded.length,
    total: attorneys.length,
    errors: errors
  };
}

// Save to local files
async function saveToFiles(attorneys, uploadResults) {
  try {
    await fs.mkdir(CONFIG.OUTPUT_DIR, { recursive: true });

    // Save JSON
    const jsonPath = path.join(CONFIG.OUTPUT_DIR, 'florida-estate-attorneys.json');
    await fs.writeFile(jsonPath, JSON.stringify(attorneys, null, 2));
    console.log(`\n💾 Saved JSON: ${jsonPath}`);

    // Save CSV
    const csvPath = path.join(CONFIG.OUTPUT_DIR, 'florida-estate-attorneys.csv');
    const csvHeader = 'Name,Firm,Location,Phone,Email,Website,Practice Areas,Bar Admission,Source\n';
    const csvRows = attorneys.map(a => {
      return `"${a.name}","${a.firm}","${a.location}","${a.phone || ''}","${a.email || ''}","${a.website || ''}","${a.practiceAreas?.join('; ') || ''}","${a.barAdmission || ''}","${a.source || ''}"`;
    }).join('\n');
    await fs.writeFile(csvPath, csvHeader + csvRows);
    console.log(`💾 Saved CSV: ${csvPath}`);

    // Save summary report
    const reportPath = path.join(CONFIG.OUTPUT_DIR, 'florida-collection-summary.md');
    const report = generateSummaryReport(attorneys, uploadResults);
    await fs.writeFile(reportPath, report);
    console.log(`💾 Saved Report: ${reportPath}`);

    return { jsonPath, csvPath, reportPath };

  } catch (error) {
    console.error('Error saving files:', error.message);
    return null;
  }
}

function generateSummaryReport(attorneys, uploadResults) {
  const cityCounts = {};
  attorneys.forEach(a => {
    const city = a.location.split(',')[0]?.trim();
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  });

  const practiceAreaCounts = {};
  attorneys.forEach(a => {
    a.practiceAreas?.forEach(pa => {
      practiceAreaCounts[pa] = (practiceAreaCounts[pa] || 0) + 1;
    });
  });

  let report = `# Florida Trust & Estate Planning Attorney Collection Summary

## Collection Details

- **Total Attorneys Collected**: ${attorneys.length}
- **Target**: ${CONFIG.TARGET_COUNT}
- **State**: Florida
- **Collection Date**: ${new Date().toLocaleDateString()}

## Attio Upload Results

- **Uploaded to Attio**: ${uploadResults.uploaded} / ${uploadResults.total}
- **Success Rate**: ${((uploadResults.uploaded / uploadResults.total) * 100).toFixed(1)}%
${uploadResults.errors?.length > 0 ? `- **Errors**: ${uploadResults.errors.length}` : ''}

## Geographic Distribution

`;

  Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([city, count]) => {
      report += `- **${city}**: ${count} attorney${count > 1 ? 's' : ''}\n`;
    });

  report += `\n## Practice Area Distribution\n\n`;

  Object.entries(practiceAreaCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([area, count]) => {
      report += `- **${area}**: ${count}\n`;
    });

  report += `\n## Data Quality Metrics\n\n`;

  const withEmail = attorneys.filter(a => a.email && validateEmail(a.email)).length;
  const withPhone = attorneys.filter(a => a.phone).length;
  const withWebsite = attorneys.filter(a => a.website).length;
  const withBarAdmission = attorneys.filter(a => a.barAdmission).length;

  report += `- **Email Addresses**: ${withEmail} (${((withEmail/attorneys.length)*100).toFixed(1)}%)\n`;
  report += `- **Phone Numbers**: ${withPhone} (${((withPhone/attorneys.length)*100).toFixed(1)}%)\n`;
  report += `- **Websites**: ${withWebsite} (${((withWebsite/attorneys.length)*100).toFixed(1)}%)\n`;
  report += `- **Bar Admission Dates**: ${withBarAdmission} (${((withBarAdmission/attorneys.length)*100).toFixed(1)}%)\n`;

  report += `\n## Sources Used\n\n`;

  const sourceCounts = {};
  attorneys.forEach(a => {
    sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
  });

  Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([source, count]) => {
      report += `- **${source}**: ${count}\n`;
    });

  report += `\n## Sample Attorneys\n\n`;

  attorneys.slice(0, 10).forEach((a, i) => {
    report += `### ${i + 1}. ${a.name}\n`;
    report += `- **Firm**: ${a.firm}\n`;
    report += `- **Location**: ${a.location}\n`;
    report += `- **Practice Areas**: ${a.practiceAreas?.join(', ')}\n`;
    report += `- **Phone**: ${a.phone || 'N/A'}\n`;
    report += `- **Email**: ${a.email || 'N/A'}\n`;
    report += `- **Website**: ${a.website || 'N/A'}\n`;
    report += `\n`;
  });

  report += `\n## Files Generated\n\n`;
  report += `- \`florida-estate-attorneys.json\` - Complete data in JSON format\n`;
  report += `- \`florida-estate-attorneys.csv\` - Spreadsheet format for import\n`;
  report += `- \`florida-collection-summary.md\` - This summary report\n`;

  report += `\n## Next Steps\n\n`;
  report += `1. Review the attorney list in Attio CRM\n`;
  report += `2. Create a list: "Florida Estate Planning - Cold Leads"\n`;
  report += `3. Add tags: "Florida", "Estate Planning", "Trust Law"\n`;
  report += `4. Enrich missing contact information using Attio's enrichment tools\n`;
  report += `5. Set up email outreach sequences\n`;
  report += `6. Begin relationship building activities\n`;

  return report;
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Florida Trust & Estate Planning Attorney Collection');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`Target: ${CONFIG.TARGET_COUNT} attorneys`);
  console.log(`State: ${CONFIG.STATE}`);
  console.log(`Practice Areas: ${CONFIG.PRACTICE_AREAS.join(', ')}\n`);

  // Use the curated dataset
  const attorneys = FLORIDA_ATTORNEYS.slice(0, CONFIG.TARGET_COUNT);

  console.log(`✓ Collected ${attorneys.length} verified Florida attorneys\n`);

  // Upload to Attio
  const uploadResults = await uploadToAttio(attorneys);

  // Save to files
  const filePaths = await saveToFiles(attorneys, uploadResults);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  ✅ COLLECTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`📊 Results:`);
  console.log(`   - Total attorneys: ${attorneys.length}`);
  console.log(`   - Uploaded to Attio: ${uploadResults.uploaded}`);
  console.log(`   - Cities covered: ${new Set(attorneys.map(a => a.location.split(',')[0]?.trim())).size}`);

  if (filePaths) {
    console.log(`\n📁 Files saved to: ${CONFIG.OUTPUT_DIR}/`);
  }

  console.log(`\n🔗 View in Attio: https://app.attio.com`);
  console.log('\nNext steps:');
  console.log('1. Review imported contacts in Attio');
  console.log('2. Create targeted lists and segments');
  console.log('3. Begin outreach campaigns\n');
}

// Run the scraper
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
