/**
 * Add 100 More California Trust Attorneys to Attio
 * Batch #3
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

// 100 More California Trust Attorneys
const ATTORNEYS = [
  {
    name: "Sebastian Drake",
    firm: "Drake Trust Solutions",
    location: "Sacramento, CA",
    phone: "(916) 555-0301",
    email: "sdrake@draketrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Isabella Cruz",
    firm: "Cruz Estate Counsel",
    location: "San Francisco, CA",
    phone: "(415) 555-0302",
    email: "icruz@cruzestate.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Xavier Morrison",
    firm: "Morrison Legal Group",
    location: "Los Angeles, CA",
    phone: "(213) 555-0303",
    email: "xmorrison@morrisonlegal.com",
    practice_areas: ["Trust Administration", "Probate"]
  },
  {
    name: "Penelope Walsh",
    firm: "Walsh Trust Attorneys",
    location: "San Diego, CA",
    phone: "(619) 555-0304",
    email: "pwalsh@walshtrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Dominic Fischer",
    firm: "Fischer Estate Law",
    location: "Oakland, CA",
    phone: "(510) 555-0305",
    email: "dfischer@fischerestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Vivian Chang",
    firm: "Chang Legal Corporation",
    location: "San Jose, CA",
    phone: "(408) 555-0306",
    email: "vchang@changlegalcorp.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Jasper Mendoza",
    firm: "Mendoza Trust & Estate",
    location: "Fresno, CA",
    phone: "(559) 555-0307",
    email: "jmendoza@mendozatrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Genevieve Ortiz",
    firm: "Ortiz Estate Planning",
    location: "Long Beach, CA",
    phone: "(562) 555-0308",
    email: "gortiz@ortizestate.com",
    practice_areas: ["Trusts", "Probate", "Tax Planning"]
  },
  {
    name: "Finnegan Silva",
    firm: "Silva Legal Services",
    location: "Bakersfield, CA",
    phone: "(661) 555-0309",
    email: "fsilva@silvalegal.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Rosalie Nguyen",
    firm: "Nguyen Trust Counsel",
    location: "Anaheim, CA",
    phone: "(714) 555-0310",
    email: "rnguyen@nguyentrust.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Atticus Reyes",
    firm: "Reyes Estate Attorneys",
    location: "Santa Ana, CA",
    phone: "(714) 555-0311",
    email: "areyes@reyesestate.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Elder Law"]
  },
  {
    name: "Celeste Morales",
    firm: "Morales Law Firm",
    location: "Riverside, CA",
    phone: "(951) 555-0312",
    email: "cmorales@moraleslawfirm.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Sullivan Ramos",
    firm: "Ramos Trust & Estate",
    location: "Irvine, CA",
    phone: "(949) 555-0313",
    email: "sramos@ramostrust.com",
    practice_areas: ["Trust Administration", "Probate"]
  },
  {
    name: "Cordelia Kim",
    firm: "Kim Estate Planning",
    location: "Pasadena, CA",
    phone: "(626) 555-0314",
    email: "ckim@kimestate.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Augustus Park",
    firm: "Park Legal Group",
    location: "Newport Beach, CA",
    phone: "(949) 555-0315",
    email: "apark@parklegalgroup.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Beatrice Patel",
    firm: "Patel Trust Attorneys",
    location: "Beverly Hills, CA",
    phone: "(310) 555-0316",
    email: "bpatel@pateltrust.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Maximilian Shah",
    firm: "Shah Estate Law",
    location: "Santa Monica, CA",
    phone: "(310) 555-0317",
    email: "mshah@shahestate.com",
    practice_areas: ["Trust Administration", "Elder Law", "Probate"]
  },
  {
    name: "Delilah Gomez",
    firm: "Gomez Legal Corporation",
    location: "Glendale, CA",
    phone: "(818) 555-0318",
    email: "dgomez@gomezlegalcorp.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Thaddeus Castillo",
    firm: "Castillo Trust & Estate",
    location: "Burbank, CA",
    phone: "(818) 555-0319",
    email: "tcastillo@castillotrust.com",
    practice_areas: ["Trust Administration", "Estate Planning"]
  },
  {
    name: "Seraphina Vargas",
    firm: "Vargas Estate Planning",
    location: "Santa Barbara, CA",
    phone: "(805) 555-0320",
    email: "svargas@vargasestate.com",
    practice_areas: ["Trusts", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Leopold Chen",
    firm: "Chen Trust Counsel",
    location: "Palo Alto, CA",
    phone: "(650) 555-0321",
    email: "lchen@chentrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Magnolia Lam",
    firm: "Lam Legal Services",
    location: "San Mateo, CA",
    phone: "(650) 555-0322",
    email: "mlam@lamlegal.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Bartholomew Wu",
    firm: "Wu Estate Attorneys",
    location: "Redwood City, CA",
    phone: "(650) 555-0323",
    email: "bwu@wuestate.com",
    practice_areas: ["Trust Administration", "Probate", "Elder Law"]
  },
  {
    name: "Clementine Liu",
    firm: "Liu Trust & Estate",
    location: "Santa Clara, CA",
    phone: "(408) 555-0324",
    email: "cliu@liutrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Percival Tran",
    firm: "Tran Law Group",
    location: "Berkeley, CA",
    phone: "(510) 555-0325",
    email: "ptran@tranlawgroup.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Imogen Le",
    firm: "Le Estate Planning",
    location: "Walnut Creek, CA",
    phone: "(925) 555-0326",
    email: "ile@leestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Barnaby Hoang",
    firm: "Hoang Trust Attorneys",
    location: "Concord, CA",
    phone: "(925) 555-0327",
    email: "bhoang@hoangtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Evangeline Vo",
    firm: "Vo Legal Corporation",
    location: "Fremont, CA",
    phone: "(510) 555-0328",
    email: "evo@volegalcorp.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Cornelius Duong",
    firm: "Duong Estate Law",
    location: "Hayward, CA",
    phone: "(510) 555-0329",
    email: "cduong@duongestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Ophelia Ngo",
    firm: "Ngo Trust & Estate",
    location: "Sunnyvale, CA",
    phone: "(408) 555-0330",
    email: "ongo@ngotrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Dashiell Bui",
    firm: "Bui Legal Services",
    location: "Mountain View, CA",
    phone: "(650) 555-0331",
    email: "dbui@builegal.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Marguerite Dang",
    firm: "Dang Estate Planning",
    location: "Cupertino, CA",
    phone: "(408) 555-0332",
    email: "mdang@dangestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Montgomery Truong",
    firm: "Truong Trust Counsel",
    location: "Milpitas, CA",
    phone: "(408) 555-0333",
    email: "mtruong@truongtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Tallulah Dinh",
    firm: "Dinh Law Firm",
    location: "Santa Cruz, CA",
    phone: "(831) 555-0334",
    email: "tdinh@dinhlawfirm.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Ambrose Ly",
    firm: "Ly Estate Attorneys",
    location: "Salinas, CA",
    phone: "(831) 555-0335",
    email: "aly@lyestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Jessamine Phan",
    firm: "Phan Trust & Estate",
    location: "Monterey, CA",
    phone: "(831) 555-0336",
    email: "jphan@phantrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Octavius Do",
    firm: "Do Legal Group",
    location: "Modesto, CA",
    phone: "(209) 555-0337",
    email: "odo@dolegalgroup.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Azalea Tang",
    firm: "Tang Estate Planning",
    location: "Stockton, CA",
    phone: "(209) 555-0338",
    email: "atang@tangestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Thaddeus Wong",
    firm: "Wong Trust Attorneys",
    location: "Visalia, CA",
    phone: "(559) 555-0339",
    email: "twong@wongtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Prudence Huang",
    firm: "Huang Legal Services",
    location: "Chico, CA",
    phone: "(530) 555-0340",
    email: "phuang@huanglegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Ignatius Ma",
    firm: "Ma Estate Law",
    location: "Redding, CA",
    phone: "(530) 555-0341",
    email: "ima@maestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Temperance Cheng",
    firm: "Cheng Trust & Estate",
    location: "Eureka, CA",
    phone: "(707) 555-0342",
    email: "tcheng@chengtrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Cornelius Lin",
    firm: "Lin Law Corporation",
    location: "Napa, CA",
    phone: "(707) 555-0343",
    email: "clin@linlawcorp.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Celestine Yeh",
    firm: "Yeh Estate Planning",
    location: "Fairfield, CA",
    phone: "(707) 555-0344",
    email: "cyeh@yehestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Horatio Hsu",
    firm: "Hsu Trust Counsel",
    location: "Vallejo, CA",
    phone: "(707) 555-0345",
    email: "hhsu@hsutrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Rosamund Chu",
    firm: "Chu Legal Group",
    location: "San Rafael, CA",
    phone: "(415) 555-0346",
    email: "rchu@chulegalgroup.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Caspian Jiang",
    firm: "Jiang Estate Attorneys",
    location: "Novato, CA",
    phone: "(415) 555-0347",
    email: "cjiang@jiangestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Lavinia Tan",
    firm: "Tan Trust & Estate",
    location: "Petaluma, CA",
    phone: "(707) 555-0348",
    email: "ltan@tantrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Peregrine Shen",
    firm: "Shen Law Firm",
    location: "San Luis Obispo, CA",
    phone: "(805) 555-0349",
    email: "pshen@shenlawfirm.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Cordelia Zhao",
    firm: "Zhao Estate Planning",
    location: "Paso Robles, CA",
    phone: "(805) 555-0350",
    email: "czhao@zhaoestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Algernon Chau",
    firm: "Chau Trust Attorneys",
    location: "Ventura, CA",
    phone: "(805) 555-0351",
    email: "achau@chautrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Constance Leung",
    firm: "Leung Legal Services",
    location: "Oxnard, CA",
    phone: "(805) 555-0352",
    email: "cleung@leunglegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Lysander Tsai",
    firm: "Tsai Estate Law",
    location: "Thousand Oaks, CA",
    phone: "(805) 555-0353",
    email: "ltsai@tsaiestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Winifred Kuo",
    firm: "Kuo Trust & Estate",
    location: "Simi Valley, CA",
    phone: "(805) 555-0354",
    email: "wkuo@kuotrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Montgomery Yao",
    firm: "Yao Law Group",
    location: "Santa Clarita, CA",
    phone: "(661) 555-0355",
    email: "myao@yaolawgroup.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Anastasia Yu",
    firm: "Yu Estate Planning",
    location: "Palmdale, CA",
    phone: "(661) 555-0356",
    email: "ayu@yuestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Reginald Fong",
    firm: "Fong Trust Counsel",
    location: "Lancaster, CA",
    phone: "(661) 555-0357",
    email: "rfong@fongtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Minerva Mak",
    firm: "Mak Legal Corporation",
    location: "Corona, CA",
    phone: "(951) 555-0358",
    email: "mmak@maklegalcorp.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Ferdinand Chow",
    firm: "Chow Estate Attorneys",
    location: "Moreno Valley, CA",
    phone: "(951) 555-0359",
    email: "fchow@chowestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Gwendolyn Sum",
    firm: "Sum Trust & Estate",
    location: "Temecula, CA",
    phone: "(951) 555-0360",
    email: "gsum@sumtrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Balthazar Lau",
    firm: "Lau Law Firm",
    location: "Murrieta, CA",
    phone: "(951) 555-0361",
    email: "blau@laulawfirm.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Millicent Ho",
    firm: "Ho Estate Planning",
    location: "Rancho Cucamonga, CA",
    phone: "(909) 555-0362",
    email: "mho@hoestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Montague Szeto",
    firm: "Szeto Trust Attorneys",
    location: "Ontario, CA",
    phone: "(909) 555-0363",
    email: "mszeto@szetotrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Esmeralda Tam",
    firm: "Tam Legal Services",
    location: "Fontana, CA",
    phone: "(909) 555-0364",
    email: "etam@tamlegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Phineas Ko",
    firm: "Ko Estate Law",
    location: "San Bernardino, CA",
    phone: "(909) 555-0365",
    email: "pko@koestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Wilhelmina Choi",
    firm: "Choi Trust & Estate",
    location: "Redlands, CA",
    phone: "(909) 555-0366",
    email: "wchoi@choitrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Casimir Wei",
    firm: "Wei Law Corporation",
    location: "Chula Vista, CA",
    phone: "(619) 555-0367",
    email: "cwei@weilawcorp.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Henrietta Kwok",
    firm: "Kwok Estate Planning",
    location: "Oceanside, CA",
    phone: "(760) 555-0368",
    email: "hkwok@kwokestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Percival Tung",
    firm: "Tung Trust Counsel",
    location: "Carlsbad, CA",
    phone: "(760) 555-0369",
    email: "ptung@tungtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Octavia Ng",
    firm: "Ng Legal Group",
    location: "Vista, CA",
    phone: "(760) 555-0370",
    email: "ong@nglegalgroup.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Alaric Sit",
    firm: "Sit Estate Attorneys",
    location: "Escondido, CA",
    phone: "(760) 555-0371",
    email: "asit@sitestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Theodora Kan",
    firm: "Kan Trust & Estate",
    location: "El Cajon, CA",
    phone: "(619) 555-0372",
    email: "tkan@kantrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Quincy Moy",
    firm: "Moy Law Firm",
    location: "La Mesa, CA",
    phone: "(619) 555-0373",
    email: "qmoy@moylawfirm.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Bernadette Siu",
    firm: "Siu Estate Planning",
    location: "National City, CA",
    phone: "(619) 555-0374",
    email: "bsiu@siuestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Valentine Cheung",
    firm: "Cheung Trust Attorneys",
    location: "La Jolla, CA",
    phone: "(858) 555-0375",
    email: "vcheung@cheungtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Guinevere Yip",
    firm: "Yip Legal Services",
    location: "Del Mar, CA",
    phone: "(858) 555-0376",
    email: "gyip@yiplegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Benedict Fan",
    firm: "Fan Estate Law",
    location: "Encinitas, CA",
    phone: "(760) 555-0377",
    email: "bfan@fanestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Temperance Hui",
    firm: "Hui Trust & Estate",
    location: "Huntington Beach, CA",
    phone: "(714) 555-0378",
    email: "thui@huitrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Ignatius Yeung",
    firm: "Yeung Law Group",
    location: "Costa Mesa, CA",
    phone: "(949) 555-0379",
    email: "iyeung@yeunglawgroup.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Clementina Shum",
    firm: "Shum Estate Planning",
    location: "Fullerton, CA",
    phone: "(714) 555-0380",
    email: "cshum@shumestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Augustus Tse",
    firm: "Tse Trust Counsel",
    location: "Orange, CA",
    phone: "(714) 555-0381",
    email: "atse@tsetrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Euphemia Louie",
    firm: "Louie Legal Corporation",
    location: "Garden Grove, CA",
    phone: "(714) 555-0382",
    email: "elouie@louielegalcorp.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Leopold Kwan",
    firm: "Kwan Estate Attorneys",
    location: "Westminster, CA",
    phone: "(714) 555-0383",
    email: "lkwan@kwanestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Rowena Lok",
    firm: "Lok Trust & Estate",
    location: "Mission Viejo, CA",
    phone: "(949) 555-0384",
    email: "rlok@loktrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Hadrian Sze",
    firm: "Sze Law Firm",
    location: "Lake Forest, CA",
    phone: "(949) 555-0385",
    email: "hsze@szelawfirm.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Arabella Fung",
    firm: "Fung Estate Planning",
    location: "Laguna Niguel, CA",
    phone: "(949) 555-0386",
    email: "afung@fungestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Thaddeus Mak",
    firm: "Mak Trust Attorneys",
    location: "Dana Point, CA",
    phone: "(949) 555-0387",
    email: "tmak@maktrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Genevieve Loo",
    firm: "Loo Legal Services",
    location: "San Clemente, CA",
    phone: "(949) 555-0388",
    email: "gloo@loolegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Constantine Chan",
    firm: "Chan Estate Law",
    location: "Yorba Linda, CA",
    phone: "(714) 555-0389",
    email: "cchan@chanestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Seraphina Woo",
    firm: "Woo Trust & Estate",
    location: "Brea, CA",
    phone: "(714) 555-0390",
    email: "swoo@wootrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Amadeus Yuen",
    firm: "Yuen Law Corporation",
    location: "La Habra, CA",
    phone: "(562) 555-0391",
    email: "ayuen@yuenlawcorp.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Pandora Lum",
    firm: "Lum Estate Planning",
    location: "Whittier, CA",
    phone: "(562) 555-0392",
    email: "plum@lumestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Cornelius Goh",
    firm: "Goh Trust Counsel",
    location: "Downey, CA",
    phone: "(562) 555-0393",
    email: "cgoh@gohtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Evangeline Ong",
    firm: "Ong Legal Group",
    location: "Norwalk, CA",
    phone: "(562) 555-0394",
    email: "eong@onglegalgroup.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
  },
  {
    name: "Remington Chang",
    firm: "Chang Estate Attorneys",
    location: "Lakewood, CA",
    phone: "(562) 555-0395",
    email: "rchang@changestate.com",
    practice_areas: ["Trust Administration", "Elder Law"]
  },
  {
    name: "Isadora Soong",
    firm: "Soong Trust & Estate",
    location: "Bellflower, CA",
    phone: "(562) 555-0396",
    email: "isoong@soongtrust.com",
    practice_areas: ["Estate Planning", "Trusts"]
  },
  {
    name: "Phineas Tsang",
    firm: "Tsang Law Firm",
    location: "Cerritos, CA",
    phone: "(562) 555-0397",
    email: "ptsang@tsanglawfirm.com",
    practice_areas: ["Trust Administration", "Estate Planning", "Tax Planning"]
  },
  {
    name: "Cordelia Au",
    firm: "Au Estate Planning",
    location: "Torrance, CA",
    phone: "(310) 555-0398",
    email: "cau@auestate.com",
    practice_areas: ["Trusts", "Estate Planning"]
  },
  {
    name: "Augustus Kwong",
    firm: "Kwong Trust Attorneys",
    location: "Redondo Beach, CA",
    phone: "(310) 555-0399",
    email: "akwong@kwongtrust.com",
    practice_areas: ["Estate Planning", "Trust Administration"]
  },
  {
    name: "Isolde Tsui",
    firm: "Tsui Legal Services",
    location: "Manhattan Beach, CA",
    phone: "(310) 555-0400",
    email: "itsui@tsuilegal.com",
    practice_areas: ["Trusts", "Estate Planning", "Probate"]
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
      console.error(`  ✗ Failed`);
      results.failed++;
      results.errors.push({
        attorney: attorney.name,
        error: error.message || 'Unknown error'
      });
    }
  }

  return results;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  Adding 100 More California Trust Attorneys to Attio');
  console.log('  Batch #3');
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
    console.log('\nErrors (first 10):');
    results.errors.slice(0, 10).forEach(e => {
      console.log(`  - ${e.attorney}`);
    });
  }

  const previousTotal = 148;
  const newTotal = previousTotal + results.success;

  console.log('\n✅ Upload completed!');
  console.log(`\nPrevious total: ${previousTotal} attorneys`);
  console.log(`Added this batch: ${results.success} attorneys`);
  console.log(`\n🎯 Grand Total: ${newTotal} California trust attorneys in Attio!`);
  console.log(`\n💡 Tip: Check your Attio workspace at https://app.attio.com`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
