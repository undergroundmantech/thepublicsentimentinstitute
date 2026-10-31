// Oct 31 2026: how each real person in the game looks, so a portrait reads as that person and not a random face.
// Skin runs 0 (fairest) to 7 (deepest). Fictional characters get a look from their name, so a Keisha or a Priya
// is drawn as a woman with a fitting complexion instead of a coin flip.

export const SKIN = ["#fbe0c8", "#f3c9a6", "#e5b48e", "#cf9a6c", "#b17a4e", "#8e5a35", "#6c4127", "#4b2c1b"];
export const HC = {
  blk: "#1b1b1b", dk: "#3b2a1a", br: "#6b4423", lbr: "#8a6040", aub: "#a0522d", red: "#b5562a", bld: "#d9b26b", lbld: "#ead08a",
  salt: "#6e6a66", gry: "#9e9e9e", slv: "#c8c8c8", wht: "#ece8e0", tr: "#e8c25e",
} as const;

export type Style = "short" | "side" | "swoop" | "slick" | "buzz" | "bald" | "balding" | "curly" | "wavy" | "long" | "shoulder" | "bob" | "pulled" | "pixie" | "locs" | "afro";
export type Beard = "full" | "short" | "goatee" | "stache" | "stubble";
export type Hat = "cap" | "kippah" | "cowboy";
export type Look = { sk: number; hc: string; st: Style; f: boolean; gl?: boolean; bd?: Beard; bc?: string; hat?: Hat; hatC?: string };

const m = (sk: number, hc: string, st: Style, x: Partial<Look> = {}): Look => ({ sk, hc, st, f: false, ...x });
const w = (sk: number, hc: string, st: Style, x: Partial<Look> = {}): Look => ({ sk, hc, st, f: true, ...x });

