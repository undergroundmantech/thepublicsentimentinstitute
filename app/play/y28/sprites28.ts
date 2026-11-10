// Campaign 2028 sprites, drawn at a higher resolution than the 2026 edition: a 40 by 40 portrait with three tone skin
// and hair shading, real eyes, a nose, lips, ears, a suit with lapels, a tie with a knot and a flag pin, and a 16 by
// 32 figure for the debate stage. Every face comes from the person's look in px/looks.ts, so a candidate is drawn the
// same way everywhere.
import { SKIN, HC, type Look } from "../px/looks";
import { lookFor, seedOf, partyCol } from "../px/sprites";

type Grid = (string | null)[][];
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const toRgb = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
/** Lighten (k > 1) or darken (k < 1) a color, warming the shadows a little so skin never goes gray. */
const tone = (h: string, k: number, warm = 0) => { const [r, g, b] = toRgb(h); return toHex(r * k + warm, g * k, b * k - warm * 0.6); };
const mix = (a: string, b: string, t: number) => { const x = toRgb(a), y = toRgb(b); return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t); };
function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
const SUITS = ["#20263a", "#1b2740", "#2e2e34", "#3a3026", "#1f3038", "#2a2238"];
const BLOUSES = ["#e9e4dc", "#c7d6ee", "#f2d0dc", "#d8e8d6", "#f0e2c0"];

