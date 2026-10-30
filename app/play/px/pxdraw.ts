// Chunky pixel drawing for the game's charts: everything is drawn on a small grid and scaled up with
// image-rendering: pixelated, so lines step, bands dither and dots are squares, like the map and the portraits.
export type G = CanvasRenderingContext2D;

/** Size a canvas to a pixel grid and get its context with smoothing off. */
export function grid(cv: HTMLCanvasElement | null, gw: number, gh: number): G | null {
  if (!cv) return null;
  if (cv.width !== gw) cv.width = gw;
  if (cv.height !== gh) cv.height = gh;
  const g = cv.getContext("2d"); if (!g) return null;
  g.imageSmoothingEnabled = false; g.clearRect(0, 0, gw, gh);
  return g;
}
export const dot = (g: G, x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
export const box = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
/** A Bresenham line, optionally dashed (on, off) and thick. */
export function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string, dash?: [number, number], thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, k = 0; g.fillStyle = c;
  for (;;) {
    if (!dash || k % (dash[0] + dash[1]) < dash[0]) g.fillRect(x0, y0, thick, thick);
    k++; if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; }
  }
}
/** A stepped line through points: across, then up or down, the way a market ticker or an old terminal draws it. */
export function steps(g: G, pts: [number, number][], c: string, thick = 1) {
  for (let i = 1; i < pts.length; i++) { const [a, b] = pts[i - 1], [x, y] = pts[i]; line(g, a, b, x, b, c, undefined, thick); line(g, x, b, x, y, c, undefined, thick); }
}
/** Fill between two curves sampled at every column, solid or as a checker dither. */
export function band(g: G, x0: number, x1: number, top: (x: number) => number, bot: (x: number) => number, c: string, dither = false) {
  g.fillStyle = c;
  for (let x = Math.round(x0); x <= Math.round(x1); x++) {
    const a = Math.round(Math.min(top(x), bot(x))), b = Math.round(Math.max(top(x), bot(x)));
    for (let y = a; y <= b; y++) if (!dither || (x + y) % 2 === 0) g.fillRect(x, y, 1, 1);
  }
}
/** Linear interpolation of a series of [x, y] points at column x. */
export function at(pts: [number, number][], x: number) {
  if (!pts.length) return 0; if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) { const [a, b] = pts[i - 1], [c, d] = pts[i]; return c === a ? d : b + ((x - a) * (d - b)) / (c - a); }
  return pts[pts.length - 1][1];
}
