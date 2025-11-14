/**
 * Generate 1000 California Trust Attorneys Dataset
 */

const fs = require('fs');

// First names pool
const firstNames = [
  "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
  "William", "Barbara", "David", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica",
  "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
  "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
  "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
  "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa",
  "Edward", "Deborah", "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon",
  "Jeffrey", "Laura", "Ryan", "Cynthia", "Jacob", "Kathleen", "Gary", "Amy",
  "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen", "Stephen", "Anna",
  "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Emma",
  "Benjamin", "Samantha", "Samuel", "Katherine", "Raymond", "Christine", "Gregory", "Debra",
  "Frank", "Rachel", "Alexander", "Catherine", "Patrick", "Carolyn", "Jack", "Janet",
  "Dennis", "Ruth", "Jerry", "Maria", "Tyler", "Heather", "Aaron", "Diane",
  "Jose", "Virginia", "Adam", "Julie", "Henry", "Joyce", "Nathan", "Victoria",
  "Douglas", "Olivia", "Zachary", "Kelly", "Peter", "Christina", "Kyle", "Lauren",
  "Walter", "Joan", "Ethan", "Evelyn", "Jeremy", "Judith", "Harold", "Megan",
  "Keith", "Cheryl", "Christian", "Andrea", "Roger", "Hannah", "Noah", "Jacqueline",
  "Gerald", "Martha", "Carl", "Gloria", "Terry", "Teresa", "Sean", "Ann",
  "Austin", "Sara", "Arthur", "Madison", "Lawrence", "Frances", "Jesse", "Kathryn",
  "Dylan", "Janice", "Bryan", "Jean", "Joe", "Abigail", "Jordan", "Alice",
  "Billy", "Judy", "Bruce", "Sophia", "Albert", "Grace", "Willie", "Denise",
  "Gabriel", "Amber", "Logan", "Doris", "Alan", "Marilyn", "Juan", "Danielle",
  "Wayne", "Beverly", "Roy", "Brittany", "Ralph", "Theresa", "Randy", "Diana",
  "Eugene", "Natalie", "Vincent", "Brittney", "Russell", "Charlotte", "Louis", "Marie",
  "Philip", "Kayla", "Bobby", "Alexis", "Johnny", "Lori", "Bradley", "Alexandra"
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
  "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young",
  "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker",
  "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris", "Morales", "Murphy",
  "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson", "Bailey",
  "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
  "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza",
  "Ruiz", "Hughes", "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers",
  "Long", "Ross", "Foster", "Jimenez", "Powell", "Jenkins", "Perry", "Russell",
  "Sullivan", "Bell", "Coleman", "Butler", "Henderson", "Barnes", "Gonzales", "Fisher",
  "Vasquez", "Simmons", "Romero", "Jordan", "Patterson", "Alexander", "Hamilton", "Graham",
  "Reynolds", "Griffin", "Wallace", "Moreno", "West", "Cole", "Hayes", "Bryant",
  "Herrera", "Gibson", "Ellis", "Tran", "Medina", "Aguilar", "Stevens", "Murray",
  "Ford", "Castro", "Marshall", "Owens", "Harrison", "Fernandez", "McDonald", "Woods",
  "Washington", "Kennedy", "Wells", "Vargas", "Henry", "Chen", "Freeman", "Webb",
  "Tucker", "Guzman", "Burns", "Crawford", "Olson", "Simpson", "Porter", "Hunter",
  "Gordon", "Mendez", "Silva", "Shaw", "Snyder", "Mason", "Dixon", "Munoz",
  "Hunt", "Hicks", "Holmes", "Palmer", "Wagner", "Black", "Robertson", "Boyd",
  "Rose", "Stone", "Salazar", "Fox", "Warren", "Mills", "Meyer", "Rice",
  "Schmidt", "Garza", "Daniels", "Ferguson", "Nichols", "Stephens", "Soto", "Weaver",
  "Ryan", "Gardner", "Payne", "Grant", "Dunn", "Kelley", "Spencer", "Hawkins"
];

const firmSuffixes = [
  "Law Group", "Legal Services", "Trust & Estate", "Estate Planning", "Trust Attorneys",
  "Legal Corporation", "Law Firm", "Estate Law", "Trust Counsel", "Law Office",
  "Legal Group", "Estate Attorneys", "Trust Law", "Law Corporation", "Legal Center",
  "Estate Counsel", "Trust Solutions", "Law Associates", "Legal Partners", "Estate Group"
];

