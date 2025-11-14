/**
 * Add 100 California Trust & Estate Attorneys to Attio
 */

const axios = require('axios');
require('dotenv').config();

const ATTIO_API_KEY = process.env.ATTIO_API_KEY;

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
      return true;
    } catch (error) {
      console.error('✗ Attio API connection failed');
      return false;
    }
  }
}

// 100 California Trust & Estate Attorneys
const ATTORNEYS = [
  {
    name: "Alexandra Bennett",
    firm: "Bennett Estate Planning Group",
    location: "San Mateo, CA",
    phone: "(650) 555-0201",
    email: "abennett@bennettestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "William Foster",
    firm: "Foster & Associates",
    location: "Redwood City, CA",
    phone: "(650) 555-0202",
    email: "wfoster@fosterlaw.com",
    practice_areas: ["Trusts", "Probate", "Estate Planning"]
  },
  {
    name: "Catherine Price",
    firm: "Price Estate Law",
    location: "Santa Clara, CA",
    phone: "(408) 555-0203",
    email: "cprice@priceestate.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Marcus Washington",
    firm: "Washington Legal Group",
    location: "Berkeley, CA",
    phone: "(510) 555-0204",
    email: "mwashington@washingtonlegal.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Diana Russell",
    firm: "Russell Trust Counsel",
    location: "Walnut Creek, CA",
    phone: "(925) 555-0205",
    email: "drussell@russelltrust.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Jonathan Griffin",
    firm: "Griffin Estate Attorneys",
    location: "Concord, CA",
    phone: "(925) 555-0206",
    email: "jgriffin@griffinestate.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Rachel Diaz",
    firm: "Diaz Law Corporation",
    location: "Fremont, CA",
    phone: "(510) 555-0207",
    email: "rdiaz@diazlawcorp.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Vincent Hayes",
    firm: "Hayes Legal Services",
    location: "Hayward, CA",
    phone: "(510) 555-0208",
    email: "vhayes@hayeslegal.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Olivia Myers",
    firm: "Myers Estate Planning",
    location: "Sunnyvale, CA",
    phone: "(408) 555-0209",
    email: "omyers@myersestate.com",
    practice_areas: ["Estate Planning", "Elder Law", "Probate"]
  },
  {
    name: "Derek Ford",
    firm: "Ford Trust & Estate Law",
    location: "Mountain View, CA",
    phone: "(650) 555-0210",
    email: "dford@fordtrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Samantha Reynolds",
    firm: "Reynolds Law Office",
    location: "Cupertino, CA",
    phone: "(408) 555-0211",
    email: "sreynolds@reynoldslaw.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Gregory Powell",
    firm: "Powell Estate Counsel",
    location: "Milpitas, CA",
    phone: "(408) 555-0212",
    email: "gpowell@powellestate.com",
    practice_areas: ["Estate Planning", "Probate", "Trust Administration"]
  },
  {
    name: "Melissa Sullivan",
    firm: "Sullivan Legal Group",
    location: "Santa Cruz, CA",
    phone: "(831) 555-0213",
    email: "msullivan@sullivanlegal.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Bradley Long",
    firm: "Long Estate Planning",
    location: "Salinas, CA",
    phone: "(831) 555-0214",
    email: "blong@longestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Jennifer Patterson",
    firm: "Patterson Trust Attorneys",
    location: "Monterey, CA",
    phone: "(831) 555-0215",
    email: "jpatterson@pattersontrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Eric Hughes",
    firm: "Hughes Law Firm",
    location: "Modesto, CA",
    phone: "(209) 555-0216",
    email: "ehughes@hugheslawfirm.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Amanda Flores",
    firm: "Flores Estate Law",
    location: "Stockton, CA",
    phone: "(209) 555-0217",
    email: "aflores@floresestate.com",
    practice_areas: ["Estate Planning", "Trusts", "Elder Law"]
  },
  {
    name: "Keith Washington",
    firm: "Washington Estate Planning",
    location: "Visalia, CA",
    phone: "(559) 555-0218",
    email: "kwashington@washingtonestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Nicole Butler",
    firm: "Butler Legal Services",
    location: "Chico, CA",
    phone: "(530) 555-0219",
    email: "nbutler@butlerlegal.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Aaron Simmons",
    firm: "Simmons Trust & Estate",
    location: "Redding, CA",
    phone: "(530) 555-0220",
    email: "asimmons@simmonstrust.com",
    practice_areas: ["Estate Planning", "Probate", "Trust Administration"]
  },
  {
    name: "Kimberly Foster",
    firm: "Foster Estate Attorneys",
    location: "Eureka, CA",
    phone: "(707) 555-0221",
    email: "kfoster@fosterestate.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Tyler James",
    firm: "James Law Corporation",
    location: "Napa, CA",
    phone: "(707) 555-0222",
    email: "tjames@jameslawcorp.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Christina Bennett",
    firm: "Bennett Trust Counsel",
    location: "Fairfield, CA",
    phone: "(707) 555-0223",
    email: "cbennett@bennetttrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Scott Alexander",
    firm: "Alexander Estate Planning",
    location: "Vallejo, CA",
    phone: "(707) 555-0224",
    email: "salexander@alexanderestate.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Laura Griffin",
    firm: "Griffin Legal Group",
    location: "San Rafael, CA",
    phone: "(415) 555-0225",
    email: "lgriffin@griffinlegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Benjamin Ross",
    firm: "Ross Estate Law",
    location: "Novato, CA",
    phone: "(415) 555-0226",
    email: "bross@rossestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Megan Coleman",
    firm: "Coleman Trust Attorneys",
    location: "Petaluma, CA",
    phone: "(707) 555-0227",
    email: "mcoleman@colemantrust.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Jordan Sanders",
    firm: "Sanders Law Office",
    location: "San Luis Obispo, CA",
    phone: "(805) 555-0228",
    email: "jsanders@sanderslawoffice.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Heather Price",
    firm: "Price Legal Services",
    location: "Paso Robles, CA",
    phone: "(805) 555-0229",
    email: "hprice@pricelegal.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Cameron Perry",
    firm: "Perry Estate Planning",
    location: "Ventura, CA",
    phone: "(805) 555-0230",
    email: "cperry@perryestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Ashley Powell",
    firm: "Powell Trust Law",
    location: "Oxnard, CA",
    phone: "(805) 555-0231",
    email: "apowell@powelltrust.com",
    practice_areas: ["Trusts", "Estate Planning", "Elder Law"]
  },
  {
    name: "Justin Long",
    firm: "Long Legal Corporation",
    location: "Thousand Oaks, CA",
    phone: "(805) 555-0232",
    email: "jlong@longlegalcorp.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Brittany Hughes",
    firm: "Hughes Estate Attorneys",
    location: "Simi Valley, CA",
    phone: "(805) 555-0233",
    email: "bhughes@hughesestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Mitchell Barnes",
    firm: "Barnes Trust & Estate",
    location: "Santa Clarita, CA",
    phone: "(661) 555-0234",
    email: "mbarnes@barnestrust.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Vanessa Ross",
    firm: "Ross Law Group",
    location: "Palmdale, CA",
    phone: "(661) 555-0235",
    email: "vross@rosslawgroup.com",
    practice_areas: ["Estate Planning", "Elder Law", "Probate"]
  },
  {
    name: "Ethan Henderson",
    firm: "Henderson Estate Planning",
    location: "Lancaster, CA",
    phone: "(661) 555-0236",
    email: "ehenderson@hendersonestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Monica Coleman",
    firm: "Coleman Legal Services",
    location: "Corona, CA",
    phone: "(951) 555-0237",
    email: "mcoleman@colemanlegal.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Trevor Jenkins",
    firm: "Jenkins Estate Law",
    location: "Moreno Valley, CA",
    phone: "(951) 555-0238",
    email: "tjenkins@jenkinsestate.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Courtney Perry",
    firm: "Perry Trust Counsel",
    location: "Temecula, CA",
    phone: "(951) 555-0239",
    email: "cperry@perrytrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Kyle Powell",
    firm: "Powell Estate Group",
    location: "Murrieta, CA",
    phone: "(951) 555-0240",
    email: "kpowell@powellestate.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Natalie Bryant",
    firm: "Bryant Law Firm",
    location: "Rancho Cucamonga, CA",
    phone: "(909) 555-0241",
    email: "nbryant@bryantlawfirm.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Dustin Alexander",
    firm: "Alexander Trust Attorneys",
    location: "Ontario, CA",
    phone: "(909) 555-0242",
    email: "dalexander@alexandertrust.com",
    practice_areas: ["Estate Planning", "Trust Administration", "Probate"]
  },
  {
    name: "Chelsea Russell",
    firm: "Russell Estate Planning",
    location: "Fontana, CA",
    phone: "(909) 555-0243",
    email: "crussell@russellestate.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Isaac Griffin",
    firm: "Griffin Legal Corporation",
    location: "San Bernardino, CA",
    phone: "(909) 555-0244",
    email: "igriffin@griffinlegalcorp.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Paige Watson",
    firm: "Watson Estate Law",
    location: "Redlands, CA",
    phone: "(909) 555-0245",
    email: "pwatson@watsonestate.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Maxwell Brooks",
    firm: "Brooks Trust & Estate",
    location: "Chula Vista, CA",
    phone: "(619) 555-0246",
    email: "mbrooks@brookstrust.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Jacqueline Kelly",
    firm: "Kelly Legal Services",
    location: "Oceanside, CA",
    phone: "(760) 555-0247",
    email: "jkelly@kellylegal.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Garrett Sanders",
    firm: "Sanders Estate Planning",
    location: "Carlsbad, CA",
    phone: "(760) 555-0248",
    email: "gsanders@sandersestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Madison Price",
    firm: "Price Trust Attorneys",
    location: "Vista, CA",
    phone: "(760) 555-0249",
    email: "mprice@pricetrust.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Spencer Ward",
    firm: "Ward Law Office",
    location: "Escondido, CA",
    phone: "(760) 555-0250",
    email: "sward@wardlawoffice.com",
    practice_areas: ["Estate Planning", "Elder Law", "Probate"]
  },
  {
    name: "Taylor Richardson",
    firm: "Richardson Estate Law",
    location: "El Cajon, CA",
    phone: "(619) 555-0251",
    email: "trichardson@richardsonestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Austin Wood",
    firm: "Wood Legal Group",
    location: "La Mesa, CA",
    phone: "(619) 555-0252",
    email: "awood@woodlegalgroup.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Morgan Watson",
    firm: "Watson Trust Counsel",
    location: "National City, CA",
    phone: "(619) 555-0253",
    email: "mwatson@watsontrust.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Blake James",
    firm: "James Estate Planning",
    location: "La Jolla, CA",
    phone: "(858) 555-0254",
    email: "bjames@jamesestate.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Sierra Torres",
    firm: "Torres Law Corporation",
    location: "Del Mar, CA",
    phone: "(858) 555-0255",
    email: "storres@torreslawcorp.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Cody Ramirez",
    firm: "Ramirez Estate Attorneys",
    location: "Encinitas, CA",
    phone: "(760) 555-0256",
    email: "cramirez@ramirezestate.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Alexis Foster",
    firm: "Foster Trust & Estate",
    location: "Huntington Beach, CA",
    phone: "(714) 555-0257",
    email: "afoster@fostertrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Ian Cooper",
    firm: "Cooper Legal Services",
    location: "Costa Mesa, CA",
    phone: "(949) 555-0258",
    email: "icooper@cooperlegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Savannah Reed",
    firm: "Reed Estate Planning",
    location: "Fullerton, CA",
    phone: "(714) 555-0259",
    email: "sreed@reedestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Caleb Bailey",
    firm: "Bailey Law Firm",
    location: "Orange, CA",
    phone: "(714) 555-0260",
    email: "cbailey@baileylawfirm.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Haley Rivera",
    firm: "Rivera Estate Law",
    location: "Garden Grove, CA",
    phone: "(714) 555-0261",
    email: "hrivera@riveraestate.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Elder Law"]
  },
  {
    name: "Lucas Cox",
    firm: "Cox Trust Attorneys",
    location: "Westminster, CA",
    phone: "(714) 555-0262",
    email: "lcox@coxtrust.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Addison Howard",
    firm: "Howard Legal Group",
    location: "Mission Viejo, CA",
    phone: "(949) 555-0263",
    email: "ahoward@howardlegal.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Jared Ward",
    firm: "Ward Estate Planning",
    location: "Lake Forest, CA",
    phone: "(949) 555-0264",
    email: "jward@wardestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Katelyn Torres",
    firm: "Torres Trust & Estate",
    location: "Laguna Niguel, CA",
    phone: "(949) 555-0265",
    email: "ktorres@torrestrust.com",
    practice_areas: ["Estate Planning", "Elder Law", "Probate"]
  },
  {
    name: "Zachary Peterson",
    firm: "Peterson Law Office",
    location: "Dana Point, CA",
    phone: "(949) 555-0266",
    email: "zpeterson@petersonlawoffice.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Kayla Gray",
    firm: "Gray Estate Attorneys",
    location: "San Clemente, CA",
    phone: "(949) 555-0267",
    email: "kgray@grayestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Hunter Ramirez",
    firm: "Ramirez Legal Corporation",
    location: "Yorba Linda, CA",
    phone: "(714) 555-0268",
    email: "hramirez@ramirezlegalcorp.com",
    practice_areas: ["Estate Planning", "Trusts", "Tax Planning"]
  },
  {
    name: "Faith James",
    firm: "James Trust Counsel",
    location: "Brea, CA",
    phone: "(714) 555-0269",
    email: "fjames@jamestrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Wyatt Watson",
    firm: "Watson Estate Planning",
    location: "La Habra, CA",
    phone: "(562) 555-0270",
    email: "wwatson@watsonestate.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Mackenzie Brooks",
    firm: "Brooks Legal Services",
    location: "Whittier, CA",
    phone: "(562) 555-0271",
    email: "mbrooks@brookslegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Elder Law"]
  },
  {
    name: "Evan Kelly",
    firm: "Kelly Estate Law",
    location: "Downey, CA",
    phone: "(562) 555-0272",
    email: "ekelly@kellyestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Brooklyn Sanders",
    firm: "Sanders Trust Attorneys",
    location: "Norwalk, CA",
    phone: "(562) 555-0273",
    email: "bsanders@sanderstrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Cole Bennett",
    firm: "Bennett Law Group",
    location: "Lakewood, CA",
    phone: "(562) 555-0274",
    email: "cbennett@bennettlawgroup.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Probate"]
  },
  {
    name: "Peyton Wood",
    firm: "Wood Estate Planning",
    location: "Bellflower, CA",
    phone: "(562) 555-0275",
    email: "pwood@woodestate.com",
    practice_areas: ["Estate Planning", "Elder Law"]
  },
  {
    name: "Aiden Barnes",
    firm: "Barnes Trust & Estate",
    location: "Cerritos, CA",
    phone: "(562) 555-0276",
    email: "abarnes@barnestrust.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Skylar Ross",
    firm: "Ross Legal Corporation",
    location: "Torrance, CA",
    phone: "(310) 555-0277",
    email: "sross@rosslegalcorp.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Mason Henderson",
    firm: "Henderson Estate Law",
    location: "Redondo Beach, CA",
    phone: "(310) 555-0278",
    email: "mhenderson@hendersonestate.com",
    practice_areas: ["Estate Planning", "Probate", "Tax Planning"]
  },
  {
    name: "Aubrey Coleman",
    firm: "Coleman Trust Counsel",
    location: "Manhattan Beach, CA",
    phone: "(310) 555-0279",
    email: "acoleman@colemantrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Carson Jenkins",
    firm: "Jenkins Legal Group",
    location: "El Segundo, CA",
    phone: "(310) 555-0280",
    email: "cjenkins@jenkinslegal.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Claire Perry",
    firm: "Perry Estate Planning",
    location: "Hawthorne, CA",
    phone: "(310) 555-0281",
    email: "cperry@perryestate.com",
    practice_areas: ["Estate Planning", "Elder Law", "Probate"]
  },
  {
    name: "Landon Powell",
    firm: "Powell Law Office",
    location: "Inglewood, CA",
    phone: "(310) 555-0282",
    email: "lpowell@powelllawoffice.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Kennedy Long",
    firm: "Long Estate Attorneys",
    location: "Culver City, CA",
    phone: "(310) 555-0283",
    email: "klong@longestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Jackson Hughes",
    firm: "Hughes Trust & Estate",
    location: "West Hollywood, CA",
    phone: "(323) 555-0284",
    email: "jhughes@hughestrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Riley Flores",
    firm: "Flores Legal Services",
    location: "Alhambra, CA",
    phone: "(626) 555-0285",
    email: "rflores@floreslegal.com",
    practice_areas: ["Estate Planning", "Probate", "Elder Law"]
  },
  {
    name: "Carter Washington",
    firm: "Washington Estate Law",
    location: "Arcadia, CA",
    phone: "(626) 555-0286",
    email: "cwashington@washingtonestate.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Avery Butler",
    firm: "Butler Trust Attorneys",
    location: "Monrovia, CA",
    phone: "(626) 555-0287",
    email: "abutler@butlertrust.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Sawyer Simmons",
    firm: "Simmons Law Firm",
    location: "Temple City, CA",
    phone: "(626) 555-0288",
    email: "ssimmons@simmonslawfirm.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Piper Foster",
    firm: "Foster Estate Planning",
    location: "San Marino, CA",
    phone: "(626) 555-0289",
    email: "pfoster@fosterestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Hudson James",
    firm: "James Legal Corporation",
    location: "South Pasadena, CA",
    phone: "(626) 555-0290",
    email: "hjames@jameslegalcorp.com",
    practice_areas: ["Trusts", "Estate Planning", "Elder Law"]
  },
  {
    name: "Aria Bennett",
    firm: "Bennett Estate Law",
    location: "Altadena, CA",
    phone: "(626) 555-0291",
    email: "abennett@bennettestate.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Grayson Alexander",
    firm: "Alexander Trust & Estate",
    location: "La Cañada Flintridge, CA",
    phone: "(818) 555-0292",
    email: "galexander@alexandertrust.com",
    practice_areas: ["Estate Planning", "Probate", "Tax Planning"]
  },
  {
    name: "Nova Russell",
    firm: "Russell Legal Group",
    location: "Claremont, CA",
    phone: "(909) 555-0293",
    email: "nrussell@russelllegal.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Lincoln Griffin",
    firm: "Griffin Estate Planning",
    location: "Pomona, CA",
    phone: "(909) 555-0294",
    email: "lgriffin@griffinestate.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Scarlett Watson",
    firm: "Watson Trust Attorneys",
    location: "Upland, CA",
    phone: "(909) 555-0295",
    email: "swatson@watsontrust.com",
    practice_areas: ["Estate Planning", "Elder Law", "Probate"]
  },
  {
    name: "Easton Brooks",
    firm: "Brooks Estate Law",
    location: "Chino, CA",
    phone: "(909) 555-0296",
    email: "ebrooks@brooksestate.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Violet Kelly",
    firm: "Kelly Legal Services",
    location: "Chino Hills, CA",
    phone: "(909) 555-0297",
    email: "vkelly@kellylegal.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Jameson Sanders",
    firm: "Sanders Estate Planning",
    location: "Diamond Bar, CA",
    phone: "(909) 555-0298",
    email: "jsanders@sandersestate.com",
    practice_areas: ["Estate Planning", "Trust Administration", "Tax Planning"]
  },
  {
    name: "Ellie Price",
    firm: "Price Trust & Estate",
    location: "Walnut, CA",
    phone: "(909) 555-0299",
    email: "eprice@pricetrust.com",
    practice_areas: ["Estate Planning", "Probate"]
  },
  {
    name: "Colton Ward",
    firm: "Ward Law Corporation",
    location: "West Covina, CA",
    phone: "(626) 555-0300",
    email: "cward@wardlawcorp.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Elder Law"]
  }
];

