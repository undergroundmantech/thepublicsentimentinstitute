// ─────────────────────────────────────────────────────────────────────────────
// TPSI Forecast — the 2026 race universe.
// 36 governorships · 35 Senate seats (class 2 + FL/OH specials) · 435 House
// districts. Partisan baselines are PVI-style leans (R+ positive, D+ negative
// on the model's Republican-margin scale). Marquee contests carry curated
// candidate slates; the long tail runs on structural data.
// ─────────────────────────────────────────────────────────────────────────────

export const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// Census-style regions (correlation features)
export const REGION = {
  CT: "NE", ME: "NE", MA: "NE", NH: "NE", RI: "NE", VT: "NE", NJ: "NE", NY: "NE", PA: "NE",
  IL: "MW", IN: "MW", MI: "MW", OH: "MW", WI: "MW", IA: "MW", KS: "MW", MN: "MW", MO: "MW", NE: "MW", ND: "MW", SD: "MW",
  DE: "SO", FL: "SO", GA: "SO", MD: "SO", NC: "SO", SC: "SO", VA: "SO", WV: "SO", AL: "SO", KY: "SO", MS: "SO", TN: "SO", AR: "SO", LA: "SO", OK: "SO", TX: "SO",
  AZ: "WE", CO: "WE", ID: "WE", MT: "WE", NV: "WE", NM: "WE", UT: "WE", WY: "WE", AK: "WE", CA: "WE", HI: "WE", OR: "WE", WA: "WE",
};

// Geographic elasticity — responsiveness of the electorate to national swings
export const ELASTICITY = {
  NH: 1.16, NV: 1.12, ME: 1.11, WI: 1.06, MI: 1.06, AZ: 1.07, PA: 1.04, IA: 1.05,
  MN: 1.03, NC: 0.99, GA: 0.94, TX: 0.95, FL: 0.97, OH: 1.02, CO: 1.02, VA: 1.02,
  AK: 1.08, MT: 1.04, KS: 1.03, NM: 1.02, OR: 1.0, WA: 1.0, NY: 1.02, NJ: 1.03,
  CA: 0.98, IL: 1.0, MD: 0.96, MA: 1.0, CT: 1.02, RI: 1.04, VT: 1.08, DE: 0.99,
  AL: 0.9, AR: 0.92, ID: 0.93, IN: 0.98, KY: 0.95, LA: 0.9, MS: 0.88, MO: 0.97,
  NE: 0.98, ND: 0.96, OK: 0.9, SC: 0.94, SD: 0.97, TN: 0.92, UT: 0.97, WV: 0.9,
  WY: 0.92, HI: 0.95,
};

// 2024 presidential margin by state (Republican-positive), the fundamentals anchor
export const PRES_2024 = {
  AL: 30.5, AK: 13.1, AZ: 5.5, AR: 30.6, CA: -20.1, CO: -11.0, CT: -14.5, DE: -14.7,
  FL: 13.1, GA: 2.2, HI: -23.5, ID: 36.5, IL: -10.9, IN: 19.0, IA: 13.2, KS: 16.2,
  KY: 30.5, LA: 22.1, ME: -7.0, MD: -29.1, MA: -25.6, MI: 1.4, MN: -4.3, MS: 22.9,
  MO: 18.5, MT: 19.9, NE: 20.3, NV: 3.1, NH: -2.8, NJ: -5.9, NM: -6.0, NY: -12.6,
  NC: 3.2, ND: 36.3, OH: 11.2, OK: 34.2, OR: -14.2, PA: 1.7, RI: -13.8, SC: 18.1,
  SD: 29.8, TN: 29.6, TX: 13.7, UT: 21.8, VT: -32.2, VA: -5.8, WA: -18.6, WV: 41.9,
  WI: 0.9, WY: 45.8,
};