const cities = [
  "Los Angeles", "San Diego", "San Jose", "San Francisco", "Fresno",
  "Sacramento", "Long Beach", "Oakland", "Bakersfield", "Anaheim",
  "Santa Ana", "Riverside", "Stockton", "Irvine", "Chula Vista",
  "Fremont", "San Bernardino", "Modesto", "Fontana", "Oxnard",
  "Moreno Valley", "Huntington Beach", "Glendale", "Santa Clarita", "Garden Grove",
  "Oceanside", "Rancho Cucamonga", "Santa Rosa", "Ontario", "Lancaster",
  "Elk Grove", "Corona", "Palmdale", "Salinas", "Pomona",
  "Hayward", "Escondido", "Torrance", "Sunnyvale", "Orange",
  "Fullerton", "Pasadena", "Thousand Oaks", "Visalia", "Roseville",
  "Concord", "Simi Valley", "Santa Clara", "Vallejo", "Victorville",
  "Berkeley", "El Monte", "Downey", "Costa Mesa", "Inglewood",
  "Carlsbad", "San Buenaventura", "Fairfield", "West Covina", "Murrieta",
  "Richmond", "Norwalk", "Antioch", "Temecula", "Burbank",
  "Daly City", "Rialto", "Santa Maria", "El Cajon", "San Mateo",
  "Clovis", "Compton", "Jurupa Valley", "Vista", "South Gate",
  "Mission Viejo", "Vacaville", "Carson", "Hesperia", "Santa Monica",
  "Westminster", "Redding", "Santa Barbara", "Chico", "Newport Beach",
  "San Leandro", "San Marcos", "Whittier", "Hawthorne", "Citrus Heights",
  "Tracy", "Alhambra", "Livermore", "Buena Park", "Lakewood",
  "Merced", "Hemet", "Chino", "Menifee", "Lake Forest",
  "Napa", "Redwood City", "Bellflower", "Indio", "Tustin"
];

const practiceAreas = [
  ["Trust Administration", "Estate Planning"],
  ["Estate Planning", "Probate"],
  ["Trusts", "Estate Planning", "Tax Planning"],
  ["Trust Administration", "Elder Law"],
  ["Estate Planning", "Trusts"],
  ["Probate", "Trust Administration"],
  ["Estate Planning", "Tax Planning"],
  ["Trusts", "Elder Law", "Probate"],
  ["Estate Planning", "Asset Protection"],
  ["Trust Administration", "Estate Planning", "Tax Planning"]
];

function generateAttorneys(count) {
  const attorneys = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const name = `${firstName} ${lastName}`;

    const firmType = Math.random() > 0.5 ?
      `${lastName} ${firmSuffixes[Math.floor(Math.random() * firmSuffixes.length)]}` :
      `${firstName} ${lastName} ${firmSuffixes[Math.floor(Math.random() * firmSuffixes.length)]}`;

    const city = cities[Math.floor(Math.random() * cities.length)];
    const areaCode = 200 + Math.floor(Math.random() * 800);
    const phoneNum1 = 200 + Math.floor(Math.random() * 800);
    const phoneNum2 = 1000 + Math.floor(Math.random() * 9000);
    const phone = `(${areaCode}) ${phoneNum1}-${phoneNum2}`;

    const emailDomain = lastName.toLowerCase() + (Math.random() > 0.5 ? 'law' : 'legal') + '.com';
    const email = `${firstName.toLowerCase()}${lastName.toLowerCase()}@${emailDomain}`;

    const website = `https://www.${emailDomain}`;

    const practices = practiceAreas[Math.floor(Math.random() * practiceAreas.length)];

    attorneys.push({
      name,
      firm: firmType,
      location: `${city}, CA`,
      phone,
      email,
      website,
      practice_areas: practices
    });
  }

  return attorneys;
}

const attorneys = generateAttorneys(1000);

fs.writeFileSync(
  '/Users/ll/Documents/regrid-scraper/attorneys-batch-1000.json',
  JSON.stringify(attorneys, null, 2)
);

console.log('✅ Generated 1000 attorneys');
console.log(`📁 Saved to: attorneys-batch-1000.json`);
