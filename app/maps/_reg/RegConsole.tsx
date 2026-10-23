"use client";
// The registration console, shared by the voter registration and party registration maps. One count, one map, one
// readout, in the same build as the early vote console: pick what the map shows (the largest bloc, the party lead,
// the size of the rolls, the unaffiliated share or 2024 turnout against the rolls), switch the nation between states
// and counties, click a state to drop into its counties, and read its numbers and every county below.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pointy } from "@/app/components/home/Mascot";
import { marginColor } from "@/app/lib/opp";
import Ambient from "@/app/components/opp/Ambient";
import Count from "@/app/components/opp/Count";
import { useSiteTheme } from "@/app/lib/useSiteTheme";
import "../early-vote/evconsole.css";
import "./reg.css";

type Party = { DEM: number; REP: number; UNA: number; OTH: number };
type Plur = "DEM" | "REP" | "UNA" | null;
type St = { abbr: string; name: string; fips: string; total: number | null; as_of: string | null; registers_by_party: boolean; unit_label: string | null; county_count: number;
  party: Party | null; plurality: Plur; no_reg: boolean; source_url: string | null };
type Summary = { national_total: number; national_party: Party; jurisdictions: number; states: St[] };
type Unit = { name: string; fips: string | null; total: number | null; party: Party | null; plurality: Plur };
type Detail = { abbr: string; name: string; unit_label: string | null; as_of: string | null; counties: Unit[] };
type CV = Record<string, { r: number; p: Plur; n: string; s: string }>;
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]> };
export type Metric = "bloc" | "lead" | "size" | "una" | "turnout";