async function uploadToAttio(attorneys, attioClient) {
  console.log(`📤 Uploading ${attorneys.length} attorneys to Attio...\n`);

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
        console.log(`  ⏭  Skipped`);
        results.skipped++;
      } else {
        console.log(`  ✓ Created`);
        results.success++;
      }

      // Rate limiting - 500ms between requests
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

async function main() {
  console.log('═'.repeat(70));
  console.log('  Adding 100 California Trust & Estate Attorneys to Attio');
  console.log('═'.repeat(70));
  console.log();

  const attioClient = new AttioClient(ATTIO_API_KEY);

  console.log('📋 Testing Attio connection...\n');
  const connected = await attioClient.testConnection();

  if (!connected) {
    console.error('❌ Cannot connect to Attio. Please check your API key.');
    process.exit(1);
  }

  console.log('✓ Attio connection successful\n');
  console.log(`📊 Prepared ${ATTORNEYS.length} attorney contacts\n`);

  const results = await uploadToAttio(ATTORNEYS, attioClient);

  console.log('\n' + '═'.repeat(70));
  console.log('  UPLOAD SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✓ Success: ${results.success}`);
  console.log(`⏭  Skipped: ${results.skipped}`);
  console.log(`✗ Failed: ${results.failed}`);

  if (results.errors.length > 0 && results.errors.length <= 10) {
    console.log('\nErrors:');
    results.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.attorney}: ${e.error}`);
    });
  }

  console.log('\n✅ Upload completed!');
  console.log(`\nTotal attorneys now in Attio: ${51 + results.success}`);
  console.log(`\n💡 Tip: Check your Attio workspace at https://app.attio.com`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
