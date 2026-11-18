// Cartoon looks for every member of the caucus. Each portrait is drawn from a handful of traits in Toon.tsx, in the
// tracker's own two tone style: faces take a tint of the side the senator is projected to back, so the whole room
// reads at a glance. These are friendly caricatures, not photographs.

export type Hair = "bald" | "balding" | "short" | "side" | "swoop" | "buzz" | "wild" | "bob" | "long" | "pixie" | "curly" | "updo";
export type Shade = "white" | "silver" | "gray" | "salt" | "dark" | "brown" | "auburn" | "blond" | "black" | "red";
export type Look = {
  hair: Hair; shade: Shade;
  glasses?: "rect" | "round" | "half";
  face?: "beard" | "goatee" | "stache" | "walrus" | "stubble";
  fem?: boolean;
  top?: "suit" | "hoodie" | "open";
  jaw?: number;      // 0.9 narrow to 1.15 wide
  mouth?: "smile" | "grin" | "flat" | "smirk";
  brows?: "heavy";
};

export const LOOK: Record<string, Look> = {
  "Chuck Schumer":         { hair: "balding", shade: "gray", glasses: "half", mouth: "grin", jaw: 1.05 },
  "Chris Van Hollen":      { hair: "side", shade: "silver", mouth: "smile", jaw: 1 },
  "Kirsten Gillibrand":    { hair: "bob", shade: "blond", fem: true, mouth: "grin" },
  "John Fetterman":        { hair: "bald", shade: "dark", face: "goatee", top: "hoodie", jaw: 1.15, mouth: "flat", brows: "heavy" },
  "Ruben Gallego":         { hair: "short", shade: "black", face: "stubble", mouth: "grin" },
  "Mark Kelly":            { hair: "bald", shade: "gray", face: "stache", mouth: "smile", jaw: 1.05 },
  "Richard Blumenthal":    { hair: "side", shade: "white", mouth: "flat", jaw: 0.95 },
  "Sherrod Brown":         { hair: "swoop", shade: "gray", mouth: "smirk", jaw: 1.08, brows: "heavy" },
  "Angus King":            { hair: "bald", shade: "white", face: "walrus", mouth: "smile", jaw: 1.05 },
  "Sheldon Whitehouse":    { hair: "side", shade: "silver", mouth: "smile" },
  "Tammy Baldwin":         { hair: "pixie", shade: "silver", fem: true, mouth: "smile" },
  "Angela Alsobrooks":     { hair: "pixie", shade: "black", fem: true, mouth: "grin" },
  "Brian Schatz":          { hair: "short", shade: "salt", glasses: "rect", mouth: "smirk" },
  "Catherine Cortez Masto":{ hair: "bob", shade: "dark", fem: true, mouth: "smile" },
  "Josh Turek":            { hair: "short", shade: "brown", mouth: "grin" },
  "Roy Cooper":            { hair: "side", shade: "gray", mouth: "smile", jaw: 1.02 },
  "Ben Ray Luján":         { hair: "side", shade: "black", mouth: "smile" },
  "Tim Kaine":             { hair: "side", shade: "gray", mouth: "grin" },
  "Adam Schiff":           { hair: "side", shade: "dark", mouth: "flat", jaw: 0.95 },
  "Amy Klobuchar":         { hair: "bob", shade: "brown", fem: true, mouth: "grin" },
  "Jacky Rosen":           { hair: "long", shade: "blond", fem: true, mouth: "smile" },
  "Jack Reed":             { hair: "balding", shade: "gray", glasses: "rect", mouth: "flat" },
  "Chris Coons":           { hair: "short", shade: "salt", mouth: "smile", jaw: 1.02 },
  "Patty Murray":          { hair: "bob", shade: "brown", fem: true, glasses: "rect", mouth: "smile" },
  "Maria Cantwell":        { hair: "bob", shade: "dark", fem: true, mouth: "flat" },
  "Mark Warner":           { hair: "side", shade: "gray", mouth: "smile", jaw: 1.05 },
  "Jon Ossoff":            { hair: "swoop", shade: "dark", mouth: "smirk", jaw: 0.95 },
  "Lisa Blunt Rochester":  { hair: "curly", shade: "black", fem: true, mouth: "grin" },
  "Mary Peltola, if seated":{ hair: "long", shade: "black", fem: true, mouth: "grin" },
  "Alex Padilla":          { hair: "side", shade: "black", mouth: "smile" },
  "John Hickenlooper":     { hair: "balding", shade: "salt", glasses: "rect", mouth: "grin" },
  "Mazie Hirono":          { hair: "bob", shade: "black", fem: true, glasses: "rect", mouth: "flat" },
  "Tammy Duckworth":       { hair: "bob", shade: "black", fem: true, mouth: "smile" },
  "Maggie Hassan":         { hair: "bob", shade: "brown", fem: true, mouth: "smile" },
  "Raphael Warnock":       { hair: "buzz", shade: "black", face: "stache", mouth: "grin" },
  "Scott Colom":           { hair: "buzz", shade: "black", face: "stubble", mouth: "smile" },
  "Ron Wyden":             { hair: "balding", shade: "gray", mouth: "flat", jaw: 0.95 },
  "Andy Kim":              { hair: "side", shade: "black", mouth: "smile" },
  "Cory Booker":           { hair: "bald", shade: "black", face: "beard", mouth: "grin", jaw: 1.08 },
  "Michael Bennet":        { hair: "swoop", shade: "salt", mouth: "flat" },
  "Bernie Sanders":        { hair: "wild", shade: "white", glasses: "round", mouth: "flat", brows: "heavy" },
  "Abdul El-Sayed":        { hair: "short", shade: "black", face: "beard", mouth: "grin" },
  "Peggy Flanagan":        { hair: "long", shade: "dark", fem: true, mouth: "grin" },
  "Juliana Stratton":      { hair: "curly", shade: "dark", fem: true, mouth: "grin" },
  "Troy Jackson":          { hair: "short", shade: "salt", face: "beard", top: "open", mouth: "smile", jaw: 1.1 },
  "Adam Hamilton":         { hair: "short", shade: "brown", mouth: "smile" },
  "Annie Andrews":         { hair: "long", shade: "blond", fem: true, mouth: "grin" },
  "Elissa Slotkin":        { hair: "long", shade: "brown", fem: true, mouth: "smile" },
  "Peter Welch":           { hair: "side", shade: "white", glasses: "rect", mouth: "smile" },
  "Chris Pappas":          { hair: "short", shade: "dark", glasses: "rect", mouth: "smile" },
  "James Talarico":        { hair: "swoop", shade: "brown", mouth: "grin", jaw: 0.95 },
  "Elizabeth Warren":      { hair: "bob", shade: "blond", fem: true, glasses: "rect", mouth: "grin" },
  "Chris Murphy":          { hair: "side", shade: "salt", mouth: "smile" },
  "Ed Markey":             { hair: "swoop", shade: "auburn", mouth: "smile", jaw: 0.95 },
  "Jeff Merkley":          { hair: "short", shade: "silver", mouth: "smile" },
  "Martin Heinrich":       { hair: "side", shade: "brown", mouth: "smile" },
};

