"use client";
// The 2028 general election in the overview's own format: the scoreboard with both nominees, the ribbon of electoral
// votes by rating, the paper cutout map beside the path to 270 and the closest states as race cards. Above the map sits
// the ticket builder from the forecast dashboard: pick any Democrat and Republican, add running mates, and add or
// remove a third party, a named independent, a nominee running outside their party, or a custom independent built from
// lanes with a home state and a share. Plain pairings read the forecast's own grid; anything else runs the county engine
// in the browser, 4,000 simulations, and every state is the sum of its counties.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Pointy from "@/onpoint-sketchbook/react/Pointy";
import { HatchDefs, InkDefs, InkOutline, Lift, sweepDelays, useBoil, useInView } from "@/onpoint-sketchbook/react/SketchMap";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { X, STATE_NAME, fmtK, fmtN, fmtMg, fmtPct, fmtSh, genRes, last, probColor, shiftColor, two, type CountiesGeo, type GenFile, type Res, type StatesGeo, type TicketRes } from "./lib";
import { WASH_CUTS, WASH_D, WASH_R, WASH_T, washColor } from "@/onpoint-sketchbook/react/SketchMap";
import { CountyPaths28, CtyTip, ViewSeg, type CtyRow, type View } from "./Cty28";
import { useJSON, useTicket, type Ticket } from "./useX";
import { RATE, RATES, rateOf, type Rate } from "./rate28";
import { RateTip, StateTip, Tip, type At } from "./Tips28";
import type { CandOpt, Grid } from "./Matchup";

// the dashboard's ticket colors, in order
const TKC = ["#d98a1c", "#13a39a", "#c23f8e", "#7b4fd6"];
/** a third party's lead, shaded the dashboard's way: a quarter tint at under 2 points up to the full color past 12 */
const mixHex = (a: string, b: string, t: number) => { const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; };
const leadTint = (c: string, fm: number) => { const B = [2, 6, 12]; let i = B.findIndex((b) => fm < b); if (i < 0) i = B.length; const tt = 0.1 + 0.9 * i / B.length; const lo = mixHex("#ffffff", c, 0.25); const l = lo.match(/\d+/g)!.map(Number); const h = [1, 3, 5].map((j) => parseInt(c.slice(j, j + 2), 16)); return `rgb(${l.map((v, k) => Math.round(v + (h[k] - v) * tt)).join(",")})`; };
const tkStep = (fm: number) => (fm < 2 ? "Tilt" : fm < 6 ? "Lean" : fm < 12 ? "Likely" : "Safe");
/** a third party's sketch hatch, the same four steps as Tilt to Safe: line width, gap and wash, drawn upright so it reads apart from the slanted blue and red */
const TK_HATCH: [number, number, number][] = [[1.2, 9, 0.1], [1.6, 7, 0.16], [2, 6.5, 0.24], [3.4, 5, 0.46]];
/** a third party's chance to carry a state: a light tint at a coin flip up to its full color at certain */
const winTint = (c: string, p: number) => mixHex("#ffffff", c, 0.15 + 0.85 * Math.max(0, Math.min(1, (p - 0.34) / 0.66)));
const tkI = (fm: number) => (fm < 2 ? 0 : fm < 6 ? 1 : fm < 12 ? 2 : 3);
const rgba = (c: string, a: number) => `rgba(${[1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)).join(",")},${a})`;
const tkCss = (c: string, fm: number) => { const [w, g, a] = TK_HATCH[tkI(fm)]; return `repeating-linear-gradient(90deg, ${c} 0 ${w}px, ${rgba(c, a)} ${w}px ${g}px)`; };
function TicketHatch({ id, colors }: { id: string; colors: string[] }) {
  return (
    <defs>
      {colors.map((c, j) => TK_HATCH.map(([w, g, a], i) => (
        <pattern key={`${j}-${i}`} id={`${id}-t${j}-${i}`} width={g} height={g} patternUnits="userSpaceOnUse">
          <rect width={g} height={g} fill={rgba(c, a)} /><line x1="0" y1="0" x2="0" y2={g} stroke={c} strokeWidth={w} />
        </pattern>
      )))}
    </defs>
  );
}
type TK = { key: string; vp: string; share: number | null };
const writeTickets = (l: TK[]) => l.map((t) => `${encodeURIComponent(t.key)}~${encodeURIComponent(t.vp || "")}~${t.share == null || !isFinite(t.share) ? "" : t.share}`).join(";");
export type ThirdModel = { key: string; party: string; name: string; share: number | null; lift: number | null; fromD: number | null; own: number | null; ind: number | null; basis: string; m?: Record<string, number | null> };
/** a candidate's modeled share alone against this pair of nominees, the dashboard's rule: the national odds times the
 *  multiplier for each nominee; null when the model takes them off the ballot against one of the nominees */
