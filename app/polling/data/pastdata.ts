// app/polling/data/pastdata.ts
// PSI past performance dataset (statewide, 50 states)
//
// Conventions
// - Margins are **R margin** = (Republican % - Democratic %)
// - 2012 baseline: Romney - Obama (R margin)
// - 2016: Trump - Clinton (R margin)
// - 2020 table you pasted is **D margin (Biden - Trump)**, so we convert to **R margin = -(D margin)**
// - 2024: Trump - Harris (R margin) from your “Margin %”
//
// Votes
// - For 2016/2020/2024 we store: R votes, D votes, total votes, and third-party combined votes
// - thirdPartyCombined = totalVotes - (R votes) - (D votes)

export type Party = "R" | "D";
export type LeanRating = "SAFE" | "LIKELY" | "LEAN" | "TILT" | "TOSSUP";

export type CycleVotes = {
  r: number;
  d: number;
  third: number; // all non-R and non-D combined
  total: number;
};

export type StatePast = {
  abbr: string;
  name: string;

  // R margin by cycle (R% - D%), in percentage points
  margins: {
    y2012: number; // Romney - Obama
    y2016: number; // Trump - Clinton
    y2020: number; // Trump - Biden (R margin)
    y2024: number; // Trump - Harris
  };

  // Trend = (y2024 - y2012), in points. + means trend R, - means trend D
  trend_2012_to_2024: number;

  // Lean based on 2024 result
  lean2024: {
    party: Party;
    rating: LeanRating;
  };

  // Human-readable shift summary
  shiftSummary: string;

  // Simple forward-looking status using 2024 + trend direction (heuristic)
  status2028: {
    party: Party;
    rating: LeanRating;
    note: string;
  };

  votes: {
    y2016: CycleVotes;
    y2020: CycleVotes;
    y2024: CycleVotes;
  };
};

function partyFromMargin(rMargin: number): Party {
  return rMargin >= 0 ? "R" : "D";
}

function ratingFromMarginAbs(abs: number): LeanRating {
  if (abs < 1) return "TOSSUP";
  if (abs < 2) return "TILT";
  if (abs < 6) return "LEAN";
  if (abs < 12) return "LIKELY";
  return "SAFE";
}

function classify(rMargin: number): { party: Party; rating: LeanRating } {
  return { party: partyFromMargin(rMargin), rating: ratingFromMarginAbs(Math.abs(rMargin)) };
}

/**
 * 2028 projection heuristic:
 * - Start from 2024 classification
 * - If trend is strongly opposite (>=6 pts), soften one step toward TOSSUP
 * - If trend is very strong (>=10 pts), soften two steps
 */
function shiftRatingTowardTossup(rating: LeanRating, steps: number): LeanRating {
  const order: LeanRating[] = ["SAFE", "LIKELY", "LEAN", "TILT", "TOSSUP"];
  let idx = order.indexOf(rating);
  idx = Math.min(order.length - 1, idx + steps);
  return order[idx];
}

function project2028(y2024: number, trend: number) {
  const base = classify(y2024);

  let steps = 0;
  if (Math.abs(trend) >= 10) steps = 2;
  else if (Math.abs(trend) >= 6) steps = 1;

  const trendDirection = trend > 0 ? "R-trending" : trend < 0 ? "D-trending" : "stable";
  const note =
    trendDirection === "stable"
      ? "Stable relative to 2012 baseline."
      : `${trendDirection} since 2012; projection nudges competitiveness by ${steps} step(s).`;

  const againstWinner = (base.party === "R" && trend < 0) || (base.party === "D" && trend > 0);
  const rating = againstWinner ? shiftRatingTowardTossup(base.rating, steps) : base.rating;

  return { party: base.party, rating, note };
}

