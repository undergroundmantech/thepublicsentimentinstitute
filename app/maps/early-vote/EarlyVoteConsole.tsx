"use client";
// The early vote console. One count, one map, one readout: pick what the map shows (ballots against 2022
// turnout, pace against 2022 at the same point, the party of the ballots, or mail against in person), click a
// state to drop into its counties, and read the state's numbers, its pace chart and every county below.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pointy } from "@/app/components/home/Mascot";
import { marginColor } from "@/app/lib/opp";
import Ambient from "@/app/components/opp/Ambient";
import Count from "@/app/components/opp/Count";
import { getCategory, getPartyModel, matchCounty, simulate, stateOfFips, type CategoryPayload, type PartyModel } from "./lib";
import type { EvConsole, EvRow } from "./consoleData";
import ThenNow from "./ThenNow";
import "./evconsole.css";

type Metric = "cast" | "pace" | "party" | "model" | "expect" | "method";
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]> };
type County = { id: string; name: string; total: number; mail: number; inperson: number; dem: number; rep: number; ind: number; uMail: number; uIn: number; md: number; mr: number; mo: number; modeled: boolean };

const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : commas(n));
const pctS = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t)))).join(",")})`;
const castFill = (t: number) => mix([46, 34, 78], [206, 178, 255], t / 0.6);
const paceFill = (r: number) => { const a = Math.min(1, Math.abs(Math.log2(r)) / 0.9); return r >= 1 ? mix([180, 236, 214], [16, 140, 104], a) : mix([255, 214, 186], [196, 82, 30], a); };
const methodFill = (mailShare: number) => mix([231, 179, 65], [86, 196, 255], mailShare);
const paceLabel = (r: number | null) => (r == null ? "No 2022 count" : Math.abs(r - 1) < 0.005 ? "Even with 2022" : `${r > 1 ? "+" : ""}${((r - 1) * 100).toFixed(0)}% vs 2022`);
const partyM = (d: number, r: number, i: number) => (d + r > 0 ? ((r - d) / (d + r + i)) * 100 : null);
const mLabel = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const pmM = (pm: { d: number; r: number } | null | undefined) => (pm ? (pm.r - pm.d) * 100 : null);
const dLabel = (d: number) => (Math.abs(d) < 0.05 ? "On expectations" : `${d < 0 ? "D" : "R"} +${Math.abs(d).toFixed(1)}`);
function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
const sumRow = (row: Record<string, { votes: number }> | undefined, f: (k: string) => boolean) => Object.entries(row ?? {}).reduce((s, [k, v]) => s + (f(k) ? Number(v?.votes) || 0 : 0), 0);
const isOther = (k: string) => k !== "Democratic" && k !== "Republican" && k !== "Unspecified";

// ── pace chart: 2022, 2024 and 2026 counts by days before Election Day ────────
function PaceChart({ r, label }: { r: { cps22: [number, number][]; cps24: [number, number][]; s26: [number, number][] }; label: string }) {
  const all = [...r.cps22, ...r.cps24, ...r.s26];
  if (r.s26.length < 1 || (r.cps22.length < 2 && r.cps24.length < 2)) return <p className="evc-note">No 2022 or 2024 checkpoints for {label}, so there is no pace line.</p>;
  const W = 340, H = 150, P = { l: 22, r: 30, t: 10, b: 20 };
  const dMax = Math.max(30, ...all.map((p) => p[0])), vMax = Math.max(...all.map((p) => p[1])) * 1.05;
  const x = (d: number) => P.l + ((dMax - d) / dMax) * (W - P.l - P.r), y = (v: number) => H - P.b - (v / vMax) * (H - P.t - P.b);
  const line = (L: [number, number][]) => [...L].sort((a, b) => b[0] - a[0]).map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const last26 = [...r.s26].sort((a, b) => a[0] - b[0])[0];
  return (
    <figure className="evc-pace">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} early vote pace against 2022 and 2024`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P.l} x2={W - P.r} y1={y(vMax * f)} y2={y(vMax * f)} className="g" />)}
        {[30, 20, 10, 0].filter((d) => d <= dMax).map((d) => <text key={d} x={x(d)} y={H - 5} className="ax">{d === 0 ? "Election Day" : `${d} days`}</text>)}
        {r.cps22.length > 1 ? <path d={line(r.cps22)} className="l22" /> : null}
        {r.cps24.length > 1 ? <path d={line(r.cps24)} className="l24" /> : null}
        {r.s26.length > 1 ? <path d={line(r.s26)} className="l26" /> : null}
        {r.s26.map((p) => <rect key={p[0]} x={x(p[0]) - 3} y={y(p[1]) - 3} width={6} height={6} className="p26" />)}
        <text x={Math.min(W - 60, x(last26[0]) + 8)} y={Math.max(14, y(last26[1]) - 6)} className="lb26">{short(last26[1])}</text>
      </svg>
      <figcaption><span><i className="k26" />2026</span><span><i className="k24" />2024</span><span><i className="k22" />2022</span></figcaption>
    </figure>
  );
}

