"use client";
// The election night desk for one November 3 race, in the same layout and arithmetic as the August boards:
// reported results, the live win probability and reporting rings, the projected final vote, then the county map
// (forecast or results, margin or turnout) and the county table. Expected votes come from the On Point Politics
// forecast; returns come from civicAPI through the caching proxy. Used on every race page and inside the monitor.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FloatTip from "@/app/components/opp/FloatTip";
import { marginColor, marginColorInd } from "@/app/lib/opp";
import { DESK_CSS } from "./deskCss";
import { STN, KIND_LABEL, FIRST_CLOSE, Phi, civicRace, expMargin, expSides, fmtK, fmtN, forecastHref, isInd, legDistricts, liveOdds, project, sides, type CDetail, type CRace, type XRace } from "./live";
import { useIndex, useLive, useStateFile } from "./useLive";

type Paths = { counties: { id: string; d: string }[]; districts: { id: string; d: string }[] };
const SET = (r: XRace) => (r.k === "leg" ? (["leg"] as const) : r.k === "measure" ? (["ballot"] as const) : r.k === "state" || r.k === "other" ? (["state"] as const) : (["fed"] as const));
const pctLabel = (p: number) => (p >= 99.95 ? ">99" : p > 0 && p < 0.05 ? "<1" : p.toFixed(1));
const signed = (m: number) => `${m >= 0 ? "+" : "−"}${Math.abs(m).toFixed(1)}`;
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
function bbox(paths: { d: string }[]) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of paths) { const re = /(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g; let m; while ((m = re.exec(p.d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } } const pad = Math.max(x1 - x0, y1 - y0) * 0.03; return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad]; }
const fmtClock = (d: Date | null) => (d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "—");
function countdown(ms: number) { if (ms <= 0) return "now"; const h = Math.floor(ms / 3600000), d = Math.floor(h / 24); return d > 0 ? `${d}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`; }

export default function NightDesk({ id, embedded = false, onClose }: { id: string; embedded?: boolean; onClose?: () => void }) {
  const ix = useIndex();
  const r = useMemo(() => ix?.races.find((x) => x.id === id) ?? null, [ix, id]);
  const sub = useMemo(() => (ix && r ? { ...ix, races: [r] } : null), [ix, r]);
  const sets = useMemo(() => (r ? [...SET(r)] : []), [r]);
  const live = useLive(sub, sets);
  const sf = useStateFile(r?.st ?? null);
  const [paths, setPaths] = useState<Paths | null>(null);
  const [det, setDet] = useState<CDetail | null>(null);
  const [view, setView] = useState<"forecast" | "results">("forecast");
  const [mode, setMode] = useState<"margin" | "turnout">("margin");
  const [tip, setTip] = useState<{ x: number; y: number; f: string } | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"votes" | "az" | "reporting" | "margin" | "gap">("votes");
  const [now, setNow] = useState(0);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!r) return; setPaths(null); fetch(`/forecast/states/${r.st}.json`).then((x) => (x.ok ? x.json() : null)).then(setPaths).catch(() => {}); }, [r]);
  const c: CRace | undefined = r ? live.byId[r.id] : undefined;
  const reporting = !!c && (c.pr > 0 || c.c.some((x) => x[2] > 0));
  useEffect(() => {
    setDet(null); if (!c || !reporting) return; let dead = false;
    civicRace(c.id).then((d) => { if (!dead) setDet(d); }).catch(() => {});
    return () => { dead = true; };
  }, [c, reporting, live.at]);
  useEffect(() => { if (reporting) setView("results"); }, [reporting]);

  if (!ix) return <div className="desk"><style>{DESK_CSS}</style><main className="shell"><div className="nd-load sx-skel" /></main></div>;
  if (!r) return <div className="desk"><style>{DESK_CSS}</style><main className="shell"><h1>Race not found</h1><p className="prose">This race is not in the November 3 index. <Link href="/results/2026">See every race</Link>.</p></main></div>;

  const ind = isInd(r);
  const exp = sf?.counties[r.id] ?? null;
  const names = sf?.names ?? {};
  const P = project(exp, det?.regions ?? null, r, c?.c ?? null, r.tot);
  const odds = liveOdds(r, P);
  const es = expSides(r);
  const isM = r.k === "measure";
  const A = isM ? "Yes" : ind ? (r.c?.[0]?.[0] ?? "Independent") : (r.c?.find((x) => x[1] === "D")?.[0] ?? "Democrat");
  const B = isM ? "No" : (r.c?.find((x) => x[1] === "R")?.[0] ?? "Republican");
  const colA = isM ? "#2fbf9b" : ind ? "#b78cff" : "var(--dem)", colB = isM ? "#e7794a" : "var(--gop)";
  const lead = odds.pA >= 0.5 ? "A" : "B";
  const leadName = lead === "A" ? last(A) : last(B), trailName = lead === "A" ? last(B) : last(A);
  const leadCol = lead === "A" ? colA : colB;
  const leadP = 100 * (lead === "A" ? odds.pA : odds.pB);
  const civWinner = c?.c.find((x) => x[4]);
  const projected = !civWinner && P.rep.t > 0 && P.pctIn >= 50 && leadP >= 99.5;
  const repPct = reporting ? Math.max(c?.pr ?? 0, 0) : 0;
  const status = !c ? "Not linked" : civWinner ? "Race called" : projected ? "Projected" : reporting ? "Counting" : now < FIRST_CLOSE ? "Polls open" : "Awaiting returns";
  const msLeft = FIRST_CLOSE - now;
  const margin = Math.abs(P.m);
  const cands = c ? [...c.c].sort((x, y) => y[2] - x[2]) : [];
  const counted = cands.reduce((s, x) => s + x[2], 0);
  const gap = cands.length > 1 ? cands[0][2] - cands[1][2] : 0;
  const tone = (party: string, name: string) => { const p = party.toLowerCase(); if (isM) return /^yes/i.test(name) ? colA : /^no$/i.test(name) ? colB : "var(--ink3)"; if (p.startsWith("dem")) return "var(--dem)"; if (p.startsWith("rep")) return "var(--gop)"; if (p.startsWith("ind") && ind) return colA; return "var(--ink3)"; };
  const finA = P.fin.t ? (100 * P.fin.a) / P.fin.t : 0, finB = P.fin.t ? (100 * P.fin.b) / P.fin.t : 0, finO = P.fin.t ? (100 * P.fin.o) / P.fin.t : 0;
  const nowA = P.rep.t ? (100 * P.rep.a) / P.rep.t : null, nowB = P.rep.t ? (100 * P.rep.b) / P.rep.t : null;
  const headline = !P.rep.t
    ? `No votes are counted yet. This is the forecast: ${leadName} ahead by ${margin.toFixed(1)} points, winning ${pctLabel(leadP)} percent of simulations. Each county's expected vote is set; returns replace it as they land.`
    : `${leadName} is projected to finish ${margin.toFixed(1)} points ahead, give or take ${(1.96 * odds.sd).toFixed(1)}, with about ${fmtK(Math.max(0, P.fin.t - P.rep.t))} votes still to count${P.swing != null && Math.abs(P.swing) >= 0.1 ? `. Counted counties are running ${Math.abs(P.swing).toFixed(1)} points ${P.swing < 0 ? (isM ? "more Yes" : ind ? "toward the independent" : "bluer") : (isM ? "more No" : "redder")} than expected` : ""}.`;

  // ---- county map and table ----
  const cPaths = (paths?.counties ?? []).filter((p) => exp?.[p.id]);
  const vb = cPaths.length ? bbox(cPaths) : null;
  const tot = exp ? Object.values(exp).map((e) => e[3]) : [];
  const tMax = Math.max(1, ...tot), tMin = Math.max(1, Math.min(...tot));
  const shade = (m: number) => (isM ? (m < 0 ? `rgba(47,191,155,${0.2 + Math.min(1, -m / 40) * 0.75})` : `rgba(231,121,74,${0.2 + Math.min(1, m / 40) * 0.75})`) : ind ? marginColorInd(m) : marginColor(m));
  const regM = (f: string) => { const g = det?.regions[f]; if (!g) return null; const s = sides(r, g.c); return s.t ? { m: (100 * (s.b - s.a)) / s.t, t: s.t, pr: g.pr, s } : null; };
  const expCM = (f: string) => { const e = exp?.[f]; return e && e[3] ? (100 * (e[1] - e[0])) / e[3] : null; };
  const fillOf = (f: string) => {
    if (view === "results") { const g = regM(f); return g ? shade(g.m) : "var(--map-blank)"; }
    const e = exp?.[f]; if (!e) return "var(--map-blank)";
    if (mode === "turnout") { const k = (Math.log(e[3]) - Math.log(tMin)) / Math.max(0.01, Math.log(tMax) - Math.log(tMin)); return `rgba(15,95,85,${(0.12 + 0.85 * k).toFixed(3)})`; }
    return shade(expCM(f) ?? 0);
  };
  const opac = (f: string) => { if (view !== "results") return 1; const g = regM(f); return g ? 0.35 + 0.65 * Math.min(1, g.pr / 100) : 1; };
  const rows = exp ? Object.entries(exp).map(([f, e]) => ({ f, n: names[f] ?? f, e, em: expCM(f), g: regM(f) })) : [];
  const ql = q.trim().toLowerCase();
  const shown = rows.filter((x) => !ql || x.n.toLowerCase().includes(ql)).sort((a, b) => sort === "az" ? a.n.localeCompare(b.n) : sort === "reporting" ? (b.g?.pr ?? -1) - (a.g?.pr ?? -1) : sort === "margin" ? Math.abs(a.g?.m ?? a.em ?? 0) - Math.abs(b.g?.m ?? b.em ?? 0) : sort === "gap" ? Math.abs(b.g && b.em != null ? b.g.m - b.em : 0) - Math.abs(a.g && a.em != null ? a.g.m - a.em : 0) : b.e[3] - a.e[3]);
  const legD = r.k === "leg" ? sf?.leg[r.id] ?? [] : [];
  const legLive = r.k === "leg" ? legDistricts(r, live.raw) : {};
  const seats = r.k === "leg" && c ? c.c.reduce((o, x) => { const p = x[1].toLowerCase(); if (p.startsWith("dem")) o.d += x[5] ?? 0; else if (p.startsWith("rep")) o.r += x[5] ?? 0; else o.o += x[5] ?? 0; return o; }, { d: 0, r: 0, o: 0 }) : { d: 0, r: 0, o: 0 };
  // a chamber's projected seats: each district's live chance where it reports, its forecast chance where it does not
  const legProj = r.k === "leg" ? legD.reduce((s, d) => { const lc = legLive[d.d.toUpperCase()]; if (lc && (lc.pr > 0 || lc.c.some((x) => x[2] > 0))) { const sd = sides({ ...r, k: "sen", c: [[d.D ?? "", "D", 0], [d.R ?? "", "R", 0]] }, lc.c); const m = sd.t ? (100 * (sd.b - sd.a)) / sd.t : 0; const f = Math.min(1, lc.pr / 100); return s + (lc.c.find((x) => x[4])?.[1].toLowerCase().startsWith("dem") ? 1 : Phi((-m) / (Math.max(0.5, 10 * Math.pow(1 - f, 0.9))))) * d.s; } return s + (d.pD ?? 0) * d.s; }, 0) : 0;

  const body = (
    <main className="shell">
      <section className="race-header" aria-labelledby="nd-title">
        {embedded ? <div className="archive-banner"><span>Situation monitor</span><button type="button" onClick={onClose}>Back to the globe</button></div> : null}
        {live.test && live.hidden > 0 ? <div className="archive-banner nd-test"><span>civicAPI is publishing test returns before Election Day. They are hidden here.</span><a href="?test=1">Preview with test returns</a></div> : null}
        {live.test && live.hidden === 0 && reporting ? <div className="archive-banner nd-test"><span>Test returns from civicAPI, shown for preview. These are not real votes.</span><a href="?">Hide test returns</a></div> : null}
        <div className="race-kicker">
          {reporting && <span className="live-dot" aria-hidden />}
          <span>{STN[r.st]} · November 3, 2026</span><span>•</span><span>{KIND_LABEL[r.k]}{exp ? " · county projection" : ""}</span>
        </div>
        <div className="race-heading-row">
          <div>
            <h1 id="nd-title">{r.nm}</h1>
            <p className="race-deck">{isM ? r.off : r.k === "leg" ? `${r.up ?? r.seats} of ${r.seats} seats on the ballot; ${r.maj} for a majority.` : `${A} and ${B}${r.c && r.c.length > 2 ? `, with ${r.c.length - 2} more on the ballot` : ""}. The forecast expects about ${fmtK(r.tot ?? es.t)} votes.`}</p>
          </div>
          <div className="race-meta" aria-label="Race update summary">
            <div className="meta-block"><span>Last updated</span><b>{fmtClock(live.at)}</b></div>
            <div className="meta-block"><span>Reported votes</span><b>{fmtN(counted)}</b></div>
            <div className="meta-block"><span>Estimated reporting</span><b>{pctLabel(P.pctIn)}%</b></div>
            <div className="meta-block"><span>civicAPI reporting</span><b>{pctLabel(repPct)}%</b></div>
            <div className="meta-block"><span>Race status</span><b>{status}</b></div>
          </div>
        </div>
        <nav className="race-tabs" aria-label="Race sections">
          <a href="#nd-results" aria-current="page">Overview</a><a href="#nd-forecast">Forecast</a>{exp ? <a href="#nd-counties">Counties</a> : null}{legD.length ? <a href="#nd-districts">Districts</a> : null}
          <Link href={forecastHref(r)}>The forecast page</Link>{!embedded ? <Link href="/results/monitor">Situation monitor</Link> : null}
        </nav>
      </section>

      <div className="dashboard-grid">
        <article className="card span-3" id="nd-results" aria-labelledby="nd-res">
          <div className="topline-shell">
            {civWinner || projected ? (
              <div className="winner-band">
                <span className="winner-badge" aria-hidden>✓</span>
                <div className="winner-copy">
                  <span>Winner · {civWinner ? "race called by civicAPI" : "On Point Polling projection"}</span>
                  <strong>{civWinner ? civWinner[0] : lead === "A" ? A : B} wins</strong>
                  <small>{signed(lead === "A" ? -P.m : P.m)} margin · {fmtN(gap)} votes · {pctLabel(P.pctIn)}% of the estimated vote counted</small>
                </div>
              </div>
            ) : null}
            <header className="topline-header">
              <div className="topline-title"><h2 id="nd-res">Reported results</h2><p>Actual reported votes from civicAPI. Forecast estimates appear separately.</p></div>
              <div className="topline-meta"><span className="topline-status">{status}</span><span className="topline-updated"><strong>Updated</strong> {fmtClock(live.at)}</span></div>
            </header>
            {r.k === "leg" ? (
              <>
                <div className="topline-columns" aria-hidden><span>Party</span><span>Seats won</span><span>Projected</span></div>
                {([["Democrats", seats.d, legProj, "var(--dem)"], ["Republicans", seats.r, Math.max(0, (r.up ?? r.seats ?? 0) - legProj), "var(--gop)"]] as const).map(([n, w, pj, col]) => (
                  <div className="topline-row" key={n}><div className="topline-row-top"><div className="topline-candidate"><span className="nd-dot" style={{ background: col }} /><div className="topline-copy"><strong>{n}</strong><small>of {r.up ?? r.seats} seats up</small></div></div><div className="topline-votes">{w}</div><div className="topline-pct">{pj.toFixed(1)}</div></div>
                    <div className="topline-bar"><span style={{ width: `${(100 * w) / Math.max(1, r.up ?? r.seats ?? 1)}%`, background: col }} /></div></div>
                ))}
              </>
            ) : (
              <>
                <div className="topline-columns" aria-hidden><span>Candidate</span><span>Votes</span><span>Vote share</span></div>
                {!reporting ? <p className="prose empty-note">{now < FIRST_CLOSE ? `First polls close at 6:00 PM ET on November 3, in ${countdown(msLeft)}. ` : "Waiting on the first returns. "}Every candidate on civicAPI's ballot is listed and fills in as votes are counted.</p> : null}
                {(cands.length ? cands.map((x) => [x[0], x[1], x[2], x[3], x[4]] as const) : (r.c ?? []).map(([n, p]) => [n, p === "D" ? "Democratic" : p === "R" ? "Republican" : p === "I" ? "Independent" : p === "Y" ? "Yes" : p === "N" ? "No" : "Other", 0, 0, 0] as const)).map(([n, p, v, pc, w], i) => {
                  const share = counted ? (100 * v) / counted : pc; const col = tone(p, n);
                  return (
                    <div className="topline-row" key={n + i}>
                      <div className="topline-row-top">
                        <div className="topline-candidate"><span className="nd-dot" style={{ background: col }} /><div className="topline-copy"><strong>{n}</strong><small>{p}</small>{i === 0 && gap > 0 && !w ? <span className="topline-lead">Leads by {fmtN(gap)} votes</span> : null}{w ? <span className="topline-lead won">Race called</span> : null}</div></div>
                        <div className="topline-votes">{fmtN(v)}</div><div className="topline-pct">{pctLabel(share)}%</div>
                      </div>
                      <div className="topline-bar"><span style={{ width: `${Math.max(0, share)}%`, background: col }} /></div>
                    </div>
                  );
                })}
              </>
            )}
            <div className="topline-foot">
              <span>{counted ? `${fmtN(counted)} votes counted` : "No votes counted"}</span>
              {counted && cands.length > 1 ? <span className="topline-margin"><b>{signed((100 * gap) / counted)}</b> margin · {fmtN(gap)} votes</span> : null}
              <span className="topline-reporting"><b>{pctLabel(P.pctIn)}%</b> est. reporting</span>
            </div>
          </div>
        </article>

        <article className="card span-3" id="nd-forecast" aria-labelledby="nd-snap">
          <section className="snapshot">
            <div className="snapshot-heading"><div><strong id="nd-snap">Forecast snapshot</strong><small>Model metrics update as new results arrive</small></div><span className="race-rule-pill">{isM ? `${Math.round(100 * (r.thr ?? 0.5))}% to pass` : r.k === "leg" ? "majority" : "plurality"}</span></div>
            <div className="forecast-model-layout">
              <div className="forecast-hero">
                <div className="model-label">{r.k === "leg" ? "Democratic control" : "Win probability"}</div>
                <div className="prob-ring" style={{ ["--value" as string]: r.k === "leg" ? 100 * (r.pD ?? 0) : leadP, ["--ring" as string]: civWinner || projected ? "var(--called)" : r.k === "leg" ? "var(--dem)" : leadCol } as React.CSSProperties} role="img" aria-label={`Win probability ${pctLabel(leadP)} percent`}>
                  <div className="ring-center"><b>{pctLabel(r.k === "leg" ? 100 * (r.pD ?? 0) : leadP)}%</b><span>{r.k === "leg" ? "Democrats" : leadName}</span></div>
                </div>
              </div>
              <div className="forecast-support">
                <div>
                  <div className="model-label">Top outcomes</div>
                  {r.k === "leg" ? (
                    <>
                      <div className="outcome-row"><i style={{ background: "var(--dem)" }} aria-hidden /><span>Democratic majority</span><b>{pctLabel(100 * (r.pD ?? 0))}%</b></div>
                      <div className="outcome-row"><i style={{ background: "var(--gop)" }} aria-hidden /><span>Republican majority</span><b>{pctLabel(100 * (r.pR ?? 0))}%</b></div>
                    </>
                  ) : (
                    <>
                      <div className="outcome-row"><i style={{ background: colA }} aria-hidden /><span>{isM ? "Passes" : `${last(A)} wins`}</span><b>{pctLabel(100 * odds.pA)}%</b></div>
                      <div className="outcome-row"><i style={{ background: colB }} aria-hidden /><span>{isM ? "Fails" : `${last(B)} wins`}</span><b>{pctLabel(100 * odds.pB)}%</b></div>
                    </>
                  )}
                </div>
                <div className="reporting-module">
                  <div className="reporting-copy"><span>Model-estimated</span><b>Percent reporting</b></div>
                  <div className="rep-ring" style={{ ["--value" as string]: Math.min(P.pctIn, 100) } as React.CSSProperties} role="img" aria-label={`Estimated reporting ${pctLabel(P.pctIn)} percent`}>
                    <div className="ring-center sm"><b>{pctLabel(P.pctIn)}%</b><span>reporting</span></div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          {r.k !== "leg" ? (
            <section className="projection-zone" aria-label="Forecasted final result">
              <div className="projected-top">
                <div className="projected-intro">
                  <span className="model-label">{projected ? "On Point Polling projection" : "Model projection · not actual results"}</span>
                  <div className="projected-name">{projected ? `${leadName} wins` : `${isM ? (lead === "A" ? "Yes" : "No") : leadName} projected ahead`}</div>
                  <p className="projection-headline prose">{headline}</p>
                </div>
                <div className="projected-margin-wrap"><span>Projected margin</span><b style={{ color: leadCol }}>{signed(margin)}</b><small>{isM ? (lead === "A" ? "Yes over No" : "No over Yes") : `${leadName} over ${trailName}`}</small></div>
              </div>
              <div className="projection-head"><div><strong>Projected final vote share</strong><small>Muted bars are an estimate, not reported votes: counted votes plus each county&apos;s outstanding vote{exp ? `, summed over ${rows.length} counties` : ""}.</small></div><span className="model-label">Forecast only</span></div>
              <div className="projected-bars">
                {([[last(A), finA, nowA, colA], [last(B), finB, nowB, colB], ...(finO >= 0.5 ? [["Others", finO, null, "var(--ink3)"] as const] : [])] as const).map(([n, s, a, col]) => (
                  <div className="projected-bar-row" key={n}>
                    <div className="projected-bar-name"><i style={{ background: col }} aria-hidden /><span>{n}</span></div>
                    <div className="projected-bar-track"><span className="projected-bar-fill" style={{ width: `${s}%`, borderColor: col }} /></div>
                    <div className="projected-bar-value">{s.toFixed(1)}%</div>
                    <div className="projected-bar-delta">{a != null ? `${s - a >= 0 ? "+" : "−"}${Math.abs(s - a).toFixed(1)} vs now` : "projected"}</div>
                  </div>
                ))}
              </div>
              <div className="model-stats">
                <div><span>Projected turnout</span><b>~{fmtN(P.fin.t || r.tot || 0)}</b></div>
                <div><span>Votes remaining</span><b>{P.rep.t ? `~${fmtK(Math.max(0, P.fin.t - P.rep.t))}` : `~${fmtK(r.tot ?? 0)}`}</b></div>
                <div><span>Margin SD</span><b>±{odds.sd.toFixed(1)} pts</b></div>
                <div><span>Margin range (95%)</span><b>{signed(-odds.hi)} to {signed(-odds.lo)}</b></div>
              </div>
              <div className="no-history">Margins read {isM ? "Yes minus No" : `${last(A)} minus ${last(B)}`} · live data only · not a race call unless marked</div>
            </section>
          ) : null}
        </article>
      </div>

      {exp && vb ? (
        <section id="nd-counties" className="county card" aria-label={`${STN[r.st]} county map and county by county detail`}>
          <div className="county-head">
            <div className="rd-view-toggles" role="group" aria-label="County view">
              <button type="button" className={view === "forecast" ? "on" : ""} onClick={() => setView("forecast")}>forecast</button>
              <button type="button" className={view === "results" ? "on" : ""} onClick={() => setView("results")}>results</button>
            </div>
            {view === "forecast" ? (
              <div className="rd-map-toggles" role="group" aria-label="County map shading">
                <button type="button" className={mode === "margin" ? "on" : ""} onClick={() => setMode("margin")}>margin</button>
                <button type="button" className={mode === "turnout" ? "on" : ""} onClick={() => setMode("turnout")}>turnout</button>
              </div>
            ) : null}
          </div>
          <div className="rd-map">
            <svg viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet" className="nd-svg" role="img" aria-label={`${STN[r.st]} counties`} onMouseLeave={() => setTip(null)}>
              {cPaths.map((p) => <path key={p.id} d={p.d} style={{ fill: fillOf(p.id), fillOpacity: opac(p.id) }} className={tip?.f === p.id ? "on" : ""} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, f: p.id })} />)}
            </svg>
            {view === "results" && !Object.keys(det?.regions ?? {}).some((f) => regM(f)) ? (
              <div className="map-empty"><p>No county has reported yet.</p><p className="map-empty-sub">Counties fill in as their votes land. Until then, the forecast view is the one carrying information.</p></div>
            ) : null}
          </div>
          <div className="rd-map-legend">
            {view === "forecast" && mode === "turnout" ? <><span className="rd-map-legend-sw" style={{ background: "linear-gradient(90deg,var(--ramp-lo),rgb(15,95,85))" }} /><span>lower to higher expected turnout</span></>
              : <><span className="rd-map-legend-sw" style={{ background: isM ? "linear-gradient(90deg,#2fbf9b,#e7794a)" : ind ? "linear-gradient(90deg,#4e24aa,#eae2ff 48%,#ffdce4 52%,#8c0a28)" : "linear-gradient(90deg,#10288c,#d6e2ff 48%,#ffdce4 52%,#8c0a28)" }} /><span>{view === "results" ? `margin in counted votes · paler means less counted` : `forecast margin · ${last(A)} to ${last(B)}`}</span></>}
            <span className="rd-map-hint">hover any county</span>
          </div>
          {tip && exp[tip.f] ? (() => { const e = exp[tip.f]; const g = regM(tip.f); const x = expCM(tip.f); return (
            <FloatTip x={tip.x} y={tip.y} className="tip" scope="opp">
              <b>{names[tip.f] ?? tip.f}</b>
              <div className="row"><span>Expected</span><span>{x == null ? "n/a" : `${x <= 0 ? last(A) : last(B)} ${signed(Math.abs(x))}`}</span></div>
              <div className="row"><span>Expected votes</span><span>{fmtN(e[3])}</span></div>
              <div className="row"><span>Counted</span><span>{g ? `${fmtN(g.t)} · ${pctLabel(g.pr)}% in` : "none yet"}</span></div>
              {g ? <div className="row"><span>Returns</span><span>{`${g.m <= 0 ? last(A) : last(B)} ${signed(Math.abs(g.m))}`}</span></div> : null}
              {g && x != null ? <div className="row"><span>Versus expected</span><span>{`${g.m - x < 0 ? (isM ? "Yes" : last(A)) : (isM ? "No" : last(B))} ${signed(Math.abs(g.m - x))}`}</span></div> : null}
            </FloatTip>); })() : null}
          <div className="rd-county">
            <div className="rd-county-tools">
              <div className="rd-county-search"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" /><path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><input id={`nd-q-${r.id}`} type="text" placeholder="search counties" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search counties" /></div>
              <div className="rd-county-sorts" role="group" aria-label="Sort counties">{([["votes", "votes"], ["az", "a to z"], ["reporting", "reporting"], ["margin", "closest"], ["gap", "vs expected"]] as const).map(([k, l]) => <button key={k} type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}</div>
            </div>
            <div className="rd-county-tablewrap">
              <table className="rd-county-table">
                <thead><tr><th>county</th><th className="num">reporting</th><th className="num">expected votes</th><th className="num">counted</th><th className="num">{last(A).toLowerCase()}</th><th className="num">{last(B).toLowerCase()}</th><th className="num">margin</th><th className="num">vs expected</th></tr></thead>
                <tbody>{shown.length === 0 ? <tr><td colSpan={8} className="rd-county-loading">no counties match “{q}”.</td></tr> : shown.map((x) => {
                  const sA = x.g ? (100 * x.g.s.a) / x.g.t : (100 * x.e[0]) / Math.max(1, x.e[3]), sB = x.g ? (100 * x.g.s.b) / x.g.t : (100 * x.e[1]) / Math.max(1, x.e[3]);
                  const vA = x.g ? x.g.s.a : x.e[0], vB = x.g ? x.g.s.b : x.e[1];
                  const m = x.g ? x.g.m : x.em; const d = x.g && x.em != null ? x.g.m - x.em : null;
                  return (
                    <tr key={x.f}>
                      <td>{x.n}</td>
                      <td className="num">{x.g ? `${pctLabel(x.g.pr)}%` : "0%"}</td>
                      <td className="num">{fmtN(x.e[3])}</td>
                      <td className="num">{x.g ? fmtN(x.g.t) : "—"}</td>
                      <td className="num"><span className="rd-cand-cell"><b style={{ color: colA }}>{sA.toFixed(1)}%</b><span className="rd-cand-votes">{fmtN(vA)}</span></span></td>
                      <td className="num"><span className="rd-cand-cell"><b style={{ color: colB }}>{sB.toFixed(1)}%</b><span className="rd-cand-votes">{fmtN(vB)}</span></span></td>
                      <td className="num">{m == null ? "—" : <span style={{ color: m <= 0 ? colA : colB }}>{m <= 0 ? last(A) : last(B)} +{Math.abs(m).toFixed(1)}</span>}</td>
                      <td className="num">{d == null ? "—" : <span style={{ color: d <= 0 ? colA : colB }}>{d <= 0 ? last(A) : last(B)} +{Math.abs(d).toFixed(1)}</span>}</td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
            <p className="prose county-caveat">Before a county reports, its row shows the forecast: expected votes and shares. Once it reports, the row shows counted votes. The estimate of the final count splits each county&apos;s outstanding vote like its own returns, leaning on the forecast while little is in; counties with nothing in take the forecast moved by the average gap in counties that have reported.</p>
          </div>
        </section>
      ) : null}

      {legD.length ? (
        <section id="nd-districts" className="county card" aria-label="Every district">
          <div className="county-head"><strong className="nd-h">Every district</strong></div>
          <div className="rd-county-tablewrap">
            <table className="rd-county-table">
              <thead><tr><th>district</th><th>democrat</th><th>republican</th><th className="num">expected votes</th><th className="num">forecast</th><th className="num">D chance</th><th className="num">reporting</th><th className="num">returns</th></tr></thead>
              <tbody>{legD.map((d) => { const lc = legLive[d.d.toUpperCase()]; const sd = lc ? sides({ ...r, k: "sen", c: [[d.D ?? "", "D", 0], [d.R ?? "", "R", 0]] }, lc.c) : null; const m = sd && sd.t ? (100 * (sd.b - sd.a)) / sd.t : null; return (
                <tr key={d.d}><td>{d.d}</td><td>{d.D ?? (d.I ? `${d.I}, ind.` : "none")}</td><td>{d.R ?? "none"}</td><td className="num">{d.v[3] ? fmtN(d.v[3]) : "—"}</td>
                  <td className="num">{d.m == null ? "—" : <span style={{ color: d.m <= 0 ? "var(--dem)" : "var(--gop)" }}>{d.m <= 0 ? "D" : "R"} +{Math.abs(d.m).toFixed(1)}</span>}</td>
                  <td className="num">{d.pD != null ? `${pctLabel(100 * d.pD)}%` : "—"}</td><td className="num">{lc ? `${pctLabel(lc.pr)}%` : "—"}</td>
                  <td className="num">{m == null ? "—" : <span style={{ color: m <= 0 ? "var(--dem)" : "var(--gop)" }}>{m <= 0 ? "D" : "R"} +{Math.abs(m).toFixed(1)}</span>}</td></tr>); })}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="nd-method card" id="nd-method">
        <strong>Method</strong>
        <p className="prose">Expected votes are the On Point Politics forecast of October 22 for every {exp ? "county" : r.k === "leg" ? "district" : "race"}. Returns come from civicAPI through a 30 second cache. The win probability starts at the forecast&apos;s own chance and its spread narrows as the estimated share of the vote counted rises. A race is marked projected only when the estimate gives the leader at least 99.5 percent with half the expected vote counted; civicAPI&apos;s own calls are shown as civicAPI reports them.</p>
      </section>
    </main>
  );
  return (
    <div className={`desk nd${embedded ? " nd-embed" : ""}`}>
      <style>{DESK_CSS}</style>
      <style>{ND_CSS}</style>
      {body}
    </div>
  );
}

// a few additions to the board styles for the generic desk
const ND_CSS = `
.desk.nd .nd-load{height:70vh;border-radius:14px}
.desk.nd .nd-dot{display:inline-block;width:12px;height:12px;border-radius:50%;flex:0 0 auto;margin-top:3px}
.desk.nd .nd-svg{position:absolute;inset:0;width:100%;height:100%}
.desk.nd .nd-svg path{stroke:var(--map-stroke);stroke-width:.7;vector-effect:non-scaling-stroke;transition:fill .35s}
.desk.nd .nd-svg path:hover,.desk.nd .nd-svg path.on{stroke:var(--map-stroke-hi);stroke-width:2}
.desk.nd .archive-banner button,.desk.nd .archive-banner a{font:700 12px var(--sans);color:var(--ink);background:none;border:1px solid var(--rule,rgba(255,255,255,.2));border-radius:999px;padding:5px 12px;cursor:pointer}
.desk.nd .nd-test{border-color:rgba(231,179,65,.5)!important;background:rgba(231,179,65,.08)!important}
.desk.nd .nd-h{font-size:16px}
.desk.nd .nd-method{margin-top:20px;padding:18px 20px;display:grid;gap:8px}
.desk.nd .race-tabs a{cursor:pointer}
.desk.nd.nd-embed{min-height:0}
.desk.nd.nd-embed .shell{padding-top:16px}
`;
