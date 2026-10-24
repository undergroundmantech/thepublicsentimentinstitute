import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import NightDesk from "../NightDesk";
import StateLive, { type LiveGroup } from "./StateLive";
import AlertSignup from "@/app/components/AlertSignup";
import JsonLd from "@/app/components/JsonLd";
import { seo, graph, pageLd, crumbsLd } from "@/app/lib/seo";
import { faqLd } from "@/app/maps/early-vote/Summary";
import { closeSentence } from "@/app/lib/pollClose";
import { STN, KIND_LABEL, fmtM, forecastHref, type XRace } from "../live";
import "../results2026.css";
import "./stateResults.css";

// Every November 3 race has a results page here, and so does every state: /results/2026/texas. The state pages are
// written for the searches people make on election night, so they render their races, the forecast and when the
// polls close as plain text, with the live returns filling in on top once counting starts.

let IX: XRace[] | null = null;
const races = () => (IX ??= (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/results/2026/index.json"), "utf8")).races as XRace[]));
const slugOf = (st: string) => (STN[st] ?? st).toLowerCase().replace(/[^a-z]+/g, "-");
const BY_SLUG = () => { const o: Record<string, string> = {}; for (const r of races()) o[slugOf(r.st)] = r.st; return o; };
const stateResultsHref = (st: string) => `/results/2026/${slugOf(st)}`;

export function generateStaticParams() {
  const st = Object.keys(BY_SLUG()).map((s) => ({ id: s }));
  return [...st, ...races().map((r) => ({ id: r.id }))];
}
export const dynamicParams = false;

const last = (n: string) => n.split(" ").filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop() ?? n;
const isIndR = (r: XRace) => r.c?.[0]?.[1] === "I";
function pair(r: XRace) {
  const c = r.c ?? [];
  const a = c.find((x) => x[1] === "D") ?? c.find((x) => x[1] === "I"), b = c.find((x) => x[1] === "R");
  return { a: a?.[0] ?? null, b: b?.[0] ?? null };
}
function between(r: XRace) { const p = pair(r); return p.a && p.b ? `${p.a} and ${p.b}` : p.a || p.b || ""; }
function who(r: XRace) { if (r.k === "measure") return r.off || "Ballot measure"; const p = pair(r); return p.a && p.b ? `${p.a} vs ${p.b}` : p.a || p.b || ""; }
const short = (r: XRace) => (r.k === "house" ? `District ${Number(r.id.split("-")[2])}` : r.nm.replace(`${STN[r.st]} `, "").replace(/^./, (x) => x.toUpperCase()));

function stateMeta(st: string) {
  const name = STN[st], rs = races().filter((r) => r.st === st);
  const sen = rs.find((r) => r.k === "sen"), gov = rs.find((r) => r.k === "gov");
  const parts = [sen ? "Senate" : null, gov ? "Governor" : null, rs.some((r) => r.k === "house") ? "House" : null].filter(Boolean).join(", ");
  return { name, rs, sen, gov, parts };
}
function favored(r: XRace): string | null {
  if (r.m == null || r.pR == null) return null;
  const p = pair(r), lead = r.m > 0 ? p.b : p.a; if (!lead) return null;
  if (Math.abs(r.m) >= 99) return `${lead} is unopposed.`;
  const pw = r.m > 0 ? r.pR : 1 - r.pR;
  return `${lead} leads the On Point forecast by ${Math.abs(r.m).toFixed(1)} points and wins ${Math.round(pw * 100)} percent of the model's simulated elections.`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const key = decodeURIComponent(id);
  const st = BY_SLUG()[key];
  if (st) {
    const m = stateMeta(st);
    return seo({ title: `${m.name} Election Results 2026: Live ${m.parts || "Race"} Count | On Point Politics`, absoluteTitle: true, path: `/results/2026/${key}`, type: "article",
      description: `Live ${m.name} election results for November 3, 2026, race by race: ${[m.sen ? `Senate, ${who(m.sen)}` : null, m.gov ? `governor, ${who(m.gov)}` : null].filter(Boolean).join("; ") || `${m.rs.length} races`}, with the On Point forecast beside the count and results by county.`,
      keywords: [`${m.name} election results`, `${m.name} election results 2026`, `${m.name} results tonight`, `${m.name} senate results`, `${m.name} governor results`, `${m.name} midterm results`] });
  }
  const r = races().find((x) => x.id === key);
  if (!r) return {};
  const w = who(r);
  return seo({ title: `${r.nm} Results 2026: Live Count${w && r.k !== "measure" ? `, ${w}` : ""} | On Point Politics`, absoluteTitle: true, path: `/results/2026/${encodeURIComponent(r.id)}`, type: "article",
    description: `Live results for the ${r.nm} race on November 3, 2026${w && r.k !== "measure" ? `, ${w}` : ""}: the count as it comes in, county by county, against the On Point Politics forecast, with an estimate of the final result.` });
}

function StatePage({ st }: { st: string }) {
  const { name, rs, sen, gov } = stateMeta(st);
  const slug = slugOf(st), p = `/results/2026/${slug}`;
  const close = closeSentence(st, name);
  const nHouse = rs.filter((r) => r.k === "house").length, nState = rs.filter((r) => r.k === "state").length, nMeas = rs.filter((r) => r.k === "measure").length;
  const marquee = [sen ? `the Senate race between ${between(sen)}` : null, gov ? `the governor race between ${between(gov)}` : null].filter(Boolean).join(" and ");
  const counts = [nHouse ? `${nHouse} House ${nHouse === 1 ? "seat" : "seats"}` : null, nState ? `${nState} statewide ${nState === 1 ? "office" : "offices"}` : null, nMeas ? `${nMeas} ballot ${nMeas === 1 ? "measure" : "measures"}` : null].filter(Boolean);
  const lede = `Live ${name} election results for November 3, 2026${marquee ? `: ${marquee}` : ""}${counts.length ? `${marquee ? ", plus " : ": "}${counts.length > 1 ? `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}` : counts[0]}` : ""}. ${close ?? ""} Until votes are counted each race shows the On Point forecast; returns fill in as counties report.`;
  const ORDER: XRace["k"][] = ["sen", "gov", "house", "state", "measure", "leg", "other"];
  const groups: LiveGroup[] = ORDER.map((k) => {
    const all = rs.filter((r) => r.k === k).sort((a, b) => (k === "house" ? Number(a.id.split("-")[2]) - Number(b.id.split("-")[2]) : a.nm.localeCompare(b.nm)));
    const cap = k === "leg" || k === "other" ? 6 : 80;
    return { k, label: KIND_LABEL[k], rows: all.slice(0, cap).map((r) => ({ id: r.id, label: k === "sen" || k === "gov" ? KIND_LABEL[k] : short(r), who: who(r), m: r.m ?? null, ind: isIndR(r), href: `/results/2026/${encodeURIComponent(r.id)}`, fhref: forecastHref(r), k })),
      more: all.length > cap ? { n: all.length - cap, href: `/results/2026?st=${st}` } : undefined };
  }).filter((g) => g.rows.length);
  const faq: [string, string][] = [
    ...(close ? [[`When do polls close in ${name}?`, `${close} Results begin to appear here as soon as the first counties report.`] as [string, string]] : []),
    ...(sen && favored(sen) ? [[`Who is favored in the ${name} Senate race?`, `${who(sen)}. ${favored(sen)}`] as [string, string]] : []),
    ...(gov && favored(gov) ? [[`Who is favored in the ${name} governor race?`, `${who(gov)}. ${favored(gov)}`] as [string, string]] : []),
    [`Where can I see ${name} results by county?`, `Open any race on this page for its county by county count, the share of the expected vote in, and an estimate of the final margin from the counties still out.`],
    [`How often do these results update?`, `The page reads the live count from civicAPI, which gathers it from state and county election offices, about once a minute on election night.`],
  ];
  const evSlug = slug;
  return (
    <main className="opp srs">
      <JsonLd data={graph(pageLd({ name: `${name} election results 2026`, description: lede, path: p }), crumbsLd([["Home", "/"], ["Results", "/results"], ["2026", "/results/2026"], [name, p]]), faqLd(faq))} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/results/2026">Results</Link><span className="sep">/</span><span>{name}</span></nav>
      <header className="srs-hero">
        <span className="eye g">Election night · November 3, 2026</span>
        <h1>{name} election results</h1>
        <p className="lede">{lede}</p>
        <div className="srs-links">
          <Link className="btn sm" href="/results/monitor">Situation monitor</Link>
          <Link className="btn sm" href={`/maps/early-vote/${evSlug}`}>{name} early vote</Link>
          {sen ? <Link className="btn sm" href={forecastHref(sen)}>Senate forecast</Link> : null}
          {gov ? <Link className="btn sm" href={forecastHref(gov)}>Governor forecast</Link> : null}
        </div>
      </header>
      <StateLive groups={groups} st={st} />
      <AlertSignup from="results" title={`${name} results in your inbox`} note="The On Point newsletter: the final forecast before Election Day and the results as races are called. Free, and you can leave any time." />
      <section className="srs-faq" aria-labelledby="srs-faq">
        <h2 id="srs-faq">{name} results, answered</h2>
        {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      <nav className="srs-states" aria-label="Results by state">
        <h2>Results by state</h2>
        <div>{Object.entries(BY_SLUG()).sort((a, b) => a[0].localeCompare(b[0])).map(([s, x]) => <Link key={x} href={`/results/2026/${s}`} aria-current={x === st ? "page" : undefined}>{STN[x]}</Link>)}</div>
      </nav>
    </main>
  );
}

function RaceAbout({ r }: { r: XRace }) {
  const name = STN[r.st] ?? r.st, close = closeSentence(r.st, name), fav = r.k === "measure" ? null : favored(r);
  return (
    <section className="opp srs-about" aria-labelledby="srs-about">
      <JsonLd data={graph(crumbsLd([["Home", "/"], ["Results", "/results"], [name, stateResultsHref(r.st)], [r.nm, `/results/2026/${encodeURIComponent(r.id)}`]]))} />
      <h2 id="srs-about">About the {r.nm} results</h2>
      <p>{r.nm}{r.k !== "measure" && who(r) ? `: ${who(r)}` : ""}. {fav ?? (r.m != null ? `The On Point forecast has it at ${fmtM(r.m, r.k, isIndR(r))}.` : "")} {r.tot ? `About ${Math.round(r.tot).toLocaleString("en-US")} votes are expected.` : ""} {close ?? ""}</p>
      <div className="srs-links">
        <Link className="btn sm" href={stateResultsHref(r.st)}>Every {name} result</Link>
        <Link className="btn sm" href={forecastHref(r)}>The forecast</Link>
        <Link className="btn sm" href={`/maps/early-vote/${slugOf(r.st)}`}>{name} early vote</Link>
      </div>
    </section>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const key = decodeURIComponent(id);
  const st = BY_SLUG()[key];
  if (st) return <StatePage st={st} />;
  const r = races().find((x) => x.id === key);
  return <>{<NightDesk id={key} />}{r ? <RaceAbout r={r} /> : null}</>;
}