function Meter({ have, of, label }: { have: number; of: number; label: string }) {
  const n = Math.max(0, Math.min(100, Math.round((have / of) * 100)));
  return (
    <div className="evc-meter" role="img" aria-label={label}>
      <div className="evc-px">{Array.from({ length: 100 }, (_, i) => <i key={i} className={i < n ? "on" : ""} style={{ animationDelay: `${(i % 20) * 0.02 + Math.floor(i / 20) * 0.05}s` }} />)}</div>
      <div className="evc-mcap"><b>{n}%</b> {label}</div>
    </div>
  );
}

// keep a tooltip on screen: open it to the left of the pointer near the right edge, and above it near the bottom
const tipFlip = (t: { x: number; y: number; w?: number; h?: number }): React.CSSProperties => ({ transform: `translate(${t.w && t.x > t.w - 290 ? "calc(-100% - 16px)" : "16px"}, ${t.h && t.y > t.h - 230 ? "calc(-100% - 12px)" : "12px"})` });

export default function EarlyVoteConsole({ data, initial, lede, faq }: { data: EvConsole; initial?: string; lede?: React.ReactNode; faq?: [string, string][] }) {
  const [metric, setMetric] = useState<Metric>("model");
  const [scope, setScope] = useState<string>(initial ?? "US");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [cGeo, setCGeo] = useState<Record<string, { id: string; d: string }[]>>({});
  const [cNames, setCNames] = useState<Record<string, string> | null>(null);
  const [cData, setCData] = useState<Record<string, { ret: CategoryPayload | null; inp: CategoryPayload | null } | "fail">>({});
  const [tip, setTip] = useState<{ k: string; x: number; y: number; w?: number; h?: number } | null>(null);
  const [sort, setSort] = useState<"most" | "pace" | "d" | "r" | "az">("most");
  const [all, setAll] = useState(false);
  const [pmodel, setPmodel] = useState<PartyModel | null>(null);
  useEffect(() => { getPartyModel().then(setPmodel); }, []);

  const byState = useMemo(() => Object.fromEntries(data.rows.map((r) => [r.st, r])) as Record<string, EvRow>, [data.rows]);
  const row = scope === "US" ? null : byState[scope] ?? null;
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);
  useEffect(() => {
    if (scope === "US") return;
    if (!cGeo[scope]) fetch(`/forecast/states/${scope}.json`).then((r) => r.json()).then((g) => setCGeo((o) => ({ ...o, [scope]: g.counties }))).catch(() => {});
    if (!cNames) fetch("/earlyvote-county-names.json").then((r) => r.json()).then(setCNames).catch(() => setCNames({}));
    if (!cData[scope]) Promise.all([getCategory(scope, "returned"), getCategory(scope, "inperson")])
      .then(([ret, inp]) => setCData((o) => ({ ...o, [scope]: ret || inp ? { ret, inp } : "fail" }))).catch(() => setCData((o) => ({ ...o, [scope]: "fail" })));
  }, [scope, cGeo, cNames, cData]);
  const go = (st: string) => {
    setScope(st); setTip(null); setAll(false);
    const slug = st === "US" ? "" : "/" + (byState[st]?.slug ?? st.toLowerCase());
    try { window.history.replaceState(null, "", `/maps/early-vote${slug}`); } catch { /* history unavailable */ }
    try { document.getElementById("evc-stage")?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* no scroll */ }
  };

  // counties of the open state, joined to the map by name
  const counties = useMemo<County[] | null>(() => {
    const cd = cData[scope];
    if (scope === "US" || !cd || cd === "fail" || !cNames) return null;
    const local: Record<string, string> = {};
    for (const [fips, nm] of Object.entries(cNames)) if (stateOfFips(fips) === scope) local[nm] = fips;
    const out: Record<string, County> = {};
    const add = (p: CategoryPayload | null, k: "mail" | "inperson") => {
      for (const [name, g] of Object.entries(p?.regions ?? {})) {
        const id = matchCounty(name, local); if (!id) continue;
        const c = (out[id] ??= { id, name, total: 0, mail: 0, inperson: 0, dem: 0, rep: 0, ind: 0, uMail: 0, uIn: 0, md: 0, mr: 0, mo: 0, modeled: false });
        const t = sumRow(g, () => true); c[k] += t; c.total += t;
        c[k === "mail" ? "uMail" : "uIn"] += sumRow(g, (x) => x === "Unspecified");
        c.dem += sumRow(g, (x) => x === "Democratic"); c.rep += sumRow(g, (x) => x === "Republican"); c.ind += sumRow(g, isOther);
      }
    };
    add(cd.ret, "mail"); add(cd.inp, "inperson");
    const L = Object.values(out);
    // modeled ballots: reported party where the county has it, the On Point party model for every Unspecified ballot
    const est: Record<string, [number, number, number]> = {};
    if (pmodel) {
      for (const [mode, key] of [["returned", "uMail"], ["early", "uIn"]] as const) {
        const places = L.filter((c) => c[key] > 0 && pmodel.mix[c.id]).map((c) => ({ key: c.id, st: scope, parts: [[c.id, c[key]] as [string, number]], votes: c[key] }));
        if (!places.length) continue;
        const sim = simulate(places, pmodel, mode);
        for (const [id, e] of Object.entries(sim.byKey)) { const v = est[id] ?? [0, 0, 0]; est[id] = [v[0] + e.d * e.votes, v[1] + e.r * e.votes, v[2] + e.i * e.votes]; }
      }
    }
    for (const c of L) {
      const u = c.uMail + c.uIn, e = est[c.id];
      if (e) { c.md = c.dem + e[0]; c.mr = c.rep + e[1]; c.mo = c.ind + e[2]; c.modeled = u > 0; }
      else if (u > 0 && row?.pm) { c.md = c.dem + u * row.pm.d; c.mr = c.rep + u * row.pm.r; c.mo = c.ind + u * row.pm.o; c.modeled = true; }
      else { c.md = c.dem; c.mr = c.rep; c.mo = c.ind; }
    }
    // keep the counties on the state's published party model: rake the modeled ballots so every county adds up to its
    // own Unspecified count and the state adds up to its published party split
    const pm = row?.pm;
    const M = L.filter((c) => c.modeled && c.uMail + c.uIn > 0);
    if (pm && M.length) {
      const T = L.reduce((a, c) => a + c.total, 0);
      const rep = { d: L.reduce((a, c) => a + c.dem, 0), r: L.reduce((a, c) => a + c.rep, 0), o: L.reduce((a, c) => a + c.ind, 0) };
      const want = { d: Math.max(0, pm.d * T - rep.d), r: Math.max(0, pm.r * T - rep.r), o: Math.max(0, pm.o * T - rep.o) };
      const e = M.map((c) => ({ c, u: c.uMail + c.uIn, d: Math.max(1e-6, c.md - c.dem), r: Math.max(1e-6, c.mr - c.rep), o: Math.max(1e-6, c.mo - c.ind) }));
      const W = want.d + want.r + want.o, U = e.reduce((a, x) => a + x.u, 0);
      if (W > 0 && U > 0) {
        const tg = { d: (want.d / W) * U, r: (want.r / W) * U, o: (want.o / W) * U };
        for (let it = 0; it < 30; it++) {
          for (const k of ["d", "r", "o"] as const) { const sm = e.reduce((a, x) => a + x[k], 0); if (sm > 0) for (const x of e) x[k] *= tg[k] / sm; }
          for (const x of e) { const sm = x.d + x.r + x.o; if (sm > 0) { x.d *= x.u / sm; x.r *= x.u / sm; x.o *= x.u / sm; } }
        }
        for (const x of e) { x.c.md = x.c.dem + x.d; x.c.mr = x.c.rep + x.r; x.c.mo = x.c.ind + x.o; }
      }
    }
    return L;
  }, [scope, cData, cNames, pmodel, row]);
  const cById = useMemo(() => Object.fromEntries((counties ?? []).map((c) => [c.id, c])), [counties]);
  const cMax = useMemo(() => Math.max(1, ...(counties ?? []).map((c) => c.total)), [counties]);

  // national numbers for the metric tiles
  const paceRows = data.rows.filter((r) => r.pace22 != null);
  const natPace = paceRows.length ? paceRows.reduce((a, r) => a + r.total, 0) / paceRows.reduce((a, r) => a + r.total / (r.pace22 as number), 0) : null;
  const natM = partyM(data.dem, data.rep, data.ind);
  const rM = row ? (row.partyShare > 0.5 ? partyM(row.dem, row.rep, row.ind) : null) : natM;
  const tiles: Record<Metric, { lb: string; big: string; sub: string }> = row ? {
    cast: { lb: "Ballots cast", big: short(row.total), sub: row.t22 ? `${pctS(row.total / row.t22, 1)} of all ${row.name} 2022 votes` : "No 2022 turnout on file" },
    pace: { lb: "Pace vs 2022", big: row.pace22 == null ? "n/a" : `${row.pace22 >= 1 ? "+" : ""}${((row.pace22 - 1) * 100).toFixed(0)}%`, sub: row.pace22 == null ? "No 2022 count this far out" : `Against ${row.name} at this point in 2022` },
    party: { lb: "Party of ballots", big: rM == null ? "Not reported" : mLabel(rM), sub: rM == null ? `${row.name} does not publish party` : "By party registration" },
    model: { lb: "Party model", big: row.pm ? mLabel(pmM(row.pm) as number) : "n/a", sub: row.pm ? (row.pm.est > 0.5 ? "Modeled by On Point Polling" : row.pm.est > 0 ? "Partly modeled by On Point Polling" : "Reported by the state") : "No model for this state yet" },
    expect: { lb: "Vs expectations", big: row.pm ? dLabel(row.pm.delta) : "n/a", sub: "Ballots so far against what the forecast expected by now" },
    method: { lb: "Mail or in person", big: pctS(row.mail / Math.max(1, row.total)), sub: "of ballots came by mail" },
  } : {
    cast: { lb: "Ballots cast", big: short(data.total), sub: `${pctS(data.total / data.t22, 1)} of all 2022 votes` },
    pace: { lb: "Pace vs 2022", big: natPace ? `${natPace >= 1 ? "+" : ""}${((natPace - 1) * 100).toFixed(0)}%` : "n/a", sub: `${paceRows.length} states with a 2022 count this far out` },
    party: { lb: "Party of ballots", big: natM == null ? "n/a" : mLabel(natM), sub: `Where ${data.rows.filter((r) => r.partyShare > 0.5).length} states report party` },
    model: { lb: "Party model", big: data.pm ? mLabel(pmM(data.pm) as number) : "n/a", sub: "Every state, modeled where party is not reported" },
    expect: { lb: "Vs expectations", big: data.pm ? dLabel(data.pm.delta) : "n/a", sub: "Ballots so far against what the forecast expected" },
    method: { lb: "Mail or in person", big: pctS(data.mail / Math.max(1, data.total)), sub: "of ballots came by mail" },
  };


  // the map
  const states = useMemo(() => (geo ? Object.entries(geo.states).map(([st, d]) => { const b = bboxOf(d), lb = geo.labels?.[st]; return { st, d, x: b[0], cx: lb ? lb[0] : (b[0] + b[2]) / 2, cy: lb ? lb[1] : (b[1] + b[3]) / 2, w: lb ? lb[2] : b[2] - b[0] }; }) : []), [geo]);
  const stFill = (r: EvRow | undefined): string | null => {
    if (!r) return null;
    if (metric === "cast") return r.t22 ? castFill(r.total / r.t22) : castFill(0.05);
    if (metric === "pace") return r.pace22 != null ? paceFill(r.pace22) : null;
    if (metric === "party") { const m = r.partyShare > 0.5 ? partyM(r.dem, r.rep, r.ind) : null; return m == null ? null : marginColor(m); }
    if (metric === "model") { const m = pmM(r.pm); return m == null ? null : marginColor(m); }
    if (metric === "expect") return r.pm ? marginColor(Math.max(-40, Math.min(40, r.pm.delta * 4))) : null;
    return methodFill(r.mail / Math.max(1, r.total));
  };
  const cFill = (c: County | undefined): string | null => {
    if (!c) return null;
    if (metric === "model") { const m = partyM(c.md, c.mr, c.mo); return m == null ? null : marginColor(m); }
    if (metric === "party") { const m = partyM(c.dem, c.rep, c.ind); return m == null ? null : marginColor(m); }
    if (metric === "method") return methodFill(c.mail / Math.max(1, c.total));
    return castFill((Math.log10(c.total + 1) / Math.log10(cMax + 1)) * 0.6);
  };
  const cPaths = scope !== "US" ? cGeo[scope] ?? null : null;
  const cBox = useMemo(() => {
    if (!cPaths?.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of cPaths) { const b = bboxOf(p.d); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.04;
    return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
  }, [cPaths]);
  const failed = scope !== "US" && cData[scope] === "fail";
  const [W, H] = geo?.frame ?? [975, 610];

  // the readout for the open scope
  const R = row ?? { st: "US", name: "Nationwide", total: data.total, mail: data.mail, inperson: data.inperson, requested: data.requested, dem: data.dem, rep: data.rep, ind: data.ind,
    partyShare: data.partyTotal / Math.max(1, data.total), t22: data.t22, e22: data.e22, t24: data.t24, e24: data.e24, pace22: natPace, pace24: null,
    cps22: [] as [number, number][], cps24: [] as [number, number][], s26: data.s26, fc: { href: "/forecast", label: "On Point forecast" }, slug: "",
    pm: data.pm ? { ...data.pm, xd: 0, xr: 0, shift: null as number | null } : null };
  const party = R.partyShare > 0.5 || (scope === "US" && data.partyTotal > 0);
  // modeled ballots so far: the On Point party model applied to every ballot cast
  const mB = scope === "US"
    ? data.rows.reduce((a, r) => (r.pm ? { d: a.d + r.pm.d * r.total, r: a.r + r.pm.r * r.total, o: a.o + r.pm.o * r.total, n: a.n + r.total } : a), { d: 0, r: 0, o: 0, n: 0 })
    : R.pm ? { d: R.pm.d * R.total, r: R.pm.r * R.total, o: R.pm.o * R.total, n: R.total } : null;
  const pT = scope === "US" ? data.partyTotal : R.dem + R.rep + R.ind;
  const outstanding = R.requested > R.mail ? R.requested - R.mail : 0;

  // table rows
  const tRows = useMemo(() => {
    if (scope !== "US") return [...(counties ?? [])].sort((a, b) => b.total - a.total);
    const L = [...data.rows];
    const dm = (r: EvRow) => (r.pm ? pmM(r.pm) : r.partyShare > 0.5 ? partyM(r.dem, r.rep, r.ind) ?? 0 : null);
    return L.sort((a, b) => sort === "most" ? b.total - a.total : sort === "pace" ? (b.pace22 ?? -1) - (a.pace22 ?? -1)
      : sort === "d" ? (dm(a) ?? 999) - (dm(b) ?? 999) : sort === "r" ? (dm(b) ?? -999) - (dm(a) ?? -999) : a.name.localeCompare(b.name));
  }, [scope, counties, data.rows, sort]);
  const LIMIT = 20, shown = all ? tRows.length : Math.min(LIMIT, tRows.length);
  const tipRow = tip ? (scope === "US" ? byState[tip.k] : null) : null;
  const tipC = tip && scope !== "US" ? cById[tip.k] : null;
  const legend = metric === "cast" ? (scope === "US" ? ["Few ballots so far", "60% of 2022 turnout or more", castFill(0.02), castFill(0.6)] : ["Fewest ballots", "Most ballots", castFill(0.02), castFill(0.6)])
    : metric === "pace" ? ["Behind 2022", "Ahead of 2022", paceFill(0.55), paceFill(1.8)] : metric === "party" || metric === "model" ? ["More Democrats", "More Republicans", marginColor(-35), marginColor(35)]
    : metric === "expect" ? ["Better for Democrats than expected", "Better for Republicans", marginColor(-35), marginColor(35)] : ["In person", "By mail", methodFill(0), methodFill(1)];
  const dateLabel = new Date(`${data.snapshot}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <section className="evc" aria-labelledby="evc-h">
      <Ambient tint="#9fe3c8" />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span>{scope === "US" ? <span>Early vote</span> : <><button className="evc-crumb" onClick={() => go("US")}>Early vote</button><span className="sep">/</span><span>{R.name}</span></>}</nav>
      <header className="evc-head">
        <Pointy className="cam-hero cam-ev pty-side" pose="wave" prop="ballot" size={118} look={-1} flip say={<>Every county&apos;s ballots, modeled by party as they come in.</>} />
        <div>
          <div className="eye g">2026 early vote · as of {dateLabel} · {data.daysOut} days out</div>
          <h1 id="evc-h"><Count value={R.total} /> <span>ballots cast {scope === "US" ? "so far" : `in ${R.name}`}</span></h1>
          {lede ? <div className="evc-lede">{lede}</div> : null}
        </div>
        <dl className="evc-meta">
          {mB && mB.n ? <>
            <div className="mb d"><dt>Modeled Democrats</dt><dd>{short(mB.d)}<small>{pctS(mB.d / mB.n, 1)}</small></dd></div>
            <div className="mb r"><dt>Modeled Republicans</dt><dd>{short(mB.r)}<small>{pctS(mB.r / mB.n, 1)}</small></dd></div>
            <div className="mb o"><dt>Modeled other</dt><dd>{short(mB.o)}<small>{pctS(mB.o / mB.n, 1)}</small></dd></div>
          </> : null}
          <div><dt>By mail</dt><dd>{short(R.mail)}</dd></div>
          <div><dt>In person</dt><dd>{short(R.inperson)}</dd></div>
          {scope === "US" ? <div><dt>States reporting</dt><dd>{data.rows.length}</dd></div> : <div><dt>Counties</dt><dd>{counties ? counties.length : "..."}</dd></div>}
          {R.t22 ? <div><dt>Of 2022 turnout</dt><dd>{pctS(R.total / R.t22, 1)}</dd></div> : null}
        </dl>
      </header>

      <div className="evc-tiles" role="tablist" aria-label="What the map shows">
        {(Object.keys(tiles) as Metric[]).map((k) => (
          <button key={k} role="tab" aria-selected={metric === k} className={`evc-tile${metric === k ? " on" : ""}`} onClick={() => setMetric(k)}>
            <span className="lb">{tiles[k].lb}</span><b>{tiles[k].big}</b><span className="sb">{tiles[k].sub}</span>
          </button>
        ))}
      </div>

      <div className="evc-stage" id="evc-stage">
        <div className="evc-mapcard">
          <div className="evc-maphead">
            <div><span className="eye">{scope === "US" ? "Every reporting state" : `${R.name} by county`}</span><h2>{tiles[metric].lb}{scope === "US" ? " by state" : ""}</h2></div>
            {scope !== "US" ? <button className="btn sm" onClick={() => go("US")}>Back to the nation</button> : <span className="evc-hint">Click a state to see its counties</span>}
          </div>
          <div className="evc-mapwrap" onMouseLeave={() => setTip(null)}>
            {scope === "US" ? (geo ? (
              <svg key={`us-${metric}`} className="evc-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Early vote by state, ${tiles[metric].lb.toLowerCase()}`}>
                <defs><pattern id="evc-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(255,255,255,.04)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.16)" strokeWidth="2" /></pattern></defs>
                {states.map((s) => {
                  const r = byState[s.st], f = stFill(r);
                  return <path key={s.st} d={s.d} className={r ? "live" : "off"} style={{ fill: r ? f ?? "url(#evc-hatch)" : undefined, animationDelay: `${((s.x / W) * 0.5).toFixed(2)}s` }}
                    tabIndex={r ? 0 : -1} role={r ? "button" : undefined} aria-label={r ? `${r.name}, ${commas(r.total)} ballots` : undefined}
                    onMouseMove={r ? (e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: s.st, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); } : undefined}
                    onClick={r ? () => go(s.st) : undefined} onKeyDown={r ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(s.st); } } : undefined} />;
                })}
                {states.filter((s) => s.w > 36).map((s) => <text key={s.st} x={s.cx} y={s.cy + 4} className={byState[s.st] ? "" : "off"}>{s.st}</text>)}
              </svg>) : <div className="evc-load sx-skel" />)
            : cPaths && cBox ? (
              <svg key={`${scope}-${metric}`} className="evc-map cty" viewBox={cBox} role="img" aria-label={`${R.name} early vote by county`}>
                {cPaths.map((p) => {
                  const c = cById[p.id], f = cFill(c);
                  return <path key={p.id} d={p.d} className={c ? "live" : "off"} style={{ fill: f ?? undefined }}
                    onMouseMove={(e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: p.id, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); }} />;
                })}
              </svg>) : <div className="evc-load sx-skel" />}
            {failed ? <div className="evc-fail">{R.name} county counts did not load just now. The state totals above are current as of {dateLabel}.</div> : null}
            {tipRow ? (
              <div className="evc-tip" style={{ left: tip!.x, top: tip!.y , ...tipFlip(tip!) }}>
                <h4>{tipRow.name}</h4>
                <div className="r"><span>Ballots</span><b>{commas(tipRow.total)}</b></div>
                <div className="r"><span>Mail / in person</span><b>{pctS(tipRow.mail / Math.max(1, tipRow.total))} / {pctS(tipRow.inperson / Math.max(1, tipRow.total))}</b></div>
                {tipRow.t22 ? <div className="r"><span>Of 2022 turnout</span><b>{pctS(tipRow.total / tipRow.t22, 1)}</b></div> : null}
                <div className="r"><span>Pace</span><b>{paceLabel(tipRow.pace22)}</b></div>
                {tipRow.partyShare > 0.5 ? <div className="r"><span>Party of ballots</span><b className={(partyM(tipRow.dem, tipRow.rep, tipRow.ind) ?? 0) < 0 ? "d" : "r"}>{mLabel(partyM(tipRow.dem, tipRow.rep, tipRow.ind) ?? 0)}</b></div> : <div className="r"><span>Party</span><b>Not reported</b></div>}
                {tipRow.pm ? <div className="r"><span>Party model{tipRow.pm.est > 0.5 ? ", modeled" : ""}</span><b className={(pmM(tipRow.pm) ?? 0) < 0 ? "d" : "r"}>{mLabel(pmM(tipRow.pm) ?? 0)}</b></div> : null}
                <div className="cta">Click for counties</div>
              </div>
            ) : tipC ? (
              <div className="evc-tip" style={{ left: tip!.x, top: tip!.y , ...tipFlip(tip!) }}>
                <h4>{tipC.name}</h4>
                <div className="r"><span>Ballots</span><b>{commas(tipC.total)}</b></div>
                <div className="r"><span>Mail / in person</span><b>{commas(tipC.mail)} / {commas(tipC.inperson)}</b></div>
                {tipC.md + tipC.mr > 0 ? <>
                  <div className="r"><span>{tipC.modeled ? "Modeled Democrats" : "Democrats"}</span><b className="d">{commas(tipC.md)} · {pctS(tipC.md / Math.max(1, tipC.total), 1)}</b></div>
                  <div className="r"><span>{tipC.modeled ? "Modeled Republicans" : "Republicans"}</span><b className="r">{commas(tipC.mr)} · {pctS(tipC.mr / Math.max(1, tipC.total), 1)}</b></div>
                  <div className="r"><span>{tipC.modeled ? "Modeled lead" : "Party lead"}</span><b className={(partyM(tipC.md, tipC.mr, tipC.mo) ?? 0) < 0 ? "d" : "r"}>{mLabel(partyM(tipC.md, tipC.mr, tipC.mo) ?? 0)}</b></div>
                </> : null}
                {tipC.dem + tipC.rep > 0 && tipC.modeled ? <div className="r"><span>Reported party</span><b className={(partyM(tipC.dem, tipC.rep, tipC.ind) ?? 0) < 0 ? "d" : "r"}>{mLabel(partyM(tipC.dem, tipC.rep, tipC.ind) ?? 0)}</b></div> : null}
              </div>
            ) : null}
          </div>
          <div className="evc-legend"><span>{legend[0]}</span><i style={{ background: `linear-gradient(90deg, ${legend[2]}, ${metric === "pace" ? "rgb(240,240,240)," : metric === "party" || metric === "model" || metric === "expect" ? "rgb(240,236,246)," : ""} ${legend[3]})` }} /><span>{legend[1]}</span>{metric === "party" || metric === "pace" || metric === "model" || metric === "expect" ? <span className="hatch">No data</span> : null}</div>
        </div>

        <aside className="evc-read" aria-live="polite">
          <div className="evc-rh"><div><span className="eye">{scope === "US" ? "All reporting states" : "State"}</span><h3>{R.name}</h3></div>{R.fc ? <Link className="btn sm" href={R.fc.href}>{scope === "US" ? "Forecast" : "Race forecast"}</Link> : null}</div>
          <div className="evc-split">
            <div className="lbls"><span><i className="m" />Mail {short(R.mail)}</span><span>In person {short(R.inperson)}<i className="p" /></span></div>
            <div className="bar"><i className="m" style={{ width: pctS(R.mail / Math.max(1, R.total), 2) }} /><i className="p" style={{ width: pctS(R.inperson / Math.max(1, R.total), 2) }} /></div>
          </div>
          {party && pT > 0 ? (
            <div className="evc-party">
              <div className="lbls"><span className="d">Democrats {pctS(R.dem / pT, 1)}</span><span>Other {pctS(R.ind / pT, 1)}</span><span className="r">Republicans {pctS(R.rep / pT, 1)}</span></div>
              <div className="bar"><i className="d" style={{ width: pctS(R.dem / pT, 2) }} /><i className="o" style={{ width: pctS(R.ind / pT, 2) }} /><i className="r" style={{ width: pctS(R.rep / pT, 2) }} /></div>
              <p className="evc-note">Party registration of the voters who cast these ballots{scope === "US" ? ", in the states that publish it" : ""}. It is not how they voted.</p>
            </div>
          ) : <p className="evc-note">{R.name} does not report the party of its early voters{R.pm ? ", so the split below comes from the On Point party model." : "."}</p>}
          {R.pm ? (
            <div className="evc-pm">
              <div className="evc-pmh"><span className="eye">On Point party model</span><span className={`tag ${scope === "US" ? "p" : R.pm.est > 0.5 ? "m" : R.pm.est > 0 ? "p" : "s"}`}>{scope === "US" ? `${pctS(R.pm.est)} modeled` : R.pm.est > 0.5 ? "Modeled" : R.pm.est > 0 ? "Partly modeled" : "Reported"}</span></div>
              <div className="lbls"><span className="d">D {pctS(R.pm.d, 1)} · {short(R.pm.d * R.total)}</span><span>Other {pctS(R.pm.o, 1)}</span><span className="r">R {pctS(R.pm.r, 1)} · {short(R.pm.r * R.total)}</span></div>
              <div className="bar"><i className="d" style={{ width: pctS(R.pm.d, 2) }} /><i className="o" style={{ width: pctS(R.pm.o, 2) }} /><i className="r" style={{ width: pctS(R.pm.r, 2) }} /></div>
              {R.pm.xd ? <div className="lbls exp"><span>Expected by now</span><span className="d">D {pctS(R.pm.xd, 1)}</span><span className="r">R {pctS(R.pm.xr, 1)}</span></div> : null}
              <div className="evc-pmk">
                <div><span>Party lead</span><b className={(pmM(R.pm) ?? 0) < 0 ? "d" : "r"}>{mLabel(pmM(R.pm) ?? 0)}</b></div>
                <div><span>Vs expected</span><b className={R.pm.delta < 0 ? "d" : "r"}>{Math.abs(R.pm.delta) < 0.05 ? "Even" : `${R.pm.delta < 0 ? "D" : "R"} +${Math.abs(R.pm.delta).toFixed(1)}`}</b></div>
                {R.pm.shift != null ? <div><span>Forecast effect</span><b className={R.pm.shift < 0 ? "d" : "r"}>{Math.abs(R.pm.shift) < 0.05 ? "None" : `${R.pm.shift < 0 ? "D" : "R"} +${Math.abs(R.pm.shift).toFixed(1)}`}</b></div> : null}
              </div>
              <p className="evc-note">{scope === "US" ? "Every reporting state on one scale: reported party where a state publishes it, and the On Point Polling model of each county where it does not." : R.pm.est > 0.5 ? `${R.name} does not publish party, so On Point Polling models it from each county's count, its voter file and its past early voters.` : R.pm.est > 0 ? "Some of these ballots carry no party, so On Point Polling models that share." : "Party registration as the state reports it."} The forecast compares these ballots with what it expected by now and moves the race by the difference.</p>
            </div>
          ) : null}
          <div className="evc-stats">
            <div><span>Of 2022 turnout</span><b>{R.t22 ? pctS(R.total / R.t22, 1) : "n/a"}</b></div>
            <div><span>Pace</span><b className={R.pace22 == null ? "" : R.pace22 >= 1 ? "up" : "dn"}>{R.pace22 == null ? "n/a" : `${R.pace22 >= 1 ? "+" : ""}${((R.pace22 - 1) * 100).toFixed(0)}%`}</b></div>
            <div><span>Mail not back yet</span><b>{outstanding ? short(outstanding) : "n/a"}</b></div>
          </div>
          {R.e22 ? <Meter have={R.total} of={R.e22} label={`of the ${short(R.e22)} early ballots cast in 2022`} /> : null}
          {scope !== "US" ? <PaceChart r={R} label={R.name} /> : <p className="evc-note">Pace compares each state with its own 2022 count at the same number of days before Election Day. Open a state for its pace chart.</p>}
        </aside>
      </div>

      <ThenNow data={data} scope={scope} onOpen={go} />

      <div className="evc-table card">
        <div className="card-h"><h3>{scope === "US" ? "Every reporting state" : `Every ${R.name} county`}</h3><span className="eye" style={{ marginLeft: "auto" }}>{tRows.length} {scope === "US" ? "states" : "counties"}</span></div>
        {scope === "US" ? (
          <div className="evc-tools"><div className="evc-chips" role="group" aria-label="Sort">
            {([["most", "Most ballots"], ["pace", "Fastest pace"], ["d", "Biggest D lead"], ["r", "Biggest R lead"], ["az", "A to Z"]] as [typeof sort, string][]).map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
          </div></div>
        ) : null}
        <div className="evc-tw">
          <table>
            <thead><tr><th>{scope === "US" ? "State" : "County"}</th><th className="n">Ballots</th><th className="n">Mail</th><th className="n">In person</th>{scope === "US" ? <><th className="n">Of 2022 turnout</th><th className="n">Pace</th></> : null}{scope === "US" ? <><th className="n">Dem</th><th className="n">Rep</th><th className="n">Modeled D ballots</th><th className="n">Modeled R ballots</th><th className="n">Vs expected</th></> : <><th className="n">Democrats</th><th className="n">Republicans</th><th className="n">Lead</th></>}</tr></thead>
            <tbody>
              {scope === "US" ? (tRows as EvRow[]).slice(0, shown).map((r) => { const pt = r.dem + r.rep + r.ind; const rep = r.partyShare > 0.5 && pt > 0; return (
                <tr key={r.st} onClick={() => go(r.st)}>
                  <td><b>{r.name}</b></td><td className="n mono">{commas(r.total)}</td><td className="n mono">{commas(r.mail)}</td><td className="n mono">{commas(r.inperson)}</td>
                  <td className="n mono">{r.t22 ? pctS(r.total / r.t22, 1) : "n/a"}</td>
                  <td className={`n mono ${r.pace22 == null ? "" : r.pace22 >= 1 ? "up" : "dn"}`}>{r.pace22 == null ? "n/a" : `${r.pace22 >= 1 ? "+" : ""}${((r.pace22 - 1) * 100).toFixed(0)}%`}</td>
                  <td className="n mono d">{rep ? pctS(r.dem / pt, 1) : "n/a"}</td><td className="n mono r">{rep ? pctS(r.rep / pt, 1) : "n/a"}</td>
                  <td className="n mono d">{r.pm ? <>{commas(r.pm.d * r.total)}<small>{pctS(r.pm.d, 1)}{r.pm.est > 0.5 ? " modeled" : ""}</small></> : "n/a"}</td><td className="n mono r">{r.pm ? <>{commas(r.pm.r * r.total)}<small>{pctS(r.pm.r, 1)}</small></> : "n/a"}</td>
                  <td className={`n mono ${r.pm ? (r.pm.delta < 0 ? "d" : "r") : ""}`}>{r.pm ? (Math.abs(r.pm.delta) < 0.05 ? "Even" : `${r.pm.delta < 0 ? "D" : "R"} +${Math.abs(r.pm.delta).toFixed(1)}`) : "n/a"}</td>
                </tr>); })
              : counties ? (tRows as County[]).slice(0, shown).map((c) => { const pt = c.dem + c.rep + c.ind; return (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td><td className="n mono">{commas(c.total)}</td><td className="n mono">{commas(c.mail)}</td><td className="n mono">{commas(c.inperson)}</td>
                  <td className="n mono d">{c.md + c.mr > 0 ? <>{commas(c.md)}<small>{pctS(c.md / Math.max(1, c.total), 1)}{c.modeled ? " modeled" : ""}</small></> : "n/a"}</td><td className="n mono r">{c.md + c.mr > 0 ? <>{commas(c.mr)}<small>{pctS(c.mr / Math.max(1, c.total), 1)}{c.modeled ? " modeled" : ""}</small></> : "n/a"}</td>
                  <td className={`n mono ${(partyM(c.md, c.mr, c.mo) ?? 0) < 0 ? "d" : "r"}`}>{c.md + c.mr > 0 ? mLabel(partyM(c.md, c.mr, c.mo) ?? 0) : "n/a"}</td>
                </tr>); })
              : <tr><td colSpan={7} className="evc-note">{failed ? "County counts did not load just now." : "Loading counties"}</td></tr>}
            </tbody>
          </table>
        </div>
        {tRows.length > LIMIT ? <div className="evc-more"><button className="btn" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${tRows.length}`}</button></div> : null}
      </div>

      {faq?.length ? (
        <div className="evc-faq">
          <h2>Early vote questions</h2>
          {faq.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}
        </div>
      ) : null}
      <p className="evc-src">Counts come from <a href="https://civicapi.org/early-vote/" target="_blank" rel="noreferrer">civicAPI</a>, which collects them from state election offices. Each state reports on its own schedule and publishes different breakdowns, so a state with no party split simply does not publish one. Pace uses each state&apos;s published 2022 and 2024 early vote checkpoints.</p>
    </section>
  );
}