// ── Governors: all 36 seats on the 2026 ballot ───────────────────────────────
// inc: +1 R incumbent running, -1 D incumbent running, 0 open
export const GOVERNORS = [
  { st: "AL", inc: 0, open: true,  dem: "Doug Jones",        gop: "Tommy Tuberville",  marquee: false },
  { st: "AK", inc: 0, open: true,  dem: "Mary Peltola",      gop: "Nancy Dahlstrom",   marquee: true },
  { st: "AZ", inc: -1, open: false, dem: "Katie Hobbs",       gop: "Karrin Taylor Robson", marquee: true },
  { st: "AR", inc: 1, open: false, dem: "Marcus Ellison",    gop: "Sarah Sanders",     marquee: false },
  { st: "CA", inc: 0, open: true,  dem: "Katie Porter",      gop: "Chad Bianco",       marquee: false },
  { st: "CO", inc: 0, open: true,  dem: "Michael Bennet",    gop: "Greg Lopez",        marquee: false },
  { st: "CT", inc: -1, open: false, dem: "Ned Lamont",        gop: "Erin Stewart",      marquee: false },
  { st: "FL", inc: 0, open: true,  dem: "David Jolly",       gop: "Byron Donalds",     marquee: true },
  { st: "GA", inc: 0, open: true,  dem: "Jason Carter",      gop: "Burt Jones",        marquee: true },
  { st: "HI", inc: -1, open: false, dem: "Josh Green",        gop: "Duke Aiona",        marquee: false },
  { st: "ID", inc: 1, open: false, dem: "Terri Pickens",     gop: "Brad Little",       marquee: false },
  { st: "IL", inc: -1, open: false, dem: "JB Pritzker",       gop: "Ted Dabrowski",     marquee: false },
  { st: "IA", inc: 0, open: true,  dem: "Rob Sand",          gop: "Randy Feenstra",    marquee: true },
  { st: "KS", inc: 0, open: true,  dem: "Cindy Holscher",    gop: "Scott Schwab",      marquee: true },
  { st: "ME", inc: 0, open: true,  dem: "Hannah Pingree",    gop: "Robert Wadsworth",  marquee: false },
  { st: "MD", inc: -1, open: false, dem: "Wes Moore",         gop: "Larry Hogan",       marquee: false },
  { st: "MA", inc: -1, open: false, dem: "Maura Healey",      gop: "Mike Kennealy",     marquee: false },
  { st: "MI", inc: 0, open: true,  dem: "Jocelyn Benson",    gop: "John James",        marquee: true },
  { st: "MN", inc: -1, open: false, dem: "Tim Walz",          gop: "Kristin Robbins",   marquee: false },
  { st: "NE", inc: 1, open: false, dem: "Dan Osborn",        gop: "Jim Pillen",        marquee: false },
  { st: "NV", inc: 1, open: false, dem: "Aaron Ford",        gop: "Joe Lombardo",      marquee: true },
  { st: "NH", inc: 1, open: false, dem: "Cinde Warmington",  gop: "Kelly Ayotte",      marquee: false },
  { st: "NM", inc: 0, open: true,  dem: "Deb Haaland",       gop: "Rebecca Dow",       marquee: false },
  { st: "NY", inc: -1, open: false, dem: "Kathy Hochul",      gop: "Elise Stefanik",    marquee: true },
  { st: "OH", inc: 0, open: true,  dem: "Amy Acton",         gop: "Vivek Ramaswamy",   marquee: true },
  { st: "OK", inc: 0, open: true,  dem: "Carly Hotvedt",     gop: "Gentner Drummond",  marquee: false },
  { st: "OR", inc: -1, open: false, dem: "Tina Kotek",        gop: "Christine Drazan",  marquee: false },
  { st: "PA", inc: -1, open: false, dem: "Josh Shapiro",      gop: "Stacy Garrity",     marquee: false },
  { st: "RI", inc: -1, open: false, dem: "Dan McKee",         gop: "Ashley Kalus",      marquee: false },
  { st: "SC", inc: 0, open: true,  dem: "Mullins McLeod",    gop: "Alan Wilson",       marquee: false },
  { st: "SD", inc: 1, open: false, dem: "Jamie Smith",       gop: "Larry Rhoden",      marquee: false },
  { st: "TN", inc: 0, open: true,  dem: "Marquita Bradshaw", gop: "Marsha Blackburn",  marquee: false },
  { st: "TX", inc: 1, open: false, dem: "Ron Nirenberg",     gop: "Greg Abbott",       marquee: false },
  { st: "VT", inc: 1, open: false, dem: "Esther Charlestin", gop: "Phil Scott",        marquee: false },
  { st: "WI", inc: 0, open: true,  dem: "Sara Rodriguez",    gop: "Tom Tiffany",       marquee: true },
  { st: "WY", inc: 0, open: true,  dem: "Marcie Kindred",    gop: "Chuck Gray",        marquee: false },
];

