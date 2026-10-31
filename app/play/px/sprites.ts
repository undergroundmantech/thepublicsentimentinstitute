// Pixel art for the game, drawn from tiny bitmaps and procedural portraits so nothing ships as an image file.
import type { Role } from "../engine";
import { SKIN, HC, lookOf, type Look, type Style, type Beard } from "./looks";

export const PAL = {
  ink: "#0b0716", night: "#140c26", deep: "#1d1238", panel: "#26184a", line: "#3b2a6b", mute: "#8a7fb4", hi: "#fff6e0",
  dem: "#3d7bff", dem2: "#8fb0ff", dem3: "#c9d8ff", gop: "#ff3b5c", gop2: "#ff8da1", gop3: "#ffc7d2", ind: "#b78cff", ind2: "#d8c2ff",
  gold: "#ffcc4d", gold2: "#c98f1c", green: "#41e08f", green2: "#1f9d5f", fog: "#3a3157", fog2: "#4a4070", water: "#0f0a1f", toss: "#e7b341",
};
export const partyCol = (p: string, k: 1 | 2 | 3 = 1) => (p === "R" ? [PAL.gop, PAL.gop2, PAL.gop3] : p === "D" ? [PAL.dem, PAL.dem2, PAL.dem3] : [PAL.ind, PAL.ind2, "#efe6ff"])[k - 1];

export type Bits = string[];
/** Paint a bitmap at x, y; each character is a palette key, "." is clear. */
export function bits(g: CanvasRenderingContext2D, b: Bits, x: number, y: number, pal: Record<string, string>, flip = false, k = 1) {
  const w = b[0].length, X = Math.round(x), Y = Math.round(y);
  for (let j = 0; j < b.length; j++) for (let i = 0; i < w; i++) {
    const ch = b[j][flip ? w - 1 - i : i]; if (ch === "." || ch === " ") continue;
    const c = pal[ch]; if (!c) continue;
    g.fillStyle = c; g.fillRect(X + i * k, Y + j * k, k, k);
  }
}
/** A dark outline around a sprite so it reads on any county color. */
export function bitsOutlined(g: CanvasRenderingContext2D, b: Bits, x: number, y: number, pal: Record<string, string>, flip = false, k = 1, line = "#0b0716") {
  const w = b[0].length, X = Math.round(x), Y = Math.round(y);
  g.fillStyle = line;
  for (let j = 0; j < b.length; j++) for (let i = 0; i < w; i++) {
    const ch = b[j][flip ? w - 1 - i : i]; if (ch === "." || ch === " " || !pal[ch]) continue;
    g.fillRect(X + i * k - 1, Y + j * k - 1, k + 2, k + 2);
  }
  bits(g, b, x, y, pal, flip, k);
}

export const BUS: Bits = [
  ".PPPPPPPPPPP.",
  "PwwPwwPwwPwwP",
  "PwwPwwPwwPwwP",
  "PPPPPPPPPPPPP",
  "PSSSSSSSSSSSP",
  "PPPPPPPPPPPPP",
  ".kgk.....kgk.",
];
export const PIN: Bits = [".yyy.", "yyyyy", "yyoyy", "yyyyy", ".yyy.", "..y..", "..y.."];
export const FLAG: [Bits, Bits] = [["Pff.", "Pfff", "Pff.", "P...", "P...", "P..."], ["Pf..", "Pfff", "Pfff", "P...", "P...", "P..."]];
export const TV: Bits = [".a.a.", "..a..", "kkkkk", "kssSk", "kSssk", "kkkkk"];
export const PERSON: [Bits, Bits] = [[".h.", "hsh", ".s.", "ccc", ".c.", "l.l"], [".h.", "hsh", ".s.", "ccc", ".c.", ".l."]];
export const HEART: Bits = [".r.r.", "rrrrr", "rrrrr", ".rrr.", "..r.."];
export const STAR: Bits = ["..y..", ".yyy.", "yyyyy", ".y.y."];
export const DOLLAR: Bits = [".g.", "ggg", "g..", "ggg", "..g", "ggg", ".g."];
export const CLIP: Bits = ["kwwk", "kwwk", "kbbk", "kwwk", "kkkk"];
export const XMARK: Bits = ["r...r", ".r.r.", "..r..", ".r.r.", "r...r"];
export const BUBBLE: Bits = ["wwwwww", "wkwkkw", "wwwwww", ".w....", "w....."];
export const RADAR: Bits = ["..g..", ".g.g.", "g.g.g", ".g.g.", "..g.."];