/** A 40 by 40 portrait. frame: 0 rest, 1 mouth open, 2 blink. */
export function portrait28(seed: number, party: string, frame = 0, female?: boolean, role: "cand" | "staff" | "moderator" = "cand"): Grid {
  const L: Look = lookFor(seed, role === "moderator" ? "moderator" : role === "staff" ? "staff" : "cand", female);
  const R = rng(seed ^ 0x2028);
  const W = 40, H = 40; const g: Grid = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x: number, y: number, c: string | null) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const get = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? g[y][x] : null);
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const fem = L.f;
  const skin = SKIN[L.sk] ?? SKIN[2];
  const skHi = tone(skin, 1.07, 4), skSh = tone(skin, 0.86, 6), skDk = tone(skin, 0.72, 8), skLine = tone(skin, 0.55, 6);
  const hair = L.hc, hrHi = mix(hair, "#ffffff", 0.22), hrSh = tone(hair, 0.7), hrDk = tone(hair, 0.5);
  const isGray = L.hc === HC.gry || L.hc === HC.slv || L.hc === HC.wht;
  const brow = isGray ? "#8c8780" : L.hc === HC.lbld || L.hc === HC.bld || L.hc === HC.tr ? tone(hair, 0.62) : tone(hair, 0.62);
  const suit = role === "moderator" ? "#22283a" : SUITS[Math.floor(R() * SUITS.length)];
  const suHi = tone(suit, 1.35), suSh = tone(suit, 0.72);
  const tie = role === "moderator" ? "#8a8fa0" : partyCol(party);
  const tieSh = tone(tie, 0.7);

  // ---- long hair falls behind the shoulders, so it goes down first
  const longLen = L.st === "long" || L.st === "locs" ? 37 : L.st === "shoulder" ? 33 : L.st === "bob" ? 27 : L.st === "afro" ? 26 : 0;
  if (longLen) {
    const wide = L.st === "afro" ? 4 : L.st === "bob" ? 3 : 2;
    for (let y = 9; y <= longLen; y++) {
      const flare = y > 28 ? Math.min(3, y - 28) : 0;
      const x0 = 10 - wide - flare, x1 = 29 + wide + flare;
      for (let x = x0; x <= x1; x++) set(x, y, x === x0 || x === x1 ? hrDk : x % 4 === 0 ? hrSh : x % 4 === 2 && y % 3 === 0 && x < 20 ? hrHi : hair);
    }
    if (L.st === "locs") for (let x = 8; x <= 31; x += 2) for (let y = 12; y <= longLen; y++) if ((y + x) % 3 === 0) set(x, y, hrDk);
  }

  // ---- shoulders and clothes
  for (let y = 30; y < H; y++) { const half = 9 + Math.min(10, Math.round((y - 30) * 1.4)); rect(20 - half, y, 19 + half, y, suit); }
  for (let y = 31; y < H; y++) { set(20 - 9 - Math.min(10, Math.round((y - 30) * 1.4)), y, suSh); set(19 + 9 + Math.min(10, Math.round((y - 30) * 1.4)), y, suSh); }
  // shoulder highlight
  for (let x = 9; x <= 14; x++) set(x, 31, suHi);
  const cand = role === "cand";
  if (!fem || role === "moderator") {
    // shirt V, lapels, tie with knot
    for (let y = 30; y < H; y++) { const w = Math.max(0, Math.min(4, Math.round((y - 29) * 0.5))); rect(20 - 1 - w, y, 19 + 1 + w, y, "#f4f2ee"); }
    for (let y = 31; y < H; y++) { const w = Math.min(5, Math.round((y - 29) * 0.55)); set(20 - 2 - w, y, suHi); set(19 + 2 + w, y, suHi); set(20 - 3 - w, y, suSh); set(19 + 3 + w, y, suSh); }
    rect(19, 31, 20, 32, tie); set(18, 31, tieSh); set(21, 31, tieSh); // knot
    for (let y = 33; y < H; y++) { const w = y > 36 ? 1 : 0; rect(19 - w, y, 20 + w, y, tie); set(20 + w, y, tieSh); }
    set(19, 33, tone(tie, 1.25));
  } else {
    // blazer over a blouse with a jewel neckline and a necklace
    const bl = BLOUSES[Math.floor(R() * BLOUSES.length)];
    for (let y = 30; y < H; y++) { const w = Math.max(1, Math.min(6, Math.round((y - 29) * 0.7))); rect(20 - w, y, 19 + w, y, bl); }
    for (let y = 31; y < H; y++) { const w = Math.min(7, Math.round((y - 29) * 0.75)); set(20 - 1 - w, y, suHi); set(19 + 1 + w, y, suHi); }
    rect(17, 30, 22, 31, skin); set(16, 30, skSh); set(23, 30, skSh);
    for (const [x, y] of [[16, 31], [17, 32], [18, 33], [19, 33], [20, 33], [21, 33], [22, 32], [23, 31]]) set(x, y, "#e8c25e");
    set(20, 34, "#f6e6a8");
  }
  if (cand) { set(13, 34, "#c8102e"); set(14, 34, "#ffffff"); set(13, 35, "#1b3c8c"); set(14, 35, "#c8102e"); } // a flag pin

  // ---- neck
  rect(16, 25, 23, 31, skin); for (let y = 25; y <= 29; y++) { set(16, y, skSh); set(23, y, skSh); } rect(17, 26, 22, 27, skSh); rect(18, 28, 21, 28, skSh);

  // ---- head: a jaw that narrows below the cheekbones
  // every face is a little different: width, how square the jaw is, how long the face runs
  const fw = 8.2 + R() * 0.9, jaw = 0.32 + R() * 0.2, chin = 0.5 + R() * 0.25;
  const inHead = (x: number, y: number) => {
    const cx = 19.5, cy = 15.5; const ry = 11; let rx = fw;
    if (y > cy + 2) rx = fw - (y - cy - 2) * jaw;
    if (y > cy + 8) rx -= (y - cy - 8) * chin;
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  };
  for (let y = 4; y <= 27; y++) for (let x = 9; x <= 30; x++) if (inHead(x, y)) set(x, y, skin);
  // ears
  for (let y = 14; y <= 19; y++) { set(10, y, skSh); set(29, y, skSh); } set(9, 15, skSh); set(9, 16, skSh); set(9, 17, skDk); set(30, 15, skSh); set(30, 16, skSh); set(30, 17, skDk);
  set(10, 16, skDk); set(29, 16, skDk);
  // light from the upper left: highlight the left cheek and forehead, shade the right side and under the jaw
  for (let y = 4; y <= 27; y++) for (let x = 9; x <= 30; x++) {
    if (get(x, y) !== skin) continue;
    if (!inHead(x + 1, y)) set(x, y, skSh);
    else if (!inHead(x + 2, y) && y > 9) set(x, y, mix(skin, skSh, 0.5));
    if (!inHead(x, y + 1)) set(x, y, skSh);
  }
  for (let y = 7; y <= 11; y++) for (let x = 14; x <= 18; x++) if (get(x, y) === skin) set(x, y, mix(skin, skHi, 0.6));
  for (let y = 18; y <= 20; y++) for (let x = 13; x <= 15; x++) if (get(x, y) === skin) set(x, y, mix(skin, skHi, 0.5));
  // outline the head with a darker skin tone so it reads against any background
  const outline: [number, number][] = [];
  for (let y = 3; y <= 28; y++) for (let x = 8; x <= 31; x++) if (!get(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const c = get(x + dx, y + dy); return c === skin || c === skSh || c === skHi || c === skDk; }) && y < 28) outline.push([x, y]);
  for (const [x, y] of outline) if (y > 13 && y < 27) set(x, y, mix(skLine, skSh, 0.4));

  // ---- hair on top
  const top = (x: number) => { const dx = (x - 19.5) / 9.6; return dx * dx >= 1 ? 99 : Math.round(15.5 - 12.4 * Math.sqrt(1 - dx * dx)); };
  const cap = (hairline: (x: number) => number, x0 = 9, x1 = 30, lift = 0) => {
    for (let x = x0; x <= x1; x++) { const t = top(x) - lift; const h = hairline(x); for (let y = t; y <= h; y++) set(x, y, y === t ? hrSh : (x + y) % 4 === 0 ? hrSh : x < 17 && y < t + 3 ? hrHi : hair); }
  };
  const sides = (to: number) => { for (let y = 9; y <= to; y++) { set(9, y, hair); set(10, y, y > 13 ? hrSh : hair); set(30, y, hrSh); set(29, y, y > 13 ? hrDk : hair); } };
  switch (L.st) {
    case "short": cap((x) => (x < 12 || x > 27 ? 12 : 8)); sides(13); break;
    case "side": cap((x) => (x < 12 || x > 27 ? 12 : x < 15 ? 9 : 8)); sides(13); for (let y = 4; y <= 8; y++) set(15, y, hrDk); for (let x = 16; x <= 26; x++) set(x, 8, hrSh); break;
    case "swoop": cap((x) => (x < 12 || x > 27 ? 13 : x < 22 ? 9 : 8), 8, 31, 1); sides(14); for (let x = 12; x <= 24; x++) set(x, 9, hrHi); for (let x = 22; x <= 27; x++) set(x, 9, hair); break;
    case "slick": cap((x) => (x < 12 || x > 27 ? 12 : 7)); sides(12); for (let x = 11; x <= 28; x += 2) { set(x, 5, hrHi); set(x + 1, 6, hrSh); } break;
    case "wavy": cap((x) => (x < 12 || x > 27 ? 13 : 8 + ((x >> 1) % 2)), 8, 31, 1); sides(14); for (let x = 10; x <= 29; x += 3) { set(x, 4, hrHi); set(x + 1, 6, hrSh); } break;
    case "buzz": for (let x = 10; x <= 29; x++) { const t = top(x); for (let y = t; y <= (x < 12 || x > 27 ? 11 : 7); y++) set(x, y, (x + y) % 2 ? hrSh : mix(hair, skin, 0.35)); } break;
    case "bald": for (let x = 13; x <= 22; x++) set(x, top(x) + 1, tone(skin, 1.12, 4)); for (let y = 11; y <= 15; y++) { set(9, y, hrSh); set(30, y, hrSh); set(10, y, hair); set(29, y, hrSh); } break;
    case "balding": for (let y = 9; y <= 15; y++) { set(9, y, hrSh); set(10, y, hair); if (y > 11) set(11, y, hair); set(29, y, hrSh); set(30, y, hrSh); } set(11, 9, hair); set(11, 10, hair); set(28, 9, hair); set(28, 10, hair); for (let x = 16; x <= 23; x++) if (!isGray) set(x, top(x) + 1, mix(hair, skin, 0.55)); for (let x = 14; x <= 25; x++) set(x, top(x) + 2, tone(skin, 1.1, 4)); break;
    case "curly": case "afro": {
      const big = L.st === "afro" ? 3 : 1;
      for (let x = 9 - big; x <= 30 + big; x++) { const t = top(Math.max(9, Math.min(30, x))) - big - 1; for (let y = t; y <= (x < 12 || x > 27 ? 14 : 8); y++) set(x, y, (x * 3 + y * 5) % 7 < 2 ? hrDk : (x * 5 + y * 3) % 7 < 2 ? hrHi : hair); }
      break;
    }
    case "long": case "shoulder": case "bob": case "locs":
      cap((x) => (x < 13 ? 14 : x > 26 ? 14 : x < 20 ? 8 : 9), 8, 31, 1);
      for (let y = 8; y <= 18; y++) { set(9, y, hair); set(10, y, hair); set(29, y, hrSh); set(30, y, hrSh); }
      for (let x = 13; x <= 19; x++) set(x, 9 + Math.floor((19 - x) / 3), hrHi); // a side part with a sweep
      break;
    case "pulled": cap((x) => (x < 12 || x > 27 ? 12 : 8)); sides(13); rect(26, 3, 31, 7, hair); rect(27, 2, 30, 3, hrSh); set(28, 4, hrHi); break;
    case "pixie": cap((x) => (x < 12 || x > 27 ? 13 : x < 18 ? 10 : 8)); sides(13); for (let x = 12; x <= 18; x++) set(x, 10, hrSh); break;
  }
  if (L.hat === "cap") { const c = L.hatC ?? "#2a3a5a"; for (let x = 9; x <= 30; x++) for (let y = top(x) - 1; y <= 8; y++) set(x, y, c); rect(6, 9, 21, 10, tone(c, 0.75)); rect(17, 4, 22, 6, tone(c, 1.35)); }
  if (L.hat === "cowboy") { const c = L.hatC ?? "#6a5032"; rect(11, 1, 28, 8, c); rect(4, 9, 35, 10, tone(c, 0.8)); rect(11, 7, 28, 7, tone(c, 0.6)); }
  if (L.hat === "kippah") { rect(17, 3, 23, 4, L.hatC ?? "#1d2a4a"); }

  // ---- beard under the mouth
  const bc = L.bc ?? (L.hc === HC.tr ? HC.bld : L.hc); const bSh = tone(bc, 0.72), bHi = mix(bc, "#ffffff", 0.18);
  if (L.bd === "full" || L.bd === "short") {
    const from = L.bd === "full" ? 18 : 20;
    for (let y = from; y <= 28; y++) for (let x = 9; x <= 30; x++) {
      const c = get(x, y); if (c !== skin && c !== skSh && c !== skDk && c !== skHi && c !== skLine) continue;
      if (y < 22 && x > 13 && x < 26) continue;
      set(x, y, (x + y * 3) % 5 === 0 ? bSh : (x * 2 + y) % 7 === 0 ? bHi : bc);
    }
    rect(16, 22, 23, 22, bc); set(15, 23, bc); set(24, 23, bc);
  } else if (L.bd === "goatee") { rect(16, 22, 23, 22, bc); rect(17, 25, 22, 27, bc); set(16, 25, bSh); set(23, 25, bSh); rect(18, 28, 21, 28, bSh); }
  else if (L.bd === "stache") { rect(16, 22, 23, 22, bc); set(15, 23, bSh); set(24, 23, bSh); rect(17, 21, 22, 21, bSh); }
  else if (L.bd === "stubble") { for (let y = 20; y <= 27; y++) for (let x = 11; x <= 28; x++) { const c = get(x, y); if ((c === skin || c === skSh) && (x + y) % 2 === 0 && !(y < 23 && x > 14 && x < 25)) set(x, y, tone(skin, 0.7)); } }

  // ---- the face
  const blink = frame === 2;
  const iris = L.sk >= 4 ? "#3a1f0e" : L.hc === HC.bld || L.hc === HC.lbld || L.hc === HC.red ? "#3f6a8a" : L.sk <= 1 && R() < 0.4 ? "#4a6a3a" : "#4a2e18";
  const eye = (x: number) => {
    if (blink) { rect(x, 16, x + 3, 16, skLine); return; }
    rect(x, 15, x + 3, 15, skLine); // the upper lid
    rect(x, 16, x + 3, 17, "#f4f1ea"); set(x + 1, 16, iris); set(x + 2, 16, iris); set(x + 1, 17, iris); set(x + 2, 17, tone(iris, 0.6)); set(x + 1, 16, tone(iris, 1.4)); set(x + 2, 17, "#120c08");
    set(x, 18, skSh); set(x + 3, 18, skSh);
    if (fem) { set(x - 1, 15, "#1a1020"); set(x + 4, 15, "#1a1020"); }
  };
  eye(14); eye(22);
  // eyebrows: heavier for men
  rect(13, 13, 17, 13, brow); rect(22, 13, 26, 13, brow); set(13, 13, mix(brow, skin, 0.5)); set(26, 13, mix(brow, skin, 0.5));
  if (!fem) { rect(14, 12, 16, 12, mix(brow, skin, 0.35)); rect(23, 12, 25, 12, mix(brow, skin, 0.35)); }
  else { set(13, 13, mix(brow, skin, 0.7)); set(26, 13, mix(brow, skin, 0.7)); }
  // the nose: a shadow down the side, a lit tip and the nostrils
  for (let y = 17; y <= 20; y++) set(21, y, skSh); set(20, 21, skHi); set(19, 21, skSh); set(22, 21, skDk); set(18, 21, skSh); set(21, 21, skDk);
  // cheeks
  if (fem || L.sk <= 2) { set(14, 20, mix(skin, "#e07a7a", 0.3)); set(15, 20, mix(skin, "#e07a7a", 0.3)); set(24, 20, mix(skin, "#e07a7a", 0.3)); set(25, 20, mix(skin, "#e07a7a", 0.3)); }
  // the mouth
  const lip = fem ? (L.sk >= 5 ? "#8a3040" : "#c4465a") : tone(skin, 0.68, 10);
  if (frame === 1) { rect(17, 23, 22, 25, "#3a0d14"); rect(18, 23, 21, 23, "#f3efe6"); rect(18, 25, 21, 25, "#c45060"); set(17, 23, lip); set(22, 23, lip); }
  else {
    rect(17, 23, 22, 23, tone(lip, 0.7)); rect(18, 24, 21, 24, lip); set(16, 23, skSh); set(23, 23, skSh);
    if (fem) rect(18, 22, 21, 22, tone(lip, 0.9));
  }
  set(19, 26, skSh); set(20, 26, skSh); // the shadow under the lower lip
  // glasses over the eyes
  if (L.gl || role === "moderator") {
    const fr = "#1c1a22", lens = "rgba(200,220,255,0.18)";
    for (const x0 of [13, 21]) { rect(x0, 14, x0 + 5, 14, fr); rect(x0, 19, x0 + 5, 19, fr); rect(x0, 14, x0, 19, fr); rect(x0 + 5, 14, x0 + 5, 19, fr); set(x0 + 1, 15, lens); }
    rect(19, 15, 20, 15, fr); set(11, 15, fr); set(12, 15, fr); set(27, 15, fr); set(28, 15, fr);
  }
  // earrings
  if (fem && !longLen) { set(9, 19, "#e8c25e"); set(30, 19, "#e8c25e"); }
  return g;
}

