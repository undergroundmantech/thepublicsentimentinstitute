// Campaign 2028 results you can share. A finished race packs into one short code: who ran, who won, the electoral
// votes, the popular vote and which side carried every state. The code becomes a link, /play/r/<code>, whose page and
// share card show the map, and a challenge link, /play?c=<code>, that starts the same race with the same seed.
// Used by the game in the browser and by the result page and its share image on the server, so it stays plain code.

export type ShareRes = {
  v: 1; p: "D" | "R"; me: string; op: string; vp?: string | null; ev: number; pop: number; win: boolean;
  /** one hex digit per four units of the model's state list, a bit set where the Democrat carried it */
  w: string; day?: number; diff?: string; seed?: number; close?: string[];
};

const b64 = (s: string) => (typeof btoa === "function" ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, "utf8").toString("base64"));
const unb64 = (s: string) => (typeof atob === "function" ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, "base64").toString("utf8"));
export const encodeRes = (r: ShareRes) => b64(JSON.stringify(r)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export function decodeRes(code: string): ShareRes | null {
  try {
    const s = code.replace(/-/g, "+").replace(/_/g, "/"); const j = JSON.parse(unb64(s + "===".slice((s.length + 3) % 4))) as ShareRes;
    if (j?.v !== 1 || !j.me || !j.op || typeof j.ev !== "number" || typeof j.w !== "string") return null;
    j.me = String(j.me).slice(0, 40); j.op = String(j.op).slice(0, 40); if (j.vp) j.vp = String(j.vp).slice(0, 40);
    j.ev = Math.max(0, Math.min(538, Math.round(j.ev))); j.pop = Math.max(-60, Math.min(60, Number(j.pop) || 0));
    return j;
  } catch { return null; }
}
/** the Democrat's units as bits, in the model's state order */
export function packWins(dWon: boolean[]) {
  let h = ""; for (let i = 0; i < dWon.length; i += 4) { let n = 0; for (let k = 0; k < 4; k++) if (dWon[i + k]) n |= 1 << k; h += n.toString(16); } return h;
}
export function unpackWins(h: string, n: number) { const out: boolean[] = []; for (let i = 0; i < n; i++) { const c = parseInt(h[i >> 2] ?? "0", 16) || 0; out.push(((c >> (i & 3)) & 1) === 1); } return out; }

/** a tile map of the states, twelve columns by eight rows */
export const TILES: Record<string, [number, number]> = {
  AK: [0, 0], ME: [11, 0], WI: [6, 1], VT: [10, 1], NH: [11, 1],
  WA: [1, 2], ID: [2, 2], MT: [3, 2], ND: [4, 2], MN: [5, 2], IL: [6, 2], MI: [7, 2], NY: [9, 2], MA: [10, 2],
  OR: [1, 3], NV: [2, 3], WY: [3, 3], SD: [4, 3], IA: [5, 3], IN: [6, 3], OH: [7, 3], PA: [8, 3], NJ: [9, 3], CT: [10, 3], RI: [11, 3],
  CA: [1, 4], UT: [2, 4], CO: [3, 4], NE: [4, 4], MO: [5, 4], KY: [6, 4], WV: [7, 4], VA: [8, 4], MD: [9, 4], DE: [10, 4],
  AZ: [2, 5], NM: [3, 5], KS: [4, 5], AR: [5, 5], TN: [6, 5], NC: [7, 5], SC: [8, 5], DC: [9, 5],
  OK: [4, 6], LA: [5, 6], MS: [6, 6], AL: [7, 6], GA: [8, 6],
  HI: [0, 7], TX: [4, 7], FL: [9, 7],
};
export const last = (n: string) => n.split(" ").slice(-1)[0];
export const winner = (r: ShareRes) => (r.win ? r.me : r.op);
export const evLine = (r: ShareRes) => (r.win ? `${r.ev} to ${538 - r.ev}` : `${538 - r.ev} to ${r.ev}`);
export const headline = (r: ShareRes) => (r.win ? `${r.me} won the 2028 election, ${evLine(r)}` : `${r.me} lost the 2028 election to ${r.op}, ${evLine(r)}`);

/** the result as a post: the line, the closest states as colored squares, the link */
export function shareText(r: ShareRes, url: string) {
  const sq = (r.close ?? []).map((x) => `${x.slice(0, 2)}${x.endsWith("D") ? "🟦" : "🟥"}`).join(" ");
  const head = r.day ? `Campaign 2028 Daily · ${String(r.day).replace(/^(\d{4})(\d{2})(\d{2})$/, "$2/$3")}` : "Campaign 2028";
  const line = r.win ? `I ran as ${r.me} and WON the White House, ${r.ev} to ${538 - r.ev} 🗳️` : `I ran as ${r.me} and lost to ${last(r.op)}, ${538 - r.ev} to ${r.ev} 😤`;
  return `${head}\n${line}\n${sq}\nCan you beat it?\n${url}`;
}