const pairShare = (r: ThirdModel, dp: string, rp: string): number | null => {
  if (r.share == null) return null; const s0 = r.share / 100; let o = s0 / (1 - s0);
  const a = r.m?.[`D|${dp}`], b = r.m?.[`R|${rp}`]; const ma = a == null ? 1 : a, mb = b == null ? 1 : b;
  if (!(ma > 0) || !(mb > 0)) return null; o *= ma * mb; return (100 * o) / (1 + o);
};
export type ThirdProfile = Record<"name" | "who" | "status" | "lane" | "core" | "quotes" | "pillars" | "attacks" | "reach" | "risks" | "draw_note", string>;
const LANES = ["Right populist", "Libertarian", "Centrist", "Progressive left", "Anti establishment", "Working class"];
const SMALL = ["DE", "RI", "CT", "NJ", "MD", "MA", "VT", "NH", "DC", "HI"];
const slug = (st: string) => `/2028/${st.toLowerCase().split("-")[0]}`;
const nameOf = (k: string) => STATE_NAME[k] ?? (k === "NE-1" ? "Nebraska 1st District" : k === "NE-3" ? "Nebraska 3rd District" : k === "ME-1" ? "Maine 1st District" : k === "ME-2" ? "Maine 2nd District" : k === "NE-2" ? "Nebraska 2nd District" : k);
const ink = (hex: string) => { if (!hex.startsWith("#") && !hex.startsWith("rgb")) return "#141218"; const c = hex.replace(/^rgb\(|\)$/g, ""); const v = hex.startsWith("#") ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : c.split(",").map(Number); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 > 150 ? "#1b1328" : "#fff"; };
const parseLanes = (s: string) => { const o: Record<string, number> = {}; (s || "").split(";").filter(Boolean).forEach((x) => { const i = x.lastIndexOf("="); o[decodeURIComponent(x.slice(0, i))] = Number(x.slice(i + 1)); }); return o; };
const joinLanes = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${v}`).join(";");

type Full = Required<Pick<Ticket, "dp" | "rp">> & { dvp: string; rvp: string; tks: TK[]; tname: string; thome: string; tlanes: string; dsh: number | null; rsh: number | null };
type Lead = "D" | "R" | number;
type Mode = "rate" | "prob" | "shift";
type Band = Rate | `T${number}`;
type Hover = { at: At; kind: "st"; st: string } | { at: At; kind: "band"; k: Band } | { at: At; kind: "cty"; f: string } | null;
type Unit = { k: string; m: number; fm: number; pD: number; pR: number; pT: number[]; sD: number; sR: number; sT: number[]; ev: number; lead: Lead };

export default function General28({ base, cands, grid, names, a24, third }: { base: Res; cands: CandOpt[]; grid: Grid[]; names: { D: string[]; R: string[] }; a24: Record<string, number | null>; third: { model: ThirdModel[]; profiles: ThirdProfile[] } }) {
  const [t, setT] = useState<Full>({ dp: base.D, rp: base.R, dvp: "", rvp: "", tks: [], tname: "", thome: "", tlanes: "", dsh: null, rsh: null });
  const plain = !t.dvp && !t.rvp && !t.tks.length && t.dsh == null && t.rsh == null;
  const [view, setView] = useState<View>("st");
  const [focus, setFocus] = useState<string | null>(null);
  const basePair = t.dp === base.D && t.rp === base.R;
  const G = useJSON<GenFile>(plain && (!basePair || view === "co") ? `${X}/gen.json` : null);
  const rg = useMemo(() => (plain && G ? genRes(G, t.dp, t.rp) : null), [plain, G, t.dp, t.rp]);
  const tq = useMemo<Ticket>(() => ({ dp: t.dp, rp: t.rp, dvp: t.dvp, rvp: t.rvp, tx: writeTickets(t.tks), tname: t.tname, thome: t.thome, tlanes: t.tlanes, dsh: t.dsh, rsh: t.rsh }), [t]);
  const eng = useTicket(tq, null, plain);
  const isBase = plain && t.dp === base.D && t.rp === base.R;
  const fresh: Res | null = isBase ? base : plain ? rg : eng.res;
  // keep the last answer on screen while the next one runs
  const held = useRef<Res>(base);
  if (fresh) held.current = fresh;
  const res = fresh ?? held.current;
  const busy = !fresh;

  // /2028/general?d=Harris&r=Vance&tp=I|Andrew Yang opens a matchup
  useEffect(() => {
    const id = setTimeout(() => { try {
      const q = new URLSearchParams(window.location.search); const d = q.get("d"), r = q.get("r"), tps = q.getAll("tp");
      const tks = tps.filter((k) => k === "X|Custom" || cands.some((x) => `${x.party}|${x.name}` === k)).slice(0, 4).map((key) => ({ key, vp: "", share: null }));
      if (d || r || tks.length) setT((o) => ({ ...o, dp: d && names.D.includes(d) ? d : o.dp, rp: r && names.R.includes(r) ? r : o.rp, ...(tks.length ? { tks } : {}) }));
    } catch { /* no query */ } }, 0);
    return () => clearTimeout(id);
  }, [cands, names]);

  const set = (p: Partial<Full>) => setT((o) => ({ ...o, ...p }));
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const [mode, setMode] = useState<Mode>("rate");
  const [hov, setHov] = useState<Hover>(null);
  const [lit, setLit] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const go = useInView(stage); useBoil(stage);
  const shapes = useMemo(() => (geo ? Object.entries(geo.states) : []) as [string, string][], [geo]);
  const delays = useMemo(() => sweepDelays(shapes), [shapes]);
  const allD = useMemo(() => shapes.map(([, d]) => d).join(""), [shapes]);
  const T = res.T; const TKS: TicketRes[] = res.tickets ?? []; const NT = TKS.length;
  const tkName = (k: number) => TKS[k]?.label ?? "Third party";
  /** the ticket's presidential candidate, so a running mate never stands in for the ticket */
  const tkTop = (k: number) => TKS[k]?.name ?? "Third party";

  // every electoral unit with its leader among every candidate; Nebraska's 1st and 3rd districts vote with the state
  const units = useMemo(() => {
    const u: Record<string, Unit> = {};
    for (const [k, s] of Object.entries(res.states)) {
      const tot = s.D + s.R + s.I + s.O || 1; const m = isFinite(s.m) ? s.m : two(s.D, s.R);
      const tv = TKS.map((_, j) => s.tk?.[j]?.v ?? 0);
      const field: [Lead, number][] = [["D", s.D], ["R", s.R], ...tv.map((v, j) => [j, v] as [Lead, number])]; field.sort((a, b) => b[1] - a[1]);
      const lead: Lead = NT ? field[0][0] : m <= 0 ? "D" : "R";
      // with a third party on the ballot the margin is the leader's lead over the runner up, in points of the whole vote:
      // negative when the Democrat leads, positive when the Republican does, and zero for a third party's state on the ladder
      const fm = NT ? (100 * (field[0][1] - field[1][1])) / tot : Math.abs(m);
      u[k] = { k, m: NT ? (lead === "D" ? -fm : lead === "R" ? fm : 0) : m, fm, pD: s.pD, pR: s.pR, pT: TKS.map((_, j) => s.tk?.[j]?.p ?? 0), sD: s.D / tot, sR: s.R / tot, sT: tv.map((v) => v / tot), ev: s.ev, lead };
    }
    if (u.NE && (u.NE.ev ?? 0) <= 2) for (const k of ["NE-1", "NE-3"]) if (!u[k]) u[k] = { ...u.NE, k, ev: 1 };
    return u;
  }, [res, TKS, NT]);
  const list = useMemo(() => Object.values(units).filter((x) => x.ev > 0), [units]);
  const evMap = useMemo(() => { const e = { D: 0, R: 0, T: TKS.map(() => 0) }; for (const x of list) { if (x.lead === "D") e.D += x.ev; else if (x.lead === "R") e.R += x.ev; else e.T[x.lead] += x.ev; } return e; }, [list, TKS]);
  const evT = evMap.T.reduce((a, b) => a + b, 0);
  // a D or R state is rated by the two party margin with no third party, and by its lead over the field with one, the dashboard's rule
  const sideRate = (x: Unit): Rate => rateOf(NT ? (x.lead === "D" ? -x.fm : x.fm) : x.m);
  const rk = (x: Unit): Band => (typeof x.lead === "number" ? `T${x.lead}` : sideRate(x));
  const ladder = useMemo(() => {
    const rows0 = [...list].sort((a, b) => (typeof a.lead === "number" ? 0 : a.m) - (typeof b.lead === "number" ? 0 : b.m));
    let run = 0; const rows = rows0.map((u) => { if (u.lead === "D") run += u.ev; return { ...u, run }; });
    const cross = rows.find((r) => r.run >= 270)?.k ?? null;
    const band: Partial<Record<Band, { ev: number; states: [string, number, number][] }>> = {};
    for (const r of rows) { const k = rk(r); (band[k] ??= { ev: 0, states: [] }).ev += r.ev; band[k]!.states.push([r.k, r.ev, r.m]); }
    return { rows, cross, band };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  const bands: Band[] = NT ? ["SD", "LD", "ND", "TD", ...TKS.map((_, j) => `T${j}` as Band), "TR", "NR", "LR", "SR"] : RATES.map((r) => r.k);
  const bandStyle = (k: Band) => (k.startsWith("T") && !RATE[k as Rate] ? (() => { const j = Number(k.slice(1)); const c = TKS[j]?.color ?? TKC[j]; return { label: `${last(tkName(j).split(" and ")[0])} leads`, color: c, ink: "#fff" }; })() : { label: RATE[k as Rate].label, color: RATE[k as Rate].color, ink: RATE[k as Rate].ink });
  const ci = ladder.cross ? ladder.rows.findIndex((r) => r.k === ladder.cross) : Math.floor(ladder.rows.length / 2);
  const win = ladder.rows.slice(Math.max(0, ci - 8), ci + 9);
  const above = ladder.rows.slice(0, Math.max(0, ci - 8)), below = ladder.rows.slice(ci + 9);
  const sum = (rs: typeof ladder.rows) => rs.reduce((a, r) => a + r.ev, 0);
  const flips = list.filter((x) => !x.k.includes("-") && a24[x.k] != null && (typeof x.lead === "number" || Math.sign(a24[x.k]!) !== Math.sign(x.m))).length;
  const closest = [...list].filter((r) => r.k !== "NE-1" && r.k !== "NE-3").sort((a, b) => (NT ? a.fm - b.fm : Math.abs(a.m) - Math.abs(b.m))).slice(0, 5);
  const counts = useMemo(() => { const c: Partial<Record<Band, number>> = {}; for (const x of list) if (!x.k.includes("-")) { const r = rk(x); c[r] = (c[r] ?? 0) + 1; } return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list]);
  const all = res.VD + res.VR + res.VI + res.VO;
  // the model's own Democratic and Republican shares for this ballot, kept while the reader overrides them
  const drKey = `${t.dp}|${t.rp}|${t.dvp}|${t.rvp}|${writeTickets(t.tks)}|${t.tname}|${t.thome}|${t.tlanes}`;
  const drModel = useRef<{ k: string; d: number; r: number } | null>(null);
  if (!busy && t.dsh == null && t.rsh == null && all > 0) drModel.current = { k: drKey, d: (100 * res.VD) / all, r: (100 * res.VR) / all };
  const dm = drModel.current?.k === drKey ? drModel.current : null;
  const nat = res.natM ?? two(res.VD, res.VR);
  // the national popular vote: the two party margin, or with third parties the leader's lead over the field
  const natField = NT ? ([[res.D, res.VD, "d"], [res.R, res.VR, "r"], ...TKS.map((tk) => [tk.name, tk.votes, "i"])] as [string, number, string][]).sort((a, b) => b[1] - a[1]) : null;
  const natText = natField ? `${last(natField[0][0].split(" and ")[0])} +${((100 * (natField[0][1] - natField[1][1])) / all).toFixed(1)}` : fmtMg(nat);
  const natCls = natField ? natField[0][2] : nat < 0 ? "d" : "r";
  const sims = res.sims ?? 4000;
  const dLead = evMap.D >= 270, rLead = evMap.R >= 270;
  const hatched = mode === "rate";
  const leaderOf = (x: Unit) => (x.lead === "D" ? res.D : x.lead === "R" ? res.R : tkTop(x.lead));
  const leadText = (x: Unit) => (NT ? `${last(leaderOf(x).split(" and ")[0])} +${x.fm.toFixed(1)}` : fmtMg(x.m));

  const fill = (st: string) => {
    const v = units[st]; if (!v) return "#2a2438";
    if (typeof v.lead === "number") return mode === "rate" ? `url(#g28-t${v.lead}-${tkI(v.fm)})` : mode === "prob" ? winTint(TKS[v.lead]?.color ?? TKC[v.lead], v.pT[v.lead]) : leadTint(TKS[v.lead]?.color ?? TKC[v.lead], v.fm);
    // the chance to carry the state among every candidate on the ballot, not just the two parties
    if (mode === "prob") return probColor(v.pD / Math.max(1e-6, v.pD + v.pR + v.pT.reduce((a, b) => a + b, 0)) + (NT ? 0.5 * v.pT.reduce((a, b) => a + b, 0) / Math.max(1e-6, v.pD + v.pR + v.pT.reduce((a, b) => a + b, 0)) : 0));
    if (mode === "shift") return a24[st] != null ? shiftColor(v.m - a24[st]!, 16) : "#2a2438";
    return `url(#g28-h-${sideRate(v)})`;
  };
  const point = (e: MouseEvent, st: string) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "st", st });

  // the county view: every county of the matchup on screen, from the forecast file or the county engine
  const cg = useJSON<CountiesGeo>(view === "co" ? `${X}/counties.json` : null);
  const cty = isBase ? rg?.cty ?? null : res.cty && Object.keys(res.cty).length ? res.cty : null;
  const c24 = useMemo(() => new Map((cg?.counties ?? []).map((c) => [c[0], c[4]])), [cg]);
  const cInfo = (f: string) => {
    const r = cty?.[f]; if (!r) return null;
    const tv = NT ? res.ctyT?.[f] ?? [] : [];
    const tot = r[0] + r[1] + r[2] + r[3] || 1;
    const field: [Lead, number][] = [["D", r[0]], ["R", r[1]], ...tv.map((v, j) => [j, v] as [Lead, number])]; field.sort((a, b) => b[1] - a[1]);
    const lead = field[0][0], fm = (100 * (field[0][1] - field[1][1])) / tot;
    const m = NT ? (lead === "D" ? -fm : lead === "R" ? fm : null) : two(r[0], r[1]);
    return { r, tv, tot, lead, fm, m };
  };
  const cFill = (f: string) => {
    const x = cInfo(f); if (!x) return "#e6e0d3";
    if (typeof x.lead === "number") return leadTint(TKS[x.lead]?.color ?? TKC[x.lead], x.fm);
    if (mode === "prob") return probColor(x.r[4] / Math.max(1e-6, x.r[4] + x.r[5]) * (NT ? 1 - x.tv.reduce((a, b) => a + b, 0) / x.tot : 1) + (NT ? 0.5 * x.tv.reduce((a, b) => a + b, 0) / x.tot : 0));
    if (mode === "shift") { const was = c24.get(f); return was != null && x.m != null ? shiftColor(x.m - was, 16) : "#e6e0d3"; }
    return washColor(x.m ?? 0);
  };
  const cHover = (f: string, e: MouseEvent) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "cty", f });
  const cTip = (f: string) => {
    const x = cInfo(f); const g = cg?.counties.find((c) => c[0] === f); if (!x || !g) return null;
    const rows: CtyRow[] = [{ name: res.D, side: "D", v: x.r[0] }, { name: res.R, side: "R", v: x.r[1] }, ...x.tv.map((v, j) => ({ name: tkTop(j), side: "U" as const, v, c: TKS[j]?.color }))];
    return <CtyTip name={g[2]} st={g[1]} rows={rows} other={x.r[3] + (NT ? 0 : x.r[2])} m24={typeof x.lead === "number" ? null : g[4]} m={x.m} note={focus ? "" : NT ? "Click to open the state's counties with these tickets" : "Click to open the state's counties"} />;
  };
  const cPaint = `${mode}|${res.D}|${res.R}|${res.VD}|${NT}|${cty ? 1 : 0}|${TKS.map((x) => x.color).join()}|${focus}`;
  const cRows = useMemo(() => (cg ? (focus ? cg.counties.filter((c) => c[1] === focus) : cg.counties) : []), [cg, focus]);
  // with a third party on the ballot the state pages cannot show this ticket, so a click opens the state's counties here
  const zoom = (st: string) => { setView("co"); setFocus(st.split("-")[0]); setHov(null); };
  const box = focus && geo?.box[focus] ? geo.box[focus] : null;
  const vb = box ? (() => { const [x, y, w, h] = box; const pad = Math.max(w, h) * 0.08; let W = w + 2 * pad, H = h + 2 * pad; const r = 1015 / 630; if (W / H < r) W = H * r; else H = W / r; return { v: `${x + w / 2 - W / 2} ${y + h / 2 - H / 2} ${W} ${H}`, k: W / 1015 }; })() : { v: "-20 -10 1015 630", k: 1 };
  // the focused state's counties, largest first, every candidate's share
  const fList = useMemo(() => (focus && cty ? cRows.map((c) => ({ g: c, x: cInfo(c[0]) })).filter((q) => q.x).sort((a, b) => b.x!.tot - a.x!.tot) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus, cty, cRows, res]);
  const coBusy = view === "co" && (!cg || !cty);
  const stTip = (st: string) => {
    const v = units[st] ?? (st.startsWith("NE-") ? units.NE : undefined); if (!v) return null;
    return <StateTip name={nameOf(st)} ev={v.ev} m={v.m} pD={v.pD} d={res.D} r={res.R} m24={typeof v.lead === "number" ? null : a24[st] ?? null}
      field={NT ? [{ name: res.D, side: "D" as const, s: v.sD, p: v.pD }, { name: res.R, side: "R" as const, s: v.sR, p: v.pR }, ...TKS.map((tk, j) => ({ name: tk.name, side: "U" as const, s: v.sT[j], p: v.pT[j], c: tk.color }))].sort((a, b) => b.s - a.s) : undefined}
      lead={NT ? { name: leaderOf(v), fm: v.fm, c: typeof v.lead === "number" ? TKS[v.lead]?.color ?? TKC[0] : v.lead === "D" ? "#1f3fd1" : "#d42a2a" } : undefined}
      note={st === res.tip ? "The tipping point in the simulations" : st.length === 2 ? (NT ? "Click to open its counties with these tickets" : "Click for its counties") : undefined} />;
  };

  // the ticket builder
  const dl = cands.filter((c) => c.party === "D"), rl = cands.filter((c) => c.party === "R"), il = cands.filter((c) => c.party === "I");
  const chips = [...grid].filter((g) => g.odds != null).sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0)).slice(0, 6);
  const tpOpts: [string, string][] = [["X|Custom", "Custom independent, build from lanes"], ...il.map((c) => [`I|${c.name}`, c.name] as [string, string]),
    ...[...dl, ...rl].filter((c) => !c.name.startsWith("Generic") && c.name !== t.dp && c.name !== t.rp).map((c) => [`${c.party}|${c.name}`, `${c.name} as an independent, from the ${c.party === "D" ? "Democratic" : "Republican"} side`] as [string, string])];
  const vpOpts: [string, string][] = [...il.map((c) => [`I|${c.name}`, c.name] as [string, string]), ...[...dl, ...rl].filter((c) => !c.name.startsWith("Generic")).map((c) => [`${c.party}|${c.name}`, c.name] as [string, string])];
  const modelShare = (key: string) => { const r = third.model.find((x) => x.key === key); return r ? pairShare(r, t.dp, t.rp) : null; };
  const setTk = (j: number, p: Partial<TK>) => set({ tks: t.tks.map((x, i) => (i === j ? { ...x, ...p } : x)) });
  const addTk = (key?: string) => { if (t.tks.length >= 4) return; const used = new Set(t.tks.map((x) => x.key)); const k = key ?? tpOpts.map((o) => o[0]).find((o) => !used.has(o) && o !== "X|Custom") ?? "X|Custom"; if (used.has(k)) return; set({ tks: [...t.tks, { key: k, vp: "", share: null }] }); };
  const dropTk = (j: number) => set({ tks: t.tks.filter((_, i) => i !== j) });
  const custom = t.tks.some((x) => x.key === "X|Custom");
  const lanes = parseLanes(t.tlanes); const hasLanes = Object.keys(lanes).length > 0;
  const laneVal = (l: string) => (hasLanes ? lanes[l] ?? 0 : l === "Anti establishment" || l === "Centrist" ? 50 : 0);
  const setLane = (l: string, v: number) => { const o: Record<string, number> = hasLanes ? { ...lanes } : { "Anti establishment": 50, Centrist: 50 }; o[l] = v; set({ tlanes: joinLanes(o) }); };
  const [showAll, setShowAll] = useState(false);
  const tm = useMemo(() => third.model.filter((r) => r.key !== `D|${t.dp}` && r.key !== `R|${t.rp}`).map((r) => ({ ...r, here: pairShare(r, t.dp, t.rp) })).sort((a, b) => (b.here ?? -1) - (a.here ?? -1)), [third.model, t.dp, t.rp]);

  return (
    <div className="h28 g28">
      {/* the scoreboard */}
      <header className="h28-board">
        <div className="h28-board-top">
          <p className="h28-count"><i />2028 general election · {sims.toLocaleString("en-US")} simulations · every state the sum of its counties</p>
          {busy ? <span className="g28-busy" role="status">Running {T || t.tks.length ? "the county engine" : "the matchup"}</span> : null}
        </div>
        <div className="h28-face-off">
          <div className={`h28-side d${dLead ? " lead" : ""}`}>
            <Toon name={res.D} side="D" size={112} className="h28-big-face" uid="gb" />
            <div><span className="h28-party">Democrat{t.dvp ? ` · with ${t.dvp}` : ""}</span><b className="h28-nm">{res.D}</b><span className="h28-ev"><b key={res.D + res.R + T} className="h28-slam">{evMap.D}</b> electoral votes</span><span className="h28-sub">{fmtPct(res.pD)} to win · {Math.round(res.evD)} in the average simulation</span></div>
          </div>
          <div className="h28-mid">
            <h1 className="h28-h1">The <em>2028</em> race</h1>
            <div className="h28-kpis">
              <span><em>Popular vote</em><b className={natCls}>{natText}</b></span>
              <span><em>Tipping point</em><b>{res.tip ? <Link href={slug(res.tip)}>{STATE_NAME[res.tip] ?? res.tip}</Link> : "None"}</b></span>
              <span><em>Flips from 2024</em><b>{flips} states</b></span>
            </div>
          </div>
          <div className={`h28-side r${rLead ? " lead" : ""}`}>
            <div><span className="h28-party">Republican{t.rvp ? ` · with ${t.rvp}` : ""}</span><b className="h28-nm">{res.R}</b><span className="h28-ev"><b key={res.R + res.D + T} className="h28-slam">{evMap.R}</b> electoral votes</span><span className="h28-sub">{fmtPct(res.pR)} to win · {Math.round(res.evR)} in the average simulation</span></div>
            <Toon name={res.R} side="R" size={112} className="h28-big-face" uid="gb" />
          </div>
        </div>
        {TKS.map((tk, j) => (
          <div key={tk.key} className="g28-third" style={{ "--t3": tk.color } as CSSProperties}>
            <Toon name={tk.name} side="U" size={58} uid={`gt${j}`} />
            <div><span className="h28-party">Third party{tk.vp ? ` · with ${tk.vp}` : ""}</span><b>{tk.label}</b></div>
            <span><em>Popular vote</em><b>{fmtSh(tk.votes / all)}</b></span>
            <span><em>Dashboard model</em><b>{fmtSh(tk.joint)}{tk.user != null ? ` · set ${fmtSh(tk.user)}` : ""}</b></span>
            <span><em>Wins the presidency</em><b>{fmtPct(tk.pWin)}</b></span>
            <span><em>States led · EV</em><b>{counts[`T${j}`] ?? 0} · {evMap.T[j] ?? 0}</b></span>
            <button type="button" className="g28-x" onClick={() => dropTk(j)}>Remove</button>
          </div>
        ))}
        {NT ? <p className="g28-nobody">No one reaches 270 in {fmtPct(res.pNone)} of runs · third parties carry {evT} electoral votes on the map</p> : null}
        {/* the nationwide count: every candidate's votes, popular vote, electoral votes on the map and across the simulations */}
        <div className="g28-nat" aria-label="Nationwide results">
          <div className="g28-nat-h"><h2>Nationwide</h2><span>{fmtN(all)} votes projected · electoral votes on the map are the states each candidate leads · the average and win chance come from {sims.toLocaleString("en-US")} simulations</span></div>
          <div className="g28-scroll"><table>
            <thead><tr><th>Candidate</th><th>Votes</th><th>Popular vote</th><th>Margin</th><th>Electoral votes</th><th>States won</th><th>Average EV</th><th>Wins the presidency</th></tr></thead>
            <tbody>{(() => {
              const rows = [
                { k: "D", nm: res.D, sub: `Democrat${t.dvp ? ` · with ${t.dvp}` : ""}`, side: "D" as const, c: "#1f3fd1", v: res.VD, ev: evMap.D, n: list.filter((x) => x.lead === "D" && !x.k.includes("-")).length, avg: res.evD, p: res.pD },
                { k: "R", nm: res.R, sub: `Republican${t.rvp ? ` · with ${t.rvp}` : ""}`, side: "R" as const, c: "#d42a2a", v: res.VR, ev: evMap.R, n: list.filter((x) => x.lead === "R" && !x.k.includes("-")).length, avg: res.evR, p: res.pR },
                ...TKS.map((tk, j) => ({ k: tk.key, nm: tk.name, sub: `Third party${tk.vp ? ` · with ${tk.vp}` : ""}`, side: "U" as const, c: tk.color, v: tk.votes, ev: evMap.T[j] ?? 0, n: list.filter((x) => x.lead === j && !x.k.includes("-")).length, avg: tk.ev, p: tk.pWin })),
              ].sort((a, b) => b.v - a.v);
              const top = rows[0].v;
              return <>
                {rows.map((r, i) => (
                  <tr key={r.k} className={i === 0 ? "lead" : undefined}>
                    <td><span className="g28-nat-who"><Toon name={r.nm} side={r.side} size={34} uid={`nat${i}`} /><span><b style={{ color: r.c }}>{r.nm}</b><small>{r.sub}</small></span></span></td>
                    <td>{fmtN(r.v)}</td>
                    <td><span className="g28-nat-bar"><i style={{ width: `${(100 * r.v) / all}%`, background: r.c }} /></span><b>{fmtSh(r.v / all)}</b></td>
                    <td>{i === 0 ? `+${((100 * (r.v - rows[1].v)) / all).toFixed(1)}` : `${((100 * (r.v - top)) / all).toFixed(1)}`}</td>
                    <td><b className={r.ev >= 270 ? "won" : undefined}>{r.ev}</b></td>
                    <td>{r.n}</td>
                    <td>{Math.round(r.avg)}</td>
                    <td>{fmtPct(r.p)}</td>
                  </tr>
                ))}
                <tr className="o"><td><span className="g28-nat-who"><span><b>Other candidates</b><small>Everyone not on a ticket above</small></span></span></td><td>{fmtN(res.VO + (NT ? 0 : res.VI))}</td><td><b>{fmtSh((res.VO + (NT ? 0 : res.VI)) / all)}</b></td><td /><td>0</td><td>0</td><td /><td />{null}</tr>
                {res.pNone > 0.0005 ? <tr className="o"><td colSpan={7}>No one reaches 270 electoral votes, so the House picks the president</td><td>{fmtPct(res.pNone)}</td></tr> : null}
              </>;
            })()}</tbody>
          </table></div>
        </div>
        <div className="h28-ribbon" aria-label="Electoral votes by rating">
          <div className="bar" onMouseLeave={() => setHov(null)}>
            {bands.map((k) => { const n = ladder.band[k]?.ev ?? 0; return n ? <i key={k} style={{ flexGrow: n, ...(!RATE[k as Rate] ? { background: tkCss(bandStyle(k).color, 6), color: "#141218" } : {}) }} className={`h28-hz ${k}${hov?.kind === "band" && hov.k === k ? " on" : ""}`} onMouseMove={(e) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "band", k })}>{n >= 20 ? n : ""}</i> : null; })}
            <em style={{ left: `${(270 / 538) * 100}%` }}><span>270</span></em>
          </div>
          <div className="keys">{bands.map((k) => { const b = bandStyle(k); return <span key={k}><i className={`h28-hz ${k}`} style={!RATE[k as Rate] ? { background: b.color } : undefined} />{b.label} <b>{ladder.band[k]?.ev ?? 0}</b></span>; })}</div>
        </div>
      </header>

      {/* the ticket builder */}
      <section className="g28-build" aria-labelledby="g28-b">
        <div className="g28-bh"><h2 id="g28-b">Build the matchup</h2><span>Any two nominees from the forecast, running mates and a third party, the same options as the forecast dashboard</span></div>
        <div className="g28-row">
          <label className="g28-f d"><span>Democrat</span><select value={t.dp} onChange={(e) => set({ dp: e.target.value })}>{names.D.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="g28-f r"><span>Republican</span><select value={t.rp} onChange={(e) => set({ rp: e.target.value })}>{names.R.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="g28-f"><span>Democratic running mate</span><select value={t.dvp} onChange={(e) => set({ dvp: e.target.value })}><option value="">None</option>{dl.filter((c) => !c.name.startsWith("Generic") && c.name !== t.dp).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
          <label className="g28-f"><span>Republican running mate</span><select value={t.rvp} onChange={(e) => set({ rvp: e.target.value })}><option value="">None</option>{rl.filter((c) => !c.name.startsWith("Generic") && c.name !== t.rp).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
        </div>
        <div className="g28-dr">
          {([["D", t.dp, t.dsh, dm?.d, "dsh"], ["R", t.rp, t.rsh, dm?.r, "rsh"]] as ["D" | "R", string, number | null, number | undefined, "dsh" | "rsh"][]).map(([side, nm, v, model, k]) => (
            <div key={side} className={`g28-tk g28-drk ${side === "D" ? "d" : "r"}`} style={{ "--tk": side === "D" ? "#1f3fd1" : "#d42a2a" } as CSSProperties}>
              <span className="g28-tkn">{side}</span>
              <label className="g28-f sm wide"><span>{last(nm)}&apos;s share of the national vote, %</span>
                <div className="g28-slide"><input type="range" min={0} max={95} step={0.5} value={v ?? (model != null ? Math.round(model * 2) / 2 : 45)} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<Full>)} aria-label={`${nm} share`} />
                  <input type="number" min={0} max={95} step={0.5} value={v ?? ""} placeholder={model != null ? model.toFixed(1) : "model"} onChange={(e) => { const x = e.target.value; set({ [k]: x === "" ? null : Math.max(0, Math.min(95, Number(x))) } as Partial<Full>); }} aria-label={`${nm} share, number`} /></div>
                <em className="g28-ms">{v == null ? `The model${model != null ? `, ${model.toFixed(1)}%` : ""}` : <button type="button" onClick={() => set({ [k]: null } as Partial<Full>)}>Back to the model{model != null ? `, ${model.toFixed(1)}%` : ""}</button>}</em>
              </label>
            </div>
          ))}
          <p className="g28-drn">Set either nominee&apos;s national share and every county moves by the same factor. With third party tickets on the ballot they give up or take back the difference in proportion to their own vote; without one, the other candidates do. Counties, states, the electoral votes and the simulations all rerun on the new numbers.</p>
        </div>
        <div className="g28-chips"><span className="eye">Likeliest matchups</span>
          {chips.map((g) => <button type="button" key={g.d + g.r} aria-pressed={t.dp === g.d && t.rp === g.r} onClick={() => set({ dp: g.d, rp: g.r })}>{last(g.d)} v {last(g.r)}<em>{fmtPct(g.odds ?? 0)} likely</em></button>)}
          <button type="button" aria-pressed={t.dp === "Generic Democrat" && t.rp === "Vance"} onClick={() => set({ dp: "Generic Democrat", rp: "Vance" })}>Generic D v Vance<em>headline</em></button>
        </div>
        <div className={`g28-tp${t.tks.length ? " on" : ""}`}>
          {t.tks.map((tk, j) => { const c = res.tickets?.find((x) => x.key === tk.key); const ms = c ? c.joint * 100 : modelShare(tk.key); return (
            <div key={j} className="g28-tk" style={{ "--tk": c?.color ?? TKC[j] } as CSSProperties}>
              <span className="g28-tkn">{j + 1}</span>
              <label className="g28-f i wide"><span>Third party ticket {j + 1}</span><select value={tk.key} onChange={(e) => setTk(j, { key: e.target.value, share: null })}>{tpOpts.filter(([v]) => v === tk.key || !t.tks.some((x) => x.key === v)).filter(([v]) => v !== "X|Custom" || tk.key === "X|Custom" || !custom).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="g28-f"><span>Running mate</span><select value={tk.vp} onChange={(e) => setTk(j, { vp: e.target.value })}><option value="">None</option>{vpOpts.filter(([v]) => v !== tk.key).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="g28-f sm"><span>Share of the vote, %</span>
                <div className="g28-slide"><input type="range" min={0} max={45} step={0.5} value={tk.share ?? ms ?? 5} onChange={(e) => setTk(j, { share: Number(e.target.value) })} aria-label={`Ticket ${j + 1} share`} /><input type="number" min={0} max={45} step={0.5} value={tk.share ?? ""} placeholder={ms != null ? ms.toFixed(1) : "model"} onChange={(e) => { const v = e.target.value; setTk(j, { share: v === "" ? null : Math.max(0, Math.min(45, Number(v))) }); }} aria-label={`Ticket ${j + 1} share, number`} /></div>
                <em className="g28-ms">{tk.share == null ? `Dashboard model${ms != null ? `, ${ms.toFixed(1)}%` : ""}` : <button type="button" onClick={() => setTk(j, { share: null })}>Back to the model{ms != null ? `, ${ms.toFixed(1)}%` : ""}</button>}</em>
              </label>
              <button type="button" className="g28-x" onClick={() => dropTk(j)}>Remove</button>
            </div>
          ); })}
          {custom ? (
            <div className="g28-custom">
              <div className="g28-row">
                <label className="g28-f"><span>Custom independent, name</span><input type="text" maxLength={40} value={t.tname} placeholder="Custom independent" onChange={(e) => set({ tname: e.target.value.slice(0, 40) })} /></label>
                <label className="g28-f"><span>Home state</span><select value={t.thome} onChange={(e) => set({ thome: e.target.value })}><option value="">No home state</option>{Object.entries(STATE_NAME).filter(([k]) => k.length === 2).sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              </div>
              <p className="g28-lh">Lanes: how much of the candidate&apos;s appeal comes from each kind of voter. They are weights, so only their proportions matter.</p>
              <div className="g28-lanes">{LANES.map((l) => (
                <label key={l}><span>{l}</span><input type="range" min={0} max={100} step={5} value={laneVal(l)} onChange={(e) => setLane(l, Number(e.target.value))} /><b>{laneVal(l)}</b></label>
              ))}</div>
            </div>
          ) : null}
          <div className="g28-add">
            {t.tks.length < 4 ? <button type="button" className="g28-plus" onClick={() => addTk()}><b>+</b> Add a third party ticket</button> : null}
            <span>Up to four tickets, each with an optional running mate. Shares start at the dashboard&apos;s model for this matchup, with the overlap between tickets that fish in the same pool taken out; set your own share to override it. {t.tks.length ? "" : "Without one, other candidates take a share built from each county's past third party vote."}</span>
          </div>
        </div>
      </section>

      <div className="h28-body">
        {/* the map */}
        <section className="h28-map" aria-label="2028 general election map">
          <div className="h28-modes">
            <div className="sk-seg" role="radiogroup" aria-label="Color the map by">
              {([["rate", "Rating"], ["prob", "Win chance"], ["shift", "Change from 2024"]] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <ViewSeg view={view} set={(v) => { setView(v); if (v === "st") setFocus(null); }} busy={coBusy} />
            {focus ? <button type="button" className="g28-back" onClick={() => setFocus(null)}>All states</button> : null}
            <span className="h28-closest">Closest: {closest.map((r, i) => <span key={r.k} onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}><Link href={slug(r.k)}>{r.k} {leadText(r)}</Link>{i < closest.length - 1 ? "," : ""}</span>)}</span>
          </div>
          <div ref={stage} className={`h28-stage ${go ? "sk-map-go" : "sk-map-wait"}${busy ? " g28-dim" : ""}`} onMouseLeave={() => setHov(null)}>
            <span className="sk-tape tl" aria-hidden="true" /><span className="sk-tape br" aria-hidden="true" />
            {!geo ? <div className="h28-load">Sketching the map</div> : (
              <svg viewBox={vb.v} role="img" aria-label={`2028 map${focus ? `, ${STATE_NAME[focus]} by county` : ""}, ${res.D} against ${res.R}${T ? ` and ${T}` : ""}`} className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
                <InkDefs id="g28" /><HatchDefs id="g28" /><TicketHatch id="g28" colors={TKS.length ? TKS.map((x) => x.color) : TKC} />
                <path className="h28-base" d={allD} fill="#fbfaf6" aria-hidden="true" />
                {view === "co" && cg && cty ? <CountyPaths28 rows={cRows} fill={cFill} onHover={cHover} onLeave={() => setHov(null)} href={slug} paint={cPaint} onPick={focus ? undefined : zoom} /> : null}
                {view === "co" ? null : <g className="h28-states sk-map-flip" key={`${mode}|${res.D}|${res.R}|${T}|${res.VD}`}>
                  {shapes.map(([st, d]) => (
                    <a key={st} href={slug(st)} aria-label={`${STATE_NAME[st] ?? st} 2028 forecast`} onClick={NT ? (e) => { e.preventDefault(); zoom(st); } : undefined}>
                      <path d={d} fill={fill(st)} style={{ "--d": delays[st] } as CSSProperties} className={(hov?.kind === "st" && hov.st === st) || lit === st ? "hov" : lit || (hov?.kind === "band" && units[st] && rk(units[st]) !== hov.k) ? "fade" : undefined} onMouseMove={(e) => point(e, st)} />
                    </a>
                  ))}
                </g>}
                {hatched || view === "co" ? null : <path className="h28-tex" d={allD} fill="url(#g28-pen)" aria-hidden="true" />}
                {view === "co" && !coBusy ? null : view === "co" ? <text x="487" y="300" textAnchor="middle" className="g28-cload">Drawing 3,100 counties</text> : null}
                <InkOutline id="g28" shapes={focus ? shapes.filter(([k]) => k === focus) : shapes} width={1.5} delays={delays} scale={vb.k} />
                <Lift id="g28" d={view === "co" ? null : hov?.kind === "st" && geo.states[hov.st.split("-")[0]] ? geo.states[hov.st.split("-")[0]] : lit && geo.states[lit.split("-")[0]] ? geo.states[lit.split("-")[0]] : null} fill={hov?.kind === "st" ? fill(hov.st.split("-")[0]) : lit ? fill(lit.split("-")[0]) : "none"} />
                <g className="h28-labels" aria-hidden="true" display={focus ? "none" : undefined}>
                  {Object.entries(geo.labels).map(([st, [x, y]]) => !SMALL.includes(st) ? <text key={st} x={x} y={y} fill={hatched || view === "co" ? "#141218" : ink(fill(st))} className={hatched || view === "co" ? "halo" : undefined}>{st}</text> : null)}
                </g>
              </svg>
            )}
            <Pointy pose="point-pointer" size={112} className="h28-pointy" />
          </div>
          {focus && fList.length ? (
            <div className="s28-card g28-tbl g28-ctab">
              <div className="g28-ctab-h"><h3>{STATE_NAME[focus]} by {focus === "AK" ? "borough" : "county"}</h3><span>{fList.length} {focus === "AK" ? "boroughs and census areas" : "counties"} · the state is their sum · largest first</span><button type="button" className="g28-back" onClick={() => setFocus(null)}>All states</button></div>
              <div className="g28-scroll"><table>
                <thead><tr><th>{focus === "AK" ? "Borough" : "County"}</th><th>Votes</th><th>{last(res.D)}</th><th>{last(res.R)}</th>{TKS.map((tk) => <th key={tk.key} style={{ color: tk.color }}>{last(tk.name)}</th>)}<th>Lead</th><th>2024</th></tr></thead>
                <tbody>{fList.slice(0, 40).map(({ g, x }) => { const r = x!.r; const t0 = x!.tot; const ld = x!.lead; const who = ld === "D" ? res.D : ld === "R" ? res.R : tkTop(ld as number);
                  return <tr key={g[0]} onMouseMove={(e) => cHover(g[0], e)} onMouseLeave={() => setHov(null)}><td>{g[2]}</td><td>{fmtK(t0)}</td><td>{fmtSh(r[0] / t0)}</td><td>{fmtSh(r[1] / t0)}</td>{TKS.map((tk, j) => <td key={tk.key}>{fmtSh((x!.tv[j] ?? 0) / t0)}</td>)}
                    <td className={typeof ld === "number" ? "i" : ld === "D" ? "d" : "r"} style={typeof ld === "number" ? { color: TKS[ld]?.color } : undefined}>{last(who)} +{x!.fm.toFixed(1)}</td><td>{g[4] != null ? fmtMg(g[4]) : ""}</td></tr>; })}</tbody>
              </table></div>
              {fList.length > 40 ? <p className="s28-say">The 40 largest of {fList.length}; hover the map for the rest.</p> : null}
            </div>
          ) : null}
          <div className="h28-under">
            {list.filter((x) => x.k.includes("-") || x.k === "DC").map((x) => { const k = rk(x); return <span key={x.k} onMouseMove={(e) => point(e, x.k)} onMouseLeave={() => setHov(null)}><Link href={slug(x.k)} className={`h28-chip h28-hz ${k}`} style={!RATE[k as Rate] ? ({ "--hatch": mode === "rate" ? tkCss(bandStyle(k).color, x.fm) : "none", backgroundColor: mode === "rate" ? "#fbfaf6" : fill(x.k), color: "#141218" } as CSSProperties) : undefined}>{x.k === "DC" ? "D.C." : x.k}</Link></span>; })}
            {view === "co" && mode === "rate" ? <div className="sk-maplegend h28-legend g28-wash">{[4, 3, 2, 1, 0].map((i) => <i key={"d" + i} style={{ background: WASH_D[i] }} />)}<i style={{ background: WASH_T }} />{[0, 1, 2, 3, 4].map((i) => <i key={"r" + i} style={{ background: WASH_R[i] }} />)}{TKS.map((tk) => <i key={tk.key} className="tk" style={{ background: `linear-gradient(90deg, ${leadTint(tk.color, 1)}, ${tk.color})` }} />)}<em>counties, from {last(res.D)} by {WASH_CUTS[4]} or more to {last(res.R)} by {WASH_CUTS[4]} or more, lavender within a point{NT ? `; a third party's counties tint from light to its full color by its lead` : ""}</em></div>
              : mode === "rate" ? <div className="sk-maplegend h28-legend">{bands.map((k) => { const b = bandStyle(k); return <span key={k}><i className={`h28-hz ${k}`} style={!RATE[k as Rate] ? { background: tkCss(b.color, 6) } : undefined} />{b.label} <b>{counts[k] ?? 0}</b></span>; })}<em>{NT ? "states, by the leader's lead over the field: Tilt under 2 points, Lean 2 to 6, Likely 6 to 12, Safe 12 and up; a third party's states are hatched upright in its color, denser the same way" : "states, by the forecast margin: Tilt under 2 points, Lean 2 to 6, Likely 6 to 12, Safe 12 and up"}</em></div>
              : mode === "prob" ? <span className="h28-scale"><em>{last(res.D)} certain</em><i className="pr" /><em>{last(res.R)} certain</em></span>
              : <span className="h28-scale"><em>Bluer than 2024</em><i className="sh" /><em>Redder than 2024</em></span>}
          </div>
        </section>

        {/* the path to 270 */}
        <aside className="h28-ladder" aria-labelledby="g28-lad">
          <div className="h28-lad-h"><h2 id="g28-lad">The path to 270</h2><span>Every state from the bluest to the reddest</span></div>
          {above.length ? <div className="h28-lad-fold d">{above.length} safer {last(res.D)} states · <b>{sum(above)}</b> votes</div> : null}
          <ol onMouseLeave={() => { setHov(null); setLit(null); }}>
            {win.map((r) => {
              const k = rk(r), b = bandStyle(k), isX = r.k === ladder.cross, isTp = r.k === res.tip;
              return (
                <li key={r.k} className={isX ? "tip" : undefined} onMouseEnter={() => setLit(r.k.split("-")[0])} onMouseMove={(e) => point(e, r.k)}>
                  <Link href={slug(r.k)}>
                    <span className="ab">{r.k}{isTp ? <i className="tp">TP</i> : null}</span>
                    <span className="mg"><i style={{ width: `${Math.min(100, ((typeof r.lead === "number" ? r.fm : Math.abs(r.m)) / 20) * 100)}%`, background: b.color, marginLeft: r.lead === "D" ? "auto" : undefined }} /></span>
                    <span className="mv" style={{ color: !RATE[k as Rate] ? b.color : RATE[k as Rate].text ?? b.color }}>{leadText(r)}</span>
                    <span className="ev">{r.ev}</span>
                    <span className="run">{r.run}</span>
                  </Link>
                  {isX ? <em>{last(res.D)} passes 270 here</em> : null}
                </li>
              );
            })}
          </ol>
          {below.length ? <div className="h28-lad-fold r">{below.length} safer {last(res.R)}{below.some((x) => typeof x.lead === "number") ? " and third party" : ""} states · <b>{sum(below)}</b> votes</div> : null}
          <p className="h28-lad-n">The last column adds up {last(res.D)}&apos;s electoral votes from the top.{ladder.cross ? "" : ` ${last(res.D)} does not reach 270 on the map.`} TP marks the tipping point across all {sims.toLocaleString("en-US")} simulations.</p>
        </aside>
      </div>

      {/* the closest states */}
      <section className="h28-close" aria-labelledby="g28-cl">
        <div className="h28-dock-h"><h2 id="g28-cl">The closest states</h2><span>{last(res.D)} against {last(res.R)}{T ? ` and ${last(T)}` : ""}</span></div>
        <div className="h28-races">
          {closest.map((r) => {
            const was = a24[r.k] ?? null, flip = was != null && (typeof r.lead === "number" || Math.sign(was) !== Math.sign(r.m)), wn = leaderOf(r);
            const pw = typeof r.lead === "number" ? r.pT[r.lead] : r.lead === "D" ? r.pD : r.pR;
            return (
              <Link key={r.k} href={slug(r.k)} className={`sk-race ${r.lead === "R" ? "r" : "d"}`}>
                <span className="st" onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}>{nameOf(r.k)}</span>
                <span className={`sk-tag${flip ? " flip" : ""}`}>{flip ? "Flip" : "Hold"}</span>
                <span className="m"><b>{leadText(r)}</b><span>{last(wn)} {fmtPct(pw)}</span></span>
                <span className="vs">{r.ev} electoral vote{r.ev === 1 ? "" : "s"}{was != null ? ` · ${fmtMg(was)} in 2024` : ""}{TKS.map((tk, j) => ` · ${last(tk.name)} ${fmtSh(r.sT[j], 1)}`).join("")}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* every state, and the spread of outcomes */}
      <div className="g28-two">
        <section className="s28-card" aria-labelledby="g28-h">
          <h2 id="g28-h">Electoral votes across {sims.toLocaleString("en-US")} simulations</h2>
          <Hist h={res.hist} />
          <p className="s28-say">{last(res.D)} wins {fmtPct(res.pD)}, {last(res.R)} {fmtPct(res.pR)}{TKS.map((tk) => `, ${last(tk.name)} ${fmtPct(tk.pWin)}`).join("")}{res.pNone > 0.005 ? `, and no one reaches 270 in ${fmtPct(res.pNone)}` : ""}. {fmtK(all)} votes projected.</p>
        </section>
        <section className="s28-card g28-tbl" aria-labelledby="g28-t">
          <h2 id="g28-t">Every state</h2>
          <div className="g28-scroll"><table>
            <thead><tr><th>State</th><th>EV</th><th>{last(res.D)}</th><th>{last(res.R)}</th>{TKS.map((tk) => <th key={tk.key} style={{ color: tk.color }}>{last(tk.name)}</th>)}<th>Margin</th><th>Leader wins</th></tr></thead>
            <tbody>{[...list].sort((a, b) => a.fm - b.fm).map((x) => (
              <tr key={x.k}><td><Link href={slug(x.k)}>{nameOf(x.k)}</Link></td><td>{x.ev}</td><td>{fmtSh(x.sD)}</td><td>{fmtSh(x.sR)}</td>{TKS.map((tk, j) => <td key={tk.key}>{fmtSh(x.sT[j])}</td>)}
                <td className={typeof x.lead === "number" ? "i" : x.lead === "D" ? "d" : "r"} style={typeof x.lead === "number" ? { color: TKS[x.lead]?.color } : undefined}>{leadText(x)}</td><td>{fmtPct(typeof x.lead === "number" ? x.pT[x.lead] : x.lead === "D" ? x.pD : x.pR)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      </div>

      {/* the dashboard's third party model: every candidate as an independent, and the third party profiles */}
      <section className="s28-card g28-3m" aria-labelledby="g28-3m">
        <h2 id="g28-3m">Every candidate as an independent</h2>
        <p className="s28-say">The dashboard&apos;s third party model: each candidate&apos;s share running as an independent in this matchup, {t.dp} against {t.rp}, and against the generic nominees, from every respondent&apos;s three way choice, how much they lift over an unknown independent and where their vote comes from. Two or more tickets on one ballot split the same voters, so each lands a little lower once added. Add any of them as a ticket above.</p>
        <div className="g28-scroll"><table>
          <thead><tr><th>Candidate</th><th>{last(t.dp)} v {last(t.rp)}</th><th>Generic nominees</th><th>Lift</th><th>From the Democratic side</th><th>Their own party</th><th>Independents</th><th>Basis</th><th /></tr></thead>
          <tbody>{(showAll ? tm : tm.slice(0, 15)).map((r) => (
            <tr key={r.key}><td><b>{r.name}</b><small>{r.party === "I" ? "Independent" : r.party === "D" ? "Democrat" : "Republican"}</small></td><td><b>{r.here != null ? `${r.here.toFixed(1)}%` : "Off the ballot"}</b></td><td>{r.share != null ? `${r.share.toFixed(1)}%` : ""}</td><td>{r.lift != null ? r.lift.toFixed(2) : ""}</td>
              <td>{r.fromD != null ? fmtSh(r.fromD, 0) : ""}</td><td>{r.own != null ? `${r.own.toFixed(1)}%` : ""}</td><td>{r.ind != null ? `${r.ind.toFixed(1)}%` : ""}</td><td>{r.basis}</td>
              <td>{t.tks.some((x) => x.key === r.key) ? <em>On the ballot</em> : r.here == null ? null : t.tks.length < 4 ? <button type="button" className="g28-addrow" onClick={() => addTk(r.key)}>Add</button> : null}</td></tr>
          ))}</tbody>
        </table></div>
        {tm.length > 15 ? <button type="button" className="p28-more" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show the top 15" : `Show all ${tm.length}`}</button> : null}
      </section>
      <section className="g28-prof" aria-labelledby="g28-pf">
        <div className="h28-dock-h"><h2 id="g28-pf">The third party options</h2><span>Who they are, their lane, their message and whose voters the model has them drawing</span></div>
        <div className="g28-pgrid">{third.profiles.map((f) => (
          <article key={f.name} className="s28-card">
            <header><Toon name={f.name} side="U" size={44} uid="pf" /><div><h3>{f.name}</h3><p>{f.status}</p></div></header>
            <p><b>Lane</b> {f.lane}</p>
            <p><b>Core message</b> {f.core}</p>
            <p><b>Reaches</b> {f.reach}</p>
            <p><b>Risks</b> {f.risks}</p>
            <p className="g28-draw">{f.draw_note}</p>
            {(() => { const k = cands.find((c) => c.party === "I" && c.name === f.name) ? `I|${f.name}` : null; return k && t.tks.length < 4 && !t.tks.some((x) => x.key === k) ? <button type="button" className="g28-addrow" onClick={() => addTk(k)}>Add to the ballot</button> : null; })()}
          </article>
        ))}</div>
      </section>

      <nav className="h28-go" aria-label="More of the 2028 forecast">
        {res.tip ? <Link href={slug(res.tip)}><b>{STATE_NAME[res.tip]}</b><span>The tipping point, county by county</span></Link> : null}
        <Link href="/2028"><b>The 2028 overview</b><span>The map for every likely matchup</span></Link>
        <Link href="/2028/primaries"><b>Play the primaries</b><span>Every state, every candidate</span></Link>
        <a href="/play" className="hot"><b>Play Campaign 2028</b><span>Run for president on this map</span></a>
      </nav>

      <Tip at={hov?.at ?? null}>
        {hov?.kind === "st" ? stTip(hov.st) : hov?.kind === "cty" ? cTip(hov.f) : hov?.kind === "band" ? (() => { const b = bandStyle(hov.k); const x = ladder.band[hov.k]; return <RateTip label={b.label} color={b.color} ink={b.ink} states={x?.states ?? []} ev={x?.ev ?? 0} />; })() : null}
      </Tip>
    </div>
  );
}

function Hist({ h }: { h: number[] }) {
  const mx = Math.max(...h, 0.001); const W = 560, H = 160;
  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="g28-hist" role="img" aria-label="Distribution of Democratic electoral votes">
      {h.map((v, k) => { const x = 10 + (k / h.length) * (W - 20), w = (W - 20) / h.length - 2, y = H - (v / mx) * (H - 10); return <rect key={k} x={x} y={y} width={w} height={H - y} rx={2} fill={k * 20 + 10 >= 270 ? "#1f3fd1" : "#d42a2a"} stroke="#141218" strokeWidth={1.2} />; })}
      <line x1={10 + (270 / 540) * (W - 20)} x2={10 + (270 / 540) * (W - 20)} y1={0} y2={H} stroke="#141218" strokeWidth={2} strokeDasharray="5 4" />
      {[0, 100, 200, 270, 300, 400, 500].map((e) => <text key={e} x={10 + (e / 540) * (W - 20)} y={H + 18} textAnchor="middle" fill="#55505e" fontSize={11} fontFamily="JetBrains Mono, monospace">{e}</text>)}
    </svg>
  );
}