// ------------------------------------------------------------- portraits
// Real people are drawn from looks.ts; everyone else gets a look from the seed, or from their name when it is known.
const SUIT = ["#2b2d42", "#1f2a44", "#3a3a3a", "#4b3b2a", "#24323a"];
const RAND_HAIR = [HC.blk, HC.dk, HC.br, HC.lbr, HC.aub, HC.bld, HC.gry, HC.slv];
const SKIN_W = [0.12, 0.2, 0.16, 0.14, 0.12, 0.11, 0.09, 0.06];
function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
export const seedOf = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const wpick = (R: () => number) => { let u = R(), i = 0; for (; i < SKIN_W.length - 1; i++) { u -= SKIN_W[i]; if (u < 0) break; } return i; };

/** The look for a seed: the real person's if there is one, else a random but coherent face. */
export function lookFor(seed: number, role: Who, female?: boolean): Look {
  const known = lookOf(seed);
  if (known) return female == null ? known : { ...known, f: female };
  const R = rng(seed ^ 0x5bd1e995);
  const f = female ?? R() < 0.45;
  const sk = wpick(R);
  const old = role === "cand" ? R() < 0.35 : R() < 0.18;
  const hc = old ? (R() < 0.5 ? HC.gry : HC.slv) : sk >= 4 ? (R() < 0.75 ? HC.blk : HC.dk) : RAND_HAIR[Math.floor(R() * 6)];
  const st: Style = f ? (["long", "shoulder", "bob", "pulled", "pixie", sk >= 5 ? "locs" : "long"] as Style[])[Math.floor(R() * 6)]
    : (sk >= 5 ? (["buzz", "bald", "short", "buzz"] as Style[]) : old ? (["balding", "side", "short", "bald"] as Style[]) : (["short", "side", "wavy", "buzz"] as Style[]))[Math.floor(R() * 4)];
  const bd: Beard | undefined = !f && role !== "cand" && R() < 0.25 ? (["full", "short", "goatee", "stache", "stubble"] as Beard[])[Math.floor(R() * 5)] : undefined;
  return { sk, hc, st, f, bd, gl: R() < 0.16 };
}
const shadeOf = (hex: string, k: number) => { const n = parseInt(hex.slice(1, 7), 16); const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0"); return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`; };

export type Who = Role | "cand" | "anchor" | "moderator" | "staff";
/** A 24 by 24 portrait. frame: 0 rest, 1 mouth open, 2 blink. */
export function portrait(seed: number, role: Who, party: string, frame = 0, female?: boolean): (string | null)[][] {
  const R = rng(seed);
  const L = lookFor(seed, role, female);
  const W = 24, H = 24; const px: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x: number, y: number, c: string | null) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y][x] = c; };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const skin = SKIN[L.sk] ?? SKIN[1];
  const skinD = shadeOf(skin, 0.86);
  const hairC = L.hc, hairD = shadeOf(L.hc, 0.78);
  const fem = L.f;
  const suit = SUIT[Math.floor(R() * SUIT.length)];
  const tie = partyCol(party);
  // clothes
  let body = suit, collar: string | null = "#f2f2f2", tieC: string | null = !fem && (role === "cand" || role === "chair" || role === "mayor" || role === "endorser" || role === "anchor") ? tie : null;
  if (fem && (role === "cand" || role === "chair" || role === "mayor" || role === "endorser" || role === "anchor")) { body = [suit, partyCol(party, 1), "#e9e4dc", "#5a2a4a"][Math.floor(R() * 4)]; collar = null; }
  if (role === "farm") { body = "#b33a3a"; collar = null; }
  if (role === "union") { body = "#3d5a80"; collar = null; }
  if (role === "faith") { body = "#151515"; collar = "#ffffff"; }
  if (role === "podcast" || role === "student") { body = role === "podcast" ? "#2f2f3a" : ["#7a3cff", "#00a37a", "#e0702a"][Math.floor(R() * 3)]; collar = null; }
  if (role === "sheriff") { body = "#7a6a4a"; collar = null; }
  if (role === "vet") { body = "#4a5a3a"; collar = null; }
  if (role === "teacher") { body = "#8a5a7a"; collar = "#f2f2f2"; }
  if (role === "biz") { body = "#f2f2f2"; collar = null; }
  if (role === "donor") { tieC = fem ? null : PAL.gold; }
  if (role === "mole") { body = "#8a7a5a"; collar = null; }
  if (role === "tribal") { body = "#2f4a5a"; collar = null; }
  if (role === "staff") { body = ["#3b4a6b", "#5a3b6b", "#2f5a4a"][Math.floor(R() * 3)]; }
  // long hair falls behind the shoulders, so it goes down first
  const sideLen = L.st === "long" || L.st === "locs" ? 19 : L.st === "shoulder" ? 16 : L.st === "afro" ? 13 : L.st === "bob" ? 13 : 0;
  if (sideLen) {
    const out = L.st === "afro" ? 3 : 2;
    rect(6 - out, 4, 6, sideLen, hairC); rect(17, 4, 17 + out, sideLen, hairC);
    if (L.st === "locs") for (let y = 6; y <= sideLen; y += 2) { set(5, y, hairD); set(18, y, hairD); }
    if (L.st === "bob") { set(4, 13, hairD); set(19, 13, hairD); }
  }
  for (let y = 17; y < H; y++) { const half = 6 + Math.min(5, y - 17); rect(12 - half, y, 11 + half, y, body); }
  if (sideLen >= 16) { rect(4, 17, 6, Math.min(H - 1, sideLen), hairC); rect(17, 17, 19, Math.min(H - 1, sideLen), hairC); }
  if (fem && collar === null && (role === "cand" || role === "chair" || role === "mayor" || role === "endorser" || role === "anchor")) { rect(10, 17, 13, 18, skin); set(11, 19, skin); set(12, 19, skin); set(9, 18, PAL.gold); set(14, 18, PAL.gold); }
  if (collar) { set(10, 17, collar); set(13, 17, collar); set(10, 18, collar); set(13, 18, collar); }
  if (tieC) { set(11, 17, tieC); set(12, 17, tieC); set(11, 18, tieC); set(12, 18, tieC); set(11, 19, tieC); set(12, 19, tieC); set(11, 20, tieC); set(12, 20, tieC); }
  if (role === "faith") { rect(11, 17, 12, 17, "#ffffff"); }
  if (role === "biz") { rect(9, 18, 14, 23, "#d8d0c0"); }
  if (role === "sheriff") { set(8, 19, PAL.gold); set(7, 20, PAL.gold); set(9, 20, PAL.gold); set(8, 21, PAL.gold); }
  if (role === "tribal") { for (let x = 9; x <= 14; x++) set(x, 18 + (x === 11 || x === 12 ? 1 : 0), "#40c0b0"); }
  if ((role === "cand" || role === "chair") && !fem) set(15, 19, tie);
  if ((role === "cand" || role === "chair") && fem) set(15, 20, tie);
  // neck and head
  rect(10, 15, 13, 17, skin); set(10, 16, skinD); set(13, 16, skinD);
  for (let y = 3; y <= 15; y++) for (let x = 5; x <= 18; x++) { const dx = (x - 11.5) / 6.3, dy = (y - 9) / 6.6; if (dx * dx + dy * dy <= 1) set(x, y, skin); }
  for (let y = 10; y <= 14; y++) if (px[y][17] === skin) set(17, y, skinD);
  set(5, 9, skinD); set(18, 9, skinD); // ears
  // hair on top
  const cap = (front: number, wide = 1.05) => { for (let y = 0; y <= 6; y++) for (let x = 3; x <= 20; x++) { const dx = (x - 11.5) / 6.6, dy = (y - 8) / 6.4; if (dx * dx + dy * dy <= wide && y <= front + (x < 7 || x > 16 ? 2 : 0)) set(x, y, hairC); } };
  const fringe = () => { rect(5, 6, 5, 10, hairC); rect(18, 6, 18, 10, hairC); };
  switch (L.st) {
    case "short": cap(5); set(5, 7, hairC); set(18, 7, hairC); break;
    case "side": cap(5); rect(5, 4, 6, 8, hairC); rect(17, 5, 18, 7, hairC); set(9, 3, hairD); set(9, 4, hairD); break;
    case "slick": cap(4); rect(5, 4, 5, 8, hairC); rect(18, 4, 18, 8, hairC); for (let x = 7; x <= 16; x += 3) set(x, 3, hairD); break;
    case "wavy": cap(5, 1.15); for (let x = 6; x <= 17; x += 2) set(x, 6, hairC); rect(5, 4, 5, 9, hairC); rect(18, 4, 18, 9, hairC); for (let x = 7; x <= 16; x += 3) set(x, 3, hairD); break;
    case "swoop": cap(5, 1.12); rect(6, 5, 16, 6, hairC); rect(4, 5, 5, 9, hairC); rect(18, 5, 19, 9, hairC); for (let x = 8; x <= 15; x += 2) set(x, 4, hairD); set(17, 6, hairC); break;
    case "buzz": for (let y = 2; y <= 5; y++) for (let x = 5; x <= 18; x++) { const dx = (x - 11.5) / 6.3, dy = (y - 9) / 6.6; if (dx * dx + dy * dy <= 1 && y <= 4 + (x < 7 || x > 16 ? 2 : 0)) set(x, y, hairC); } fringe(); break;
    case "bald": fringe(); for (let x = 9; x <= 13; x++) set(x, 4, shadeOf(skin, 1.08)); break;
    case "balding": fringe(); rect(6, 4, 7, 6, hairC); rect(16, 4, 17, 6, hairC); if (L.hc !== HC.wht && L.hc !== HC.slv) { for (let x = 9; x <= 14; x++) set(x, 3, hairC); } break;
    case "curly": case "afro": cap(5, L.st === "afro" ? 1.5 : 1.25); for (let x = 4; x <= 19; x += 2) set(x, x % 4 ? 1 : 2, hairD); for (let y = 3; y <= 6; y += 2) { set(4, y, hairC); set(19, y, hairC); } rect(5, 4, 5, 9, hairC); rect(18, 4, 18, 9, hairC); break;
    case "long": case "shoulder": case "bob": case "locs": cap(5, 1.1); rect(5, 4, 6, 9, hairC); rect(17, 4, 18, 9, hairC); for (let x = 12; x <= 16; x++) set(x, 5, hairC); set(11, 4, hairD); break;
    case "pulled": cap(5); rect(5, 4, 5, 8, hairC); rect(18, 4, 18, 8, hairC); rect(15, 0, 18, 2, hairC); rect(16, 3, 17, 3, hairC); set(16, 1, hairD); set(11, 3, hairD); break;
    case "pixie": cap(5, 1.08); rect(5, 4, 5, 8, hairC); rect(18, 4, 18, 8, hairC); for (let x = 6; x <= 10; x++) set(x, 5, hairC); set(6, 6, hairC); break;
  }
  if (role === "student" && R() < 0.5 && !fem) { rect(5, 2, 18, 4, hairC); }
  // hats and gear
  if (L.hat === "cap") { const c = L.hatC ?? "#2a3a5a"; rect(5, 1, 18, 4, c); rect(3, 5, 12, 5, shadeOf(c, 0.8)); set(11, 2, shadeOf(c, 1.3)); }
  if (L.hat === "kippah") { rect(9, 1, 14, 2, L.hatC ?? "#1d2a4a"); }
  if (L.hat === "cowboy") { const c = L.hatC ?? "#6a5032"; rect(6, 0, 17, 4, c); rect(2, 5, 21, 5, c); rect(6, 4, 17, 4, shadeOf(c, 0.7)); }
  if (role === "farm") { rect(5, 1, 18, 4, "#2a6aa8"); rect(2, 5, 12, 5, "#2a6aa8"); rect(9, 2, 13, 3, "#ffffff"); }
  if (role === "union") { rect(5, 1, 18, 4, PAL.gold); rect(3, 5, 20, 5, PAL.gold2); }
  if (role === "sheriff") { rect(6, 1, 17, 4, "#6a5032"); rect(2, 5, 21, 5, "#6a5032"); set(11, 2, PAL.gold); }
  if (role === "vet") { rect(5, 2, 18, 4, "#30402a"); rect(3, 5, 12, 5, "#30402a"); rect(8, 3, 14, 3, PAL.gold); }
  if (role === "podcast") { rect(5, 1, 18, 1, "#111"); rect(4, 2, 4, 6, "#111"); rect(19, 2, 19, 6, "#111"); rect(3, 7, 5, 11, "#e04060"); rect(18, 7, 20, 11, "#e04060"); }
  if (role === "mole") { rect(4, 2, 19, 4, "#5a4a32"); rect(2, 5, 21, 5, "#5a4a32"); }
  // beard sits under the mouth
  const brow = L.hc === HC.wht || L.hc === HC.slv ? "#9a9a9a" : L.hc === HC.lbld ? "#c9a660" : hairD;
  const bc = L.bc ?? (L.hc === HC.tr ? HC.bld : L.hc);
  if (L.bd === "full" || L.bd === "short") {
    const top = L.bd === "full" ? 11 : 12;
    for (let y = top; y <= 16; y++) for (let x = 5; x <= 18; x++) { if (px[y][x] !== skin && px[y][x] !== skinD) continue; if (y === 16 && (x < 9 || x > 14)) continue; if (y < 12 && x > 7 && x < 16) continue; set(x, y, y >= 15 || L.bd === "full" ? bc : shadeOf(bc, 1)); }
    rect(9, 12, 14, 12, bc);
  } else if (L.bd === "stubble") {
    for (let y = 11; y <= 15; y++) for (let x = 5; x <= 18; x++) if (px[y][x] === skin || px[y][x] === skinD) { if (y < 12 && x > 7 && x < 16) continue; if ((x + y) % 2 === 0) set(x, y, shadeOf(skin, 0.68)); }
  } else if (L.bd === "goatee") { rect(9, 12, 14, 12, bc); rect(9, 13, 9, 14, bc); rect(14, 13, 14, 14, bc); rect(10, 14, 13, 15, bc); }
  else if (L.bd === "stache") { rect(9, 12, 14, 12, bc); }
  // face
  const eyeY = 9;
  const blink = frame === 2;
  const iris = L.sk >= 3 ? "#2a1408" : "#24304a";
  const eye = (x: number) => { if (blink) { set(x, eyeY, shadeOf(skin, 0.55)); set(x + 1, eyeY, shadeOf(skin, 0.55)); } else { set(x, eyeY, "#ffffff"); set(x + 1, eyeY, iris); } };
  eye(8); eye(14);
  rect(7, 7, 9, 7, brow); rect(14, 7, 16, 7, brow);
  if (fem && !blink) { set(7, 8, "#1a1020"); set(16, 8, "#1a1020"); }
  const glasses = L.gl || role === "teacher" || role === "editor" || role === "anchor";
  if (role === "mole") { rect(7, 8, 10, 9, "#111"); rect(13, 8, 16, 9, "#111"); rect(10, 8, 13, 8, "#111"); }
  else if (glasses) { for (const x0 of [7, 13]) { set(x0, 8, "#222"); set(x0 + 3, 8, "#222"); set(x0, 10, "#222"); set(x0 + 3, 10, "#222"); set(x0 + 1, 8, "#222"); set(x0 + 2, 8, "#222"); set(x0 + 1, 10, "#222"); set(x0 + 2, 10, "#222"); } set(11, 9, "#222"); set(12, 9, "#222"); }
  set(11, 11, shadeOf(skin, 0.78)); set(12, 11, shadeOf(skin, 0.78)); set(12, 10, skinD);
  if (fem && L.sk <= 2) { set(7, 11, "#eaa79c"); set(16, 11, "#eaa79c"); }
  const lip = fem ? (L.sk >= 5 ? "#7a2a3a" : "#c0485a") : shadeOf(skin, 0.62);
  if (frame === 1) { rect(10, 13, 13, 13, "#3a0d14"); rect(10, 14, 13, 14, "#3a0d14"); set(11, 14, "#e06070"); set(12, 14, "#e06070"); }
  else { rect(10, 13, 13, 13, lip); }
  if (fem && R() < 0.5 && sideLen < 16) { set(5, 11, PAL.gold); set(18, 11, PAL.gold); }
  return px;
}

