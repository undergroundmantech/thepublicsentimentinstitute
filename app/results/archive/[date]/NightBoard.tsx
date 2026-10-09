"use client";

/**
 * The generic election night board — every date on the calendar that never got
 * a hand-built board of its own. Same desk shell, same slate cards, same tokens
 * as the August boards, so the archive reads as one publication rather than a
 * grid of links into a different design.
 *
 * Reported vote only. No TPSI model ran on these races, and this board must
 * never imply one did.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatElectionDate, getRacesByDate, type RaceRegistryEntry } from "../../_data/raceRegistry";
import { placeOf, titleOf } from "../labels";

type Cand = { name?: string; party?: string; votes?: number; percent?: number; winner?: boolean };
type Race = { id: number; candidates?: Cand[]; percent_reporting?: number };

/* ═════════════════════ HELPERS ═════════════════════ */

const clampPct = (n: number) => Math.min(Math.max(n, 0), 100);

const sortC = (r?: Race): Cand[] =>
  [...(r?.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));

const counted = (r?: Race) => sortC(r).reduce((s, c) => s + (c.votes || 0), 0);
const isLive = (r?: Race) => counted(r) > 0;

const reporting = (r?: Race) => {
  const p = Number(r?.percent_reporting);
  return Number.isFinite(p) ? clampPct(p) : 0;
};

const share = (c: Cand, all: Cand[]) => {
  if (Number.isFinite(c.percent)) return clampPct(Number(c.percent));
  const t = all.reduce((s, x) => s + (x.votes || 0), 0);
  return t > 0 ? ((c.votes || 0) / t) * 100 : 0;
};

const int = (n?: number) => Math.round(Number(n) || 0).toLocaleString("en-US");

/** Design System §6 — >99 and <1 at the extremes; nothing prints a flat 100. */
const pctLabel = (p: number) =>
  p >= 99.95 ? ">99" : p > 0 && p < 0.05 ? "<1" : p.toFixed(1);

const partyOf = (p?: string) => {
  const s = String(p || "").toLowerCase();
  if (/democr/.test(s)) return "d";
  if (/republic|gop/.test(s)) return "r";
  return "n";
};

/** Color LAW: the party hue for the leader, --c2 for the runner-up. Never the
 *  opposing party's colour inside a one-party primary. */
const tone = (i: number, party?: string) => {
  if (i === 0) {
    const p = partyOf(party);
    return p === "r" ? "var(--gop)" : p === "d" ? "var(--dem)" : "var(--ink2)";
  }
  if (i === 1) return "var(--c2)";
  if (i === 2) return "var(--k3)";
  return "var(--ink3)";
};

/* ═════════════════════ DATA ═════════════════════ */

function useNight(date: string, ids: Set<number>) {
  const [races, setRaces] = useState<Record<number, Race> | null>(null);
  const [failed, setFailed] = useState(false);

  const pull = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(
        `https://civicapi.org/api/v2/race/search?startDate=${date}&endDate=${date}&limit=50000`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const next: Record<number, Race> = {};
      for (const race of j.races || []) {
        if (ids.has(Number(race.id))) next[Number(race.id)] = race;
      }
      setRaces(next);
    } catch {
      setFailed(true);
    }
  }, [date, ids]);

  // The archive is settled: one fetch, with a retry button if it fails. A night
  // board polls; an archive has nothing left to poll for.
  useEffect(() => {
    pull();
  }, [pull]);

  return { races, failed, retry: pull };
}

/* ═════════════════════ BOARD ═════════════════════ */

