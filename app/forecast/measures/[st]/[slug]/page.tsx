import type { Metadata } from "next";
import Link from "next/link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { STATE_NAME } from "@/app/lib/opp";
import { GROUP_LABEL, YES_RAMP, bmHref, getMeasures, verdict, yesFill, type Measure } from "../../data";
import "../../measures.css";
import JsonLd from "@/app/components/JsonLd";
import { measureLd, measureMeta } from "../../../seo";

export const dynamicParams = false;
export function generateStaticParams() {
  return getMeasures().measures.map((m) => ({ st: m.st.toLowerCase(), slug: m.slug }));
}
const find = (st: string, slug: string): Measure | undefined => getMeasures().measures.find((m) => m.st === st.toUpperCase() && m.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ st: string; slug: string }> }): Promise<Metadata> {
  const { st, slug } = await params;
  const m = find(st, slug);
  return m ? measureMeta(m) : {};
}

const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
const TYPE: Record<string, string> = {
  "legislative referral constitutional": "Constitutional amendment referred by the legislature", "legislative referral statute": "Statute referred by the legislature",
  "initiated constitutional amendment": "Citizen initiated constitutional amendment", "initiated statute": "Citizen initiated statute", "veto referendum": "Referendum on a law",
  bond: "Bond issue", advisory: "Advisory question",
};

