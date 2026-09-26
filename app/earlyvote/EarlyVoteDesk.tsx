"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES, DIMENSIONS, commas, compact, fillFor, getCapabilities, getCategory, getDemographics,
  marginOf, matchCounty, pct, STATE_NAME, stateOfFips, sumRow, toneFor, turnoutFill, volumeScale,
  getPartyModel, modeOf, simulate, fmtMargin,
  type Capabilities, type Estimate, type PartyModel, type Category, type CategoryPayload, type DemographicPayload,
  type Dimension, type Geo, type RegionRow, type StateGeo,
} from "./lib";

const MONO = '"JetBrains Mono", ui-monospace, monospace';
const OSWALD = '"Oswald", "Barlow Condensed", system-ui, sans-serif';

/** Ordered so the party columns read the way the rest of the site does. */
function orderGroups(groups: string[]) {
  const rank = (g: string) =>
    g === "Democratic" ? 0 : g === "Republican" ? 1 :
    /No Party|Independent/.test(g) ? 2 : g === "Unspecified" ? 9 : 5;
  return [...groups].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function Bar({ row, groups, total }: { row: RegionRow; groups: string[]; total: number }) {
  if (total <= 0) return <span className="ev-bar" aria-hidden />;
  return (
    <span className="ev-bar" aria-hidden>
      {groups.map((g) => {
        const v = row[g]?.votes ?? 0;
        if (v <= 0) return null;
        return <i key={g} style={{ width: `${(v / total) * 100}%`, background: toneFor(g, row[g]?.color) }} />;
      })}
    </span>
  );
}

/** A margin range read from the closer edge out: D+10.3 to D+20.5, R+3 to R+9,
 *  and D+2 to R+4 when it straddles even. Margins are Republican positive. */
function fmtRange(lo: number, hi: number, sep = " to ") {
  const [a, b] = lo < 0 && hi <= 0 ? [hi, lo] : [lo, hi];
  return `${fmtMargin(a)}${sep}${fmtMargin(b)}`;
}

/** Thin diagonal lines laid over any shape filled from the TPSI estimate, so a
 *  modelled county never reads as a reported one. */
function HatchDefs() {
  return (
    <defs>
      <pattern id="ev-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" className="ev-hatch-line" />
      </pattern>
    </defs>
  );
}

function EstBar({ e }: { e: Estimate }) {
  return (
    <span className="ev-bar est" aria-hidden>
      <i style={{ width: `${e.d * 100}%`, background: "var(--dem)" }} />
      <i style={{ width: `${e.i * 100}%`, background: "var(--muted2)" }} />
      <i style={{ width: `${e.r * 100}%`, background: "var(--gop)" }} />
    </span>
  );
}

function EstimatePanel({ e, sub, mode, model, shade, setShade }: {
  e: Estimate; sub: string; mode: "mail" | "early"; model: PartyModel;
  shade: "estimate" | "turnout"; setShade: (s: "estimate" | "turnout") => void;
}) {
  const [open, setOpen] = useState(false);
  const parts = [
    { k: "Democratic", s: e.d, c: "var(--dem)" },
    { k: "Independent", s: e.i, c: "var(--muted2)" },
    { k: "Republican", s: e.r, c: "var(--gop)" },
  ];
  return (
    <section className="ev-est" aria-label="TPSI party estimate">
      <div className="ev-est-head">
        <div>
          <span className="ev-est-tag">TPSI estimate</span>
          <h2 className="ev-h2">Simulated party of these ballots</h2>
          <p className="ev-est-sub">{sub}</p>
        </div>
        <div className="ev-seg sm" role="tablist" aria-label="Shade places with no party data by">
          <button role="tab" aria-selected={shade === "estimate"} className={shade === "estimate" ? "on" : ""}
            onClick={() => setShade("estimate")}>Estimated party</button>
          <button role="tab" aria-selected={shade === "turnout"} className={shade === "turnout" ? "on" : ""}
            onClick={() => setShade("turnout")}>Turnout</button>
        </div>
      </div>

      <div className="ev-est-body">
        <div className="ev-est-margin">
          <b style={{ color: e.margin > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(e.margin)}</b>
          <span>80% of simulations fall between {fmtRange(e.lo, e.hi, " and ")}</span>
        </div>
        <div className="ev-est-split">
          <EstBar e={e} />
          <div className="ev-key">
            {parts.map((p) => (
              <span key={p.k}><i style={{ background: p.c }} />{p.k}<b>{commas(p.s * e.votes)}</b><u>{(p.s * 100).toFixed(1)}%</u></span>
            ))}
          </div>
        </div>
      </div>

      <button className="ev-link ev-est-more" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide how this is estimated" : "How this is estimated"}
      </button>
      {open ? (
        <div className="ev-est-method">
          <p>
            Each county starts from its 2024 Trump share of the two party vote, moved by the swing TPSI
            measures inside its own sample from 2024 recall to the 2026 generic ballot. TPSI likely voters
            then set the mix: the Independent share, and how often Democrats, Republicans and Independents
            voted Trump, which together fix the Democratic and Republican share that reproduces the
            county&apos;s lean. Last comes the {mode === "mail" ? "mail" : "early in person"} skew: at the same local lean,
            TPSI respondents who plan to vote {mode === "mail" ? "by mail" : "early in person"} lean
            {mode === "mail" ? " clearly" : " slightly"} more Democratic than the electorate as a whole, and
            the gap is widest in Democratic counties and narrows as counties get redder.
          </p>
          <p>
            All of that is refit on {model.meta.draws} bootstrap resamples of {commas(model.meta.respondents)} TPSI
            likely voters, and every resample is run against today&apos;s county counts. The range above is
            the middle 80% of those runs. This is party identification, not party registration, and it is
            an estimate of who is voting early, not a result.
          </p>
          <div className="ev-est-check">
            <em>Check against states that do report party, mail ballots requested</em>
            <table>
              <thead><tr><th>State</th><th className="num">TPSI estimate</th><th className="num">80% range</th><th className="num">Registration</th></tr></thead>
              <tbody>
                {model.meta.check.map((c) => {
                  // meta margins are Democratic positive; the page prints R positive
                  const m = -c.modelMargin, lo = -c.hi, hi = -c.lo, rep = -c.reportedMargin;
                  return (
                    <tr key={c.st}>
                      <td>{STATE_NAME[c.st] ?? c.st}</td>
                      <td className="num">{fmtMargin(m)}</td>
                      <td className="num">{fmtRange(lo, hi)}</td>
                      <td className="num">{fmtMargin(rep)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>
              Florida lands within a point, North Carolina and New Jersey within five. Pennsylvania mail voters are more
              Democratic than the model expects. Kentucky and Oklahoma still carry large ancestral
              Democratic registration that no party identification model should reproduce, and the
              twelve states estimated here have no party registration at all.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function EarlyVoteDesk() {
  const [scope, setScope] = useState("US");           // "US" or a state abbreviation
  const [cat, setCat] = useState<Category>("requested");
  const [dim, setDim] = useState<Dimension>("party");
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [data, setData] = useState<CategoryPayload | null>(null);
  const [demo, setDemo] = useState<DemographicPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState(true);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [stateGeo, setStateGeo] = useState<StateGeo | null>(null);
  const [countyNames, setCountyNames] = useState<Record<string, string> | null>(null);
  const [tip, setTip] = useState<{ key: string; x: number; y: number } | null>(null);
  const [model, setModel] = useState<PartyModel | null>(null);
  // how places with no party data are shaded: the TPSI estimate or raw volume
  const [shade, setShade] = useState<"estimate" | "turnout">("estimate");

  useEffect(() => { getPartyModel().then(setModel); }, []);

  // the national outline and the county name table load once
  useEffect(() => {
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
    fetch("/earlyvote-county-names.json").then((r) => r.json()).then(setCountyNames).catch(() => {});
  }, []);

  // county shapes load per state, only once a state is open
  useEffect(() => {
    if (scope === "US") { setStateGeo(null); return; }
    let live = true;
    fetch(`/forecast/states/${scope}.json`).then((r) => r.json())
      .then((g) => { if (live) setStateGeo(g); }).catch(() => { if (live) setStateGeo(null); });
    return () => { live = false; };
  }, [scope]);

  useEffect(() => { getCapabilities(scope).then(setCaps); }, [scope]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    getCategory(scope, cat).then((d) => { if (live) { setData(d); setLoading(false); } });
    return () => { live = false; };
  }, [scope, cat]);

  useEffect(() => {
    let live = true;
    setDemo(null);
    getDemographics(scope, cat, dim).then((d) => { if (live) setDemo(d); });
    return () => { live = false; };
  }, [scope, cat, dim]);

  // which breakdowns this state actually publishes for this category
  const available = useMemo(() => {
    const m = caps?.categories?.[cat];
    return DIMENSIONS.filter((d) => (m ? m[d.key] : d.key === "party"));
  }, [caps, cat]);

  useEffect(() => {
    if (available.length && !available.some((d) => d.key === dim)) setDim(available[0].key);
  }, [available, dim]);

  const groups = useMemo(
    () => orderGroups(Object.keys(data?.statewide_total ?? {})), [data]);
  const total = sumRow(data?.statewide_total);

  const rows = useMemo(() => {
    const r = Object.entries(data?.regions ?? {}).map(([name, row]) => ({ name, row, n: sumRow(row) }));
    r.sort((a, b) => (sortDesc ? b.n - a.n : a.name.localeCompare(b.name)));
    return r;
  }, [data, sortDesc]);

  // Places that report no party at all are shaded by raw ballot volume in
  // green. The scale is built only from those places, so a state that mixes
  // party counties and Unspecified counties keeps its party shading intact.
  const noPartyRows = useMemo(() => rows.filter((r) => marginOf(r.row) === null), [rows]);
  const vol = useMemo(() => volumeScale(noPartyRows.map((r) => r.n)), [noPartyRows]);
  const allNoParty = rows.length > 0 && noPartyRows.length === rows.length;
  const someNoParty = noPartyRows.length > 0;
  // feed county name -> FIPS for the open state
  const fipsOf = useMemo(() => {
    const out: Record<string, string> = {};
    if (scope === "US" || !countyNames || !data) return out;
    const local: Record<string, string> = {};
    for (const [fips, nm] of Object.entries(countyNames)) if (stateOfFips(fips) === scope) local[nm] = fips;
    for (const name of Object.keys(data.regions)) { const f = matchCounty(name, local); if (f) out[name] = f; }
    return out;
  }, [scope, countyNames, data]);

  // TPSI party estimate for every place that reports no party. A county is one
  // part at its own 2024 lean. A state on the national map, or a county with no
  // matching shape, is its counties weighted by adults.
  const est = useMemo(() => {
    if (!model || !noPartyRows.length) return null;
    const byState: Record<string, [number, number][]> = {};
    for (const [f, [t, a]] of Object.entries(model.counties)) (byState[stateOfFips(f)] ??= []).push([t, a]);
    const places = noPartyRows.map(({ name, n }) => {
      if (scope === "US") return { key: name, parts: byState[name] ?? [], votes: n };
      const f = fipsOf[name];
      const c = f ? model.counties[f] : undefined;
      return { key: name, parts: c ? [[c[0], 1] as [number, number]] : (byState[scope] ?? []), votes: n };
    });
    return simulate(places, model, modeOf(cat));
  }, [model, noPartyRows, fipsOf, scope, cat]);
  const showEst = shade === "estimate" && !!est?.total;

  const fillRow = (key: string, row: RegionRow) => {
    const m = marginOf(row);
    if (m !== null) return fillFor(m);
    const e = est?.byKey[key];
    if (showEst && e) return fillFor(e.margin);
    return vol ? turnoutFill(vol.t(sumRow(row))) : "var(--ev-nodata)";
  };
  const hatched = (key: string, row: RegionRow) => showEst && marginOf(row) === null && !!est?.byKey[key];

  const national = scope === "US";
  const title = national ? "Early vote, nationwide" : `${STATE_NAME[scope] ?? scope} early vote`;
  const catMeta = CATEGORIES.find((c) => c.key === cat)!;

  return (
    <div className="ev-page">
      <style>{CSS}</style>

      <div className="ev-shell">
        <div className="ev-eyebrow">
          <span className="dot" /> early vote · 2026
          {data?.snapshot_date ? <em> · snapshot {data.snapshot_date}</em> : null}
        </div>
        <h1 className="ev-h1">{title}<span className="stop">.</span></h1>
        <p className="ev-lede">
          Ballots requested, returned and cast in person, as reported by the states that publish
          them. {national
            ? "Click any state for its counties."
            : <>Counties below. <button className="ev-link" onClick={() => setScope("US")}>Back to all states</button></>}
        </p>

        {/* category */}
        <div className="ev-controls">
          <div className="ev-seg" role="tablist" aria-label="Ballot category">
            {CATEGORIES.map((c) => (
              <button key={c.key} role="tab" aria-selected={cat === c.key}
                className={cat === c.key ? "on" : ""} onClick={() => setCat(c.key)}>{c.label}</button>
            ))}
          </div>
          {available.length > 1 ? (
            <div className="ev-seg sm" role="tablist" aria-label="Breakdown">
              {available.map((d) => (
                <button key={d.key} role="tab" aria-selected={dim === d.key}
                  className={dim === d.key ? "on" : ""} onClick={() => setDim(d.key)}>{d.label}</button>
              ))}
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="ev-empty"><span className="spin" /> reading the early vote feed…</div>
        ) : !data || !Object.keys(data.regions ?? {}).length ? (
          <div className="ev-empty">
            No {catMeta.blurb} published for {national ? "any state" : (STATE_NAME[scope] ?? scope)} yet.
            {" "}States report on their own schedule, so this fills in as they do.
          </div>
        ) : (
          <>
            {/* headline */}
            <section className="ev-top">
              <div className="ev-top-n">
                <em>{catMeta.blurb}</em>
                <b>{commas(total)}</b>
                <span>{national ? `${rows.length} states reporting` : `${rows.length} counties`}</span>
              </div>
              <div className="ev-top-split">
                <Bar row={data.statewide_total} groups={groups} total={total} />
                <div className="ev-key">
                  {groups.map((g) => {
                    const v = data.statewide_total[g]?.votes ?? 0;
                    if (v <= 0) return null;
                    return (
                      <span key={g}>
                        <i style={{ background: toneFor(g, data.statewide_total[g]?.color) }} />
                        {g}<b>{commas(v)}</b><u>{pct(v, total)}</u>
                      </span>
                    );
                  })}
                </div>
              </div>
            </section>

            {someNoParty && est?.total ? (
              <EstimatePanel e={est.total} sub={national
                ? `Across the ${noPartyRows.length} ${noPartyRows.length === 1 ? "state that reports" : "states that report"} every ballot as Unspecified.`
                : allNoParty ? `${STATE_NAME[scope] ?? scope} reports every ballot as Unspecified.`
                : `Across the ${noPartyRows.length} ${noPartyRows.length === 1 ? "county that reports" : "counties that report"} every ballot as Unspecified.`}
                mode={modeOf(cat)} model={model!} shade={shade} setShade={setShade} />
            ) : null}

            {/* the chosen breakdown, when it is not the party columns already shown */}
            {demo && dim !== "party" ? (
              <section className="ev-demo">
                <h2 className="ev-h2">by {dim}</h2>
                <div className="ev-demo-rows">
                  {Object.entries(demo.values)
                    .filter(([, v]) => v > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <div key={k} className="ev-demo-row">
                        <span className="k">{k}</span>
                        <span className="track"><i style={{ width: `${(v / Math.max(1, demo.total)) * 100}%` }} /></span>
                        <span className="v">{commas(v)}</span>
                        <span className="p">{pct(v, demo.total)}</span>
                      </div>
                    ))}
                </div>
              </section>
            ) : null}

            {/* the map */}
            <section className="ev-mapwrap">
              {national && geo ? (
                <svg viewBox={`0 0 ${geo.frame[0]} ${geo.frame[1]}`} className="ev-map" role="img"
                     aria-label="Early vote by state">
                  <HatchDefs />
                  {Object.entries(geo.states).map(([abbr, d]) => {
                    const row = data.regions[abbr];
                    return (
                      <path key={abbr} d={d}
                        className={`ev-unit${row ? " live" : ""}`}
                        fill={row ? fillRow(abbr, row) : "var(--ev-idle)"}
                        onClick={row ? () => setScope(abbr) : undefined}
                        onMouseMove={row ? (e) => setTip({ key: abbr, x: e.clientX, y: e.clientY }) : undefined}
                        onMouseLeave={() => setTip(null)} />
                    );
                  })}
                  {Object.entries(geo.states).map(([abbr, d]) => {
                    const row = data.regions[abbr];
                    return row && hatched(abbr, row)
                      ? <path key={`h-${abbr}`} d={d} className="ev-hatch" fill="url(#ev-hatch)" /> : null;
                  })}
                </svg>
              ) : !national && stateGeo && countyNames ? (
                (() => {
                  // resolve each county the feed reports onto a shape
                  const byFips: Record<string, string> = {};
                  for (const [name, f] of Object.entries(fipsOf)) byFips[f] = name;
                  const matched = Object.keys(byFips).length;
                  return (
                    <>
                      <svg viewBox="0 0 900 620" className="ev-map" role="img"
                           aria-label={`Early vote by county in ${STATE_NAME[scope] ?? scope}`}>
                        <HatchDefs />
                        {stateGeo.counties.map((c) => {
                          const name = byFips[c.id];
                          const row = name ? data.regions[name] : undefined;
                          return (
                            <path key={c.id} d={c.d}
                              className={`ev-unit${row ? " live" : ""}`}
                              fill={row ? fillRow(name!, row) : "var(--ev-idle)"}
                              onMouseMove={row ? (e) => setTip({ key: name!, x: e.clientX, y: e.clientY }) : undefined}
                              onMouseLeave={() => setTip(null)} />
                          );
                        })}
                        {stateGeo.counties.map((c) => {
                          const name = byFips[c.id];
                          const row = name ? data.regions[name] : undefined;
                          return row && hatched(name!, row)
                            ? <path key={`h-${c.id}`} d={c.d} className="ev-hatch" fill="url(#ev-hatch)" /> : null;
                        })}
                      </svg>
                      {matched < Object.keys(data.regions).length ? (
                        <p className="ev-mapnote">
                          {Object.keys(data.regions).length - matched} reported{" "}
                          {Object.keys(data.regions).length - matched === 1 ? "area has" : "areas have"} no
                          matching shape and appear only in the table below.
                        </p>
                      ) : null}
                    </>
                  );
                })()
              ) : (
                <div className="ev-maploading"><span /> drawing the map…</div>
              )}

              {!allNoParty || showEst ? (
                <div className="ev-scale">
                  <span>More Democratic</span>
                  <i className="ramp" />
                  <span>More Republican</span>
                  {showEst ? <em><b className="sw hatch" /> TPSI estimate, not reported</em> : null}
                </div>
              ) : null}
              {someNoParty && vol && !showEst ? (
                <div className="ev-scale turnout">
                  {!allNoParty ? <em className="lab">no party reported</em> : null}
                  <span>Fewer ballots</span>
                  <span className="tramp-wrap">
                    <i className="ramp tramp" />
                    <span className="ticks">
                      <b>{compact(vol.min)}</b>
                      <b>{compact(Math.sqrt(vol.min * vol.max))}</b>
                      <b>{compact(vol.max)}</b>
                    </span>
                  </span>
                  <span>More ballots</span>
                </div>
              ) : null}
              {showEst ? (
                <p className="ev-mapnote">
                  {allNoParty
                    ? `${national ? "None of the reporting states attach" : `${STATE_NAME[scope] ?? scope} does not attach`} a party to these ballots. `
                    : `${noPartyRows.length} ${national ? (noPartyRows.length === 1 ? "state reports" : "states report") : (noPartyRows.length === 1 ? "county reports" : "counties report")} no party. `}
                  Hatched {national ? "states" : "counties"} are shaded by the TPSI party estimate, simulated from
                  TPSI polling against each county&apos;s lean.
                </p>
              ) : allNoParty ? (
                <p className="ev-mapnote">
                  {national ? "None of the reporting states attach" : `${STATE_NAME[scope] ?? scope} does not attach`} a
                  party to these ballots, so {national ? "states" : "counties"} are shaded by raw ballot count
                  instead: the deeper the green, the more ballots, on a log scale.
                </p>
              ) : someNoParty ? (
                <p className="ev-mapnote">
                  {noPartyRows.length} {national
                    ? (noPartyRows.length === 1 ? "state reports" : "states report")
                    : (noPartyRows.length === 1 ? "county reports" : "counties report")} no party,
                  so {noPartyRows.length === 1 ? "it is" : "they are"} shaded green by raw ballot count on a log scale.
                </p>
              ) : null}
            </section>

            {/* the table */}
            <section className="ev-tablewrap">
              <div className="ev-tablehead">
                <h2 className="ev-h2">{national ? "by state" : "by county"}</h2>
                <button className="ev-sort" onClick={() => setSortDesc((v) => !v)}>
                  {sortDesc ? "sorted by volume" : "sorted by name"}
                </button>
              </div>
              <div className="ev-scroll">
                <table className="ev-table">
                  <thead>
                    <tr>
                      <th>{national ? "State" : "County"}</th>
                      {groups.map((g) => <th key={g} className="num">{g}</th>)}
                      <th className="num">Total</th>
                      {showEst ? <>
                        <th className="num est">Est. Dem</th><th className="num est">Est. Rep</th>
                        <th className="num est">Est. Ind</th><th className="num est">Est. margin</th>
                      </> : null}
                      <th className="split">{showEst ? "Split" : allNoParty ? "Intensity" : "Split"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ name, row, n }) => (
                      <tr key={name}
                          className={national ? "clickable" : undefined}
                          tabIndex={national ? 0 : undefined}
                          onClick={national ? () => setScope(name) : undefined}
                          onKeyDown={national ? (e) => { if (e.key === "Enter") setScope(name); } : undefined}>
                        <td className="name">{national ? (STATE_NAME[name] ?? name) : name}</td>
                        {groups.map((g) => (
                          <td key={g} className="num">{row[g]?.votes ? commas(row[g].votes) : "—"}</td>
                        ))}
                        <td className="num tot">{commas(n)}</td>
                        {showEst ? (() => {
                          const e = marginOf(row) === null ? est?.byKey[name] : undefined;
                          if (!e) return <><td className="num">—</td><td className="num">—</td><td className="num">—</td><td className="num">—</td></>;
                          return <>
                            <td className="num est">{commas(e.d * n)}</td>
                            <td className="num est">{commas(e.r * n)}</td>
                            <td className="num est">{commas(e.i * n)}</td>
                            <td className="num est mg" style={{ color: e.margin > 0 ? "var(--gop)" : "var(--dem)" }}>{fmtMargin(e.margin)}</td>
                          </>;
                        })() : null}
                        <td className="split">
                          {showEst && est?.byKey[name] && marginOf(row) === null ? (
                            <EstBar e={est.byKey[name]} />
                          ) : marginOf(row) === null && vol ? (
                            <span className="ev-bar vol" aria-hidden>
                              <i style={{ width: `${Math.max(4, vol.t(n) * 100)}%`, background: turnoutFill(vol.t(n)) }} />
                            </span>
                          ) : <Bar row={row} groups={groups} total={n} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {tip && data && data.regions[tip.key] ? (() => {
          const row = data.regions[tip.key];
          const t = sumRow(row);
          const m = marginOf(row);
          const label = national ? (STATE_NAME[tip.key] ?? tip.key) : tip.key;
          return (
            <div className="ev-tip" style={{
              left: Math.min(tip.x + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 300),
              top: Math.min(tip.y - 10, (typeof window !== "undefined" ? window.innerHeight : 800) - 330),
            }}>
              <div className="n">{label}</div>
              <div className="s">{catMeta.blurb}</div>
              {orderGroups(Object.keys(row)).map((g) => {
                const v = row[g]?.votes ?? 0;
                if (v <= 0) return null;
                return (
                  <div key={g} className="row">
                    <i style={{ background: toneFor(g, row[g]?.color) }} />
                    <b>{g}</b><span>{commas(v)}</span><u>{pct(v, t)}</u>
                  </div>
                );
              })}
              <div className="row tot"><i /><b>total</b><span>{commas(t)}</span>
                <u>{m === null ? "—" : m > 0 ? `R+${m.toFixed(1)}` : `D+${Math.abs(m).toFixed(1)}`}</u></div>
              {m === null && showEst && est?.byKey[tip.key] ? (() => {
                const e = est.byKey[tip.key];
                return (
                  <>
                    <div className="est-h">TPSI estimate</div>
                    {([["Democratic", e.d, "var(--dem)"], ["Republican", e.r, "var(--gop)"], ["Independent", e.i, "var(--muted2)"]] as const).map(([g, s, c]) => (
                      <div key={g} className="row"><i style={{ background: c }} /><b>{g}</b>
                        <span>{commas(s * t)}</span><u>{(s * 100).toFixed(1)}%</u></div>
                    ))}
                    <div className="row tot"><i /><b>est. margin</b><span>{fmtMargin(e.margin)}</span>
                      <u>{fmtRange(e.lo, e.hi)}</u></div>
                  </>
                );
              })() : null}
              {m === null ? (() => {
                const share = total > 0 ? (t / total) * 100 : 0;
                const rank = noPartyRows.findIndex((r) => r.name === tip.key);
                const byVol = [...noPartyRows].sort((x, y) => y.n - x.n).findIndex((r) => r.name === tip.key) + 1;
                return (
                  <div className="row vol"><i style={{ background: vol ? turnoutFill(vol.t(t)) : "var(--ev-nodata)" }} />
                    <b>{rank >= 0 ? `#${byVol} of ${noPartyRows.length} by ballots` : "ballot volume"}</b>
                    <span>{share < 1 ? share.toFixed(2) : share.toFixed(1)}%</span><u>of {national ? "all" : "state"}</u></div>
                );
              })() : null}
              {national ? <div className="f">click to open counties</div> : null}
            </div>
          );
        })() : null}

        <p className="ev-note">
          Early vote figures come from <a href="https://civicapi.org/early-vote/" target="_blank" rel="noreferrer">civicAPI</a>,
          which collects them from state election authorities. Each state reports on its own
          schedule and publishes different breakdowns, so a category with no rows means that
          state has not posted it, not that the number is zero. Groups labelled Unspecified are
          ballots a state reports without a party or demographic attached.
        </p>
      </div>
    </div>
  );
}

const CSS = `
/* Early Vote follows the site tokens, so it moves with the theme toggle like
   every other page. Only the base colours change between themes; each rule
   keeps its own alpha. */
.ev-page { position: relative; min-height: 100svh; background: var(--canvas); color: var(--ink); }
.ev-shell { max-width: 1240px; margin: 0 auto; padding: 0 clamp(20px,4vw,44px) clamp(60px,9vh,110px); }

.ev-eyebrow { display: inline-flex; align-items: center; gap: 9px; margin-top: clamp(26px,5vh,56px);
  font-family: ${MONO}; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); }
.ev-eyebrow .dot { width: 7px; height: 7px; border-radius: 99px; background: var(--gop); animation: evPulse 2.4s ease-in-out infinite; }
.ev-eyebrow em { font-style: normal; color: var(--muted3); }
@keyframes evPulse { 0%,100%{opacity:1} 50%{opacity:.3} }

.ev-h1 { margin-top: 16px; font-family: var(--font-display); font-size: clamp(32px,4.6vw,56px); font-weight: 500;
  letter-spacing: -0.035em; line-height: 1.06; }
.ev-h1 .stop { color: var(--purple2); }
.ev-lede { margin-top: 14px; max-width: 70ch; font-size: 15px; line-height: 1.6; color: var(--muted); }
.ev-link { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; color: var(--accent-link); text-decoration: underline; text-underline-offset: 3px; }

.ev-controls { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 26px; }
.ev-seg { display: inline-flex; padding: 3px; gap: 2px; border: 1px solid var(--border2); border-radius: 10px; background: rgba(var(--line-rgb),0.03); }
.ev-seg button { appearance: none; border: 0; background: none; cursor: pointer; padding: 9px 17px; border-radius: 8px;
  font-family: ${MONO}; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: var(--muted2);
  transition: color .15s ease, background .15s ease; }
.ev-seg button:hover { color: var(--ink); }
.ev-seg button.on { background: var(--ink); color: var(--canvas); }
.ev-seg.sm button { padding: 7px 13px; font-size: 11px; }
.ev-seg button:focus-visible { outline: 2px solid var(--purple2); outline-offset: 2px; }

.ev-empty { margin-top: 34px; padding: 30px 26px; border: 1px dashed var(--border2); border-radius: 14px;
  max-width: 72ch; color: var(--muted); font-size: 14.5px; line-height: 1.6; }
.ev-empty .spin { display: inline-block; width: 9px; height: 9px; margin-right: 10px; border-radius: 99px;
  background: var(--purple2); animation: evPulse 1.1s ease-in-out infinite; }

.ev-top { margin-top: 30px; padding: 22px 24px; border: 1px solid var(--border); border-radius: 16px; background: var(--panel); box-shadow: var(--shadow-sm); }
.ev-top-n { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 16px; }
.ev-top-n em { font-style: normal; font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); }
.ev-top-n b { font-family: ${MONO}; font-size: clamp(30px,4vw,44px); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.ev-top-n span { margin-left: auto; font-family: ${MONO}; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); }
.ev-top-split { margin-top: 16px; }
.ev-key { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 14px; font-size: 13px; color: var(--muted); }
.ev-key span { display: inline-flex; align-items: center; gap: 7px; }
.ev-key i { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
.ev-key b { font-family: ${MONO}; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
.ev-key u { text-decoration: none; font-family: ${MONO}; font-size: 11.5px; color: var(--muted2); }

.ev-page { --ev-idle: rgba(var(--line-rgb),0.07); --ev-nodata: rgba(var(--line-rgb),0.16); --ev-mid: var(--panel); --ev-turnout: var(--win); }
.ev-mapwrap { position: relative; margin-top: 30px; }
.ev-map { display: block; width: 100%; height: auto; max-height: 66svh; margin: 0 auto; }
.ev-unit { stroke: rgba(var(--line-rgb),0.22); stroke-width: 0.6; transition: filter .12s ease; }
.ev-unit.live { cursor: pointer; }
.ev-unit.live:hover { filter: brightness(1.25); stroke: var(--ink); stroke-width: 1.1; }
.ev-maploading { padding: 70px 0; text-align: center; font-family: ${MONO}; font-size: 11px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted2); }
.ev-maploading span { display: inline-block; width: 9px; height: 9px; margin-right: 10px; border-radius: 99px; background: var(--accent-link); }
.ev-mapnote { margin-top: 8px; text-align: center; font-size: 12px; color: var(--muted2); }
.ev-scale { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px 16px; margin-top: 14px;
  font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.ev-scale .ramp { width: min(320px, 46vw); height: 10px; border-radius: 99px;
  background: linear-gradient(90deg, var(--dem), var(--panel), var(--gop)); border: 1px solid var(--border2); }
.ev-scale em { font-style: normal; display: inline-flex; align-items: center; gap: 7px; }
.ev-scale .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.ev-scale .sw.nodata { background: var(--ev-nodata); }
.ev-scale.turnout { margin-top: 10px; }
.ev-scale .lab { color: var(--ink); }
.ev-scale .tramp-wrap { display: inline-flex; flex-direction: column; gap: 5px; }
.ev-scale .tramp { background: linear-gradient(90deg,
  color-mix(in srgb, var(--ev-turnout) 14%, var(--ev-mid)),
  color-mix(in srgb, var(--ev-turnout) 52%, var(--ev-mid)),
  color-mix(in srgb, var(--ev-turnout) 90%, var(--ev-mid))); }
.ev-scale .ticks { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; color: var(--muted); letter-spacing: 0.04em; }
.ev-scale .ticks b { font-weight: 700; }
.ev-tip .row.vol { margin-top: 5px; }
.ev-tip .row.vol b { color: var(--muted2); font-family: ${MONO}; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }

.ev-tip { position: fixed; z-index: 70; pointer-events: none; width: 252px; padding: 12px 14px; border-radius: 12px;
  background: var(--panel); border: 1px solid var(--border2); box-shadow: var(--shadow-md); }
.ev-tip .n { font-family: ${OSWALD}; font-size: 14.5px; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; color: var(--ink); }
.ev-tip .s { margin-top: 2px; font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.ev-tip .row { display: flex; align-items: center; gap: 8px; margin-top: 7px; font-size: 12.5px; }
.ev-tip .row i { width: 3px; height: 14px; flex-shrink: 0; }
.ev-tip .row b { font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
.ev-tip .row span { font-family: ${MONO}; font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--ink); }
.ev-tip .row u { text-decoration: none; font-family: ${MONO}; font-size: 10.5px; color: var(--muted2); min-width: 46px; text-align: right; }
.ev-tip .row.tot { margin-top: 9px; padding-top: 8px; border-top: 1px solid var(--border); }
.ev-tip .row.tot b { color: var(--muted2); font-family: ${MONO}; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
.ev-tip .f { margin-top: 9px; font-family: ${MONO}; font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted3); }

.ev-bar { display: flex; height: 9px; border-radius: 99px; overflow: hidden; background: rgba(var(--line-rgb),0.07); }
.ev-bar i { display: block; height: 100%; }

.ev-h2 { font-family: ${OSWALD}; font-size: 15px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink); }

.ev-demo { margin-top: 34px; }
.ev-demo-rows { margin-top: 14px; display: grid; gap: 9px; }
.ev-demo-row { display: grid; grid-template-columns: minmax(120px,1.1fr) 3fr auto auto; align-items: center; gap: 14px; font-size: 13.5px; }
.ev-demo-row .k { color: var(--ink); }
.ev-demo-row .track { height: 10px; border-radius: 99px; background: rgba(var(--line-rgb),0.07); overflow: hidden; }
.ev-demo-row .track i { display: block; height: 100%; background: var(--purple2); }
.ev-demo-row .v { font-family: ${MONO}; font-weight: 700; font-variant-numeric: tabular-nums; }
.ev-demo-row .p { font-family: ${MONO}; font-size: 11.5px; color: var(--muted2); min-width: 52px; text-align: right; }

.ev-tablewrap { margin-top: 38px; }
.ev-tablehead { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; }
.ev-sort { background: none; border: 1px solid var(--border2); border-radius: 999px; padding: 6px 13px; cursor: pointer;
  font-family: ${MONO}; font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); }
.ev-sort:hover { color: var(--ink); border-color: var(--border3); }
.ev-scroll { margin-top: 14px; overflow-x: auto; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); }
table.ev-table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
table.ev-table th { position: sticky; top: 0; z-index: 1; background: var(--panel); text-align: left; padding: 13px 14px;
  font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--muted2); border-bottom: 1px solid var(--border2); white-space: nowrap; }
table.ev-table th.num, table.ev-table td.num { text-align: right; }
table.ev-table th.split { width: 130px; }
table.ev-table td { padding: 11px 14px; border-top: 1px solid var(--border); color: var(--muted); white-space: nowrap; }
table.ev-table td.name { color: var(--ink); font-weight: 600; }
table.ev-table td.tot { color: var(--ink); font-weight: 700; }
table.ev-table tr.clickable { cursor: pointer; }
table.ev-table tr.clickable:hover td { background: rgba(var(--line-rgb),0.04); }
table.ev-table tr.clickable:focus-visible { outline: 2px solid var(--purple2); outline-offset: -2px; }
table.ev-table td.split { min-width: 120px; }

.ev-hatch { pointer-events: none; }
.ev-hatch-line { stroke: var(--panel); stroke-width: 1.4; stroke-opacity: 0.55; }
.ev-scale .sw.hatch { background: repeating-linear-gradient(45deg, var(--muted2) 0 2px, transparent 2px 5px); border: 1px solid var(--border2); }

.ev-est { margin-top: 18px; padding: 20px 24px 18px; border: 1px dashed var(--border3, var(--border2)); border-radius: 16px;
  background: rgba(var(--line-rgb),0.025); }
.ev-est-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: 14px; }
.ev-est-tag { display: inline-block; margin-bottom: 8px; padding: 3px 9px; border-radius: 99px; border: 1px solid var(--border2);
  font-family: ${MONO}; font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--purple2); }
.ev-est-sub { margin-top: 5px; font-size: 13px; color: var(--muted); }
.ev-est-body { display: grid; grid-template-columns: minmax(180px, 0.8fr) 2fr; gap: 18px 28px; align-items: center; margin-top: 16px; }
.ev-est-margin b { display: block; font-family: ${MONO}; font-size: clamp(28px,3.6vw,40px); font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.ev-est-margin span { display: block; margin-top: 4px; font-size: 12.5px; line-height: 1.45; color: var(--muted2); max-width: 30ch; }
.ev-est-more { margin-top: 14px; font-size: 13px; }
.ev-est-method { margin-top: 12px; display: grid; gap: 10px; max-width: 80ch; font-size: 13px; line-height: 1.6; color: var(--muted); }
.ev-est-check { margin-top: 6px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--panel); overflow-x: auto; }
.ev-est-check em { font-style: normal; font-family: ${MONO}; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted2); }
.ev-est-check table { margin-top: 8px; border-collapse: collapse; font-size: 12.5px; font-variant-numeric: tabular-nums; min-width: 420px; }
.ev-est-check th { text-align: left; padding: 6px 12px 6px 0; font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted2); font-weight: 700; }
.ev-est-check td { padding: 5px 12px 5px 0; border-top: 1px solid var(--border); color: var(--ink); }
.ev-est-check .num { text-align: right; }
.ev-est-check p { margin-top: 10px; font-size: 12.5px; }
table.ev-table th.est { color: var(--purple2); }
table.ev-table td.est { font-style: italic; }
table.ev-table td.mg { font-style: normal; font-family: ${MONO}; font-weight: 700; font-size: 12px; }
.ev-tip { width: 284px; }
.ev-tip .est-h { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--border2); font-family: ${MONO}; font-size: 9.5px;
  font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--purple2); }
.ev-tip .row.tot u { min-width: 0; white-space: nowrap; }
@media (max-width: 760px) { .ev-est-body { grid-template-columns: 1fr; } }

.ev-note { margin-top: 30px; max-width: 78ch; font-size: 12.5px; line-height: 1.65; color: var(--muted2); }
.ev-note a { color: var(--accent-link); }

@media (max-width: 760px) {
  .ev-top-n span { margin-left: 0; width: 100%; }
  .ev-demo-row { grid-template-columns: minmax(90px,1fr) 2fr auto; }
  .ev-demo-row .p { display: none; }
}
`;