export default function NightBoard({ date }: { date: string }) {
  const entries = useMemo(() => getRacesByDate(date), [date]);
  const ids = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  const { races, failed, retry } = useNight(date, ids);

  const groups = useMemo(() => {
    const by = new Map<string, RaceRegistryEntry[]>();
    for (const e of entries) {
      const { place } = placeOf(e.label);
      const list = by.get(place);
      if (list) list.push(e);
      else by.set(place, [e]);
    }
    return [...by.entries()]
      .map(([place, list]) => ({ place, list }))
      .sort((a, b) => b.list.length - a.list.length || a.place.localeCompare(b.place));
  }, [entries]);

  const totals = useMemo(() => {
    const all = Object.values(races || {});
    return {
      votes: all.reduce((s, r) => s + counted(r), 0),
      called: all.filter((r) => sortC(r).some((c) => c.winner === true)).length,
      reported: all.filter(isLive).length,
    };
  }, [races]);

  const heading = formatElectionDate(date);

  return (
    <div className="desk">
      <style>{CSS}</style>

      <main className="shell">
        <section className="race-header">
          <div className="archive-banner">
            <span>Archived · {heading}</span>
            <Link href="/results/archive">All election nights →</Link>
          </div>

          <div className="race-kicker">
            <span>Election night</span>
            <span>·</span>
            <span>Reported results</span>
            <span>·</span>
            <span>No TPSI model</span>
          </div>

          <div className="race-heading-row">
            <div>
              <h1>{heading}</h1>
              <p className="race-deck">
                Every race TPSI tracked on this date, as reported by AP through CivicAPI.
                Counted vote only — no forecast ran on these contests, and nothing on this
                page is a projection.
              </p>
            </div>
            <div className="race-meta">
              <div className="meta-block">
                <span>Races</span>
                <b>{entries.length}</b>
              </div>
              <div className="meta-block">
                <span>{groups.length === 1 ? "State" : "States"}</span>
                <b>{groups.length}</b>
              </div>
              <div className="meta-block">
                <span>Called</span>
                <b>{races ? totals.called : "—"}</b>
              </div>
              <div className="meta-block">
                <span>Votes counted</span>
                <b>{races ? int(totals.votes) : "—"}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="board" id="board">
          <div className="board-head">
            <div>
              <h2>Every race on the ballot</h2>
              <p>Reported results only, no TPSI model.</p>
            </div>
            <div className="board-meta">
              <span className="model-label">
                {entries.length} races · {groups.length} {groups.length === 1 ? "state" : "states"}
              </span>
              {failed && (
                <button type="button" className="utility-button" onClick={retry}>
                  Feed unavailable · retry
                </button>
              )}
            </div>
          </div>

          {groups.map((g) => (
            <div className="grp" key={g.place}>
              <div className="grp-hd">
                <h3>{g.place}</h3>
                <span className="model-label">
                  {g.list.length} {g.list.length === 1 ? "race" : "races"}
                </span>
              </div>
              <div className="grid">
                {g.list.map((e) => {
                  const { rest } = placeOf(e.label);
                  return (
                    <SlateCard
                      key={e.id}
                      {...titleOf(rest)}
                      race={races?.[e.id]}
                      pending={races === null}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="method">
          <h2>Method</h2>
          <p className="prose">
            These are reported vote totals carried from AP through CivicAPI, shown as the
            share of the vote counted in each race. TPSI published no survey, no county
            model and no projection for the races on this page; where a race is marked
            called, that is AP&rsquo;s decision, not ours. Percentages are of the counted vote
            and can move until a state certifies.
          </p>
          <div className="method-foot">
            <span className="model-label">© 2026 The Public Sentiment Institute</span>
            <span className="model-label">Powered by CivicAPI</span>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ═════════════════════ SLATE CARD ═════════════════════ */

function SlateCard({
  title,
  sub,
  race,
  pending,
}: {
  title: string;
  sub: string;
  race?: Race;
  pending: boolean;
}) {
  const all = sortC(race);
  const show = all.slice(0, 2);
  const live = isLive(race);
  const marked = all.some((c) => c.winner === true);

  return (
    <div className="l4">
      <div className="l4-hd">
        <span className={`l4-dot ${partyOf(show[0]?.party || sub)}`} />
        <div className="l4-title">
          <strong>{title}</strong>
          {sub && <small>{sub}</small>}
        </div>
        {marked && <span className="l4-called">Called</span>}
      </div>

      {live ? (
        <div className="l4-body">
          {show.map((c, i) => (
            <div className="l4-row" key={c.name || i}>
              <span className="l4-nm">
                {marked && (
                  <i className={c.winner ? "l4-check" : "l4-check ghost"} aria-hidden>✓</i>
                )}
                <span>{c.name}</span>
              </span>
              <span className="l4-pct">{pctLabel(share(c, all))}%</span>
              <div className="l4-bar">
                <span style={{ width: `${Math.max(share(c, all), 0)}%`, background: tone(i, c.party) }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="l4-empty">{pending ? "Loading returns" : "No returns reported"}</div>
      )}

      <div className="l4-foot">
        <span className="model-label">
          {live ? `${pctLabel(reporting(race))}% reporting` : pending ? "—" : "Feed carried no result"}
        </span>
      </div>
    </div>
  );
}

/* ═════════════════════ STYLE ═════════════════════ */
/* The August board's shell, trimmed to what an archive night uses. Surface, ink,
   party and signal tokens come from globals.css so this flips with the site's
   data-theme; only desk-local values are declared here. */

const CSS = `
.desk{
  --k3:#6D4B96; --k5:#8A929C;
  --mono:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  --sans:var(--font-body,'Geist'),system-ui,sans-serif;
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  --shadow:none;
  color:var(--ink);min-height:100vh;font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
}
html[data-theme="dark"] .desk{--k3:#8a63ef}

.desk *{margin:0;padding:0;box-sizing:border-box}
.desk a{text-decoration:none;color:inherit}

.desk h1,.desk h2,.desk h3{font-family:var(--sans);font-weight:800;letter-spacing:-.028em}
.desk .model-label,.desk .race-kicker,.desk .l4-called{font-family:var(--mono);
  font-weight:700;font-size:8px;letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.desk .meta-block b,.desk .l4-pct{font-family:var(--mono);font-variant-numeric:tabular-nums}
.desk .prose{font-family:var(--sans);line-height:1.6}

.utility-button{font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--ink2);border:1px solid var(--hairline2);
  border-radius:var(--r-pill);padding:5px 12px;background:var(--panel);cursor:pointer}
.utility-button:hover{color:var(--ink)}

.shell{max-width:1180px;margin:0 auto;padding:26px 22px 70px}

.archive-banner{display:flex;justify-content:space-between;align-items:center;gap:12px;
  flex-wrap:wrap;margin-bottom:16px;padding:9px 13px;border-radius:var(--r-card);
  background:var(--panel2);border:1px solid var(--hairline2);
  font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.archive-banner a{color:var(--ink2);border-bottom:1px solid var(--hairline2)}
.archive-banner a:hover{color:var(--ink)}
.race-header{padding-bottom:20px;border-bottom:1px solid var(--hairline)}
.race-kicker{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.race-heading-row{display:flex;justify-content:space-between;gap:32px;
  align-items:flex-start;margin-top:12px;flex-wrap:wrap}
.race-header h1{font-size:clamp(22px,2.6vw,32px);line-height:1.14}
.race-deck{font-size:14px;color:var(--ink2);max-width:560px;margin-top:9px;line-height:1.6}
.race-meta{display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:14px 26px}
.meta-block span{display:block;font-family:var(--mono);font-size:8px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.meta-block b{display:block;font-size:17px;font-weight:800;letter-spacing:-.02em;margin-top:3px}

/* slate */
.board{margin-top:30px}
.board-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;
  padding-bottom:12px;border-bottom:1px solid var(--hairline2);flex-wrap:wrap}
.board-head h2{font-size:21px}
.board-head p{font-size:11.5px;color:var(--ink2);margin-top:4px}
.board-meta{display:flex;align-items:center;gap:10px}
.grp{margin-top:22px}
.grp-hd{display:flex;justify-content:space-between;gap:12px;align-items:baseline;
  margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid var(--hairline)}
.grp-hd h3{font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:10px}
.l4{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-card);
  box-shadow:var(--shadow);padding:12px 13px;display:flex;flex-direction:column;gap:10px;
  transition:border-color 140ms ease}
.l4:hover{border-color:var(--hairline2)}
.l4-hd{display:flex;gap:9px;align-items:flex-start}
.l4-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex:0 0 auto;background:var(--ink3)}
.l4-dot.d{background:var(--dem)} .l4-dot.r{background:var(--gop)} .l4-dot.n{background:var(--c2)}
.l4-title{flex:1;min-width:0}
.l4-title strong{display:block;font-size:13px;font-weight:700;letter-spacing:-.01em}
.l4-title small{display:block;font-family:var(--mono);font-size:8px;letter-spacing:.08em;
  text-transform:uppercase;color:var(--ink3);margin-top:2px}
.l4-called{color:var(--called)}
.l4-body{display:flex;flex-direction:column;gap:9px}
.l4-row{display:grid;grid-template-columns:1fr auto;gap:4px 8px}
.l4-nm{display:flex;align-items:center;gap:5px;min-width:0;font-size:11.5px;font-weight:600}
.l4-nm span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l4-check{flex:0 0 13px;display:inline-grid;place-content:center;width:13px;height:13px;
  border-radius:50%;font-size:8px;font-weight:800;font-style:normal;
  color:var(--panel);background:var(--called)}
.l4-check.ghost{visibility:hidden}
.l4-pct{font-size:12px;font-weight:800}
.l4-bar{grid-column:1/-1;height:4px;border-radius:99px;background:var(--panel3);overflow:hidden}
.l4-bar span{display:block;height:100%;border-radius:99px;
  transition:width 600ms cubic-bezier(.16,1,.3,1)}
.l4-empty{font-family:var(--mono);font-size:9px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink3);padding:8px 0}
.l4-foot{margin-top:auto;padding-top:8px;border-top:1px solid var(--hairline)}

/* method */
.method{margin-top:38px;padding-top:18px;border-top:1px solid var(--hairline)}
.method h2{font-size:16px}
.method .prose{font-size:12px;color:var(--ink2);margin-top:9px;max-width:840px}
.method-foot{display:flex;justify-content:space-between;gap:14px;margin-top:16px;flex-wrap:wrap}

@media(max-width:640px){.grid{grid-template-columns:1fr}}
`;