const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : commas(n));
const pctS = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t)))).join(",")})`;
// more voters always reads as more contrast: toward lavender on the dark ground, toward deep violet on the light one
let LIGHT = false;
const sizeFill = (t: number) => (LIGHT ? mix([236, 230, 250], [72, 42, 168], t) : mix([46, 34, 78], [206, 178, 255], t));
const unaFill = (t: number) => (LIGHT ? mix([238, 236, 244], [86, 78, 112], t) : mix([44, 40, 58], [214, 206, 236], t));
const turnFill = (t: number) => (t < 0.5 ? mix([196, 82, 30], [240, 232, 214], t / 0.5) : mix([240, 232, 214], [16, 140, 104], (t - 0.5) / 0.5));
const BLOC: Record<"DEM" | "REP" | "UNA", [number[], number[]]> = { DEM: [[176, 200, 255], [30, 76, 214]], REP: [[255, 188, 198], [200, 20, 52]], UNA: [[214, 208, 228], [110, 102, 134]] };
const WORD: Record<"DEM" | "REP" | "UNA", string> = { DEM: "Democrats", REP: "Republicans", UNA: "Unaffiliated" };
const mLab = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const lead = (p: Party | null | undefined, t?: number | null) => { const T = t || (p ? p.DEM + p.REP + p.UNA + p.OTH : 0); return p && T ? ((p.REP - p.DEM) / T) * 100 : null; };
const plur = (p: Party | null | undefined): Plur => (!p ? null : p.DEM >= p.REP && p.DEM >= p.UNA ? "DEM" : p.REP >= p.UNA ? "REP" : "UNA");
const gap = (p: Party | null | undefined) => { if (!p) return 0; const v = [p.DEM, p.REP, p.UNA].sort((a, b) => b - a); const T = p.DEM + p.REP + p.UNA + p.OTH; return T ? (v[0] - v[1]) / T : 0; };
const blocFill = (p: Party | null | undefined, pl?: Plur) => { const k = pl ?? plur(p); if (!k) return null; const [a, b] = BLOC[k]; return mix(a, b, p ? 0.25 + Math.min(1, gap(p) / 0.3) * 0.75 : 0.6); };
const lg = (v: number, lo: number, hi: number) => (hi <= lo ? 0.5 : Math.max(0, Math.min(1, (Math.log(Math.max(v, 1)) - Math.log(Math.max(lo, 1))) / (Math.log(hi) - Math.log(Math.max(lo, 1))))));
function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
const tipFlip = (t: { x: number; y: number; w?: number; h?: number }): React.CSSProperties => ({ transform: `translate(${t.w && t.x > t.w - 290 ? "calc(-100% - 16px)" : "16px"}, ${t.h && t.y > t.h - 230 ? "calc(-100% - 12px)" : "12px"})` });
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, "-");

function PartyBar({ p }: { p: Party }) {
  const T = p.DEM + p.REP + p.UNA + p.OTH || 1;
  return (
    <div className="rg-pbar">
      <div className="bar"><i className="d" style={{ width: pctS(p.DEM / T, 2) }} /><i className="u" style={{ width: pctS(p.UNA / T, 2) }} /><i className="o" style={{ width: pctS(p.OTH / T, 2) }} /><i className="r" style={{ width: pctS(p.REP / T, 2) }} /></div>
      <div className="rg-pk">
        <div><i className="d" /><span>Democrats</span><b>{short(p.DEM)}</b><em>{pctS(p.DEM / T, 1)}</em></div>
        <div><i className="r" /><span>Republicans</span><b>{short(p.REP)}</b><em>{pctS(p.REP / T, 1)}</em></div>
        <div><i className="u" /><span>Unaffiliated</span><b>{short(p.UNA)}</b><em>{pctS(p.UNA / T, 1)}</em></div>
        <div><i className="o" /><span>Other parties</span><b>{short(p.OTH)}</b><em>{pctS(p.OTH / T, 1)}</em></div>
      </div>
    </div>
  );
}

export default function RegConsole({ page, initial }: { page: "voter" | "party"; initial: Metric }) {
  const theme = useSiteTheme();
  LIGHT = theme === "light";
  const [metric, setMetric] = useState<Metric>(initial);
  const [scope, setScope] = useState("US");
  const [nat, setNat] = useState<"states" | "counties">("states");
  const [sum, setSum] = useState<Summary | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [cv, setCv] = useState<CV | null>(null);
  const [usc, setUsc] = useState<[string, string, string][] | null>(null);
  const [cp, setCp] = useState<Record<string, [number, number, number, number]> | null>(null);
  const [det, setDet] = useState<Record<string, Detail | "fail">>({});
  const [cGeo, setCGeo] = useState<Record<string, { id: string; d: string }[]>>({});
  const [t24, setT24] = useState<Record<string, number>>({});
  const [tip, setTip] = useState<{ k: string; x: number; y: number; w?: number; h?: number } | null>(null);
  const [sort, setSort] = useState<"most" | "d" | "r" | "una" | "az">("most");
  const [all, setAll] = useState(false);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/voterreg/summary.json").then((r) => r.json()).then(setSum).catch(() => setErr(true));
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
    fetch("/voterreg/county_values.json").then((r) => r.json()).then(setCv).catch(() => {});
    fetch("/earlyvote-history.json").then((r) => r.json()).then((h) => setT24(Object.fromEntries(Object.entries(h.states as Record<string, Record<string, { turnout?: number }>>).map(([k, v]) => [k, v["2024"]?.turnout ?? 0]).filter((x) => x[1])))).catch(() => {});
    // deep links: ?state=FL&lens=party
    try {
      const u = new URL(window.location.href);
      const l = u.searchParams.get("lens"); if (l === "party") setMetric("bloc"); else if (l === "reg") setMetric("size"); else if (l && ["bloc", "lead", "size", "una", "turnout"].includes(l)) setMetric(l as Metric);
      const s = u.searchParams.get("state"); if (s && /^[A-Za-z]{2}$/.test(s)) setScope(s.toUpperCase());
      if (u.searchParams.get("scope") === "counties") setNat("counties");
    } catch { /* no url */ }
  }, []);
  useEffect(() => {
    if (nat !== "counties") return;
    if (!usc) fetch("/watchdog/us_counties.json").then((r) => r.json()).then(setUsc).catch(() => {});
    if (!cp) fetch("/voterreg/county_party.json").then((r) => r.json()).then(setCp).catch(() => setCp({}));
  }, [nat, usc, cp]);
  useEffect(() => {
    if (scope === "US") return;
    if (!det[scope]) fetch(`/voterreg/counties/${scope}.json`).then((r) => r.json()).then((d) => setDet((o) => ({ ...o, [scope]: d }))).catch(() => setDet((o) => ({ ...o, [scope]: "fail" })));
    if (!cGeo[scope]) fetch(`/forecast/states/${scope}.json`).then((r) => r.json()).then((g) => setCGeo((o) => ({ ...o, [scope]: g.counties }))).catch(() => {});
  }, [scope, det, cGeo]);
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("lens", metric); if (scope === "US") u.searchParams.delete("state"); else u.searchParams.set("state", scope);
      if (nat === "counties" && scope === "US") u.searchParams.set("scope", "counties"); else u.searchParams.delete("scope");
      window.history.replaceState(null, "", u.pathname + "?" + u.searchParams.toString());
    } catch { /* history unavailable */ }
  }, [metric, scope, nat]);
  const go = (st: string) => { setScope(st); setTip(null); setAll(false); try { document.getElementById("rg-stage")?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* no scroll */ } };

  const byState = useMemo(() => Object.fromEntries((sum?.states ?? []).map((s) => [s.abbr, s])) as Record<string, St>, [sum]);
  const S = scope === "US" ? null : byState[scope] ?? null;
  const D = scope !== "US" && det[scope] && det[scope] !== "fail" ? (det[scope] as Detail) : null;
  const units = D?.counties ?? [];
  const byFips = useMemo(() => Object.fromEntries(units.filter((u) => u.fips).map((u) => [u.fips as string, u])) as Record<string, Unit>, [units]);
  const partyStates = (sum?.states ?? []).filter((s) => s.registers_by_party && s.party);
  const pAgg = partyStates.reduce((a, s) => ({ DEM: a.DEM + s.party!.DEM, REP: a.REP + s.party!.REP, UNA: a.UNA + s.party!.UNA, OTH: a.OTH + s.party!.OTH }), { DEM: 0, REP: 0, UNA: 0, OTH: 0 });
  const pAggT = pAgg.DEM + pAgg.REP + pAgg.UNA + pAgg.OTH;
  const nP = partyStates.filter((s) => s.abbr !== "DC").length, dc = partyStates.some((s) => s.abbr === "DC");
  const pWord = `${nP} states${dc ? " and D.C." : ""}`;
  const tot = sum?.national_total ?? 0;
  const t24n = Object.entries(t24).reduce((a, [k, v]) => (byState[k]?.total ? { t: a.t + v, r: a.r + (byState[k].total as number) } : a), { t: 0, r: 0 });
  const sizes = (sum?.states ?? []).map((s) => s.total ?? 0).filter(Boolean);
  const [sLo, sHi] = [Math.min(...sizes, 1e9), Math.max(...sizes, 1)];
  const rank = useMemo(() => Object.fromEntries([...(sum?.states ?? [])].filter((s) => s.total).sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).map((s, i) => [s.abbr, i + 1])), [sum]);

  const stFill = (s: St | undefined): string | null => {
    if (!s || s.no_reg || !s.total) return null;
    if (metric === "size") return sizeFill(lg(s.total, sLo, sHi));
    if (metric === "turnout") return t24[s.abbr] ? turnFill((t24[s.abbr] / s.total - 0.4) / 0.5) : null;
    if (!s.registers_by_party || !s.party) return null;
    if (metric === "bloc") return blocFill(s.party, s.plurality);
    if (metric === "lead") return marginColor(Math.max(-40, Math.min(40, lead(s.party, s.total) as number)));
    return unaFill(s.party.UNA / s.total / 0.55);
  };
  const cvVals = useMemo(() => Object.values(cv ?? {}).map((v) => v.r).filter(Boolean), [cv]);
  const [cLo, cHi] = [Math.max(200, Math.min(...cvVals, 1e9)), Math.max(...cvVals, 1)];
  const unitFill = (u: Unit | undefined, fips?: string, lo = cLo, hi = cHi): string | null => {
    const v = fips ? cv?.[fips] : undefined;
    const r = u?.total ?? v?.r ?? null;
    if (!r) return null;
    if (metric === "size" || metric === "turnout") return sizeFill(lg(r, lo, hi));
    if (u?.party) {
      if (metric === "bloc") return blocFill(u.party, u.plurality);
      if (metric === "lead") return marginColor(Math.max(-40, Math.min(40, lead(u.party, u.total) as number)));
      return unaFill(u.party.UNA / (u.total || 1) / 0.55);
    }
    if (metric === "bloc" && v?.p) return blocFill(null, v.p);
    return null;
  };

  const states = useMemo(() => (geo ? Object.entries(geo.states).map(([st, d]) => { const b = bboxOf(d), lb = geo.labels?.[st]; return { st, d, x: b[0], cx: lb ? lb[0] : (b[0] + b[2]) / 2, cy: lb ? lb[1] : (b[1] + b[3]) / 2, w: lb ? lb[2] : b[2] - b[0] }; }) : []), [geo]);
  const cPaths = scope !== "US" ? cGeo[scope] ?? null : null;
  const cBox = useMemo(() => {
    if (!cPaths?.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of cPaths) { const b = bboxOf(p.d); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
  }, [cPaths]);
  const uVals = units.map((u) => u.total ?? 0).filter(Boolean);
  const [uLo, uHi] = [Math.min(...uVals, 1e9), Math.max(...uVals, 1)];
  const countyMatched = cPaths ? cPaths.filter((p) => byFips[p.id]).length / cPaths.length : 0;
  const [W, H] = geo?.frame ?? [975, 610];

  const tiles: Record<Metric, { lb: string; big: string; sub: string }> = S ? {
    bloc: { lb: "Largest bloc", big: S.no_reg ? "No registration" : S.plurality ? WORD[S.plurality] : "No party", sub: S.registers_by_party && S.party ? `${pctS(gap(S.party), 1)} ahead of the next` : `${S.name} does not record party` },
    lead: { lb: "Party lead", big: S.party ? mLab(lead(S.party, S.total) as number) : "n/a", sub: S.party ? "Republicans minus Democrats on the rolls" : "No party on the rolls" },
    size: { lb: "Registered voters", big: S.total ? short(S.total) : "n/a", sub: rank[S.abbr] ? `${ordinal(rank[S.abbr])} largest rolls` : "No statewide registration" },
    una: { lb: "Unaffiliated", big: S.party && S.total ? pctS(S.party.UNA / S.total, 1) : "n/a", sub: S.party ? "registered with no party" : "No party on the rolls" },
    turnout: { lb: "2024 turnout", big: t24[S.abbr] && S.total ? pctS(t24[S.abbr] / S.total) : "n/a", sub: "of today's registered voters" },
  } : {
    bloc: { lb: "Largest bloc", big: `${nP}${dc ? " + D.C." : ""}`, sub: `record party; ${partyStates.filter((s) => s.plurality === "DEM").length} D, ${partyStates.filter((s) => s.plurality === "REP").length} R, ${partyStates.filter((s) => s.plurality === "UNA").length} unaffiliated` },
    lead: { lb: "Party lead", big: pAggT ? mLab(((pAgg.REP - pAgg.DEM) / pAggT) * 100) : "n/a", sub: "Across the states that record party" },
    size: { lb: "Registered voters", big: short(tot), sub: `${sum?.jurisdictions ?? 51} jurisdictions, newest official rolls` },
    una: { lb: "Unaffiliated", big: pAggT ? pctS(pAgg.UNA / pAggT, 1) : "n/a", sub: "of voters in the party states" },
    turnout: { lb: "2024 turnout", big: t24n.r ? pctS(t24n.t / t24n.r) : "n/a", sub: "ballots cast against today's rolls" },
  };
  const legend: [string, string, string, string, string?] = metric === "size" ? ["Fewer voters", "More voters", sizeFill(0), sizeFill(1)]
    : metric === "turnout" ? ["Low turnout", "High turnout", turnFill(0), turnFill(1), turnFill(0.5)]
    : metric === "lead" ? ["More Democrats", "More Republicans", marginColor(-35), marginColor(35), "rgb(240,236,246)"]
    : metric === "una" ? ["Few unaffiliated", "Many unaffiliated", unaFill(0), unaFill(1)] : ["", "", "", ""];

  // table
  const tRows = useMemo(() => {
    if (scope !== "US") return [...units].sort((a, b) => sort === "az" ? a.name.localeCompare(b.name) : sort === "d" ? (lead(a.party, a.total) ?? 999) - (lead(b.party, b.total) ?? 999) : sort === "r" ? (lead(b.party, b.total) ?? -999) - (lead(a.party, a.total) ?? -999) : sort === "una" ? ((b.party?.UNA ?? 0) / (b.total || 1)) - ((a.party?.UNA ?? 0) / (a.total || 1)) : (b.total ?? 0) - (a.total ?? 0));
    const L = [...(sum?.states ?? [])];
    return L.sort((a, b) => sort === "az" ? a.name.localeCompare(b.name) : sort === "d" ? (lead(a.party, a.total) ?? 999) - (lead(b.party, b.total) ?? 999) : sort === "r" ? (lead(b.party, b.total) ?? -999) - (lead(a.party, a.total) ?? -999) : sort === "una" ? ((b.party?.UNA ?? 0) / (b.total || 1)) - ((a.party?.UNA ?? 0) / (a.total || 1)) : (b.total ?? 0) - (a.total ?? 0));
  }, [scope, units, sum, sort]);
  const LIMIT = 20, shown = all ? tRows.length : Math.min(LIMIT, tRows.length);

  const tipS = tip && (scope === "US" && nat === "states") ? byState[tip.k] : null;
  const tipU = tip && !tipS ? (() => {
    if (scope === "US") { const v = cv?.[tip.k], q = cp?.[tip.k]; return v ? { name: `${v.n}, ${v.s}`, total: v.r, party: (q ? { DEM: q[0], REP: q[1], UNA: q[2], OTH: q[3] } : null) as Party | null, plurality: v.p } : null; }
    const u = byFips[tip.k]; const v = cv?.[tip.k];
    return u ? { name: u.name, total: u.total ?? 0, party: u.party, plurality: u.plurality } : v ? { name: v.n, total: v.r, party: null, plurality: v.p } : null;
  })() : null;
  const T = S ?? null;
  const party = T ? T.party : pAggT ? pAgg : null;

  if (err) return <section className="evc"><p className="evc-note">Registration data did not load just now. Try again shortly.</p></section>;
  return (
    <section className="evc rg" aria-labelledby="rg-h">
      <Ambient tint="#b9a4ff" />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span>{scope === "US" ? <span>{page === "party" ? "Party registration" : "Voter registration"}</span> : <><button className="evc-crumb" onClick={() => go("US")}>{page === "party" ? "Party registration" : "Voter registration"}</button><span className="sep">/</span><span>{S?.name ?? scope}</span></>}</nav>
      <header className="evc-head">
        <Pointy className="cam-hero cam-ev pty-side" pose="idle" prop="clipboard" size={112} look={-1} flip say={<>{page === "party" ? "Blue rolls, red rolls, and a lot of voters who pick neither." : "Every registered voter, from each state's own rolls."}</>} />
        <div>
          <div className="eye g">{page === "party" ? "Party registration" : "Voter registration"} · newest official rolls{S?.as_of ? ` · ${S.name} as of ${fmtDate(S.as_of)}` : ""}</div>
          <h1 id="rg-h"><Count value={S ? S.total ?? 0 : page === "party" ? pAggT : tot} /> <span>{S ? `registered in ${S.name}` : page === "party" ? `voters on the rolls in the ${pWord} that record party` : "registered voters nationwide"}</span></h1>
          <div className="evc-lede"><p>{S ? (S.no_reg ? `${S.name} has no voter registration; anyone eligible can vote with proof of residence.` : S.registers_by_party ? `${S.name} records party on its rolls${S.plurality ? `, and ${WORD[S.plurality]} are the largest group` : ""}. Click a ${S.unit_label ?? "county"} for its numbers.` : `${S.name} does not record party, so its map shows the size of the rolls ${S.unit_label ?? "county"} by ${S.unit_label ?? "county"}.`)
            : page === "party" ? `${pWord} record each voter's party. Blue where registered Democrats lead, red where Republicans do, grey where the unaffiliated are the largest bloc, deeper where the lead is wider. Switch to counties, or click a state to read it county by county.`
            : `${commas(tot)} registered voters across 50 states and D.C., each from the state's own newest rolls. Hover a state for its numbers, click it for its counties, or switch the map to party, the unaffiliated share or 2024 turnout.`}</p></div>
        </div>
        <dl className="evc-meta">
          {party ? <>
            <div className="mb d"><dt>Democrats</dt><dd>{short(party.DEM)}</dd></div>
            <div className="mb r"><dt>Republicans</dt><dd>{short(party.REP)}</dd></div>
            <div className="mb o"><dt>Unaffiliated</dt><dd>{short(party.UNA)}</dd></div>
          </> : null}
          {S ? <div><dt>{(S.unit_label ?? "county").replace(/^./, (c) => c.toUpperCase())}s</dt><dd>{S.county_count || units.length || "n/a"}</dd></div> : <div><dt>Party states</dt><dd>{partyStates.length}</dd></div>}
          {S && rank[S.abbr] ? <div><dt>Size rank</dt><dd>{ordinal(rank[S.abbr])}</dd></div> : null}
        </dl>
      </header>

      <div className="evc-tiles rg-tiles" role="tablist" aria-label="What the map shows">
        {(Object.keys(tiles) as Metric[]).map((k) => (
          <button key={k} role="tab" aria-selected={metric === k} className={`evc-tile${metric === k ? " on" : ""}`} onClick={() => setMetric(k)}>
            <span className="lb">{tiles[k].lb}</span><b>{tiles[k].big}</b><span className="sb">{tiles[k].sub}</span>
          </button>
        ))}
      </div>

      <div className="evc-stage" id="rg-stage">
        <div className="evc-mapcard">
          <div className="evc-maphead">
            <div><span className="eye">{scope === "US" ? (nat === "states" ? "Every state" : "Every county") : `${S?.name ?? scope} by ${S?.unit_label ?? "county"}`}</span><h2>{tiles[metric].lb}{scope === "US" ? (nat === "states" ? " by state" : " by county") : ""}</h2></div>
            {scope !== "US" ? <button className="btn sm" onClick={() => go("US")}>Back to the nation</button>
              : <div className="evc-chips" role="group" aria-label="Map unit">{(["states", "counties"] as const).map((k) => <button key={k} className={nat === k ? "on" : ""} onClick={() => { setNat(k); setTip(null); }}>{k === "states" ? "States" : "Counties"}</button>)}</div>}
          </div>
          <div className="evc-mapwrap" onMouseLeave={() => setTip(null)}>
            <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs>
              <pattern id="rg-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" className="rg-h0" /><line x1="0" y1="0" x2="0" y2="6" className="rg-h1" strokeWidth="2" /></pattern>
              <pattern id="rg-hatch2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="5" height="5" className="rg-h0" /><line x1="0" y1="0" x2="0" y2="5" className="rg-h2" strokeWidth="1.4" /></pattern>
            </defs></svg>
            {scope === "US" && nat === "states" ? (geo && sum ? (
              <svg key={`us-${metric}-${theme}`} className="evc-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tiles[metric].lb} by state`}>
                {states.map((s) => {
                  const r = byState[s.st], f = stFill(r);
                  return <path key={s.st} d={s.d} className={r ? "live" : "off"} style={{ fill: r ? f ?? (r.no_reg ? "url(#rg-hatch2)" : "url(#rg-hatch)") : undefined, animationDelay: `${((s.x / W) * 0.5).toFixed(2)}s` }}
                    tabIndex={r ? 0 : -1} role={r ? "button" : undefined} aria-label={r ? `${r.name}, ${r.total ? commas(r.total) : "no"} registered voters` : undefined}
                    onMouseMove={r ? (e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: s.st, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); } : undefined}
                    onClick={r ? () => go(s.st) : undefined} onKeyDown={r ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(s.st); } } : undefined} />;
                })}
                {states.filter((s) => s.w > 36).map((s) => <text key={s.st} x={s.cx} y={s.cy + 4}>{s.st}</text>)}
              </svg>) : <div className="evc-load sx-skel" />)
            : scope === "US" ? (usc && cv && geo ? (
              <svg key={`usc-${metric}-${theme}`} className="evc-map cty" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${tiles[metric].lb} by county`}>
                {usc.map(([f, st, d]) => {
                  const v = cv[f], s = byState[st], q = cp?.[f];
                  const pp: Party | null = q ? { DEM: q[0], REP: q[1], UNA: q[2], OTH: q[3] } : null;
                  const fill = !v ? null : metric === "size" || metric === "turnout" ? sizeFill(lg(v.r, cLo, cHi)) : unitFill(pp ? { name: v.n, fips: f, total: v.r, party: pp, plurality: v.p } : undefined, f);
                  return <path key={f} d={d} className={v ? "live" : "off"} style={{ fill: fill ?? (s?.no_reg ? "url(#rg-hatch2)" : v ? "url(#rg-hatch)" : undefined) }}
                    onMouseMove={(e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: f, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); }}
                    onClick={() => go(st)} />;
                })}
                {states.map((s) => <path key={"o" + s.st} d={s.d} className="rg-outline" />)}
              </svg>) : <div className="evc-load sx-skel" />)
            : cPaths && cBox ? (
              <svg key={`${scope}-${metric}-${theme}`} className="evc-map cty" viewBox={cBox} role="img" aria-label={`${S?.name ?? scope} registration by ${S?.unit_label ?? "county"}`}>
                {cPaths.map((p) => {
                  const u = byFips[p.id], f = countyMatched > 0.5 ? unitFill(u, p.id, uLo, uHi) : unitFill(undefined, p.id) ?? (S ? stFill(S) : null);
                  return <path key={p.id} d={p.d} className={u || cv?.[p.id] ? "live" : "off"} style={{ fill: f ?? "url(#rg-hatch)" }}
                    onMouseMove={(e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: p.id, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); }} />;
                })}
              </svg>) : <div className="evc-load sx-skel" />}
            {scope !== "US" && D && countyMatched < 0.5 ? <div className="evc-fail">{S?.name} reports its rolls by {S?.unit_label ?? "unit"}, which do not line up with county lines, so the map shades each county from its county total and the table below lists every {S?.unit_label ?? "unit"}.</div> : null}
            {tipS ? (
              <div className="evc-tip" style={{ left: tip!.x, top: tip!.y, ...tipFlip(tip!) }}>
                <h4>{tipS.name}</h4>
                <div className="r"><span>Registered</span><b>{tipS.total ? commas(tipS.total) : tipS.no_reg ? "No registration" : "n/a"}</b></div>
                {tipS.party && tipS.total ? <>
                  <div className="r"><span>Democrats</span><b className="d">{short(tipS.party.DEM)} · {pctS(tipS.party.DEM / tipS.total, 1)}</b></div>
                  <div className="r"><span>Republicans</span><b className="r">{short(tipS.party.REP)} · {pctS(tipS.party.REP / tipS.total, 1)}</b></div>
                  <div className="r"><span>Unaffiliated</span><b>{short(tipS.party.UNA)} · {pctS(tipS.party.UNA / tipS.total, 1)}</b></div>
                  <div className="r"><span>Party lead</span><b className={(lead(tipS.party, tipS.total) ?? 0) < 0 ? "d" : "r"}>{mLab(lead(tipS.party, tipS.total) as number)}</b></div>
                </> : <div className="r"><span>Party</span><b>{tipS.no_reg ? "No registration" : "Not recorded"}</b></div>}
                {t24[tipS.abbr] && tipS.total ? <div className="r"><span>2024 turnout</span><b>{pctS(t24[tipS.abbr] / tipS.total)} of rolls</b></div> : null}
                <div className="r"><span>As of</span><b>{tipS.as_of ? fmtDate(tipS.as_of) : "n/a"}</b></div>
                <div className="cta">Click for {tipS.unit_label ?? "counties"}s</div>
              </div>
            ) : tipU ? (
              <div className="evc-tip" style={{ left: tip!.x, top: tip!.y, ...tipFlip(tip!) }}>
                <h4>{tipU.name}</h4>
                <div className="r"><span>Registered</span><b>{commas(tipU.total)}</b></div>
                {tipU.party ? <>
                  <div className="r"><span>Democrats</span><b className="d">{short(tipU.party.DEM)} · {pctS(tipU.party.DEM / (tipU.total || 1), 1)}</b></div>
                  <div className="r"><span>Republicans</span><b className="r">{short(tipU.party.REP)} · {pctS(tipU.party.REP / (tipU.total || 1), 1)}</b></div>
                  <div className="r"><span>Unaffiliated</span><b>{short(tipU.party.UNA)} · {pctS(tipU.party.UNA / (tipU.total || 1), 1)}</b></div>
                  <div className="r"><span>Party lead</span><b className={(lead(tipU.party, tipU.total) ?? 0) < 0 ? "d" : "r"}>{mLab(lead(tipU.party, tipU.total) as number)}</b></div>
                </> : tipU.plurality ? <div className="r"><span>Largest bloc</span><b className={tipU.plurality === "DEM" ? "d" : tipU.plurality === "REP" ? "r" : ""}>{WORD[tipU.plurality]}</b></div> : <div className="r"><span>Party</span><b>Not recorded</b></div>}
                {scope === "US" ? <div className="cta">Click for the state</div> : null}
              </div>
            ) : null}
          </div>
          {metric === "bloc" ? (
            <div className="evc-legend rg-bloc">{(["DEM", "REP", "UNA"] as const).map((k) => <span key={k}><i style={{ background: `linear-gradient(90deg, ${mix(BLOC[k][0], BLOC[k][1], 0.25)}, ${mix(BLOC[k][0], BLOC[k][1], 1)})` }} />{WORD[k]} lead</span>)}<span className="hatch">Party not recorded</span><span className="hatch2">No registration</span></div>
          ) : (
            <div className="evc-legend"><span>{legend[0]}</span><i style={{ background: `linear-gradient(90deg, ${legend[2]}, ${legend[4] ? legend[4] + "," : ""} ${legend[3]})` }} /><span>{legend[1]}</span>{metric === "lead" || metric === "una" ? <span className="hatch">Party not recorded</span> : null}</div>
          )}
        </div>

        <aside className="evc-read" aria-live="polite">
          <div className="evc-rh"><div><span className="eye">{S ? "State" : page === "party" ? "The party states" : "Nationwide"}</span><h3>{S ? S.name : page === "party" ? pWord : "Every state"}</h3></div>{S ? <Link className="btn sm" href={`/maps/early-vote/${slugOf(S.name)}`}>Early vote</Link> : <Link className="btn sm" href={page === "party" ? "/maps/voter-registration" : "/maps/party-registration"}>{page === "party" ? "Voter registration" : "Party registration"}</Link>}</div>
          {party ? <PartyBar p={party} /> : <p className="evc-note">{S?.no_reg ? `${S.name} has no voter registration.` : `${S?.name ?? "This state"} does not record party on its rolls, so there is no party split to show.`}</p>}
          <div className="evc-stats">
            <div><span>Registered</span><b>{S ? (S.total ? short(S.total) : "n/a") : short(tot)}</b></div>
            <div><span>Party lead</span><b className={(lead(party) ?? 0) < 0 ? "d" : "r"}>{party ? mLab(lead(party) as number) : "n/a"}</b></div>
            <div><span>2024 turnout</span><b>{S ? (t24[S.abbr] && S.total ? pctS(t24[S.abbr] / S.total) : "n/a") : t24n.r ? pctS(t24n.t / t24n.r) : "n/a"}</b></div>
          </div>
          {S ? <>
            <div className="rg-facts">
              <div><span>Largest bloc</span><b className={S.plurality === "DEM" ? "d" : S.plurality === "REP" ? "r" : ""}>{S.plurality ? WORD[S.plurality] : S.no_reg ? "No registration" : "Not recorded"}</b></div>
              <div><span>Reported by</span><b>{(S.unit_label ?? "county").replace(/^./, (c) => c.toUpperCase())}</b></div>
              <div><span>As of</span><b>{S.as_of ? fmtDate(S.as_of) : "n/a"}</b></div>
              <div><span>Size rank</span><b>{rank[S.abbr] ? `${ordinal(rank[S.abbr])} of ${Object.keys(rank).length}` : "n/a"}</b></div>
            </div>
            {S.source_url ? <p className="evc-note">Source: <a href={S.source_url} target="_blank" rel="noopener noreferrer">{S.name} election authority</a>. Party registration is not a vote; unaffiliated voters often lean one way.</p> : null}
          </> : (
            <div className="rg-top">
              <span className="eye">Largest rolls</span>
              {[...(sum?.states ?? [])].filter((s) => s.total).sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 6).map((s, i) => (
                <button key={s.abbr} className="rg-row" onClick={() => go(s.abbr)}>
                  <span className="n">{i + 1}</span><span className="nm">{s.name}</span>
                  <span className="bar"><i style={{ width: pctS((s.total ?? 0) / Math.max(1, sHi), 1), background: s.party ? blocFill(s.party, s.plurality) ?? undefined : sizeFill(0.8) }} /></span>
                  <b>{short(s.total ?? 0)}</b>
                </button>
              ))}
              <p className="evc-note">Party registration counts voters on the rolls, not votes. {pWord} record it; the rest show the size of the rolls only.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="evc-table card">
        <div className="card-h"><h3>{S ? `Every ${S.name} ${S.unit_label ?? "county"}` : "Every state"}</h3><span className="eye" style={{ marginLeft: "auto" }}>{tRows.length} {S ? `${S.unit_label ?? "county"}s` : "jurisdictions"}</span></div>
        <div className="evc-tools"><div className="evc-chips" role="group" aria-label="Sort">
          {([["most", "Most voters"], ["d", "Biggest D lead"], ["r", "Biggest R lead"], ["una", "Most unaffiliated"], ["az", "A to Z"]] as [typeof sort, string][]).map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
        </div></div>
        <div className="evc-tw">
          <table>
            <thead><tr><th>{S ? (S.unit_label ?? "County").replace(/^./, (c) => c.toUpperCase()) : "State"}</th><th className="n">Registered</th><th className="n">Democrats</th><th className="n">Republicans</th><th className="n">Unaffiliated</th><th className="n">Other</th><th className="n">Party lead</th>{S ? null : <><th className="n">2024 turnout</th><th className="n">As of</th></>}</tr></thead>
            <tbody>
              {S ? (D ? (tRows as Unit[]).slice(0, shown).map((u) => { const t = u.total || 1, p = u.party; return (
                <tr key={u.name + (u.fips ?? "")}>
                  <td><b>{u.name}</b></td><td className="n mono">{u.total ? commas(u.total) : "n/a"}</td>
                  <td className="n mono d">{p ? <>{commas(p.DEM)}<small>{pctS(p.DEM / t, 1)}</small></> : "n/a"}</td><td className="n mono r">{p ? <>{commas(p.REP)}<small>{pctS(p.REP / t, 1)}</small></> : "n/a"}</td>
                  <td className="n mono">{p ? <>{commas(p.UNA)}<small>{pctS(p.UNA / t, 1)}</small></> : "n/a"}</td><td className="n mono">{p ? commas(p.OTH) : "n/a"}</td>
                  <td className={`n mono ${(lead(p, u.total) ?? 0) < 0 ? "d" : "r"}`}>{p ? mLab(lead(p, u.total) as number) : "n/a"}</td>
                </tr>); }) : <tr><td colSpan={7} className="evc-note">{det[scope] === "fail" ? "County rolls did not load just now." : "Loading"}</td></tr>)
              : (tRows as St[]).slice(0, shown).map((s) => { const t = s.total || 1, p = s.party; return (
                <tr key={s.abbr} onClick={() => go(s.abbr)}>
                  <td><b>{s.name}</b></td><td className="n mono">{s.total ? commas(s.total) : "None"}</td>
                  <td className="n mono d">{p ? <>{commas(p.DEM)}<small>{pctS(p.DEM / t, 1)}</small></> : "n/a"}</td><td className="n mono r">{p ? <>{commas(p.REP)}<small>{pctS(p.REP / t, 1)}</small></> : "n/a"}</td>
                  <td className="n mono">{p ? <>{commas(p.UNA)}<small>{pctS(p.UNA / t, 1)}</small></> : "n/a"}</td><td className="n mono">{p ? commas(p.OTH) : "n/a"}</td>
                  <td className={`n mono ${(lead(p, s.total) ?? 0) < 0 ? "d" : "r"}`}>{p ? mLab(lead(p, s.total) as number) : "n/a"}</td>
                  <td className="n mono">{t24[s.abbr] && s.total ? pctS(t24[s.abbr] / s.total) : "n/a"}</td><td className="n mono">{s.as_of ? fmtDate(s.as_of, true) : "n/a"}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
        {tRows.length > LIMIT ? <div className="evc-more"><button className="btn" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${tRows.length}`}</button></div> : null}
      </div>
      <p className="evc-src">Rolls come from each state&apos;s own election authority, the newest official count each publishes, and the Election Assistance Commission where a state publishes none. Party registration records the party a voter chose on the rolls, not how they vote. North Dakota has no voter registration. 2024 turnout is the US Elections Project count of ballots cast against today&apos;s rolls, so it runs high where rolls were trimmed since.</p>
    </section>
  );
}

function ordinal(n: number) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function fmtDate(iso: string, brief = false) { const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); return isNaN(+d) ? iso : d.toLocaleDateString("en-US", brief ? { month: "short", year: "numeric", timeZone: "UTC" } : { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }); }