function shiftSummary(name: string, y2012: number, y2024: number) {
  const trend = +(y2024 - y2012).toFixed(2);
  const dir = trend > 0 ? "right" : trend < 0 ? "left" : "not materially";
  const magnitude =
    Math.abs(trend) >= 10
      ? "dramatically"
      : Math.abs(trend) >= 6
      ? "clearly"
      : Math.abs(trend) >= 3
      ? "moderately"
      : "slightly";

  const from = classify(y2012);
  const to = classify(y2024);

  const fromStr = `${from.party}${from.party === "R" ? "+" : ""}${y2012.toFixed(2)}`;
  const toStr = `${to.party}${to.party === "R" ? "+" : ""}${y2024.toFixed(2)}`;

  return `${name} shifted ${magnitude} ${dir} from 2012→2024 (trend ${trend > 0 ? "+" : ""}${trend} pts), moving from ${fromStr} to ${toStr}.`;
}

function makeVotes(r: number, d: number, total: number): CycleVotes {
  const third = total - r - d;
  return { r, d, third, total };
}

/* =========================
   2012 R margins (Romney - Obama)
   ========================= */
const Y2012_R_MARGIN: Record<string, number> = {
  AL: 22.19, AK: 13.99, AZ: 9.06,  AR: 23.69, CA: -23.12,
  CO: -5.36, CT: -17.33, DE: -18.63, FL: -0.88, GA: 7.82,
  HI: -42.71, ID: 31.69, IL: -16.87, IN: 10.20, IA: -5.81,
  KS: 21.72, KY: 22.69, LA: 17.20, ME: -15.29, MD: -26.07,
  MA: -23.14, MI: -9.50, MN: -7.69, MS: 11.50, MO: 9.38,
  MT: 13.65, NE: 21.77, NV: -6.68, NH: -5.58, NJ: -17.79,
  NM: -10.15, NY: -28.18, NC: 2.04,  ND: 19.63, OH: -2.98,
  OK: 33.54, OR: -12.09, PA: -5.38, RI: -27.46, SC: 10.47,
  SD: 18.02, TN: 20.40, TX: 15.79, UT: 48.04, VT: -35.60,
  VA: -3.88, WA: -14.87, WV: 26.76, WI: -6.94, WY: 40.82,
};

/* =========================
   2016 R margins (Trump - Clinton) from your 2016 table
   ========================= */
const Y2016_R_MARGIN: Record<string, number> = {
  AL: 27.72, AK: 14.73, AZ: 3.54,  AR: 26.92, CA: -30.11,
  CO: -4.91, CT: -13.64, DE: -11.38, FL: 1.20,  GA: 5.13,
  HI: -32.18, ID: 31.77, IL: -17.07, IN: 19.17, IA: 9.41,
  KS: 20.60, KY: 29.84, LA: 19.64, ME: -2.96, MD: -26.42,
  MA: -27.20, MI: 0.23,  MN: -1.52, MS: 17.83, MO: 18.63,
  MT: 20.42, NE: 25.05, NV: -2.42, NH: -0.37, NJ: -14.10,
  NM: -8.22, NY: -22.49, NC: 3.66,  ND: 35.73, OH: 8.13,
  OK: 36.39, OR: -10.98, PA: 0.72,  RI: -15.51, SC: 14.27,
  SD: 29.79, TN: 26.00, TX: 8.99,  UT: 18.08, VT: -26.41,
  VA: -5.32, WA: -15.71, WV: 42.07, WI: 0.77,  WY: 46.29,
};

/* =========================
   2020 R margins (Trump - Biden)
   Your 2020 table margin is D margin (Biden - Trump), so:
   R margin = -(that margin)
   ========================= */
const Y2020_R_MARGIN: Record<string, number> = {
  AL: 25.46, AK: 10.06, AZ: -0.31, AR: 27.62, CA: -29.16,
  CO: -13.50, CT: -20.07, DE: -18.97, FL: 3.36,  GA: -0.23,
  HI: -29.46, ID: 30.77, IL: -16.99, IN: 16.07, IA: 8.20,
  KS: 14.64, KY: 25.94, LA: 18.61, ME: -9.07, MD: -33.21,
  MA: -33.46, MI: -2.78, MN: -7.11, MS: 16.55, MO: 15.39,
  MT: 16.37, NE: 19.06, NV: -2.39, NH: -7.35, NJ: -15.93,
  NM: -10.79, NY: -23.13, NC: 1.35,  ND: 33.34, OH: 8.03,
  OK: 33.09, OR: -16.09, PA: -1.16, RI: -20.78, SC: 11.68,
  SD: 26.16, TN: 23.21, TX: 5.58,  UT: 20.48, VT: -35.41,
  VA: -10.11, WA: -19.20, WV: 38.93, WI: -1.40, WY: 43.38,
};