/** A 16 by 32 standing figure for the debate stage. frame 1 gestures and talks. */
export function figure28(seed: number, party: string, frame: number, female?: boolean): Grid {
  const L: Look = lookFor(seed, "cand", female); const R = rng(seed ^ 0x1928);
  const W = 16, H = 32; const g: Grid = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x: number, y: number, c: string | null) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const skin = SKIN[L.sk] ?? SKIN[2], skSh = tone(skin, 0.84, 6), hair = L.hc, hrSh = tone(hair, 0.7);
  const suit = SUITS[Math.floor(R() * SUITS.length)], suSh = tone(suit, 0.7), suHi = tone(suit, 1.35);
  const tie = partyCol(party), fem = L.f;
  // legs, shoes
  rect(5, 25, 7, 30, fem ? skin : tone(suit, 0.9)); rect(8, 25, 10, 30, fem ? skSh : suSh);
  if (fem) rect(4, 22, 11, 26, suit);
  rect(4, 31, 7, 31, "#141018"); rect(8, 31, 11, 31, "#141018");
  // torso
  rect(3, 12, 12, 24, suit); rect(3, 12, 3, 24, suSh); rect(12, 12, 12, 24, suSh); rect(4, 12, 6, 12, suHi);
  if (!fem) { rect(7, 12, 8, 15, "#f4f2ee"); rect(7, 13, 8, 19, tie); set(8, 14, tone(tie, 0.7)); set(6, 13, suHi); set(9, 13, suHi); }
  else { rect(6, 12, 9, 14, BLOUSES[Math.floor(R() * BLOUSES.length)]); set(7, 12, skin); set(8, 12, skin); set(6, 13, "#e8c25e"); set(9, 13, "#e8c25e"); }
  set(5, 14, "#c8102e"); // the pin
  // arms: one gestures when talking
  rect(1, 13, 2, 21, suit); set(1, 22, skin); set(2, 22, skin);
  if (frame === 1) { rect(13, 9, 14, 13, suit); set(13, 8, skin); set(14, 8, skin); set(14, 7, skin); }
  else { rect(13, 13, 14, 21, suit); set(13, 22, skin); set(14, 22, skin); }
  // neck and head
  rect(6, 10, 9, 11, skSh);
  rect(4, 2, 11, 9, skin); rect(10, 3, 11, 9, skSh); set(4, 2, null); set(11, 2, null); set(4, 9, null); set(11, 9, null); set(5, 9, skSh); set(10, 9, skSh);
  set(3, 5, skSh); set(12, 5, skSh); set(3, 6, skSh); set(12, 6, skSh);
  // face
  set(5, 5, "#f4f1ea"); set(6, 5, "#20140c"); set(9, 5, "#f4f1ea"); set(10, 5, "#20140c");
  rect(5, 4, 6, 4, tone(hair, 0.6)); rect(9, 4, 10, 4, tone(hair, 0.6));
  set(8, 6, skSh); set(8, 7, skSh);
  if (frame === 1) { rect(7, 8, 9, 8, "#3a0d14"); } else rect(7, 8, 9, 8, fem ? "#c4465a" : tone(skin, 0.66, 10));
  if (L.gl) { rect(4, 5, 7, 5, "#1c1a22"); rect(8, 5, 11, 5, "#1c1a22"); set(5, 5, "#f4f1ea"); set(9, 5, "#f4f1ea"); }
  // hair by style
  const bald = L.st === "bald" || L.st === "balding";
  if (!bald) { rect(4, 0, 11, 2, hair); rect(3, 1, 3, 4, hair); rect(12, 1, 12, 4, hrSh); set(5, 0, tone(hair, 1.25)); set(6, 0, tone(hair, 1.25)); }
  else { rect(3, 3, 3, 6, hair); rect(12, 3, 12, 6, hrSh); set(6, 1, tone(skin, 1.1)); }
  if (L.st === "long" || L.st === "shoulder" || L.st === "locs") { rect(2, 2, 3, L.st === "shoulder" ? 11 : 14, hair); rect(12, 2, 13, L.st === "shoulder" ? 11 : 14, hrSh); }
  if (L.st === "bob") { rect(2, 2, 3, 9, hair); rect(12, 2, 13, 9, hrSh); }
  if (L.st === "curly" || L.st === "afro") { rect(3, 0, 12, 2, hair); rect(2, 1, 13, 3, hair); set(4, 0, hrSh); set(9, 1, hrSh); }
  if (L.st === "swoop") { rect(4, 2, 9, 2, hair); }
  if (L.bd && L.bd !== "stubble") { const bc = L.bc ?? hair; rect(4, 7, 11, 9, bc); set(7, 8, fem ? "#c4465a" : tone(bc, 0.6)); set(8, 8, tone(bc, 0.6)); if (L.bd === "stache") { rect(4, 8, 11, 9, skin); rect(6, 7, 9, 7, bc); } if (L.bd === "goatee") { rect(4, 7, 5, 9, skin); rect(10, 7, 11, 9, skin); } }
  if (L.hat === "cap") rect(3, 0, 12, 1, L.hatC ?? "#2a3a5a");
  return g;
}
export { seedOf };