// Gov-specific structural offsets (candidate quality, state-office crossover
// tradition, incumbent brands) applied on top of the presidential anchor.
export const GOV_ADJ = {
  VT: -34,  // Scott's crossover brand
  NH: -8, NV: -4, MD: -12, KS: -16, NY: 6, AZ: -2, WI: -1, MI: 0,
  MA: -6, CT: -2, RI: -2, OK: -6, TN: -6, AL: -6, KY: 0, ME: 0,
  NE: -8,   // Osborn independent-style run
  OH: -3, IA: -4, GA: -1, FL: -4, AK: -6, CA: 4, CO: 2, OR: 2, SC: -2, TX: -2,
};

// ── Senate: class 2 + the FL & OH specials ───────────────────────────────────
export const SENATE = [
  { st: "AL", inc: 0, open: true,  dem: "Kyle Sweetser",     gop: "Steve Marshall",    marquee: false },
  { st: "AK", inc: 1, open: false, dem: "Forrest Dunbar",    gop: "Dan Sullivan",      marquee: false },
  { st: "AR", inc: 1, open: false, dem: "Josh Mahony",       gop: "Tom Cotton",        marquee: false },
  { st: "CO", inc: -1, open: false, dem: "John Hickenlooper", gop: "Deborah Flora",     marquee: false },
  { st: "DE", inc: -1, open: false, dem: "Chris Coons",       gop: "Eric Hansen",       marquee: false },
  { st: "FL", inc: 1, open: false, dem: "Josh Weil",         gop: "Ashley Moody",      marquee: false, special: true },
  { st: "GA", inc: -1, open: false, dem: "Jon Ossoff",        gop: "Buddy Carter",      marquee: true },
  { st: "ID", inc: 1, open: false, dem: "David Roth",        gop: "Jim Risch",         marquee: false },
  { st: "IL", inc: 0, open: true,  dem: "Juliana Stratton",  gop: "Darren Bailey",     marquee: false },
  { st: "IA", inc: 0, open: true,  dem: "Nathan Sage",       gop: "Ashley Hinson",     marquee: true },
  { st: "KS", inc: 1, open: false, dem: "Ethan Corson",      gop: "Roger Marshall",    marquee: false },
  { st: "KY", inc: 0, open: true,  dem: "Pamela Stevenson",  gop: "Andy Barr",         marquee: false },
  { st: "LA", inc: 1, open: false, dem: "Luke Mixon",        gop: "Bill Cassidy",      marquee: false },
  { st: "ME", inc: 1, open: false, dem: "Janet Mills",       gop: "Susan Collins",     marquee: true },
  { st: "MA", inc: -1, open: false, dem: "Ed Markey",         gop: "John Deaton",       marquee: false },
  { st: "MI", inc: 0, open: true,  dem: "Mallory McMorrow",  gop: "Mike Rogers",       marquee: true },
  { st: "MN", inc: 0, open: true,  dem: "Peggy Flanagan",    gop: "Royce White",       marquee: false },
  { st: "MS", inc: 1, open: false, dem: "Ty Pinkins",        gop: "Cindy Hyde-Smith",  marquee: false },
  { st: "MT", inc: 1, open: false, dem: "Ryan Busse",        gop: "Steve Daines",      marquee: false },
  { st: "NE", inc: 1, open: false, dem: "Preston Love",      gop: "Pete Ricketts",     marquee: false },
  { st: "NH", inc: 0, open: true,  dem: "Chris Pappas",      gop: "Scott Brown",       marquee: true },
  { st: "NJ", inc: -1, open: false, dem: "Cory Booker",       gop: "Curtis Bashaw",     marquee: false },
  { st: "NM", inc: -1, open: false, dem: "Ben Ray Luján",     gop: "Nella Domenici",    marquee: false },
  { st: "NC", inc: 0, open: true,  dem: "Roy Cooper",        gop: "Michael Whatley",   marquee: true },
  { st: "OH", inc: 1, open: false, dem: "Sherrod Brown",     gop: "Jon Husted",        marquee: true, special: true },
  { st: "OK", inc: 1, open: false, dem: "Erick Harris",      gop: "Markwayne Mullin",  marquee: false },
  { st: "OR", inc: -1, open: false, dem: "Jeff Merkley",      gop: "Jo Rae Perkins",    marquee: false },
  { st: "RI", inc: -1, open: false, dem: "Jack Reed",         gop: "Raymond McKay",     marquee: false },
  { st: "SC", inc: 1, open: false, dem: "Annie Andrews",     gop: "Lindsey Graham",    marquee: false },
  { st: "SD", inc: 1, open: false, dem: "Brian Bengs",       gop: "Mike Rounds",       marquee: false },
  { st: "TN", inc: 1, open: false, dem: "Gloria Johnson",    gop: "Bill Hagerty",      marquee: false },
  { st: "TX", inc: 1, open: false, dem: "Colin Allred",      gop: "John Cornyn",       marquee: true },
  { st: "VA", inc: -1, open: false, dem: "Mark Warner",       gop: "Hung Cao",          marquee: false },
  { st: "WV", inc: 1, open: false, dem: "Zach Shrewsbury",   gop: "Shelley Capito",    marquee: false },
  { st: "WY", inc: 1, open: false, dem: "Scott Morrow",      gop: "Cynthia Lummis",    marquee: false },
];

