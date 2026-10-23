// Server side: read every outlet's public feed, keep each item's own headline, link, time and outlet, and group
// items about the same event into stories. Nothing is rewritten; every line keeps the outlet's own words and link.
import { OUTLETS, OUTLET, type Cat, type Lean } from "./sources";

export type Item = { o: string; lean: Lean; t: string; u: string; d: number; cat: Cat; img?: string; op?: boolean; ap?: boolean; s?: string };
export type Cluster = { id: string; head: Item; items: Item[]; n: { L: number; C: number; R: number }; outlets: number; cat: Cat; first: number; last: number; blind: "L" | "R" | null; keys: string[] };
export type FeedStatus = { o: string; url: string; ok: boolean; n: number };

const decode = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (x: string, t: string) => { const m = x.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]) : ""; };
const attr = (x: string, t: string, a: string) => { const m = x.match(new RegExp(`<${t}\\s[^>]*${a}=["']([^"']+)["']`, "i")); return m ? m[1] : ""; };

/** RSS 2.0 and Atom, without a dependency. */
export function parseFeed(xml: string, outlet: string, cat: Cat): Item[] {
  const o = OUTLET[outlet]; if (!o) return [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: Item[] = [];
  for (const b of blocks) {
    const t = tag(b, "title"); if (!t) continue;
    let u = tag(b, "link"); if (!u || !/^https?:/.test(u)) u = attr(b, "link", "href") || tag(b, "guid");
    if (!/^https?:\/\//.test(u)) continue;
    const ds = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
    const d = Date.parse(ds); if (!Number.isFinite(d)) continue;
    // a picture from the feed itself: media tags first, then the first image inside the description
    const inline = (b.match(/<img[^>]+src=["'](https:[^"']+)["']/i) ?? b.match(/&lt;img[^&]*?src=(?:&quot;|&#34;|")(https:[^&"]+)/i))?.[1];
    const img = attr(b, "media:content", "url") || attr(b, "media:thumbnail", "url") || attr(b, "enclosure", "url") || inline || undefined;
    const s = tag(b, "description").slice(0, 280) || undefined;
    // wire copy republished by a network is credited to the wire
    const ap = /\/wireStory\//i.test(u) || /\(AP\)|Associated Press/.test(s ?? "");
    const op = o.opinionHeavy || /\/(opinion|op-eds?|opinions|commentary|columns?|editorials?)\//i.test(u);
    out.push({ o: ap && o.id !== "ap" ? "ap" : o.id, lean: ap ? "C" : o.lean, t, u, d, cat, img: img && /^https:/.test(img) && !/\.(mp3|mp4|m4a)(\?|$)/i.test(img) ? img.replace(/&amp;/g, "&") : undefined, op, ap: ap || undefined, s });
  }
  return out;
}

async function get(url: string, ms = 4000): Promise<string | null> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { "user-agent": "OnPointPoliticsNewsDesk/1.0 (+https://onpointpolitics.com/news/sources)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, next: { revalidate: 600 } });
    return r.ok ? await r.text() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

export async function readAll(maxAgeH = 48): Promise<{ items: Item[]; status: FeedStatus[] }> {
  const jobs = OUTLETS.flatMap((o) => o.feeds.map((f) => ({ o: o.id, ...f })));
  const status: FeedStatus[] = []; const items: Item[] = [];
  let i = 0; const stop = Date.now() + 8500; // stay inside a serverless time limit; slow feeds wait for the next read
  const worker = async () => {
    while (i < jobs.length && Date.now() < stop) {
      const j = jobs[i++]; const x = await get(j.url);
      const got = x ? parseFeed(x, j.o, j.cat) : [];
      status.push({ o: j.o, url: j.url, ok: !!x, n: got.length }); items.push(...got);
    }
  };
  await Promise.all(Array.from({ length: 16 }, worker));
  const cut = Date.now() - maxAgeH * 3600_000, seen = new Set<string>();
  const keep = items.filter((x) => x.d >= cut && x.d <= Date.now() + 3600_000).sort((a, b) => b.d - a.d).filter((x) => { const k = x.u.split("?")[0]; if (seen.has(k)) return false; seen.add(k); return true; });
  return { items: keep, status };
}

// ---- grouping items into stories ------------------------------------------------------------------------------
const STOP = new Set("a an and are as at be been but by can could did do does for from had has have he her his how i if in into is it its just more most new news not now of on one or our out over says said say she so than that the their them then there these they this to up us was we were what when where which who why will with would you your after about amid against before being both during first get gets got here make makes may might much must next off only other still such take takes than then through under very vs week what while year years day days live updates update watch video report reports opinion analysis key top takeaways moments says".split(" "));
const stem = (w: string) => w.replace(/'s$/, "").replace(/(ies)$/, "y").replace(/(es|s)$/, "").replace(/ing$/, "");
/** Words seen capitalized mid headline in a sentence case headline anywhere in the corpus: names and places. */
export function nameSet(titles: string[]) {
  const names = new Set<string>();
  for (const t of titles) {
    const raw = t.split(/[^A-Za-z0-9'\u2019]+/).filter(Boolean);
    const caps = raw.filter((w) => /^[A-Z]/.test(w)).length;
    if (raw.length < 4 || caps / raw.length > 0.6) continue; // Title Case headlines say nothing about names
    raw.forEach((w, i) => { if (i > 0 && /^[A-Z]/.test(w)) names.add(stem(w.toLowerCase().replace(/[\u2019']s$/, ""))); });
  }
  return names;
}
export function tokens(t: string, names?: Set<string>) {
  const raw = t.replace(/[\u2018\u2019]/g, "'").split(/[^A-Za-z0-9']+/).filter(Boolean);
  const out = new Map<string, number>();
  for (const w of raw) {
    const lw = w.toLowerCase(); if (lw.length < 3 || STOP.has(lw)) continue;
    const k = stem(lw); out.set(k, names?.has(k) ? 2 : Math.max(out.get(k) ?? 0, 1));
  }
  return out;
}

export function cluster(items: Item[]): Cluster[] {
  const names = nameSet(items.map((x) => x.t));
  const docs = items.map((x) => tokens(x.t, names));
  const df = new Map<string, number>(); for (const d of docs) for (const k of d.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  const N = Math.max(1, items.length);
  const idf = (k: string) => Math.log(1 + N / (df.get(k) ?? 1));
  type G = { idx: number[]; w: Map<string, number> };
  const groups: G[] = [];
  const order = items.map((_, i) => i).sort((a, b) => items[a].d - items[b].d);
  for (const i of order) {
    const d = docs[i]; if (d.size < 2) { groups.push({ idx: [i], w: new Map([...d].map(([k, v]) => [k, v * idf(k)])) }); continue; }
    let best = -1, bs = 0;
    for (let g = 0; g < groups.length; g++) {
      const G = groups[g]; const t0 = items[G.idx[G.idx.length - 1]].d; if (items[i].d - t0 > 36 * 3600_000) continue;
      let inter = 0, shared = 0, sharedName = 0, self = 0;
      for (const [k, v] of d) { const w = v * idf(k); self += w; const gw = G.w.get(k); if (gw) { inter += Math.min(w, gw / G.idx.length * 1.5); shared++; if (v === 2) sharedName++; } }
      const score = inter / Math.max(1e-9, self);
      if (((shared >= 2 && sharedName >= 1) || shared >= 3) && score > bs) { bs = score; best = g; }
    }
    if (best >= 0 && bs >= 0.3) { const G = groups[best]; G.idx.push(i); for (const [k, v] of d) G.w.set(k, (G.w.get(k) ?? 0) + v * idf(k)); }
    else groups.push({ idx: [i], w: new Map([...d].map(([k, v]) => [k, v * idf(k)])) });
  }
  // a second pass joins groups that grew toward each other: cosine of their word weights
  const norm = (m: Map<string, number>) => Math.sqrt([...m.values()].reduce((a, v) => a + v * v, 0)) || 1;
  for (let a = 0; a < groups.length; a++) {
    for (let b = a + 1; b < groups.length; b++) {
      const A = groups[a], B = groups[b]; if (!A.idx.length || !B.idx.length) continue;
      let dot = 0, nameHit = false; for (const [k, v] of A.w) { const u = B.w.get(k); if (u) { dot += v * u; if (names.has(k)) nameHit = true; } }
      if (nameHit && dot / (norm(A.w) * norm(B.w)) >= 0.42) { A.idx.push(...B.idx); for (const [k, v] of B.w) A.w.set(k, (A.w.get(k) ?? 0) + v); B.idx = []; b = a; }
    }
  }
  const out: Cluster[] = [];
  for (const G of groups.filter((g) => g.idx.length)) {
    const its = G.idx.map((i) => items[i]).sort((a, b) => b.d - a.d);
    // one line per outlet: its latest headline on the story
    const per = new Map<string, Item>(); for (const x of its) if (!per.has(x.o)) per.set(x.o, x);
    const uniq = [...per.values()];
    const n = { L: 0, C: 0, R: 0 }; for (const x of uniq) n[x.lean]++;
    const cats = new Map<Cat, number>(); for (const x of uniq) cats.set(x.cat, (cats.get(x.cat) ?? 0) + 1);
    const cat = [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // the headline shown first: a straight news line from a Center outlet where there is one
    const head = uniq.find((x) => x.lean === "C" && !x.op) ?? uniq.find((x) => !x.op) ?? uniq[0];
    const tot = uniq.length;
    const blind = tot >= 4 && n.L === 0 && n.R >= 3 ? "L" : tot >= 4 && n.R === 0 && n.L >= 3 ? "R" : null;
    const keys = [...G.w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
    out.push({ id: keys.slice(0, 4).join("-") + "-" + its[its.length - 1].d.toString(36), head, items: uniq, n, outlets: tot, cat, first: its[its.length - 1].d, last: its[0].d, blind, keys });
  }
  // stories carried by the most outlets, then the newest
  return out.sort((a, b) => b.outlets - a.outlets || b.last - a.last);
}
