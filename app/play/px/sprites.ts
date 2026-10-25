// Pixel art for the game, drawn from tiny bitmaps and procedural portraits so nothing ships as an image file.
import type { Role } from "../engine";

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
const SKIN = ["#f6d3b3", "#e8b48f", "#d39a6a", "#a8693f", "#7a4a2a", "#5a3520"];
const HAIR = ["#1b1b1b", "#3b2a1a", "#6b4423", "#a0522d", "#d9b26b", "#bdbdbd", "#e9e4dc", "#2a1a3a"];
const SUIT = ["#2b2d42", "#1f2a44", "#3a3a3a", "#4b3b2a", "#24323a"];
function rng(seed: number) { let t = seed >>> 0; return () => { t += 0x6d2b79f5; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
export const seedOf = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export type Who = Role | "cand" | "anchor" | "moderator" | "staff";
/** A 24 by 24 portrait. frame: 0 rest, 1 mouth open, 2 blink. */
export function portrait(seed: number, role: Who, party: string, frame = 0, female?: boolean): (string | null)[][] {
  const R = rng(seed);
  const W = 24, H = 24; const px: (string | null)[][] = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < W && y < H) px[y][x] = c; };
  const rect = (x0: number, y0: number, x1: number, y1: number, c: string) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const skin = SKIN[Math.floor(R() * SKIN.length)];
  const shade = "#00000033";
  const hairC = role === "cand" && R() < 0.3 ? HAIR[5] : HAIR[Math.floor(R() * HAIR.length)];
  const fem = female ?? R() < 0.45;
  const style = Math.floor(R() * 4); // 0 short, 1 side part, 2 long, 3 bald or buzz
  const suit = SUIT[Math.floor(R() * SUIT.length)];
  const tie = partyCol(party);
  // clothes
  let body = suit, collar: string | null = "#f2f2f2", tieC: string | null = role === "cand" || role === "chair" || role === "mayor" || role === "endorser" || role === "anchor" ? tie : null;
  if (role === "farm") { body = "#b33a3a"; collar = null; }
  if (role === "union") { body = "#3d5a80"; collar = null; }
  if (role === "faith") { body = "#151515"; collar = "#ffffff"; }
  if (role === "podcast" || role === "student") { body = role === "podcast" ? "#2f2f3a" : ["#7a3cff", "#00a37a", "#e0702a"][Math.floor(R() * 3)]; collar = null; }
  if (role === "sheriff") { body = "#7a6a4a"; collar = null; }
  if (role === "vet") { body = "#4a5a3a"; collar = null; }
  if (role === "teacher") { body = "#8a5a7a"; collar = "#f2f2f2"; }
  if (role === "biz") { body = "#f2f2f2"; collar = null; }
  if (role === "donor") { tieC = PAL.gold; }
  if (role === "mole") { body = "#8a7a5a"; collar = null; }
  if (role === "tribal") { body = "#2f4a5a"; collar = null; }
  if (role === "staff") { body = ["#3b4a6b", "#5a3b6b", "#2f5a4a"][Math.floor(R() * 3)]; }
  for (let y = 17; y < H; y++) { const half = 6 + Math.min(5, y - 17); rect(12 - half, y, 11 + half, y, body); }
  if (collar) { set(10, 17, collar); set(13, 17, collar); set(10, 18, collar); set(13, 18, collar); }
  if (tieC) { set(11, 17, tieC); set(12, 17, tieC); set(11, 18, tieC); set(12, 18, tieC); set(11, 19, tieC); set(12, 19, tieC); set(11, 20, tieC); set(12, 20, tieC); }
  if (role === "faith") { rect(11, 17, 12, 17, "#ffffff"); }
  if (role === "biz") { rect(9, 18, 14, 23, "#d8d0c0"); }
  if (role === "sheriff") { set(8, 19, PAL.gold); set(7, 20, PAL.gold); set(9, 20, PAL.gold); set(8, 21, PAL.gold); }
  if (role === "tribal") { for (let x = 9; x <= 14; x++) set(x, 18 + (x === 11 || x === 12 ? 1 : 0), "#40c0b0"); }
  if (role === "cand" || role === "chair") set(15, 19, tie);
  // neck and head
  rect(10, 15, 13, 17, skin);
  for (let y = 3; y <= 15; y++) for (let x = 5; x <= 18; x++) { const dx = (x - 11.5) / 6.3, dy = (y - 9) / 6.6; if (dx * dx + dy * dy <= 1) set(x, y, skin); }
  for (let y = 10; y <= 15; y++) set(17, y, px[y][17] ? shade : null as unknown as string);
  // hair
  const top = (y0: number) => { for (let y = y0; y <= 6; y++) for (let x = 5; x <= 18; x++) { const dx = (x - 11.5) / 6.6, dy = (y - 8) / 6.4; if (dx * dx + dy * dy <= 1.05 && y <= 5 + (x < 7 || x > 16 ? 2 : 0)) set(x, y, hairC); } };
  if (style !== 3 || fem) top(1);
  if (style === 1) { rect(5, 4, 6, 9, hairC); set(13, 3, skin); }
  if (style === 2 || fem) { rect(4, 4, 6, fem ? 15 : 11, hairC); rect(17, 4, 19, fem ? 15 : 11, hairC); }
  if (style === 3 && !fem) { rect(5, 6, 5, 9, hairC); rect(18, 6, 18, 9, hairC); }
  if (role === "student" && R() < 0.5) { rect(5, 2, 18, 4, hairC); }
  // hats and gear
  if (role === "farm") { rect(5, 1, 18, 4, "#2a6aa8"); rect(2, 5, 12, 5, "#2a6aa8"); rect(9, 2, 13, 3, "#ffffff"); }
  if (role === "union") { rect(5, 1, 18, 4, PAL.gold); rect(3, 5, 20, 5, PAL.gold2); }
  if (role === "sheriff") { rect(6, 1, 17, 4, "#6a5032"); rect(2, 5, 21, 5, "#6a5032"); set(11, 2, PAL.gold); }
  if (role === "vet") { rect(5, 2, 18, 4, "#30402a"); rect(3, 5, 12, 5, "#30402a"); rect(8, 3, 14, 3, PAL.gold); }
  if (role === "podcast") { rect(5, 1, 18, 1, "#111"); rect(4, 2, 4, 6, "#111"); rect(19, 2, 19, 6, "#111"); rect(3, 7, 5, 11, "#e04060"); rect(18, 7, 20, 11, "#e04060"); }
  if (role === "mole") { rect(4, 2, 19, 4, "#5a4a32"); rect(2, 5, 21, 5, "#5a4a32"); }
  // face
  const eyeY = 9;
  const blink = frame === 2;
  const eye = (x: number) => { if (blink) { set(x, eyeY, "#2a1a10"); set(x + 1, eyeY, "#2a1a10"); } else { set(x, eyeY, "#ffffff"); set(x + 1, eyeY, "#1a1020"); set(x, eyeY - 1, null as unknown as string); } };
  eye(8); eye(14);
  rect(7, 7, 9, 7, hairC === HAIR[6] ? "#9a9a9a" : hairC); rect(14, 7, 16, 7, hairC === HAIR[6] ? "#9a9a9a" : hairC);
  if (role === "mole") { rect(7, 8, 10, 9, "#111"); rect(13, 8, 16, 9, "#111"); rect(10, 8, 13, 8, "#111"); }
  else if (role === "teacher" || role === "editor" || role === "anchor" || (R() < 0.18 && role !== "farm")) { for (const x0 of [7, 13]) { set(x0, 8, "#222"); set(x0 + 3, 8, "#222"); set(x0, 10, "#222"); set(x0 + 3, 10, "#222"); set(x0 + 1, 8, "#222"); set(x0 + 2, 8, "#222"); set(x0 + 1, 10, "#222"); set(x0 + 2, 10, "#222"); } set(11, 9, "#222"); set(12, 9, "#222"); }
  set(11, 11, shade); set(12, 11, shade); set(12, 10, shade);
  const lip = fem ? "#c0485a" : "#8a4a3a";
  if (frame === 1) { rect(10, 13, 13, 13, "#3a0d14"); rect(10, 14, 13, 14, "#3a0d14"); set(11, 14, "#e06070"); set(12, 14, "#e06070"); }
  else { rect(10, 13, 13, 13, lip); }
  if (!fem && R() < 0.22 && role !== "cand") { rect(9, 12, 14, 12, hairC); }
  if (fem && R() < 0.5) { set(5, 11, PAL.gold); set(18, 11, PAL.gold); }
  return px;
}