/** Every candidate in the game, and every real person who can endorse or campaign with you. */
const REAL: [string[], Look][] = [
  // Senate
  [["Abdul El-Sayed"], m(4, HC.blk, "short", { bd: "short" })],
  [["Mike Rogers"], m(1, HC.slv, "side")],
  [["Josh Turek"], m(1, HC.br, "short")],
  [["Ashley Hinson"], w(1, HC.bld, "shoulder")],
  [["Sherrod Brown"], m(1, HC.gry, "curly")],
  [["Jon Husted"], m(1, HC.slv, "side")],
  [["James Talarico"], m(1, HC.dk, "wavy")],
  [["Ken Paxton"], m(1, HC.salt, "side")],
  [["Jon Ossoff"], m(1, HC.dk, "side")],
  [["Mike Collins"], m(1, HC.br, "short")],
  [["Roy Cooper"], m(1, HC.wht, "side")],
  [["Michael Whatley"], m(1, HC.salt, "side")],
  [["Dan Osborn"], m(1, HC.br, "short", { bd: "short" })],
  [["Pete Ricketts"], m(1, HC.br, "balding")],
  [["Annie Andrews"], w(1, HC.lbr, "long")],
  [["Darline Graham"], w(1, HC.slv, "bob")],
  [["Adam Hamilton"], m(1, HC.wht, "side")],
  [["Roger Marshall"], m(1, HC.gry, "balding")],
  [["Mary Peltola"], w(3, HC.blk, "long")],
  [["Dan S. Sullivan", "Dan Sullivan"], m(1, HC.salt, "side")],
  [["Troy Jackson"], m(1, HC.salt, "short", { bd: "goatee" })],
  [["Susan Collins"], w(1, HC.br, "bob")],
  [["Chris Pappas"], m(1, HC.dk, "short")],
  [["John E. Sununu", "John Sununu"], m(1, HC.dk, "balding")],
  [["Peggy Flanagan"], w(3, HC.blk, "long")],
  [["Michele Tafoya"], w(1, HC.lbld, "long")],
  [["Scott Colom"], m(4, HC.blk, "buzz")],
  [["Cindy Hyde-Smith"], w(1, HC.bld, "bob")],
  [["Angie Nixon"], w(6, HC.blk, "locs")],
  [["Ashley Moody"], w(1, HC.lbld, "long")],
  [["Charles Booker"], m(6, HC.blk, "buzz", { bd: "short" })],
  [["Andy Barr"], m(1, HC.br, "side")],
  [["Everett Wess"], m(6, HC.gry, "buzz", { bd: "stache" })],
  [["Barry Moore"], m(1, HC.gry, "short")],
  [["Hallie Shoffner"], w(1, HC.bld, "long")],
  [["Tom Cotton"], m(1, HC.br, "balding")],
  [["Jamie Davis"], m(6, HC.blk, "buzz", { hat: "cap", hatC: "#3d4a5a" })],
  [["Julia Letlow"], w(1, HC.br, "long")],
  [["Brian Bengs"], m(1, HC.br, "buzz", { bd: "stubble" })],
  [["Mike Rounds"], m(1, HC.wht, "side")],
  // Governors
  [["Jocelyn Benson"], w(1, HC.br, "shoulder")],
  [["John James"], m(6, HC.blk, "buzz")],
  [["Amy Acton"], w(1, HC.br, "pixie", { gl: true })],
  [["Vivek Ramaswamy"], m(4, HC.blk, "side")],
  [["Gina Hinojosa"], w(3, HC.dk, "long")],
  [["Greg Abbott"], m(1, HC.salt, "balding")],
  [["Keisha Lance Bottoms"], w(6, HC.blk, "bob")],
  [["Rick Jackson"], m(1, HC.wht, "side")],
  [["David Jolly"], m(1, HC.dk, "short")],
  [["Byron Donalds"], m(6, HC.blk, "bald")],
  [["Rob Sand"], m(1, HC.br, "short")],
  [["Zach Lahn"], m(1, HC.br, "short")],
  [["Cindy Holscher"], w(1, HC.bld, "shoulder")],
  [["Ty Masterson"], m(1, HC.gry, "short")],
  [["Hannah Pingree"], w(1, HC.br, "long")],
  [["Bobby Charles"], m(1, HC.salt, "side")],
  [["Amy Klobuchar"], w(1, HC.br, "bob")],
  [["Lisa Demuth"], w(1, HC.bld, "shoulder")],
  [["Aaron Ford"], m(6, HC.blk, "bald", { bd: "goatee" })],
  [["Joe Lombardo"], m(2, HC.gry, "buzz")],
  [["Katie Hobbs"], w(1, HC.dk, "shoulder", { gl: true })],
  [["Andy Biggs"], m(1, HC.slv, "balding")],
  [["Jermaine Johnson"], m(6, HC.blk, "buzz", { bd: "short" })],
  [["Alan Wilson"], m(1, HC.salt, "side")],
  [["Lynne Walz"], w(1, HC.slv, "pixie")],
  [["Jim Pillen"], m(1, HC.gry, "balding")],
  [["David Crowley"], m(6, HC.blk, "buzz", { bd: "full" })],
  [["Tom Tiffany"], m(1, HC.gry, "balding", { gl: true })],
  [["Deb Haaland"], w(4, HC.salt, "long")],
  [["Gregg Hull"], m(1, HC.gry, "buzz")],
  [["Tina Kotek"], w(1, HC.lbr, "pixie", { gl: true })],
  [["Christine Drazan"], w(1, HC.bld, "shoulder")],
  [["Doug Jones"], m(1, HC.wht, "side")],
  [["Tommy Tuberville"], m(1, HC.wht, "short")],
  [["Fredrick Love"], m(6, HC.blk, "bald", { bd: "goatee" })],
  [["Sarah Huckabee Sanders"], w(1, HC.dk, "long")],
  [["Jerri Green"], w(1, HC.bld, "shoulder")],
  [["Marsha Blackburn"], w(1, HC.lbld, "bob")],
  [["Cinde Warmington"], w(1, HC.lbld, "pixie")],
  [["Kelly Ayotte"], w(1, HC.br, "shoulder")],
  [["Cyndi Munson"], w(2, HC.blk, "long")],
  [["Mike Mazzei"], m(1, HC.salt, "short")],
  [["Jonathan Kreiss-Tomkins"], m(1, HC.lbr, "short")],
  [["Bernadette Wilson"], w(1, HC.bld, "long")],
  [["Helena Foulkes"], w(1, HC.bld, "shoulder")],
  [["Ken Block"], m(1, HC.gry, "bald")],
  [["Dan Ahlers"], m(1, HC.br, "balding", { gl: true })],
  [["Larry Rhoden"], m(1, HC.gry, "short", { hat: "cowboy", hatC: "#e9e0cc" })],
  [["Amanda Janoo"], w(2, HC.dk, "long")],
  [["Phil Scott"], m(1, HC.gry, "short")],
  // People who endorse or campaign with you
  [["Barack Obama"], m(5, HC.gry, "buzz")],
  [["Kamala Harris"], w(4, HC.dk, "shoulder")],
  [["Donald Trump"], m(2, HC.tr, "swoop")],
  [["Vice President JD Vance", "JD Vance"], m(1, HC.dk, "side", { bd: "full" })],
  [["Bernie Sanders"], m(1, HC.wht, "balding", { gl: true })],
  [["Rep. Alexandria Ocasio-Cortez", "Alexandria Ocasio-Cortez"], w(3, HC.dk, "long")],
  [["Becca Balint"], w(1, HC.dk, "pixie", { gl: true })],
  [["Peter Welch"], m(1, HC.wht, "side")],
  [["Ron DeSantis"], m(1, HC.dk, "short")],
  [["Gov. Brian Kemp", "Brian Kemp"], m(1, HC.gry, "side")],
  [["Gov. Jeff Landry", "Jeff Landry"], m(1, HC.salt, "side")],
  [["Gov. Laura Kelly", "Laura Kelly"], w(1, HC.lbld, "pixie")],
  [["Gov. Mike DeWine", "Mike DeWine"], m(1, HC.wht, "side")],
  [["Former Sen. Joe Manchin", "Joe Manchin"], m(1, HC.wht, "side")],
  [["Former Sen. Jon Tester", "Jon Tester"], m(1, HC.salt, "buzz")],
  [["Former Sen. Tom Brewer", "Tom Brewer"], m(4, HC.gry, "short")],
  [["Sen. Joni Ernst campaigned with Hinson", "Joni Ernst"], w(1, HC.bld, "pixie")],
  [["Sen. Tammy Baldwin campaigned with Crowley", "Tammy Baldwin"], w(1, HC.slv, "pixie")],
  [["Senate Majority Leader John Thune campaigned for Graham", "John Thune"], m(1, HC.gry, "side")],
  [["Rep. Haley Stevens", "Haley Stevens"], w(1, HC.bld, "shoulder")],
  [["Michael Bloomberg, at least 1 million dollars", "Michael Bloomberg"], m(1, HC.gry, "balding")],
  [["Rabbi Asher Lopatin"], m(1, HC.salt, "short", { bd: "full", gl: true, hat: "kippah", hatC: "#1d2a4a" })],
  [["Don Bolduc, former GOP Senate nominee", "Don Bolduc"], m(1, HC.gry, "bald", { bd: "full" })],
  [["Clark County DA Steve Wolfson"], m(1, HC.gry, "side")],
  [["Former Gov. Bill Graves, a Republican"], m(1, HC.wht, "side")],
  [["Former Gov. Mike Hayden, a Republican"], m(1, HC.wht, "balding", { gl: true })],
  [["Former GOP Sen. John Stinner"], m(1, HC.gry, "balding")],
  [["Former GOP Sen. Mark Kolterman"], m(1, HC.gry, "short")],
  [["Arch Naramore, Marshall's GOP primary opponent"], m(1, HC.gry, "short", { gl: true })],
  [["David Maxwell, former Paxton aide"], m(1, HC.salt, "short")],
  [["Elaine Pelino, former GOP primary candidate"], w(1, HC.bld, "shoulder")],
  [["Former Aiken County Council member Scott Singer, a Republican"], m(1, HC.salt, "short")],
  [["Nick Albares, former Democratic primary candidate"], m(1, HC.dk, "short")],
  [["Valdosta Mayor Scott James Matheson"], m(1, HC.br, "short")],
  [["Chugach Alaska Corp. board chair Sheri Buretta"], w(3, HC.dk, "shoulder")],
  [["Penobscot, Maliseet, Mi'kmaq and Passamaquoddy chiefs"], m(4, HC.salt, "long")],
];

