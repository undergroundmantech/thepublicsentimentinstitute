"use client";
// The national election night dashboard for November 3: the state of the Senate, the House, the governorships and
// every other race on one screen, in the forecast console's shape. Four cards across the top carry the score and
// pick a category; the stage below shows that category's map beside its seats, what each side still needs and the
// races to watch; the full race list follows. Returns come from civicAPI through the caching proxy and expected
// results from the forecast index; until a race has votes it shows only its expected lean, hatched, never as a result.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { useRouter } from "next/navigation";
import { marginColor, marginColorInd } from "@/app/lib/opp";
import { STN, KIND_LABEL, FIRST_CLOSE, fmtK, fmtM, isInd, resultsHref, type Kind, type XRace } from "./live";
import { useSharedLive } from "./LiveProvider";
import { tally, watchBar } from "./nationalTally";
import { SeatArc, GovTiles, MajorityBar, SeatKey, countSeats, seatOf, hasReturns, liveMargin, expM, GOV_HOLD, type Seat, type SeatState, type Tile } from "../monitor/Chambers";
import { leanStroke } from "../monitor/paint";
import type { Chambers } from "../monitor/Monitor";

type Cat = "sen" | "house" | "gov" | "other";
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]>; districts: Record<string, { d: string } | string> };
const CATS: { k: Cat; label: string; kinds: Kind[]; hub: string }[] = [
  { k: "sen", label: "Senate", kinds: ["sen"], hub: "sen" }, { k: "house", label: "House", kinds: ["house"], hub: "house" },
  { k: "gov", label: "Governors", kinds: ["gov"], hub: "gov" }, { k: "other", label: "Other races", kinds: ["state", "measure", "leg", "other"], hub: "state" },
];
const MAJ: Record<"sen" | "house" | "gov", number> = { sen: 51, house: 218, gov: 26 };
const pct = (p: number) => `${Math.round(p > 1 ? p : p * 100)}%`;
const slug = (st: string) => STN[st].toLowerCase().replace(/[^a-z]+/g, "-");
const shade = (m: number, ind = false) => (ind ? marginColorInd(m) : marginColor(m));
const clockET = (d: Date | null) => (d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) + " ET" : "—");
const countdown = (ms: number) => { if (ms <= 0) return "now"; const h = Math.floor(ms / 3600000), d = Math.floor(h / 24); return d > 0 ? `${d}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`; };
const lastName = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
const tipFlip = (t: { x: number; y: number; w: number; h: number }): React.CSSProperties => ({ transform: `translate(${t.x > t.w - 280 ? "calc(-100% - 16px)" : "16px"}, ${t.y > t.h - 200 ? "calc(-100% - 12px)" : "12px"})` });