export const SEN_ADJ = {
  ME: -12,  // Collins crossover minus Mills' statewide brand — nets close
  OH: -8,   // Brown overperformance history vs appointed incumbent
  NC: -5,   // Cooper's statewide brand
  GA: -3,   // Ossoff incumbency + organization
  MT: -6, TX: -4, IA: -3, AK: -4, KS: -3, SC: -2, LA: -2, NE: -2,
  MI: -1, NH: -3, MN: -1, FL: 2, WV: -4, MA: -4, NJ: -2,
};

// ── House: 435 districts ─────────────────────────────────────────────────────
// Per-state arrays of district leans (R+ positive). Competitive seats are set
// from ratings-grade knowledge; the rest are structurally realistic.
export const HOUSE_PVI = {
  AL: [30, 28, 25, 33, 27, 15, -26],
  AK: [8],
  AZ: [3, 25, -30, -22, 20, 4, -44, 2, 33],
  AR: [24, 26, 22, 30],
  CA: [-16, 10, -8, -18, 8, -10, -24, -12, -6, -14, -74, -46, 2, -42, -56, -18,
       -62, -30, -26, 6, 1, 4, 16, -34, -8, -18, 1, -32, -48, -36, -12, -40,
       -14, -60, -30, -8, -66, -50, -8, -2, 4, -30, -70, -52, 2, -6, -38, 6,
       -4, -20, -34, -28],
  CO: [-22, -14, 18, -4, 9, -18, -6, 1],
  CT: [-22, -8, -18, -26, -10],
  DE: [-14],
  FL: [4, 16, 6, 8, 20, 12, 8, 10, -22, -12, 24, 18, 3, -20, 8, 12, 14, 26,
       16, -50, 6, 10, -46, -58, -10, 18, 4, 12],
  GA: [24, 8, 26, -48, -60, 6, -18, 20, 30, 18, 22, 14, -52, 26],
  HI: [-30, -18],
  ID: [34, 38],
  IL: [-60, -34, -24, -64, -40, -12, -66, -14, -44, -26, -16, 28, 3, -8, 32, 22, -6],
  IN: [-16, 18, 22, 20, 2, 24, -34, 16, 14],
  IA: [2, 1, 3, 16],
  KS: [12, 8, -8, 18],
  KY: [28, 22, -18, 30, 32, 18],
  LA: [24, -50, 20, 26, 22, -22],
  ME: [-10, 4],
  MD: [26, -28, -20, -60, -30, -6, -58, -36],
  MA: [-18, -22, -16, -30, -34, -14, -56, -28, -12],
  MI: [10, 8, 3, 12, 22, -8, 1, 2, 20, 4, -30, -48, -46],
  MN: [16, -2, -8, -50, -60, 22, 26, 18],
  MS: [22, -26, 24, 20],
  MO: [-56, 20, 18, 24, -12, 20, 22, 30],
  MT: [12, 20],
  NE: [14, -1, 28],
  NV: [-2, 16, -1, 2],
  NH: [-3, -4],
  NJ: [8, -14, -12, 18, -10, -32, 2, -46, -30, -66, -34, -28],
  NM: [-4, 2, -10],
  NY: [4, -14, -6, -4, -20, -30, -70, -44, -74, -50, 8, -66, -76, -36, -78, -30,
       1, -2, 3, -22, 10, 2, 12, 8, -18, -16],
  NC: [1, -30, 16, -32, 20, 24, 22, 18, 14, 20, 26, -52, 3, -18],
  ND: [26],
  OH: [3, 12, -38, 24, 22, 14, 18, 20, -2, 16, -56, 10, -4, 26, 5],
  OK: [30, 24, 36, 22, 12],
  OR: [-24, 22, -42, -6, -3, -8],
  PA: [-2, -18, -76, 3, -30, -8, 1, 2, 30, 5, 24, -12, 32, 20, 28, 12, -4],
  RI: [-24, -18],
  SC: [1, 20, 26, 18, 24, -44, 12],
  SD: [30],
  TN: [26, 30, 28, 32, -12, 24, 20, 22, -50],
  TX: [22, 20, 24, 32, 16, 26, -22, 12, -66, 20, 34, 18, 36, 6, 3, -16, 14,
       -56, 26, -22, 8, 10, 5, 12, 24, 20, 6, 2, -46, -60, 10, -22, -30, 1,
       -12, 26, -24, 30],
  UT: [16, 18, 14, 22],
  VT: [-32],
  VA: [-4, 1, -34, -62, 3, 16, -6, -42, 20, 6, -30],
  WA: [-20, -14, 1, 12, 16, -24, -66, -2, -38, -12],
  WV: [40, 44],
  WI: [4, -6, 1, -52, 24, 16, 18, -38],
  WY: [46],
};