// Fictional names. Gender from the first name; complexion from whichever name says the most about heritage.
const FEM = new Set(["Dana", "Linda", "Teresa", "Priya", "Carol", "Mei", "Rosa", "Janelle", "Keisha", "Ana", "Gloria", "Becky"]);
const HERITAGE: Record<string, [number, number]> = {
  Priya: [3, 5], Mei: [1, 2], Luis: [2, 4], Rosa: [2, 4], Ana: [2, 4], Gloria: [2, 5], Teresa: [1, 4], Omar: [3, 5],
  Darnell: [5, 7], Dwayne: [5, 7], Keisha: [5, 7], Janelle: [4, 7], Marcus: [1, 7],
  Nguyen: [1, 2], Okafor: [6, 7], Ortega: [2, 4], Reyes: [2, 4], Castillo: [2, 4], Delgado: [2, 4], Soto: [2, 4],
  Banks: [1, 6], Kowalski: [0, 1], Lindqvist: [0, 1], Yoder: [0, 1], McAllister: [0, 1], Mahoney: [0, 1], Brandt: [0, 1],
};
const SPECIFIC_FIRST = new Set(["Priya", "Mei", "Luis", "Rosa", "Ana", "Omar", "Darnell", "Dwayne", "Keisha"]);
function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** A believable look for a made up name. */
export function lookFromName(name: string, seed = hash(name)): Look {
  const R = rng(seed ^ 0x9e3779b9);
  const [first, ...rest] = name.trim().split(/\s+/); const last = rest.at(-1) ?? "";
  const f = FEM.has(first);
  const range = (SPECIFIC_FIRST.has(first) && HERITAGE[first]) || HERITAGE[last] || HERITAGE[first] || [0, 5];
  const sk = range[0] + Math.floor(R() * (range[1] - range[0] + 1));
  const dark = sk >= 3;
  const eastAsian = first === "Mei" || last === "Nguyen";
  const age = R();
  const hc = age > 0.8 ? (R() < 0.5 ? HC.gry : HC.slv) : dark || eastAsian ? (R() < 0.7 ? HC.blk : HC.dk)
    : [HC.dk, HC.br, HC.lbr, HC.bld, HC.aub, HC.blk][Math.floor(R() * 6)];
  const st: Style = f
    ? (sk >= 5 ? (["locs", "bob", "shoulder", "afro", "pulled"] as Style[]) : (["long", "shoulder", "bob", "pulled", "pixie"] as Style[]))[Math.floor(R() * 5)]
    : (sk >= 5 ? (["buzz", "bald", "buzz", "short"] as Style[]) : age > 0.75 ? (["balding", "side", "bald", "short"] as Style[]) : (["short", "side", "wavy", "buzz", "slick"] as Style[]))[Math.floor(R() * 4)];
  const bd: Beard | undefined = !f && R() < 0.3 ? (["full", "short", "goatee", "stache", "stubble"] as Beard[])[Math.floor(R() * 5)] : undefined;
  return { sk, hc, st, f, bd, gl: R() < 0.2 };
}

