// Seeded randomness for VAI (math §7: "seeded RNG"). xoshiro128** seeded through splitmix32. Math.random is banned in
// this directory (tests/vai/guardrails.test.ts); every stochastic function here takes an Rng built from a numeric seed.

const U32 = 4294967296;

function splitmix32(a: number): () => number {
  let s = a >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;

/** FNV-1a over a label, folded into a seed: independent, reproducible substreams ("inventory", "preference", ...). */
export function seedFrom(seed: number, label: string): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private spare: number | null = null;

  constructor(seed: number) {
    const sm = splitmix32(seed);
    this.s0 = sm();
    this.s1 = sm();
    this.s2 = sm();
    this.s3 = sm();
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  private nextU32(): number {
    const r = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 = (this.s2 ^ this.s0) >>> 0;
    this.s3 = (this.s3 ^ this.s1) >>> 0;
    this.s1 = (this.s1 ^ this.s2) >>> 0;
    this.s0 = (this.s0 ^ this.s3) >>> 0;
    this.s2 = (this.s2 ^ t) >>> 0;
    this.s3 = rotl(this.s3, 11);
    return r;
  }

  /** Uniform on the open interval (0, 1), 53 bits. Never exactly 0 or 1, so logs and quantiles are always finite. */
  uniform(): number {
    const hi = this.nextU32() >>> 5, lo = this.nextU32() >>> 6;
    return (hi * 67108864 + lo + 0.5) / 9007199254740992;
  }

  /** Standard normal by Box–Muller; the second value of each pair is kept for the next call. */
  normal(): number {
    if (this.spare !== null) {
      const v = this.spare;
      this.spare = null;
      return v;
    }
    const r = Math.sqrt(-2 * Math.log(this.uniform())), a = 2 * Math.PI * this.uniform();
    this.spare = r * Math.sin(a);
    return r * Math.cos(a);
  }

  /** An independent stream derived from this seed and a label; it does not advance this generator. */
  static fork(seed: number, label: string): Rng {
    return new Rng(seedFrom(seed, label));
  }

  /** Raw 32-bit output, for tests of the generator itself. */
  raw(): number {
    return this.nextU32() / U32;
  }
}