// Marquee House battlegrounds — real slates, incumbency, quality signals
export const HOUSE_KEY = {
  "AZ-01": { dem: "Amish Shah",        gop: "David Schweikert", inc: 1 },
  "AZ-06": { dem: "Kirsten Engel",     gop: "Juan Ciscomani",   inc: 1 },
  "CA-13": { dem: "Adam Gray",         gop: "Javier Lopez",     inc: -1 },
  "CA-22": { dem: "Randy Villegas",    gop: "David Valadao",    inc: 1 },
  "CA-27": { dem: "George Whitesides", gop: "Mike Garcia",      inc: -1 },
  "CA-41": { dem: "Will Rollins",      gop: "Ken Calvert",      inc: 1 },
  "CA-45": { dem: "Derek Tran",        gop: "Janet Nguyen",     inc: -1 },
  "CO-08": { dem: "Yadira Caraveo",    gop: "Gabe Evans",       inc: 1 },
  "IA-01": { dem: "Christina Bohannan", gop: "Mariannette Miller-Meeks", inc: 1 },
  "IA-02": { dem: "Sarah Corkery",     gop: "Ashley Hinson",    inc: 0 },
  "IA-03": { dem: "Lanon Baccam",      gop: "Zach Nunn",        inc: 1 },
  "ME-02": { dem: "Jared Golden",      gop: "Austin Theriault", inc: -1 },
  "MI-04": { dem: "Jessica Swartz",    gop: "Bill Huizenga",    inc: 1 },
  "MI-07": { dem: "Curtis Hertel",     gop: "Tom Barrett",      inc: 1 },
  "MI-08": { dem: "Kristen McDonald Rivet", gop: "Paul Junge",  inc: -1 },
  "MI-10": { dem: "Carl Marlinga",     gop: "John James",       inc: 0 },
  "NE-02": { dem: "Tony Vargas",       gop: "Dan Frei",         inc: 0 },
  "NV-01": { dem: "Dina Titus",        gop: "Mark Robertson",   inc: -1 },
  "NV-03": { dem: "Susie Lee",         gop: "Drew Johnson",     inc: -1 },
  "NV-04": { dem: "Steven Horsford",   gop: "John Lee",         inc: -1 },
  "NH-01": { dem: "Maggie Goodlander", gop: "Chris Bright",     inc: -1 },
  "NJ-07": { dem: "Rebecca Bennett",   gop: "Tom Kean Jr.",     inc: 1 },
  "NM-02": { dem: "Gabe Vasquez",      gop: "Yvette Herrell",   inc: -1 },
  "NY-04": { dem: "Laura Gillen",      gop: "Anthony D'Esposito", inc: -1 },
  "NY-17": { dem: "Mondaire Jones",    gop: "Mike Lawler",      inc: 1 },
  "NY-19": { dem: "Josh Riley",        gop: "Marc Molinaro",    inc: -1 },
  "NY-22": { dem: "John Mannion",      gop: "Brandon Williams", inc: -1 },
  "NC-01": { dem: "Don Davis",         gop: "Laurie Buckhout",  inc: -1 },
  "OH-09": { dem: "Marcy Kaptur",      gop: "Derek Merrin",     inc: -1 },
  "OH-13": { dem: "Emilia Sykes",      gop: "Kevin Coughlin",   inc: -1 },
  "OR-05": { dem: "Janelle Bynum",     gop: "Lori Chavez-DeRemer", inc: -1 },
  "PA-07": { dem: "Susan Wild",        gop: "Ryan Mackenzie",   inc: 1 },
  "PA-08": { dem: "Matt Cartwright",   gop: "Rob Bresnahan",    inc: 1 },
  "PA-10": { dem: "Janelle Stelson",   gop: "Scott Perry",      inc: 1 },
  "TX-15": { dem: "Bobby Pulido",      gop: "Monica De La Cruz", inc: 1 },
  "TX-28": { dem: "Henry Cuellar",     gop: "Jay Furman",       inc: -1 },
  "TX-34": { dem: "Vicente Gonzalez",  gop: "Mayra Flores",     inc: -1 },
  "VA-02": { dem: "Missy Cotter Smasal", gop: "Jen Kiggans",    inc: 1 },
  "VA-07": { dem: "Eugene Vindman",    gop: "Derrick Anderson", inc: -1 },
  "WA-03": { dem: "Marie Gluesenkamp Perez", gop: "Joe Kent",   inc: -1 },
  "WI-01": { dem: "Peter Barca",       gop: "Bryan Steil",      inc: 1 },
  "WI-03": { dem: "Rebecca Cooke",     gop: "Derrick Van Orden", inc: 1 },
};