/* =========================
   2024 R margins (Trump - Harris) from your 2024 table
   ========================= */
const Y2024_R_MARGIN: Record<string, number> = {
  AL: 30.47, AK: 13.13, AZ: 5.53,  AR: 30.64, CA: -20.14,
  CO: -10.99, CT: -14.51, DE: -14.70, FL: 13.10, GA: 2.19,
  HI: -23.11, ID: 36.49, IL: -10.90, IN: 18.96, IA: 13.21,
  KS: 16.12, KY: 30.53, LA: 22.01, ME: -6.94, MD: -28.54,
  MA: -25.20, MI: 1.42,  MN: -4.24, MS: 22.89, MO: 18.41,
  MT: 19.93, NE: 20.46, NV: 3.10,  NH: -2.78, NJ: -5.91,
  NM: -6.00, NY: -12.60, NC: 3.21,  ND: 36.45, OH: 11.21,
  OK: 34.26, OR: -14.30, PA: 1.71,  RI: -13.78, SC: 17.87,
  SD: 29.19, TN: 29.72, TX: 13.68, UT: 21.59, VT: -31.51,
  VA: -5.78, WA: -18.22, WV: 41.87, WI: 0.86,  WY: 45.76,
};

/* =========================
   Votes (from your pasted tables)
   - 2016: r=Trump, d=Clinton, total=Total votes
   - 2020: r=Trump, d=Biden, total=Total votes
   - 2024: r=Trump, d=Harris, total=Total votes
   ========================= */
const VOTES_2016: Record<string, CycleVotes> = {
  AL: makeVotes(1318255, 729547, 2123372),
  AK: makeVotes(163387, 116454, 318608),
  AZ: makeVotes(1252401, 1161167, 2573165),
  AR: makeVotes(684872, 380494, 1130676),
  CA: makeVotes(4483810, 8753788, 14181595),
  CO: makeVotes(1202484, 1338870, 2780247),
  CT: makeVotes(673215, 897572, 1644920),
  DE: makeVotes(185127, 235603, 443814),
  FL: makeVotes(4617886, 4504975, 9420039),
  GA: makeVotes(2089104, 1877963, 4114732),
  HI: makeVotes(128847, 266891, 428937),
  ID: makeVotes(409055, 189765, 690255),
  IL: makeVotes(2146015, 3090729, 5536424),
  IN: makeVotes(1557286, 1033126, 2734958),
  IA: makeVotes(800983, 653669, 1566031),
  KS: makeVotes(671018, 427005, 1184402),
  KY: makeVotes(1202971, 628854, 1924149),
  LA: makeVotes(1178638, 780154, 2029032),
  ME: makeVotes(335593, 357735, 747927),
  MD: makeVotes(943169, 1677928, 2781446),
  MA: makeVotes(1090893, 1995196, 3325046),
  MI: makeVotes(2279543, 2268839, 4799284),
  MN: makeVotes(1322951, 1367716, 2944813),
  MS: makeVotes(700714, 485131, 1209357),
  MO: makeVotes(1594511, 1071068, 2808605),
  MT: makeVotes(279240, 177709, 497147),
  NE: makeVotes(495961, 284494, 844227),
  NV: makeVotes(512058, 539260, 1125385),
  NH: makeVotes(345790, 348526, 744296),
  NJ: makeVotes(1601933, 2148278, 3874046),
  NM: makeVotes(319667, 385234, 798319),
  NY: makeVotes(2819534, 4556124, 7721453),
  NC: makeVotes(2362631, 2189316, 4741564),
  ND: makeVotes(216794, 93758, 344360),
  OH: makeVotes(2841005, 2394164, 5496487),
  OK: makeVotes(949136, 420375, 1452992),
  OR: makeVotes(782403, 1002106, 2001336),
  PA: makeVotes(2970733, 2926441, 6165478),
  RI: makeVotes(180543, 252525, 464144),
  SC: makeVotes(1155389, 855373, 2103027),
  SD: makeVotes(227721, 117458, 370093),
  TN: makeVotes(1522925, 870695, 2508027),
  TX: makeVotes(4685047, 3877868, 8969226),
  UT: makeVotes(515231, 310676, 1131430),
  VT: makeVotes(95369, 178573, 315067),
  VA: makeVotes(1769443, 1981473, 3984631),
  WA: makeVotes(1221747, 1742718, 3317019),
  WV: makeVotes(489371, 188794, 714423),
  WI: makeVotes(1405284, 1382536, 2976150),
  WY: makeVotes(174419, 55973, 255849),
};