/** A tiny standing figure for the debate stage and the war room, 8 wide by 14 tall. */
export function figure(seed: number, party: string, frame: number, role: Who = "cand"): (string | null)[][] {
  const R = rng(seed); const L = lookFor(seed, role);
  const skin = SKIN[L.sk] ?? SKIN[1], hair = L.hc;
  const body = role === "moderator" ? "#2b2d42" : role === "staff" ? ["#3b4a6b", "#5a3b6b", "#2f5a4a", "#6b5a3b"][Math.floor(R() * 4)] : L.f && role === "cand" ? [SUIT[0], partyCol(party, 1), "#5a2a4a"][Math.floor(R() * 3)] : SUIT[Math.floor(R() * SUIT.length)];
  const tie = role === "moderator" ? "#999" : partyCol(party);
  const g: (string | null)[][] = Array.from({ length: 14 }, () => Array(8).fill(null));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < 8 && y < 14) g[y][x] = c; };
  const bald = L.st === "bald" || L.st === "balding";
  for (let x = 2; x <= 5; x++) { set(x, 0, bald ? skin : hair); set(x, 1, skin); set(x, 2, skin); set(x, 3, skin); }
  if (!bald) set(2, 1, hair); else { set(2, 1, hair); set(5, 1, hair); }
  if (L.st === "long" || L.st === "shoulder" || L.st === "locs") { set(1, 1, hair); set(1, 2, hair); set(1, 3, hair); set(6, 1, hair); set(6, 2, hair); set(6, 3, hair); if (L.st !== "shoulder") { set(1, 4, hair); set(6, 4, hair); } }
  if (L.st === "bob" || L.st === "curly" || L.st === "afro" || L.st === "swoop") { set(1, 0, hair); set(6, 0, hair); set(1, 1, hair); set(6, 1, hair); if (L.st === "bob") { set(1, 2, hair); set(6, 2, hair); } }
  if (L.st === "pulled") set(6, 0, hair);
  if (L.hat === "cap" || L.hat === "cowboy") { const c = L.hatC ?? "#2a3a5a"; for (let x = 1; x <= 6; x++) set(x, 0, c); if (L.hat === "cowboy") { set(0, 1, c); set(7, 1, c); } }
  set(3, 2, "#111"); set(5, 2, "#111");
  if (L.gl) { set(3, 2, "#333"); set(4, 2, "#333"); set(5, 2, "#333"); }
  if (L.bd && L.bd !== "stubble") { set(2, 3, hair); set(3, 3, hair); set(5, 3, hair); if (L.bd !== "stache") set(4, 4, hair); }
  if (frame === 1) set(4, 3, "#3a0d14");
  for (let y = 4; y <= 9; y++) for (let x = 1; x <= 6; x++) set(x, y, body);
  if (L.bd && L.bd !== "stubble" && L.bd !== "stache") set(4, 4, L.hc);
  if (!L.f || role !== "cand") { set(3, 4, "#eee"); set(4, 5, tie); set(4, 6, tie); if (!(L.bd && L.bd !== "stubble" && L.bd !== "stache")) set(4, 4, tie); }
  else { set(3, 4, skin); set(4, 4, skin); set(5, 6, tie); }
  const arm = frame === 1 ? -1 : 0; set(0, 5 + arm, body); set(7, 5 + arm * 2, body); set(7, 4 + arm * 2, skin);
  for (let y = 10; y <= 13; y++) { set(2, y, L.f && role === "cand" && y < 12 ? body : "#1a1a26"); set(5, y, L.f && role === "cand" && y < 12 ? body : "#1a1a26"); }
  return g;
}
export function paintGrid(g: CanvasRenderingContext2D, grid: (string | null)[][], x: number, y: number, flip = false, k = 1) {
  const w = grid[0].length;
  for (let j = 0; j < grid.length; j++) for (let i = 0; i < w; i++) { const c = grid[j][flip ? w - 1 - i : i]; if (c) { g.fillStyle = c; g.fillRect(x + i * k, y + j * k, k, k); } }
}