// generic candidate name pools for the long tail (deterministic by district)
export const DEM_POOL = ["Alvarez", "Brooks", "Carter", "Chen", "Dawson", "Ellis", "Foster", "Garcia", "Hale", "Ito", "Jensen", "Klein", "Lopez", "Meyer", "Nguyen", "Ortiz", "Park", "Quinn", "Reyes", "Shah", "Silva", "Turner", "Vaughn", "Walsh"];
export const GOP_POOL = ["Anderson", "Baker", "Cole", "Decker", "Evans", "Ford", "Griffin", "Harmon", "Ingram", "Jacobs", "Keller", "Lane", "Mercer", "North", "Olsen", "Price", "Reid", "Sawyer", "Tate", "Underwood", "Vance", "Whitfield", "York", "Zimmer"];
export const FIRST_D = ["Maya", "Jordan", "Elena", "Marcus", "Priya", "Daniel", "Renee", "Andre", "Grace", "Victor", "Naomi", "Caleb", "Rosa", "Theo", "Amara", "Louis", "Simone", "Devon", "Lena", "Omar"];
export const FIRST_R = ["Wade", "Carol", "Hank", "Denise", "Roy", "Martha", "Glenn", "Paula", "Clint", "Susan", "Earl", "Janet", "Todd", "Diane", "Bruce", "Karen", "Vern", "Tammy", "Chuck", "Rhonda"];

