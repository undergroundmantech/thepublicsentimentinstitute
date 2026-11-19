// The model's state list, read once on the server, so a shared result's map can be drawn from its code.
import fs from "node:fs";
import path from "node:path";
import { decodeRes, unpackWins, type ShareRes } from "../share28";

let ST: { st: string; n: string; ev: number }[] | null = null;
export const states = () => (ST ??= (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "play", "2028.json"), "utf8")) as { states: { st: string; n: string; ev: number }[] }).states.map((x) => ({ st: x.st, n: x.n, ev: x.ev })));
/** the shared result and, for every state, whether the Democrat carried it; districts go with their state */
export function load(code: string): { r: ShareRes; dWon: Record<string, boolean> } | null {
  const r = decodeRes(code); if (!r) return null; const S = states(); const w = unpackWins(r.w, S.length);
  const dWon: Record<string, boolean> = {}; S.forEach((x, i) => { if (!x.st.includes("-")) dWon[x.st] = w[i]; });
  return { r, dWon };
}