const VOTES_2020: Record<string, CycleVotes> = {
  AL: makeVotes(1441170, 849624, 2323282),
  AK: makeVotes(189951, 153778, 359530),
  AZ: makeVotes(1661686, 1672143, 3387326),
  AR: makeVotes(760647, 423932, 1219069),
  CA: makeVotes(6006518, 11110639, 17501380),
  CO: makeVotes(1364607, 1804352, 3256980),
  CT: makeVotes(714717, 1080831, 1823857),
  DE: makeVotes(200603, 296268, 504346),
  FL: makeVotes(5668731, 5297045, 11067456),
  GA: makeVotes(2461854, 2473633, 4999960),
  HI: makeVotes(196864, 366130, 574469),
  ID: makeVotes(554119, 287021, 867934),
  IL: makeVotes(2446891, 3471915, 6033744),
  IN: makeVotes(1729857, 1242498, 3033210),
  IA: makeVotes(897672, 759061, 1690871),
  KS: makeVotes(771406, 570323, 1373986),
  KY: makeVotes(1326646, 772474, 2136768),
  LA: makeVotes(1255776, 856034, 2148062),
  ME: makeVotes(360737, 435072, 819461),
  MD: makeVotes(976414, 1985023, 3037030),
  MA: makeVotes(1167202, 2382202, 3631402),
  MI: makeVotes(2649852, 2804040, 5539302),
  MN: makeVotes(1484065, 1717077, 3277171),
  MS: makeVotes(756764, 539398, 1313759),
  MO: makeVotes(1718736, 1253014, 3025962),
  MT: makeVotes(343602, 244786, 603674),
  NE: makeVotes(556846, 374583, 956383),
  NV: makeVotes(669890, 703486, 1405376),
  NH: makeVotes(365660, 424937, 806205),
  NJ: makeVotes(1883313, 2608400, 4549457),
  NM: makeVotes(401894, 501614, 923965),
  NY: makeVotes(3251997, 5244886, 8616861),
  NC: makeVotes(2758775, 2684292, 5524804),
  ND: makeVotes(235751, 115042, 362024),
  OH: makeVotes(3154834, 2679165, 5922202),
  OK: makeVotes(1020280, 503890, 1560699),
  OR: makeVotes(958448, 1340383, 2374321),
  PA: makeVotes(3377674, 3458229, 6936976),
  RI: makeVotes(199922, 307486, 517757),
  SC: makeVotes(1385103, 1091541, 2513329),
  SD: makeVotes(261043, 150471, 422609),
  TN: makeVotes(1852475, 1143711, 3053851),
  TX: makeVotes(5890347, 5259126, 11315056),
  UT: makeVotes(865140, 560282, 1488289),
  VT: makeVotes(112704, 242820, 367428),
  VA: makeVotes(1962430, 2413568, 4460524),
  WA: makeVotes(1584651, 2369612, 4087631),
  WV: makeVotes(545382, 235984, 794731),
  WI: makeVotes(1610184, 1630866, 3298041),
  WY: makeVotes(193559, 73491, 276765),
};