const djb2 = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h; };

// Deterministic filler names, unique nationally per party. Each field draws from
// its own hash (shifted bits of one hash correlate across neighboring ids), and
// collisions walk the surname wheel until a free combination turns up.
function makeNamer(firsts, lasts, salt) {
  const used = new Set(Object.values(HOUSE_KEY).map((k) => (salt === "d" ? k.dem : k.gop)));
  return (id) => {
    let fi = djb2(salt + "f·" + id) % firsts.length;
    let li = djb2(salt + "l·" + id) % lasts.length;
    for (let t = 0; t < firsts.length * lasts.length; t++) {
      const name = `${firsts[fi]} ${lasts[li]}`;
      if (!used.has(name)) { used.add(name); return name; }
      li = (li + 1) % lasts.length;
      if (li === 0) fi = (fi + 1) % firsts.length;
    }
    return `${firsts[fi]} ${lasts[li]}`;
  };
}

// Incumbency for non-key House seats: hold-party incumbent runs (~88%), open otherwise
export function buildHouse() {
  const races = [];
  const demName = makeNamer(FIRST_D, DEM_POOL, "d");
  const gopName = makeNamer(FIRST_R, GOP_POOL, "r");
  for (const [st, pvis] of Object.entries(HOUSE_PVI)) {
    pvis.forEach((pvi, k) => {
      const num = k + 1;
      const id = `${st}-${String(num).padStart(2, "0")}`;
      const key = HOUSE_KEY[id];
      const h = djb2("hs·" + id);
      const holdsR = pvi > 0;
      const open = key ? key.inc === 0 : h % 100 < 12;
      const inc = key ? key.inc : open ? 0 : holdsR ? 1 : -1;
      races.push({
        id,
        office: "house",
        st,
        district: num,
        pvi,
        inc,
        open,
        marquee: !!key,
        dem: key?.dem || demName(id),
        gop: key?.gop || gopName(id),
      });
    });
  }
  return races;
}

export function buildUniverse() {
  const gov = GOVERNORS.map((g) => ({
    id: `GOV-${g.st}`,
    office: "governor",
    st: g.st,
    district: 0,
    pvi: PRES_2024[g.st] + (GOV_ADJ[g.st] ?? 0),
    inc: g.inc,
    open: g.open,
    marquee: g.marquee,
    dem: g.dem,
    gop: g.gop,
  }));
  const sen = SENATE.map((s) => ({
    id: `SEN-${s.st}${s.special ? "-SP" : ""}`,
    office: "senate",
    st: s.st,
    district: 0,
    pvi: PRES_2024[s.st] + (SEN_ADJ[s.st] ?? 0),
    inc: s.inc,
    open: s.open,
    marquee: s.marquee,
    special: !!s.special,
    dem: s.dem,
    gop: s.gop,
  }));
  const house = buildHouse();
  return { gov, sen, house, all: [...gov, ...sen, ...house] };
}

// sanity when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const u = buildUniverse();
  const seats = Object.values(HOUSE_PVI).reduce((s, a) => s + a.length, 0);
  console.log("gov", u.gov.length, "sen", u.sen.length, "house", u.house.length, "seat-sum", seats);
}