const FIRST = ["Dana", "Marcus", "Linda", "Ray", "Teresa", "Hank", "Priya", "Luis", "Carol", "Dwayne", "Mei", "Frank", "Rosa", "Earl", "Janelle", "Bud", "Keisha", "Tom", "Ana", "Walt", "Gloria", "Darnell", "Becky", "Omar"];
const LAST = ["Hollister", "Ortega", "Banks", "Kowalski", "Nguyen", "Whitfield", "Reyes", "Lindqvist", "Okafor", "McAllister", "Brandt", "Castillo", "Pruitt", "Yoder", "Delgado", "Haskins", "Albright", "Soto", "Fairbanks", "Mahoney"];

let TABLE: Map<number, Look> | null = null;
const EXTRA = new Map<number, Look>();
function table() {
  if (TABLE) return TABLE;
  TABLE = new Map();
  for (const f of FIRST) for (const l of LAST) { const n = `${f} ${l}`; TABLE.set(hash(n), lookFromName(n)); }
  for (const [names, look] of REAL) for (const n of names) TABLE.set(hash(n), look);
  return TABLE;
}
/** Tie a look to a seed that is not the hash of the name, such as a campaign manager's. */
export function registerLook(seed: number, name: string) { if (!EXTRA.has(seed)) EXTRA.set(seed, table().get(hash(name)) ?? lookFromName(name)); }
export function lookOf(seed: number): Look | null { return EXTRA.get(seed) ?? table().get(seed) ?? null; }
/** The real people with a look on file, for checks. */
export const REAL_NAMES = REAL.map(([n]) => n[0]);