const VOTES_2024: Record<string, CycleVotes> = {
  AL: makeVotes(1462616, 772412, 2265090),
  AK: makeVotes(184458, 140026, 338177),
  AZ: makeVotes(1770242, 1582860, 3390161),
  AR: makeVotes(759241, 396905, 1182676),
  CA: makeVotes(6081697, 9276179, 15865475),
  CO: makeVotes(1377441, 1728159, 3192745),
  CT: makeVotes(736918, 992053, 1759010),
  DE: makeVotes(214351, 289758, 512912),
  FL: makeVotes(6110125, 4683038, 10893752),
  GA: makeVotes(2663117, 2548017, 5250905),
  HI: makeVotes(193661, 313044, 516701),
  ID: makeVotes(605246, 274972, 905057),
  IL: makeVotes(2449079, 3062863, 5633310),
  IN: makeVotes(1720347, 1163603, 2936677),
  IA: makeVotes(927019, 707278, 1663506),
  KS: makeVotes(758802, 544853, 1327591),
  KY: makeVotes(1337494, 704043, 2074530),
  LA: makeVotes(1208505, 766870, 2006975),
  ME: makeVotes(377977, 435652, 831375),
  MD: makeVotes(1035550, 1902577, 3038334),
  MA: makeVotes(1251303, 2126518, 3473668),
  MI: makeVotes(2816636, 2736533, 5664186),
  MN: makeVotes(1519032, 1656979, 3253920),
  MS: makeVotes(747744, 466668, 1228008),
  MO: makeVotes(1751986, 1200599, 2995327),
  MT: makeVotes(352079, 231906, 602990),
  NE: makeVotes(564816, 369995, 952182),
  NV: makeVotes(751205, 705197, 1484840),
  NH: makeVotes(395523, 418488, 826189),
  NJ: makeVotes(1968215, 2220713, 4272725),
  NM: makeVotes(423391, 478802, 923403),
  NY: makeVotes(3578899, 4619195, 8262495),
  NC: makeVotes(2898423, 2715375, 5699141),
  ND: makeVotes(246505, 112327, 368155),
  OH: makeVotes(3180116, 2533699, 5767788),
  OK: makeVotes(1036213, 499599, 1566173),
  OR: makeVotes(919480, 1240600, 2244493),
  PA: makeVotes(3543308, 3423042, 7058732),
  RI: makeVotes(214406, 285156, 513386),
  SC: makeVotes(1483747, 1028452, 2548140),
  SD: makeVotes(272081, 146859, 428922),
  TN: makeVotes(1966865, 1056265, 3063942),
  TX: makeVotes(6393597, 4835250, 11388674),
  UT: makeVotes(883818, 562566, 1488494),
  VT: makeVotes(119395, 235791, 369422),
  VA: makeVotes(2075085, 2335395, 4505941),
  WA: makeVotes(1530923, 2245849, 3924243),
  WV: makeVotes(533556, 214309, 762582),
  WI: makeVotes(1697626, 1668229, 3422918),
  WY: makeVotes(192633, 69527, 269048),
};

/* =========================
   State list (50 states only)
   ========================= */
const STATES: Array<{ abbr: string; name: string }> = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

export const PAST_DATA: StatePast[] = STATES.map(({ abbr, name }) => {
  const y2012 = Y2012_R_MARGIN[abbr];
  const y2016 = Y2016_R_MARGIN[abbr];
  const y2020 = Y2020_R_MARGIN[abbr];
  const y2024 = Y2024_R_MARGIN[abbr];

  const trend = +(y2024 - y2012).toFixed(2);
  const lean2024 = classify(y2024);
  const status2028 = project2028(y2024, trend);

  return {
    abbr,
    name,
    margins: { y2012, y2016, y2020, y2024 },
    trend_2012_to_2024: trend,
    lean2024,
    shiftSummary: shiftSummary(name, y2012, y2024),
    status2028,
    votes: {
      y2016: VOTES_2016[abbr],
      y2020: VOTES_2020[abbr],
      y2024: VOTES_2024[abbr],
    },
  };
});

export const PAST_DATA_BY_STATE: Record<string, StatePast> = Object.fromEntries(
  PAST_DATA.map((s) => [s.abbr, s])
);