export default async function Page({ params }: { params: Promise<{ st: string; slug: string }> }) {
  const { st, slug } = await params;
  const m = find(st, slug);
  if (!m) notFound();
  const data = getMeasures();
  const state = STATE_NAME[m.st] ?? m.st;
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const v = verdict(m.est.prob);
  const sibs = data.measures.filter((x) => x.st === m.st && x.id !== m.id);
  let paths: CountyPath[] = [];
  try {
    const geo = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "states", `${m.st}.json`), "utf8")) as { counties: CountyPath[] };
    paths = geo.counties.filter((p) => m.counties[p.id] != null);
  } catch { paths = []; }
  let names: Record<string, string> = {};
  try { names = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "counties.json"), "utf8"))._n ?? {}) as Record<string, string>; } catch { names = {}; }
  const fills: Record<string, string> = {}, tips: Record<string, GeoTip> = {};
  for (const p of paths) {
    const y = m.counties[p.id];
    fills[p.id] = yesFill(y);
    const nm = names[p.id] ?? p.id;
    tips[p.id] = { title: /county|parish|city|borough|census area/i.test(nm) ? nm : `${nm}${m.st === "LA" ? " Parish" : " County"}`, rows: [["Yes", `${y.toFixed(1)}%`, "#2fbf9b"], ["No", `${(100 - y).toFixed(1)}%`, "#e8794a"]] };
  }
  const yesC = paths.filter((p) => m.counties[p.id] >= 50).length;
  const thr = m.threshold * 100;
  const X = (val: number) => `${Math.max(0, Math.min(100, ((val - 20) / 60) * 100))}%`;
  const lede = `${m.summary} The forecast has Yes at ${m.est.yes.toFixed(1)} percent against the ${thr === 50 ? "50" : (Math.round(thr * 10) / 10).toString()} percent it needs, a ${pct(m.est.prob)} chance to pass.`;

  return (
    <div className="opp bm fc-wide">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href="/forecast/measures">Ballot measures</Link><span className="sep">/</span><span>{state} {m.label}</span>
      </nav>
      <ForecastNav />
      <JsonLd data={measureLd(m)} />
      <header className="bm-head">
        <div>
          <div className="eye g">2026 ballot measure forecast</div>
          <h1>{state} <em>{m.label}</em></h1>
          <p className="bm-title">{m.title}</p>
          <p className="lede">{lede}</p>
          <div className="pmeta">
            <span className={`pill ${v.cls}`}>{v.label}</span><span>{TYPE[m.type] ?? m.type}</span><span>{GROUP_LABEL[m.group] ?? m.group}</span><span>Updated <b>{updated}</b></span>
          </div>
        </div>
        <div className="bm-strip">
          <div className="card bm-s"><div className="lab">Chance to pass</div><b className={`mono ${v.cls}`}>{pct(m.est.prob)}</b><div className="sub">2,000 simulations</div></div>
          <div className="card bm-s"><div className="lab">Forecast Yes</div><b className="mono">{m.est.yes.toFixed(1)}%</b><div className="sub">80% range {m.est.p10.toFixed(0)} to {m.est.p90.toFixed(0)}</div></div>
          <div className="card bm-s"><div className="lab">Needs</div><b className="mono ct">{(Math.round(thr * 10) / 10).toString()}%</b><div className="sub">{m.thresholdNote}</div></div>
          <div className="card bm-s"><div className="lab">Polling average</div><b className="mono">{m.pollAvg != null ? `${m.pollAvg.toFixed(1)}%` : "None"}</b><div className="sub">{m.pollAvg != null ? "Yes, with undecided split two to one for No" : "No public polls found"}</div></div>
        </div>
      </header>

      <section className="bm-top">
        <div className="card">
          <div className="card-h"><h3>County forecast</h3><span className="eye" style={{ marginLeft: "auto" }}>{paths.length ? `${yesC} of ${paths.length} ${m.st === "LA" ? "parishes" : "counties"} vote Yes` : "statewide"}</span></div>
          <div className="card-b" style={{ padding: 10 }}>
            {paths.length > 1 ? <GeoMap paths={paths} fills={fills} tips={tips} label={`${state} ${m.label} county forecast`} W={1000} H={640} /> : <div className="empty" style={{ padding: 40, color: "var(--mute)" }}>One statewide unit; no county map for this measure.</div>}
            <div className="bm-legend"><span className="cn">No +30</span><i style={{ background: YES_RAMP }} /><span className="cy">Yes +30</span><span>Hover a county for its forecast</span></div>
          </div>
        </div>
        <div className="bm-side">
          <div className="card bm-odds">
            <div className="lab">Where the Yes vote lands</div>
            <div className="bm-scale" aria-label={`Forecast Yes ${m.est.yes.toFixed(1)} percent, 80 percent range ${m.est.p10.toFixed(0)} to ${m.est.p90.toFixed(0)}, needs ${thr.toFixed(1)}`}>
              <div className="trk" />
              <div className="rng" style={{ left: X(m.est.p10), width: `calc(${X(m.est.p90)} - ${X(m.est.p10)})` }} />
              <div className="thr" style={{ left: X(thr) }}><span>needs {(Math.round(thr * 10) / 10).toString()}</span></div>
              <div className="pt" style={{ left: X(m.est.yes) }} />
              {[20, 35, 50, 65, 80].map((t) => <span key={t} className="ax" style={{ left: X(t) }}>{t}</span>)}
            </div>
            <dl className="bm-dl" style={{ marginTop: 18 }}>
              <div><dt>History and structure</dt><dd className="mono">{m.prior.toFixed(1)}% Yes</dd></div>
              <div><dt>Polls</dt><dd className="mono">{m.pollAvg != null ? `${m.pollAvg.toFixed(1)}% Yes` : "None"}</dd></div>
              <div><dt>Forecast</dt><dd className="mono">{m.est.yes.toFixed(1)}% Yes</dd></div>
              <div><dt>Yes leans</dt><dd>{m.lean === "D" ? "Democratic" : m.lean === "R" ? "Republican" : "Neither party"}</dd></div>
              {m.ruleNote ? <div><dt>Rule to pass</dt><dd style={{ maxWidth: 240 }}>{m.ruleNote}</dd></div> : null}
            </dl>
          </div>
          {m.campaign ? <div className="card" style={{ padding: 18 }}><div className="eye" style={{ marginBottom: 8 }}>The campaign</div><p className="bm-sum">{m.campaign}</p></div> : null}
          {sibs.length ? (
            <div className="card bm-sib">
              <div className="card-h"><h3>Also on the {state} ballot</h3></div>
              {sibs.map((x) => (
                <Link key={x.id} href={bmHref(x)} className="bm-row">
                  <div><div className="t1">{x.label}</div><div className="t2">{x.title}</div></div>
                  <div className="bm-bar"><i style={{ width: X(x.est.yes) }} /><s style={{ left: X(x.threshold * 100) }} /></div>
                  <div className={`pp ${x.est.prob >= 0.6 ? "cy" : x.est.prob <= 0.4 ? "cn" : "ct"}`}>{pct(x.est.prob)}</div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <div className="bm-foot">
        <div className="card">
          <div className="card-h"><h3>Polls of the measure</h3><span className="eye" style={{ marginLeft: "auto" }}>{m.polls.length || "no"} {m.polls.length === 1 ? "poll" : "polls"}</span></div>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Pollster</th><th>Sample</th><th style={{ textAlign: "right" }}>Ended</th><th style={{ textAlign: "right" }}>Yes</th><th style={{ textAlign: "right" }}>No</th><th style={{ textAlign: "right" }}>Undecided</th><th style={{ textAlign: "right" }}>Yes, adjusted</th></tr></thead>
              <tbody>
                {m.polls.length ? m.polls.map((p, i) => (
                  <tr key={i}>
                    <td>{p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer">{p.pollster}</a> : p.pollster}{p.side === "yes" || p.side === "no" ? <span style={{ color: "var(--mute)", fontSize: 11.5 }}> · for the {p.side === "yes" ? "Yes" : "No"} side</span> : null}</td>
                    <td className="mono" style={{ color: "var(--ink2)" }}>{p.n ? p.n.toLocaleString() : ""} {p.pop ?? ""}</td>
                    <td className="n">{p.end ?? ""}</td>
                    <td className="n cy">{p.yes ?? ""}</td><td className="n cn">{p.no ?? ""}</td><td className="n">{p.und ?? ""}</td>
                    <td className="n">{p.adj != null ? `${p.adj.toFixed(1)}%` : ""}</td>
                  </tr>
                )) : <tr><td colSpan={7} style={{ color: "var(--ink2)" }}>No public polls of this measure. The forecast rests on how comparable measures have run and how it reached the ballot.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="callout">
          <div className="eye">How this is built</div>
          {m.label} is forecast as a {(GROUP_LABEL[m.group] ?? m.group).toLowerCase()} measure whose Yes vote leans {m.lean === "D" ? "Democratic" : m.lean === "R" ? "Republican" : "to neither party"}.
          Comparable measures from 2018 to 2024 set how far its Yes share moves with {state}&apos;s partisanship and with each county&apos;s 2024 presidential vote, and
          how it reached the ballot moves it further. Polls then pull the forecast toward them by recency and size, after splitting undecided voters two to one for No.
          {m.sources.length ? <> Sources: {m.sources.slice(0, 4).map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>{i ? ", " : ""}{new URL(u).hostname.replace(/^www\./, "")}</a>)}.</> : null}{" "}
          <Link href="/forecast/measures" style={{ textDecoration: "underline" }}>All measures</Link>.
        </div>
      </div>
    </div>
  );
}
