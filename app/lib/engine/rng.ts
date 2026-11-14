// Seeded random numbers, so the same snapshot, model version and seed always give the same forecast.
// xoshiro128** seeded from a string hash (cyrb128). Not cryptographic; it does not need to be.

function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067); h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213); h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

export class Rng {
  private s: Uint32Array; private spare: number | null = null;
  constructor(seed: string) { this.s = new Uint32Array(cyrb128(seed)); if (!this.s.some((x) => x)) this.s[0] = 1; }
  /** uniform on (0, 1) */
  next(): number {
    const s = this.s, r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0, t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
    return (r + 0.5) / 4294967296;
  }
  /** standard normal (Box-Muller, polar-free form) */
  normal(): number {
    if (this.spare != null) { const v = this.spare; this.spare = null; return v; }
    const u = this.next(), v = this.next(), r = Math.sqrt(-2 * Math.log(u)), th = 2 * Math.PI * v;
    this.spare = r * Math.sin(th); return r * Math.cos(th);
  }
}
const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** A stable, non-cryptographic content hash (FNV-1a, 64-bit as two 32-bit halves) for snapshot ids. */
export function fnv64(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c ^ (h1 >>> 7), 16777619) >>> 0; }
  return h2.toString(16).padStart(8, "0") + h1.toString(16).padStart(8, "0");
}
/** JSON with object keys sorted, so equal content hashes equally. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}