export const lookOf = (name: string): Look => LOOK[name] ?? { hair: "short", shade: "gray" };

// The 2028 presidential model names its candidates by their last name, as the model does. Anyone also in the Senate
// caucus above points to the same look, so a senator is the same cartoon on every page.
const SAME: Record<string, string> = {
  Kelly: "Mark Kelly", Booker: "Cory Booker", Ossoff: "Jon Ossoff", Talarico: "James Talarico", Warnock: "Raphael Warnock", Gallego: "Ruben Gallego",
  Murphy: "Chris Murphy", Cooper: "Roy Cooper", "El-Sayed": "Abdul El-Sayed", Brown: "Sherrod Brown", Klobuchar: "Amy Klobuchar", Warren: "Elizabeth Warren",
  Fetterman: "John Fetterman", "Van Hollen": "Chris Van Hollen", Slotkin: "Elissa Slotkin", Schumer: "Chuck Schumer",
};
export const LOOK28: Record<string, Look> = {
  Harris: { hair: "bob", shade: "dark", fem: true, mouth: "grin" },
  Newsom: { hair: "swoop", shade: "salt", mouth: "smile", jaw: 1.05 },
  Buttigieg: { hair: "side", shade: "dark", mouth: "smile", jaw: 0.95 },
  "Ocasio-Cortez": { hair: "long", shade: "dark", fem: true, mouth: "grin" },
  Shapiro: { hair: "side", shade: "dark", mouth: "smile", jaw: 1.02 },
  Beshear: { hair: "side", shade: "brown", mouth: "smile" },
  Pritzker: { hair: "balding", shade: "salt", glasses: "rect", mouth: "smile", jaw: 1.18 },
  Whitmer: { hair: "long", shade: "brown", fem: true, mouth: "grin" },
  Moore: { hair: "buzz", shade: "black", mouth: "smile", jaw: 1.05 },
  Crockett: { hair: "long", shade: "black", fem: true, mouth: "grin" },
  Walz: { hair: "short", shade: "white", glasses: "rect", mouth: "grin", jaw: 1.1 },
  Khanna: { hair: "side", shade: "black", mouth: "smile" },
  Cuban: { hair: "swoop", shade: "brown", mouth: "grin" },
  "Stephen A. Smith": { hair: "bald", shade: "black", face: "stache", mouth: "flat", brows: "heavy" },
  Hinojosa: { hair: "bob", shade: "brown", fem: true, mouth: "grin" },
  "Rob Sand": { hair: "short", shade: "brown", mouth: "grin" },
  Emanuel: { hair: "balding", shade: "gray", mouth: "flat", jaw: 0.95 },
  Polis: { hair: "short", shade: "brown", mouth: "smile" },
  "Bernie Sanders": LOOK["Bernie Sanders"],
  Stewart: { hair: "short", shade: "gray", face: "stubble", mouth: "smirk" },
  "Charles Barkley": { hair: "bald", shade: "silver", face: "goatee", mouth: "grin", jaw: 1.15 },
  "Don Lemon": { hair: "buzz", shade: "black", mouth: "smile" },
  "Brad Carson": { hair: "short", shade: "brown", mouth: "smile" },
  Vance: { hair: "side", shade: "brown", face: "beard", mouth: "smirk", jaw: 1.05 },
  Rubio: { hair: "side", shade: "black", mouth: "smile" },
  "Trump Jr.": { hair: "swoop", shade: "dark", face: "beard", mouth: "smirk" },
  DeSantis: { hair: "short", shade: "dark", mouth: "flat", jaw: 1.05 },
  "Kennedy Jr.": { hair: "swoop", shade: "gray", mouth: "smile", jaw: 0.95 },
  Cruz: { hair: "short", shade: "salt", face: "beard", mouth: "smirk" },
  Haley: { hair: "long", shade: "dark", fem: true, mouth: "smile" },
  Carlson: { hair: "swoop", shade: "salt", mouth: "smirk" },
  Massie: { hair: "short", shade: "gray", glasses: "rect", mouth: "flat" },
  Ramaswamy: { hair: "side", shade: "black", mouth: "grin" },
  Youngkin: { hair: "balding", shade: "gray", mouth: "grin", jaw: 1.05 },
  Kemp: { hair: "short", shade: "silver", mouth: "smile" },
  Greene: { hair: "long", shade: "blond", fem: true, mouth: "smirk" },
  Cotton: { hair: "side", shade: "brown", mouth: "flat", jaw: 0.95 },
  Hawley: { hair: "side", shade: "brown", mouth: "smile" },
  "Rand Paul": { hair: "curly", shade: "salt", mouth: "flat" },
  "Huckabee Sanders": { hair: "long", shade: "brown", fem: true, mouth: "smile" },
  Donalds: { hair: "buzz", shade: "black", glasses: "rect", mouth: "smile" },
  "Tim Scott": { hair: "bald", shade: "black", mouth: "grin" },
  Noem: { hair: "long", shade: "brown", fem: true, mouth: "grin" },
  Burgum: { hair: "balding", shade: "white", glasses: "rect", mouth: "smile" },
  Stefanik: { hair: "long", shade: "brown", fem: true, mouth: "smile" },
  Bannon: { hair: "swoop", shade: "gray", face: "stubble", top: "open", mouth: "flat", jaw: 1.1 },
  Pence: { hair: "side", shade: "white", mouth: "flat" },
  Abbott: { hair: "balding", shade: "gray", glasses: "rect", mouth: "smile" },
  "James Fishback": { hair: "side", shade: "brown", mouth: "smile", jaw: 0.95 },
  Greaney: { hair: "short", shade: "gray", glasses: "rect", mouth: "smile" },
  "Royce White": { hair: "bald", shade: "black", face: "beard", mouth: "flat", jaw: 1.1 },
  Bovino: { hair: "buzz", shade: "gray", mouth: "flat", jaw: 1.05 },
  Bacon: { hair: "balding", shade: "gray", mouth: "smile" },
  Christie: { hair: "balding", shade: "dark", mouth: "grin", jaw: 1.2 },
  "John Kennedy": { hair: "balding", shade: "white", glasses: "rect", mouth: "smirk" },
  McEntee: { hair: "short", shade: "brown", mouth: "smile" },
};
export const lookAny = (name: string): Look => LOOK[name] ?? LOOK[SAME[name] ?? ""] ?? LOOK28[name] ?? { hair: "short", shade: "gray" };
export const hasLook = (name: string) => !!(LOOK[name] || LOOK[SAME[name] ?? ""] || LOOK28[name]);
