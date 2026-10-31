import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import GeoMap, { type GeoTip } from "@/app/components/opp/GeoMap";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { STATE_NAME } from "@/app/lib/opp";
import { GROUP_LABEL, YES_RAMP, bmHref, getMeasures, getMeasureCounties, verdict, yesFill, type Measure } from "../../data";
import { MeasureVotes, countyName } from "@/app/components/opp/VoteTables";
import CountyExplorer from "@/app/components/opp/CountyExplorer";
import "../../measures.css";
import { STORY_CSS, ShareBars, SecTitle, phraseFor } from "@/app/components/opp/RaceStory";
import StageHero from "@/app/components/opp/StageHero";
import Ambient from "@/app/components/opp/Ambient";
import SectionNav from "@/app/components/opp/SectionNav";
import OutcomeHist from "@/app/components/opp/OutcomeHist";
import { FX_CSS } from "@/app/components/opp/fxCss";
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
  const cvs = getMeasureCounties()[m.id] ?? {};
  const mRows = Object.entries(cvs).map(([f, v]) => ({ id: f, name: countyName(names[f] ?? f, m.st), yes: v[1], no: v[2] }));
  for (const p of paths) { const c = cvs[p.id]; if (c && tips[p.id]) tips[p.id].rows.push(["Yes votes", c[1].toLocaleString()], ["No votes", c[2].toLocaleString()]); }
  const thr = m.threshold * 100;
  const X = (val: number) => `${Math.max(0, Math.min(100, ((val - 20) / 60) * 100))}%`;
  const thrS = (Math.round(thr * 10) / 10).toString();
  const lede = `${m.summary} The forecast has Yes at ${m.est.yes.toFixed(1)} percent against the ${thrS} percent it needs, a ${pct(m.est.prob)} chance to pass.`;
  const YES = "#2fbf9b", NO = "#e8794a";
  const passes = m.est.prob >= 0.5;
  const leadWin = passes ? m.est.prob : 1 - m.est.prob;
  const phrase = phraseFor(leadWin);
  const unit = m.st === "LA" ? "parishes" : m.st === "AK" ? "boroughs" : "counties";
  const half = Math.max(0.5, Math.abs(m.est.p90 - m.est.p10) / 4);
  const yesV = m.votes?.yes ?? 0, noV = m.votes?.no ?? 0;
  const pathRows: [string, string, number | null][] = [
    ["History and structure", "comparable measures, the state's lean and how it reached the ballot", m.prior],
    ["Polls", m.pollAvg != null ? `${m.polls.length} ${m.polls.length === 1 ? "poll" : "polls"}, undecided split two to one for No` : "no public polls", m.pollAvg],
    ["Forecast", m.pollWeight ? `polls carry ${Math.round(m.pollWeight * 100)} percent of the weight` : "history and structure alone", m.est.yes],
  ];
  const navItems = [
    { id: "map", label: "County map" }, { id: "vote", label: "Yes and No" }, { id: "polls", label: "Polling" }, { id: "path", label: "How we got here" },
    ...(m.campaign ? [{ id: "campaign", label: "The campaign" }] : []), ...(sibs.length ? [{ id: "ballot", label: "Also on the ballot" }] : []),
    ...(m.votes && mRows.length ? [{ id: "counties", label: "Every county" }] : []),
  ];

  return (
    <div className="opp bm fc-xl fx fx-dark">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span>
        <Link href="/forecast/measures">Ballot measures</Link><span className="sep">/</span><span>{state} {m.label}</span>
      </nav>
      <ForecastNav />
      <JsonLd data={measureLd(m)} />
      <style>{STORY_CSS}</style>
      <Ambient tint="#7fe0c4" />
      <StageHero
        eyebrow={`2026 ballot measure · ${state} ${m.label}`}
        title={phrase
          ? <><span className="nm" style={{ color: passes ? YES : NO }}>{m.label}</span> is <span className="ph-w">{phrase}</span> to {passes ? "pass" : "fail"} in {state}.</>
          : <>{state}&apos;s <span className="nm" style={{ color: "#f3eff8" }}>{m.label}</span> is a <span className="ph-w">toss up</span>.</>}
        lede={<><b style={{ color: "#fff" }}>{m.title}.</b> {lede}</>}
        pills={<>
          <span className={`pill ${v.cls}`}>{v.label}</span>
          <span>Yes <b className="mono">{m.est.yes.toFixed(1)}%</b></span>
          <span>Needs <b className="mono">{thrS}%</b></span>
          <span>{TYPE[m.type] ?? GROUP_LABEL[m.group] ?? m.type}</span>
          <span>Updated <b>{updated}</b></span>
        </>}
        cands={m.votes ? [{ name: "Yes", label: "For the measure", pct: (100 * yesV) / Math.max(1, yesV + noV), votes: yesV, color: YES }, { name: "No", label: "Against the measure", pct: (100 * noV) / Math.max(1, yesV + noV), votes: noV, color: NO }] : []}
        paths={paths} fills={fills} mapLabel={`${state} ${m.label} drawn in pixels, shaded by the Yes vote`}
        labels={Object.fromEntries(paths.map((p) => { const y = m.counties[p.id]; return [p.id, { t: tips[p.id]?.title ?? p.id, s: `Yes ${y.toFixed(1)}%`, c: y >= 50 ? "#7fe0c4" : "#f2a27f" }]; }))}
        win={leadWin} lead={{ name: passes ? "Yes" : "No", color: passes ? YES : NO }} other={{ name: passes ? "No" : "Yes", color: passes ? NO : YES }} />

      <style>{FX_CSS}</style>
      <div className="fx-kpis">
        <div className="card fx-k"><span>Chance to pass</span><b className={`mono ${v.cls}`}>{pct(m.est.prob)}</b><small>{v.label}, 2,000 simulations</small></div>
        <div className="card fx-k"><span>Forecast Yes</span><b className="mono">{m.est.yes.toFixed(1)}%</b><small>80% range {m.est.p10.toFixed(0)} to {m.est.p90.toFixed(0)}</small></div>
        <div className="card fx-k"><span>Needs</span><b className="mono ct">{thrS}%</b><small>{m.thresholdNote}</small></div>
        <div className="card fx-k"><span>Polling average</span><b className="mono">{m.pollAvg != null ? `${m.pollAvg.toFixed(1)}%` : "None"}</b><small>{m.pollAvg != null ? "Yes, undecided split two to one for No" : "No public polls found"}</small></div>
      </div>

      <div className="fx-body">
        <SectionNav items={navItems} />
        <div style={{ display: "grid", gap: 56, minWidth: 0 }}>
          <section id="map" className="st-sec">
            <SecTitle title="The county map" sub={`Yes carries ${yesC} of ${paths.length} ${unit}. Each one moves with its own voters, not the statewide number`} />
            {paths.length > 1 && mRows.length ? (
              <section className="fx-sec" aria-label="County explorer">
                <CountyExplorer kind="measure" paths={paths} unit={unit} stateName={state}
                  title={`${m.label} by ${m.st === "LA" ? "parish" : m.st === "AK" ? "borough" : "county"}`}
                  rows={mRows.map((c) => ({ id: c.id, name: c.name, a: c.yes, b: c.no, other: 0, total: c.yes + c.no }))}
                  sides={[{ name: "Yes", short: "Yes", color: YES, letter: "Yes" }, { name: "No", short: "No", color: NO, letter: "No" }]} />
              </section>
            ) : paths.length ? (
              <div className="card"><div className="card-b" style={{ padding: 10 }}><GeoMap paths={paths} fills={fills} tips={tips} label={`${m.label} map`} />
                <div className="legend" style={{ paddingInline: 8 }}><span>No</span><span className="ramp" style={{ flex: 1, maxWidth: 280, margin: 0, background: YES_RAMP }} /><span>Yes</span></div></div></div>
            ) : <div className="card"><div className="card-b">No county build for this measure.</div></div>}
          </section>

          <section id="vote" className="st-sec">
            <SecTitle title="Yes and No" sub="Each side's projected share and the range of 80 percent of simulations" />
            <ShareBars half={half} cands={[{ name: "Yes", party: "For the measure", pct: m.est.yes, color: YES, win: m.est.prob }, { name: "No", party: "Against the measure", pct: 100 - m.est.yes, color: NO, win: 1 - m.est.prob }]} />
            <div className="fx-grid2">
              <div className="card bm-odds">
                <div className="lab">Where the Yes vote lands</div>
                <div className="bm-scale" aria-label={`Forecast Yes ${m.est.yes.toFixed(1)} percent, 80 percent range ${m.est.p10.toFixed(0)} to ${m.est.p90.toFixed(0)}, needs ${thr.toFixed(1)}`}>
                  <div className="trk" />
                  <div className="rng" style={{ left: X(m.est.p10), width: `calc(${X(m.est.p90)} - ${X(m.est.p10)})` }} />
                  <div className="thr" style={{ left: X(thr) }}><span>needs {thrS}</span></div>
                  <div className="pt" style={{ left: X(m.est.yes) }} />
                  {[20, 35, 50, 65, 80].map((t) => <span key={t} className="ax" style={{ left: X(t) }}>{t}</span>)}
                </div>
                <dl className="bm-dl" style={{ marginTop: 18 }}>
                  <div><dt>Projected Yes votes</dt><dd className="mono">{yesV ? yesV.toLocaleString("en-US") : "n/a"}</dd></div>
                  <div><dt>Projected No votes</dt><dd className="mono">{noV ? noV.toLocaleString("en-US") : "n/a"}</dd></div>
                  <div><dt>Yes leans</dt><dd>{m.lean === "D" ? "Democratic" : m.lean === "R" ? "Republican" : "Neither party"}</dd></div>
                  {m.ruleNote ? <div><dt>Rule to pass</dt><dd style={{ maxWidth: 260 }}>{m.ruleNote}</dd></div> : null}
                </dl>
              </div>
              <OutcomeHist title="Every simulated outcome" eye="2,000 sims" center={m.est.yes} p10={m.est.p10} p90={m.est.p90} line={thr} below={NO} above={YES}
                fmt={(x) => `${x.toFixed(0)}% Yes`} note={<>80 percent of simulations put Yes between {m.est.p10.toFixed(0)} and {m.est.p90.toFixed(0)} percent. Bars past the white line pass; it passes in {pct(m.est.prob)} of them.</>} />
            </div>
          </section>

          <section id="polls" className="st-sec">
            <SecTitle title="Polling" sub="Every public poll of the measure, as published and as the forecast counts it" />
            <div className="card">
              <div className="card-h"><h3>Polls of the measure</h3><span className="eye" style={{ marginLeft: "auto" }}>{m.polls.length || "no"} {m.polls.length === 1 ? "poll" : "polls"}</span></div>
              <div className="tblwrap">
                <table className="tbl">
                  <thead><tr><th>Pollster</th><th>Sample</th><th style={{ textAlign: "right" }}>Ended</th><th style={{ textAlign: "right" }}>Yes</th><th style={{ textAlign: "right" }}>No</th><th style={{ textAlign: "right" }}>Undecided</th><th style={{ textAlign: "right" }}>Yes, adjusted</th></tr></thead>
                  <tbody>
                    {m.pollAvg != null ? <tr className="avg"><td>On Point average</td><td>Recency and size weighted</td><td className="n" /><td className="n cy" colSpan={3} /><td className="n">{m.pollAvg.toFixed(1)}%</td></tr> : null}
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
          </section>

          <section id="path" className="st-sec">
            <SecTitle title="How we got here" sub="From comparable measures to the forecast, one stage at a time" />
            <div className="card st-path" style={{ padding: "14px 16px" }}>
              <div style={{ display: "grid", gap: 14 }}>
                {pathRows.map(([lab, note, val], i) => (
                  <div key={lab} style={{ display: "grid", gridTemplateColumns: "minmax(150px,220px) minmax(0,1fr) 70px", gap: 14, alignItems: "center" }}>
                    <div><b style={{ fontSize: 14 }}>{lab}</b><div style={{ fontSize: 11.5, color: "var(--mute)" }}>{note}</div></div>
                    <div style={{ position: "relative", height: 12, borderRadius: 6, background: "rgba(255,255,255,.06)" }}>
                      {val != null ? <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: X(val), borderRadius: 6, background: `linear-gradient(90deg,transparent,${val >= thr ? YES : NO})`, opacity: i === 2 ? 1 : 0.7 }} /> : null}
                      <span style={{ position: "absolute", left: X(thr), top: -4, bottom: -4, width: 2, background: "var(--hi)", opacity: 0.7 }} />
                    </div>
                    <b className="mono" style={{ textAlign: "right", color: val == null ? "var(--mute)" : val >= thr ? YES : NO }}>{val != null ? `${val.toFixed(1)}%` : "None"}</b>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "12px 0 0" }}>Scale runs from 20 to 80 percent Yes; the white tick is the {thrS} percent it needs.</p>
            </div>
          </section>

          {m.campaign ? (
            <section id="campaign" className="st-sec">
              <SecTitle title="The campaign" sub={`${GROUP_LABEL[m.group] ?? m.group}, ${TYPE[m.type] ?? m.type}`.toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} />
              <div className="card" style={{ padding: 18 }}><p className="bm-sum" style={{ margin: 0 }}>{m.campaign}</p></div>
            </section>
          ) : null}

          {sibs.length ? (
            <section id="ballot" className="st-sec">
              <SecTitle title={`Also on the ${state} ballot`} sub="Every other statewide measure, with its chance to pass" />
              <div className="card bm-sib">
                {sibs.map((x) => (
                  <Link key={x.id} href={bmHref(x)} className="bm-row">
                    <div><div className="t1">{x.label}</div><div className="t2">{x.title}</div></div>
                    <div className="bm-bar"><i style={{ width: X(x.est.yes) }} /><s style={{ left: X(x.threshold * 100) }} /></div>
                    <div className={`pp ${x.est.prob >= 0.6 ? "cy" : x.est.prob <= 0.4 ? "cn" : "ct"}`}>{pct(x.est.prob)}</div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {m.votes && mRows.length ? (
            <section id="counties" className="st-sec">
              <SecTitle title={`Every ${unit === "parishes" ? "parish" : unit === "boroughs" ? "borough" : "county"}`} sub="The projected Yes and No vote in each, largest first" />
              <MeasureVotes rows={mRows} yes={m.votes.yes} no={m.votes.no} unit={unit} needs={m.threshold * 100} />
            </section>
          ) : null}

          <div className="callout">
            <div className="eye">How this is built</div>
            {m.label} is forecast as a {(GROUP_LABEL[m.group] ?? m.group).toLowerCase()} measure whose Yes vote leans {m.lean === "D" ? "Democratic" : m.lean === "R" ? "Republican" : "to neither party"}.
            Comparable measures from 2018 to 2024 set how far its Yes share moves with {state}&apos;s partisanship, and each county moves with its own
            age, education, race and density mix as well as its 2024 presidential vote, so no two counties share a margin by default.
            How it reached the ballot moves it further. Polls then pull the forecast toward them by recency and size, after splitting undecided voters two to one for No.
            {m.sources.length ? <> Sources: {m.sources.slice(0, 4).map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>{i ? ", " : ""}{new URL(u).hostname.replace(/^www\./, "")}</a>)}.</> : null}{" "}
            <Link href="/forecast/measures" style={{ textDecoration: "underline" }}>All measures</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