/** A tiny standing figure for the debate stage and the war room, 8 wide by 14 tall. */
export function figure(seed: number, party: string, frame: number, role: Who = "cand"): (string | null)[][] {
  const R = rng(seed); const skin = SKIN[Math.floor(R() * SKIN.length)], hair = HAIR[Math.floor(R() * HAIR.length)];
  const body = role === "moderator" ? "#2b2d42" : role === "staff" ? ["#3b4a6b", "#5a3b6b", "#2f5a4a", "#6b5a3b"][Math.floor(R() * 4)] : SUIT[Math.floor(R() * SUIT.length)];
  const tie = role === "moderator" ? "#999" : partyCol(party);
  const g: (string | null)[][] = Array.from({ length: 14 }, () => Array(8).fill(null));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && y >= 0 && x < 8 && y < 14) g[y][x] = c; };
  for (let x = 2; x <= 5; x++) { set(x, 0, hair); set(x, 1, x === 2 ? hair : skin); set(x, 2, skin); set(x, 3, skin); }
  set(5, 1, skin); set(3, 2, "#111"); set(5, 2, "#111");
  if (frame === 1) set(4, 3, "#3a0d14");
  for (let y = 4; y <= 9; y++) for (let x = 1; x <= 6; x++) set(x, y, body);
  set(3, 4, "#eee"); set(4, 4, tie); set(4, 5, tie); set(4, 6, tie);
  const arm = frame === 1 ? -1 : 0; set(0, 5 + arm, body); set(7, 5 + arm * 2, body); set(7, 4 + arm * 2, skin);
  for (let y = 10; y <= 13; y++) { set(2, y, "#1a1a26"); set(5, y, "#1a1a26"); }
  return g;
}
export function paintGrid(g: CanvasRenderingContext2D, grid: (string | null)[][], x: number, y: number, flip = false, k = 1) {
  const w = grid[0].length;
  for (let j = 0; j < grid.length; j++) for (let i = 0; i < w; i++) { const c = grid[j][flip ? w - 1 - i : i]; if (c) { g.fillStyle = c; g.fillRect(x + i * k, y + j * k, k, k); } }
}