export default function NationalDesk({ chambers }: { chambers: Chambers }) {
  const router = useRouter();
  // one read of every race type for the whole page, so the four category totals never depend on the open tab
  const shared = useSharedLive();
  if (!shared) throw new Error("NationalDesk must render inside LiveProvider");
  const { ix, live } = shared;
  const [cat, setCat] = useState<Cat>("sen");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [now, setNow] = useState(0);
  const [tip, setTip] = useState<{ k: string; x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);

  const all = useMemo(() => ix?.races ?? [], [ix]);
  const ofKind = (k: Kind) => all.filter((r) => r.k === k);
  // what each category has counted: civicAPI calls by party, races leading by party, races counting
  const T = useMemo(() => ({ sen: tally(ofKind("sen"), live.byId), house: tally(ofKind("house"), live.byId), gov: tally(ofKind("gov"), live.byId), other: tally(all.filter((r) => CATS[3].kinds.includes(r.k)), live.byId) }), [all, live.byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const seats = useMemo(() => {
    const of = (k: Kind) => ofKind(k).map((r) => seatOf(r, live.byId[r.id]));
    const hold = (n: number, s: SeatState, l: string): Seat[] => Array.from({ length: n }, () => ({ s, label: l }));
    const gov = of("gov") as Tile[];
    for (const [st, p] of Object.entries(GOV_HOLD)) if (!gov.some((t) => t.st === st)) gov.push({ st, s: p === "D" ? "nd" : "nr", label: `${STN[st]}: ${p === "D" ? "Democratic" : "Republican"} governor, not up this year` });
    return { sen: [...hold(chambers.sen.notD, "nd", "Democratic seat not up this year"), ...of("sen"), ...hold(chambers.sen.notR, "nr", "Republican seat not up this year")], house: of("house"), gov };
  }, [all, live.byId, chambers]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => ({ sen: countSeats(seats.sen), house: countSeats(seats.house), gov: countSeats(seats.gov) }), [seats]);

  const anyLive = T.sen.counting + T.house.counting + T.gov.counting + T.other.counting > 0;
  const linked = Object.keys(live.byId).length;
  const totalCalled = T.sen.called + T.house.called + T.gov.called + T.other.called;
  const totalCounting = T.sen.counting + T.house.counting + T.gov.counting + T.other.counting;
  const msLeft = FIRST_CLOSE - now;
  const phase: "pre" | "closing" | "counting" = anyLive ? "counting" : now && msLeft > 0 ? "pre" : "closing";
  const status = live.loading ? "Connecting to civicAPI" : live.error ? "Live returns unreachable" : phase === "counting" ? "Counting" : phase === "pre" ? "Polls open" : "Awaiting returns";

  // the category on the stage
  const C = CATS.find((c) => c.k === cat)!;
  const races = useMemo(() => all.filter((r) => C.kinds.includes(r.k)), [all, C]);
  const byKey = useMemo(() => { const m: Record<string, XRace[]> = {}; for (const r of races) (m[cat === "house" ? r.id : r.st] ??= []).push(r); return m; }, [races, cat]);
  const [W, H] = geo?.frame ?? [975, 610];
  const shapes = useMemo(() => {
    if (!geo) return [] as { key: string; d: string }[];
    if (cat === "house") return Object.entries(geo.districts).map(([id, v]) => ({ key: id, d: typeof v === "string" ? v : v.d }));
    return Object.entries(geo.states).map(([st, d]) => ({ key: st, d }));
  }, [geo, cat]);
  const labels = useMemo(() => (geo && cat !== "house" ? Object.entries(geo.labels ?? {}).filter(([, l]) => l[2] > 36).map(([st, l]) => ({ st, x: l[0], y: l[1] })) : []), [geo, cat]);
  // one paint per unit: a call fills solid, a count fills by its margin and fades with little in, no votes shows only
  // the expected lean as hatching over the neutral ground, and for mixed offices the share of races reporting
  type Paint = { kind: "none" } | { kind: "expected"; lean: string | null } | { kind: "reported"; fill: string; a: number; called: boolean };
  const paintOf = (key: string): Paint => {
    const rs = byKey[key]; if (!rs?.length) return { kind: "none" };
    const rep = rs.filter((r) => hasReturns(live.byId[r.id]));
    if (cat === "other") {
      if (!rep.length) return { kind: "expected", lean: null };
      return { kind: "reported", fill: `rgba(183,140,255,${(0.3 + 0.6 * rep.length / rs.length).toFixed(2)})`, a: 1, called: rep.some((r) => live.byId[r.id]?.c.some((x) => x[4])) };
    }
    const w = (r: XRace) => r.tot || 1;
    if (!rep.length) {
      const em = rs.filter((r) => expM(r) != null); if (!em.length) return { kind: "expected", lean: null };
      const e = em.reduce((s, r) => s + (expM(r) ?? 0) * w(r), 0) / em.reduce((s, r) => s + w(r), 0);
      return { kind: "expected", lean: shade(e, em.length === 1 && isInd(em[0])) };
    }
    const m = rep.reduce((s, r) => s + (liveMargin(r, live.byId[r.id]) ?? 0) * w(r), 0) / rep.reduce((s, r) => s + w(r), 0);
    const pr = rep.reduce((s, r) => s + (live.byId[r.id]?.pr ?? 0), 0) / rep.length;
    return { kind: "reported", fill: shade(m, rep.length === 1 && isInd(rep[0])), a: 0.45 + 0.55 * Math.min(1, pr / 100), called: rep.some((r) => live.byId[r.id]?.c.some((x) => x[4])) };
  };
  const clickKey = (key: string) => {
    const rs = byKey[key]; if (!rs?.length) return;
    if (rs.length === 1) { router.push(resultsHref(rs[0].id)); return; }
    router.push(`/results/2026/${slug(rs[0].st)}`);
  };

  // the readout: the seats, what each side needs, the verdict and the races to watch
  const ch = cat === "other" ? null : cat;
  const ct = ch ? counts[ch] : null;
  const dTot = ct ? ct.dW + ct.iW : 0;
  const open = ct ? ct.aw + ct.dL + ct.rL + ct.iL : 0;
  const fc = ch === "sen" ? chambers.sen : ch === "house" ? chambers.house : ch === "gov" ? chambers.gov : null;
  const toWatch = useMemo(() => {
    const rep = races.filter((r) => hasReturns(live.byId[r.id]) && !live.byId[r.id]?.c.some((x) => x[4]));
    const pool = rep.length ? rep.sort((a, b) => Math.abs(liveMargin(a, live.byId[a.id]) ?? 99) - Math.abs(liveMargin(b, live.byId[b.id]) ?? 99)) : races.filter((r) => r.k !== "leg" && r.k !== "other" && expM(r) != null).sort((a, b) => Math.abs(expM(a) ?? 99) - Math.abs(expM(b) ?? 99));
    return { live: rep.length > 0, rows: pool.slice(0, 6) };
  }, [races, live.byId]);
  const verdict = (() => {
    if (cat === "other") {
      const t = T.other; const kinds = CATS[3].kinds.map((k) => `${ofKind(k).length} ${KIND_LABEL[k].toLowerCase()}`);
      return t.counting ? <><b>{t.counting} of {t.n}</b> other races are counting and civicAPI has called <b>{t.called}</b></> : <>No votes are counted in the <b>{t.n}</b> other races: {kinds.join(", ")}</>;
    }
    const t = T[cat], c = ct!, name = cat === "sen" ? "Senate" : cat === "house" ? "House" : "governorships";
    if (!t.counting) return <>No votes are counted yet. The forecast gives Democrats <b className="d">{pct(fc!.pD)}</b> for {cat === "gov" ? "most governorships" : `the ${name}`}, about <b>{fc!.dS.toFixed(0)}</b> {cat === "gov" ? "governors" : "seats"} on average</>;
    const dN = Math.max(0, MAJ[cat] - dTot), rN = Math.max(0, (cat === "sen" ? 50 : MAJ[cat]) - c.rW);
    return <>Democrats hold or have won <b className="d">{dTot}</b>, Republicans <b className="r">{c.rW}</b>{dN === 0 ? <>. <b className="d">Democrats have a majority</b></> : rN === 0 ? <>. <b className="r">Republicans have a majority</b></> : <>. Democrats need <b>{dN}</b> of the <b>{open}</b> still open, Republicans need <b>{rN}</b></>}</>;
  })();
  const stats: [string, string][] = cat === "other"
    ? [["Counting", String(T.other.counting)], ["Called", String(T.other.called)], ["Votes in", T.other.votes ? fmtK(T.other.votes) : "0"]]
    : [["Called", `${T[cat].called} of ${T[cat].n}`], ["Leading", `${T[cat].lD} D · ${T[cat].lR} R`], ["Not counted", String(ct!.aw)]];
  const mapTitle = cat === "sen" ? `${T.sen.n} Senate seats on the ballot` : cat === "house" ? "All 435 House districts" : cat === "gov" ? `${T.gov.n} governor races` : `${T.other.n} statewide, legislative, ballot and local races`;

  const tipRaces = tip ? byKey[tip.k] ?? [] : [];
  const stateOf = (key: string) => (cat === "house" ? key.split("-")[1] : key);

  return (
    <section className="opp nat" aria-labelledby="nat-h">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/results">Results</Link><span className="sep">/</span><span>November 3, 2026</span></nav>
      <header className="nat-head">
        <div>
          <div className="eye nat-eye"><i className={`nat-dot${anyLive ? " on" : ""}`} aria-hidden />November 3, 2026 · {status}</div>
          <h1 id="nat-h">Election night, <em>as the nation counts.</em></h1>
          <p className="lede">
            {phase === "pre" ? <>First polls close at 6:00 PM ET on November 3, in {countdown(msLeft)}. Until then every map and seat shows the On Point Politics forecast as an expected lean, hatched, never as a result. Returns from civicAPI replace it as votes are counted.</>
              : phase === "counting" ? <>{totalCounting} races are counting and civicAPI has called {totalCalled}. Reported votes are actual returns; projections and expected leans are modeled and labeled as such.</>
              : <>Polls are closing. Returns appear here as civicAPI reports them, race by race, against the expected vote.</>}
          </p>
          {live.test && live.hidden > 0 ? <p className="nat-test">civicAPI is publishing test returns before Election Day; they are hidden. <a href="?test=1">Preview with test returns</a></p> : null}
          {live.test && live.hidden === 0 && anyLive ? <p className="nat-test">Showing civicAPI test returns for preview. These are not real votes. <a href="?">Hide them</a></p> : null}
        </div>
        <div className="nat-side">
          <dl className="nat-meta">
            <div><dt>{phase === "pre" ? "Polls close in" : "Last read"}</dt><dd>{phase === "pre" ? countdown(msLeft) : clockET(live.at)}</dd></div>
            <div><dt>Races</dt><dd>{all.length || "…"}</dd></div>
            <div><dt>Counting</dt><dd className={anyLive ? "live" : ""}>{linked ? totalCounting : "—"}</dd></div>
            <div><dt>Called</dt><dd>{linked ? totalCalled : "—"}</dd></div>
          </dl>
          <Link className="btn g" href="/results/monitor">Open the situation monitor</Link>
        </div>
      </header>

      <div className="nat-board" role="tablist" aria-label="Race category">
        {CATS.map((c, i) => {
          const t = T[c.k]; const on = cat === c.k;
          const cc = c.k === "other" ? null : counts[c.k];
          const fcx = c.k === "sen" ? chambers.sen : c.k === "house" ? chambers.house : c.k === "gov" ? chambers.gov : null;
          return (
            <button key={c.k} role="tab" aria-selected={on} className={`nat-card${on ? " on" : ""}`} onClick={() => { setCat(c.k); setTip(null); }} style={{ animationDelay: `${i * 0.06}s` }}>
              <span className="nat-card-h"><span className="lb">{c.label}</span><span className="st">{t.called} of {t.n} called · {t.counting} counting</span></span>
              {cc ? (
                <>
                  <span className="nat-score">
                    <span className="d"><b>{cc.dW + cc.iW}</b><small>Dem{cc.iW ? ` +${cc.iW} ind` : ""}{cc.dL + cc.iL ? ` · ${cc.dL + cc.iL} lead` : ""}</small></span>
                    <span className="mid"><b>{cc.aw}</b><small>not counted</small></span>
                    <span className="r"><b>{cc.rW}</b><small>Rep{cc.rL ? ` · ${cc.rL} lead` : ""}</small></span>
                  </span>
                  <MajorityBar c={cc} maj={MAJ[c.k as "sen" | "house" | "gov"]} majLabel={`${MAJ[c.k as "sen" | "house" | "gov"]} for ${c.k === "gov" ? "most" : "control"}`} />
                  <span className="sb">Forecast <b className="d">D {pct(fcx!.pD)}</b> · {fcx!.dS.toFixed(1)} D {c.k === "gov" ? "governors" : "seats"} on average</span>
                </>
              ) : (
                <>
                  <span className="nat-score other">
                    {CATS[3].kinds.map((k) => <span key={k}><b>{ofKind(k).length}</b><small>{KIND_LABEL[k].toLowerCase()}</small></span>)}
                  </span>
                  <span className="nat-prog" aria-hidden><i style={{ width: `${t.n ? (100 * t.counting) / t.n : 0}%` }} /></span>
                  <span className="sb">{t.counting ? `${pct(t.counting / t.n)} of these races have votes in` : "Statewide offices, legislatures, ballot measures, courts and local races"}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="nat-stage">
        <div className="nat-mapcard card">
          <div className="nat-maphead">
            <div><span className="eye">{C.label}</span><h2>{mapTitle}</h2></div>
            <span className="nat-upd">{live.at ? <>civicAPI · read {clockET(live.at)}</> : live.loading ? "Connecting to civicAPI" : "Forecast only"}</span>
          </div>
          <div className="nat-mapwrap" onMouseLeave={() => setTip(null)}>
            {geo ? (
              <svg key={cat} className={`nat-map${cat === "house" ? " hs" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${C.label} results map`}>
                <defs>
                  <pattern id="nat-stripes" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#000" /><rect width="2.2" height="6" fill="#fff" /></pattern>
                  <mask id="nat-hatch" maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}><rect width={W} height={H} fill="url(#nat-stripes)" /></mask>
                </defs>
                {shapes.map((s, i) => {
                  const p = paintOf(s.key); const rs = byKey[s.key] ?? [];
                  const aria = rs.length ? rs.slice(0, 3).map((r) => { const c = live.byId[r.id]; const m = liveMargin(r, c); return `${r.nm}: ${m != null ? `${fmtM(m, r.k, isInd(r))} with ${c!.pr.toFixed(0)}% in` : `no votes yet, expected ${fmtM(expM(r), r.k, isInd(r))}`}`; }).join("; ") : undefined;
                  const handlers = rs.length ? {
                    onMouseMove: (e: React.MouseEvent<SVGElement>) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: s.key, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); },
                    onClick: () => clickKey(s.key), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickKey(s.key); } },
                  } : {};
                  return (
                    <g key={s.key} className={`u ${p.kind}${p.kind === "reported" && p.called ? " called" : ""}${tip?.k === s.key ? " hov" : ""}`} style={{ animationDelay: `${Math.min(0.6, i * (cat === "house" ? 0.0012 : 0.012)).toFixed(3)}s` }}
                      tabIndex={rs.length ? 0 : -1} role={rs.length ? "button" : undefined} aria-label={aria} {...handlers}>
                      <path d={s.d} className="g" style={p.kind === "reported" ? { fill: p.fill, fillOpacity: p.a } : undefined} />
                      {p.kind === "expected" && p.lean ? <path d={s.d} className="lean" mask="url(#nat-hatch)" style={{ fill: p.lean }} /> : null}
                    </g>
                  );
                })}
                {labels.map((l) => <text key={l.st} x={l.x} y={l.y + 4} className={byKey[l.st] ? "" : "off"}>{l.st}</text>)}
              </svg>
            ) : <div className="nat-load sx-skel" />}
            {tip && tipRaces.length ? (
              <div className="nat-tip" style={{ left: tip.x, top: tip.y, ...tipFlip(tip) }}>
                <h4>{cat === "house" ? tipRaces[0].nm : STN[stateOf(tip.k)]}</h4>
                {tipRaces.slice(0, 6).map((r) => { const c = live.byId[r.id]; const m = liveMargin(r, c); const w = c?.c.find((x) => x[4]); const ind = isInd(r); const e = expM(r); return (
                  <div className="r" key={r.id}>
                    <span>{cat === "house" ? (r.c ?? []).slice(0, 2).map((x) => lastName(x[0])).join(" v ") : tipRaces.length > 1 ? r.nm.replace(STN[r.st] + " ", "") : (r.c ?? []).slice(0, 2).map((x) => lastName(x[0])).join(" v ") || r.off}</span>
                    {w ? <b className="call">Called · {lastName(w[0])}</b> : m != null ? <b className={m < 0 ? (ind ? "i" : "d") : "r"}>{fmtM(m, r.k, ind)} · {c!.pr.toFixed(0)}% in</b> : <b className="ex">{e != null ? `Expected ${fmtM(e, r.k, ind)}` : "No votes yet"}</b>}
                  </div>); })}
                {tipRaces.length > 6 ? <div className="more">and {tipRaces.length - 6} more</div> : null}
                <div className="cta">{tipRaces.length === 1 ? "Click for the full race" : "Click for every race in the state"}</div>
              </div>
            ) : null}
          </div>
          <div className="nat-legend">
            {cat === "other" ? <><span><i className="sw" style={{ background: "rgba(183,140,255,.75)" }} />Deeper purple, more races with votes in</span></>
              : <><span>D +40</span><i className="ramp" /><span>R +40</span><span className="k">counted votes · paler means less counted</span></>}
            <span><i className="sw hatch" />Hatched: no votes yet, expected lean only</span>
            <span><i className="sw call" />civicAPI call</span>
          </div>
        </div>

        <aside className="nat-read card" aria-live="polite">
          <div className="nat-verdict">{verdict}</div>
          {ch ? (
            <div className="nat-seats">
              {ch === "gov" ? <GovTiles tiles={seats.gov as Tile[]} onPick={(t) => t.id && router.push(resultsHref(t.id))} />
                : <SeatArc seats={seats[ch]} onPick={(s) => s.id && router.push(resultsHref(s.id))} label={`${C.label}: ${dTot} Democratic and ${ct!.rW} Republican seats held or won, ${ct!.aw} not counted yet`} />}
              <SeatKey />
            </div>
          ) : (
            <div className="nat-px" role="img" aria-label="Every other race as one square, by category and status">
              {races.map((r) => { const s = seatOf(r, live.byId[r.id]); return <i key={r.id} className={`st-${s.s}`} title={s.label} style={s.s === "aw" ? { borderColor: leanStroke(s.pR) } : undefined} />; })}
            </div>
          )}
          <div className="nat-stats">{stats.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          <div className="nat-watch">
            <div className="eye">{toWatch.live ? "Closest races counting" : `Closest ${C.label.toLowerCase()} by the forecast`}</div>
            <div className="key">{toWatch.live ? "Bar: share of the two-way vote counted so far" : "Bar: pre-election forecast chance, not a result"}</div>
            {toWatch.rows.map((r) => {
              const c = live.byId[r.id]; const m = liveMargin(r, c); const ind = isInd(r); const e = expM(r);
              const bar = watchBar(r, c, toWatch.live);
              return (
                <Link key={r.id} href={resultsHref(r.id)} className="nat-row">
                  <span className="nm"><b>{r.nm}</b><small>{r.k === "measure" ? r.off : (r.c ?? []).slice(0, 2).map((x) => lastName(x[0])).join(" vs ") || r.off}</small></span>
                  <span className="vl">
                    {toWatch.live && m != null ? <b className={m < 0 ? (ind ? "i" : "d") : "r"}>{fmtM(m, r.k, ind)}<small> · {c!.pr.toFixed(0)}% in</small></b> : <b className={`ex ${e != null && e < 0 ? (ind ? "i" : "d") : "r"}`}><small>Exp. </small>{fmtM(e, r.k, ind)}</b>}
                    {bar ? <span className="nat-cb" role="img" aria-label={bar.label} title={bar.label}><i style={{ width: `${bar.pD * 100}%`, background: bar.ind ? "var(--ind, #b78cff)" : "var(--dem)" }} /></span> : null}
                  </span>
                </Link>
              );
            })}
          </div>
          <Link className="btn g nat-cta" href={`/results/2026?k=${C.hub}#rh`}>Every {C.label.toLowerCase().replace("other races", "statewide")} race</Link>
        </aside>
      </div>
      {live.error ? <p className="rh-note">{live.error}</p> : null}
      <p className="nat-src">Reported votes come from civicAPI through a 30 second cache and are counted returns. Expected leans come from the On Point Politics forecast of {ix ? new Date(ix.asOf + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" }) : "October"} and are modeled. A race is marked called only when civicAPI reports a winner; OnPoint projections appear on race pages, labeled as projections.</p>
    </section>
  );
}
