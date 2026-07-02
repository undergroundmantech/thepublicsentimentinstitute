"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import { ThemeProvider } from "../../onpoint/lib/theme.jsx";
import { OPA_GLOBAL_CSS } from "../../onpoint/OpaResultsPage.jsx";
import RaceMapHover from "../../components/RaceMapHover";
import RaceDetail from "../../onpoint/RaceDetail.jsx";
import { raceHasMap, candColor, shade } from "../../onpoint/electionLib.js";
import { useElectionIndex } from "../../onpoint/lib/electionIndex.js";
import SwingOMeter from "../../components/SwingOMeter";
import DeskSearch from "../../components/DeskSearch";
import { needleFromRace } from "../../components/needleModel";

const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-mp", display: "swap" });

const fmtInt = (n: number) => (Number(n) || 0).toLocaleString("en-US");
const surname = (n?: string) => (n ? n.trim().split(/\s+/).pop() : "");
const partyTag = (cand: any) => {
  const p = String(cand?.party || "").toLowerCase();
  if (/democr/.test(p)) return "Dem";
  if (/republic|gop/.test(p)) return "GOP";
  if (/independ/.test(p)) return "Ind";
  if (/libertarian/.test(p)) return "Lib";
  if (/green/.test(p)) return "Grn";
  if (/nonpartisan/.test(p)) return "NP";
  return String(cand?.party || "").slice(0, 3) || "—";
};

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}


// party words stripped → the shared office key that groups "X Democratic
// Primary" with "X Republican Primary" (the NYT one-page-per-office pattern)
const PARTY_WORDS = /\b(democratic|republican|libertarian|green|nonpartisan|independent)\b/gi;
const officeKey = (contest?: string) =>
  String(contest || "").toLowerCase().replace(PARTY_WORDS, "").replace(/\s+/g, " ").trim();
const boardParty = (doc: any): string => {
  const c = String(doc?.contest || "");
  if (/democratic/i.test(c)) return "democratic primary";
  if (/republican/i.test(c)) return "republican primary";
  if (/primary/i.test(c)) return "primary";
  if (/runoff/i.test(c)) return "runoff";
  if (/special/i.test(c)) return "special election";
  return "general";
};
const boardRank = (doc: any) => (/democratic/i.test(doc?.contest || "") ? 0 : /republican/i.test(doc?.contest || "") ? 1 : 2);

function Tallies({ doc }: { doc: any }) {
  const race = doc?.race;
  const cands = useMemo(
    () => [...(race?.candidates || [])].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0)),
    [race]
  );
  const leader = cands[0];
  const lead = (cands[0]?.percent || 0) - (cands[1]?.percent || 0);
  const winner = cands.find((c: any) => c.winner);
  const banner = winner || leader;
  const bannerCol = banner ? candColor(banner) : "#5566e6";
  const reporting = Math.max(0, Math.min(100, Number(race?.percent_reporting) || 0));
  const total = (race?.candidates || []).reduce((s: number, c: any) => s + (c.votes || 0), 0);
  const remain = reporting > 0 && reporting < 100 ? Math.round((total * (100 - reporting)) / reporting) : 0;
  return (
    <div className="rd-tallies">
      {/* the hub board's anatomy, laid open on the page — no enclosing card */}
      <div className="rd-thead" style={{ background: shade(bannerCol, lead) }}>
        <span className="rd-thead-yr">2026</span>
        <span className="rd-thead-title">{race?.election_name || doc?.contest}</span>
      </div>
      {banner ? (
        <div
          className="rd-banner"
          style={{
            background: `color-mix(in srgb, ${bannerCol} 13%, #090b12)`,
            color: `color-mix(in srgb, ${bannerCol} 52%, #ffffff)`,
          }}
        >
          {winner ? `${winner.name} is projected to win.` : `${leader?.name || "—"} leads by ${lead.toFixed(1)}.`}
        </div>
      ) : null}
      {cands.map((c: any, i: number) => {
        const col = candColor(c);
        const pct = Number(c.percent) || 0;
        return (
          <div key={c.name || i} className={`rd-trow ${c.winner ? "won" : ""}`}>
            <span className="rd-trow-tick" aria-hidden style={{ background: col }} />
            <span className="rd-trow-name">
              {c.winner ? <span className="rd-checkbox" aria-hidden>✓</span> : null}
              <b>{c.name}</b>
              <em>{partyTag(c)}</em>
            </span>
            <span className="rd-trow-votes">{fmtInt(c.votes || 0)}</span>
            <span className="rd-trow-pct">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
      <div className="rd-slider" aria-hidden>
        <span className="rd-slider-track">
          <i style={{ width: `${reporting}%` }} />
          <b style={{ left: `${reporting}%` }} />
        </span>
      </div>
      <div className="rd-trow-foot">
        <span><em className="rd-api">API</em> Source: civicAPI</span>
        <span className="rd-foot-rep">
          <b>{Math.round(reporting)}% reporting</b>
          {remain > 0 ? <span>~{fmtInt(remain)} remain</span> : null}
        </span>
      </div>
    </div>
  );
}

function Board({ doc, primary, onMap }: { doc: any; primary?: boolean; onMap: (race: any) => void }) {
  const race = doc?.race;
  const hasMap = race ? raceHasMap(race) && race.has_map !== false : false;
  // Dustin's forecast engine (app/lib/electoralModel) drives the needle
  const needle = useMemo(() => (race ? needleFromRace(race) : null), [race]);
  const called = Array.isArray(race?.candidates) && race.candidates.some((c: any) => c.winner);
  return (
    <section className={`rd-board ${primary ? "primary" : ""}`}>
      <header className="rd-board-h">
        <span className="rd-board-party"><i aria-hidden />{boardParty(doc)}</span>
        <span className={`rd-board-flag ${called ? "called" : ""}`}>{called ? "✓ call made" : "● counting"}</span>
      </header>
      <div className={`rd-board-grid ${hasMap ? "" : "nomap"}`}>
        <div className="rd-board-left">
          <Tallies doc={doc} />
          {needle ? (
            <div className="rd-needle">
              <div className="rd-needle-h">the needle — win probability</div>
              <SwingOMeter
                c1Name={needle.leaderName}
                c2Name={needle.runnerName}
                c1Color={needle.leaderColor}
                c2Color={needle.runnerColor}
                c1Prob={needle.pLeader}
                c2Prob={needle.pRunner}
                reportingPct={needle.reporting}
                marginPp={needle.marginPp}
              />
            </div>
          ) : null}
        </div>
        <div className="rd-board-right">
          {hasMap ? (
            <>
              <div className="rd-map">
                <RaceMapHover race={race} />
              </div>
              <button type="button" className="rd-map-cta" onClick={() => onMap(race)}>
                open the precinct map <span aria-hidden>→</span>
              </button>
            </>
          ) : (
            <div className="rd-nomap" aria-hidden>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <path d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z M9 4 V17.5 M15 6.5 V20" stroke="rgba(244,244,239,0.3)" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span>no county breakdown is published for this contest — the tallies are the full picture.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function RaceDesk() {
  if (typeof document !== "undefined") {
    try { document.documentElement.dataset.opaTheme = "dark"; } catch {}
  }
  return (
    <ThemeProvider>
      <Desk />
    </ThemeProvider>
  );
}

function Desk() {
  const params = useParams();
  const router = useRouter();
  const raceId = String((params as any)?.id ?? "");
  const { index, error } = useElectionIndex(true) as { index: any; error: boolean };
  const [mapRace, setMapRace] = useState<any>(null);

  const doc = useMemo(() => {
    if (!index || !raceId) return null;
    return index.docs.find((d: any) => String(d.id) === raceId) || null;
  }, [index, raceId]);

  // the party siblings: same state, same night, same office once party words
  // are stripped — both primaries live on this one page
  const boards = useMemo(() => {
    if (!doc) return [] as any[];
    const key = officeKey(doc.contest);
    const sibs = key
      ? (index?.docs || []).filter(
          (d: any) =>
            d.id !== doc.id &&
            String(d.province) === String(doc.province) &&
            String(d.date) === String(doc.date) &&
            officeKey(d.contest) === key
        )
      : [];
    return [doc, ...sibs].sort((a, b) => boardRank(a) - boardRank(b)).slice(0, 3);
  }, [doc, index]);

  const openMap = (race: any) => {
    try { history.pushState({}, "", `/results/race/${raceId}?map=1`); } catch {}
    setMapRace(race);
  };
  const closeMap = () => {
    try { history.replaceState({}, "", `/results/race/${raceId}`); } catch {}
    setMapRace(null);
  };

  const title = doc ? (officeKey(doc.contest) || doc.contest || "race") : "";
  const meta = doc ? [doc.stateName || doc.province, fmtDate(doc.date), doc.office].filter(Boolean).join(" · ") : "";

  return (
    <div className={`rd-page ${manrope.variable}`}>
      <style>{OPA_GLOBAL_CSS}</style>
      <style>{RD_CSS}</style>

      <div className="rd-shell">
        <DarkNav />
        <div className="rd-folio">
          <button type="button" className="rd-back" onClick={() => router.push("/results")}>← the results desk</button>
          <span>live returns · county maps · forecasts</span>
        </div>

        {!index && !error ? (
          <div className="rd-hold">
            <div className="rd-hold-bar" />
            <span>pulling the season…</span>
          </div>
        ) : error ? (
          <div className="rd-hold"><span>couldn&rsquo;t load the season — refresh to retry.</span></div>
        ) : !doc ? (
          <div className="rd-hold">
            <span>we couldn&rsquo;t find that race.</span>
            <button type="button" className="rd-map-cta" onClick={() => router.push("/results")}>back to the desk <span aria-hidden>→</span></button>
          </div>
        ) : (
          <>
            <header className="rd-head">
              <span className="rd-head-eb"><i aria-hidden />{doc.stateName || doc.province} · 2026</span>
              <h1 className="rd-title">{title}<em>.</em></h1>
              <p className="rd-meta">{meta}</p>
            </header>

            {boards.map((b: any, i: number) => (
              <Board key={b.id} doc={b} primary={i === 0} onMap={openMap} />
            ))}

            <div className="rd-more">
              <span className="rd-more-h">pull another race</span>
              <DeskSearch active variant="pill" onPick={(d: any) => { if (d?.race?.id != null) router.push(`/results/race/${d.race.id}`); }} />
            </div>
          </>
        )}
      </div>

      {mapRace ? <RaceDetail race={mapRace} onClose={closeMap} /> : null}
    </div>
  );
}

const RD_CSS = `
html, body { background: #050505 !important; }
html { height: auto !important; overflow-y: auto !important; }
body { height: auto !important; min-height: 100svh; overflow: visible !important; overflow-x: clip !important; }
body header, body footer { display: none !important; }
body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

.rd-page { position: relative; width: 100vw; margin-left: calc(50% - 50vw); min-height: 100svh; background: #050505; color: #f4f4ef; font-family: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif; }
.rd-shell { max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 44px) clamp(60px, 10vh, 110px); }
.rd-folio { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 14px 0; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.10); border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.rd-back { background: none; border: 0; cursor: pointer; font: inherit; color: #f4f4ef; letter-spacing: 0.18em; transition: color .15s ease; }
.rd-back:hover { color: #b7ff00; }

.rd-hold { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 18vh 0; color: rgba(244,244,239,0.5); font-size: 14px; }
.rd-hold-bar { width: 180px; height: 2px; border-radius: 99px; overflow: hidden; background: rgba(255,255,255,0.08); position: relative; }
.rd-hold-bar::after { content: ''; position: absolute; inset: 0; width: 40%; border-radius: 99px; background: #b7ff00; animation: rdHold 1.2s ease-in-out infinite alternate; }
@keyframes rdHold { from { transform: translateX(-30%); } to { transform: translateX(260%); } }

.rd-head { padding: clamp(36px, 7vh, 72px) 0 clamp(10px, 2vh, 22px); }
.rd-head-eb { display: inline-flex; align-items: center; gap: 9px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.rd-head-eb i { width: 7px; height: 7px; background: #b7ff00; border-radius: 1.5px; }
.rd-title { font-family: var(--font-mp), "Manrope", sans-serif; font-weight: 500; text-transform: lowercase; letter-spacing: -0.04em; line-height: 0.96; font-size: clamp(38px, 6.4vw, 84px); color: #f4f4ef; margin-top: 14px; max-width: 26ch; }
.rd-title em { font-style: normal; color: #b7ff00; }
.rd-meta { margin-top: 14px; font-size: 14px; color: rgba(244,244,239,0.55); }

.rd-board { margin-top: clamp(34px, 6vh, 56px); }
/* tallies stay a compact column; the map takes the wide side */
.rd-board-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: clamp(26px, 3.4vw, 60px); margin-top: clamp(18px, 3vh, 30px); align-items: center; }
.rd-board-grid.nomap { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); align-items: start; }

/* the results block — the hub board's exact anatomy (tinted title band,
   projected banner, checkbox rows, reporting slider) laid OPEN on the page:
   the strips carry their own shape, nothing wraps the whole block */
.rd-board-h { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 14px; }
.rd-board-party { display: inline-flex; align-items: center; gap: 9px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.rd-board-party i { width: 7px; height: 7px; background: #b7ff00; border-radius: 1.5px; }
.rd-board-flag { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 12px; font-weight: 600; color: rgba(244,244,239,0.45); white-space: nowrap; }
.rd-board-flag.called { color: rgba(183,255,0,0.75); }

.rd-tallies { display: flex; flex-direction: column; }
.rd-thead { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 15px; border-radius: 11px 11px 0 0; }
.rd-thead-yr { font-family: "Oswald", "Barlow Condensed", system-ui, sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; color: rgba(255,255,255,0.62); }
.rd-thead-title { font-family: "Anton", "Oswald", "Barlow Condensed", system-ui, sans-serif; font-weight: 400; font-size: clamp(18px, 1.9vw, 24px); line-height: 1.06; letter-spacing: 0.015em; text-transform: uppercase; color: #ffffff; }
.rd-banner { font-family: "Oswald", "Barlow Condensed", system-ui, sans-serif; font-weight: 600; font-size: 11.5px; letter-spacing: 0.09em; text-transform: uppercase; padding: 10px 16px; }
.rd-trow { display: grid; grid-template-columns: 3px minmax(0, 1fr) auto auto; align-items: center; gap: clamp(10px, 1.3vw, 18px); padding: 12px 4px; border-bottom: 1px solid var(--hair, rgba(255,255,255,0.08)); font-family: "Instrument Sans", system-ui, sans-serif; }
.rd-trow-tick { width: 3px; height: 22px; border-radius: 2px; }
.rd-trow-name { min-width: 0; display: flex; align-items: center; gap: 10px; }
.rd-trow-name b { font-size: 15.5px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink, #f1ece1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rd-trow.won .rd-trow-name b { color: var(--ink-strong, #fff); }
.rd-trow-name em { font-style: normal; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12px; font-weight: 500; color: var(--ink-dim, rgba(241,236,225,0.38)); }
.rd-checkbox { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 4.5px; background: #2e63e7; color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.rd-trow-votes { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 13.5px; color: var(--ink-mute, rgba(241,236,225,0.6)); font-variant-numeric: tabular-nums; }
.rd-trow-pct { font-family: "Instrument Sans", system-ui, sans-serif; font-size: 16px; font-weight: 700; color: var(--ink-strong, #fff); font-variant-numeric: tabular-nums; min-width: 56px; text-align: right; }
.rd-slider { padding: 18px 2px 0; }
.rd-slider-track { position: relative; display: block; height: 4px; border-radius: 99px; background: rgba(244,244,239,0.16); }
.rd-slider-track i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; background: rgba(244,244,239,0.9); }
.rd-slider-track b { position: absolute; top: 50%; width: 18px; height: 18px; border-radius: 99px; background: #f4f4ef; border: 3px solid #14161c; transform: translate(-50%, -50%); box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
.rd-trow-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; padding: 12px 2px 0; font-family: "Instrument Sans", system-ui, sans-serif; font-size: 12.5px; color: var(--ink-dim, rgba(241,236,225,0.38)); }
.rd-api { font-style: normal; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 7px; border-radius: 5px; background: rgba(244,244,239,0.14); color: var(--ink, #f1ece1); margin-right: 6px; }
.rd-foot-rep { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.rd-foot-rep b { font-weight: 700; font-size: 14.5px; color: var(--ink, #f1ece1); }
.rd-foot-rep span { font-size: 11.5px; color: var(--ink-dim, rgba(241,236,225,0.38)); }

.rd-needle { margin-top: clamp(22px, 4vh, 34px); max-width: 360px; }
.rd-needle-h { font-family: "Oswald", "Barlow Condensed", system-ui, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-dim, rgba(241,236,225,0.38)); margin-bottom: 12px; }

.rd-board-right { display: flex; flex-direction: column; align-items: center; }
.rd-map { position: relative; height: clamp(400px, 56vh, 620px); width: 100%; }
.rd-map::before { content: ''; position: absolute; inset: -8% -4%; border-radius: 40px; background: radial-gradient(58% 58% at 50% 46%, rgba(106,108,255,0.14), transparent 72%); filter: blur(28px); pointer-events: none; }
.rd-map .opa-er-map { position: absolute; inset: 0; width: 100%; height: 100%; }
.rd-map .opa-er-mapvig { display: none; }
/* quiet editorial link — no pill, no mono shouting */
.rd-map-cta { position: relative; z-index: 2; display: inline-flex; align-items: center; gap: 8px; margin-top: 18px; padding: 0 1px 3px; cursor: pointer; background: none; border: 0; border-bottom: 1px solid rgba(244,244,239,0.22); font-family: var(--font-mp), "Manrope", sans-serif; font-size: 14.5px; font-weight: 600; letter-spacing: -0.01em; color: #f4f4ef; transition: border-color .2s ease; }
.rd-map-cta:hover { border-color: #b7ff00; }
.rd-map-cta span { color: #b7ff00; transition: transform .2s ease; }
.rd-map-cta:hover span { transform: translateX(3px); }
.rd-nomap { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: clamp(30px, 6vh, 60px) 18px; border: 1px dashed rgba(255,255,255,0.14); border-radius: 18px; color: rgba(244,244,239,0.45); font-size: 12.5px; line-height: 1.6; max-width: 340px; margin: 0 auto; }

.rd-more { margin-top: clamp(50px, 9vh, 90px); border-top: 1px solid rgba(255,255,255,0.1); padding-top: 26px; max-width: 480px; }
.rd-more-h { display: block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(244,244,239,0.4); margin-bottom: 12px; }

@media (max-width: 860px) {
  .rd-board-grid, .rd-board-grid.nomap { grid-template-columns: 1fr; }
  .rd-map { height: clamp(230px, 32vh, 300px); }
  .rd-trow-votes { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .rd-hold-bar::after { animation: none; }
}

/* the shared search (pill variant) — same dialect as the landing */
.desk-search-field { position: relative; display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 60px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); transition: border-color .18s ease, background .18s ease, box-shadow .2s ease; }
.desk-search.pill .desk-search-field { height: 48px; border-radius: 999px; }
.desk-search-field:focus-within { border-color: rgba(183,255,0,0.55); background: rgba(255,255,255,0.06); box-shadow: 0 0 0 4px rgba(183,255,0,0.08); }
.desk-search-icon { color: rgba(244,244,239,0.4); flex-shrink: 0; }
.desk-search-field input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: #f4f4ef; font-family: var(--font-mp), "Manrope", sans-serif; font-size: 14.5px; letter-spacing: -0.01em; }
.desk-search-field input::placeholder { color: rgba(244,244,239,0.38); }
.desk-search-kbd { flex-shrink: 0; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; color: rgba(244,244,239,0.4); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 3px 7px; background: rgba(255,255,255,0.03); }
.desk-search-pop { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 50; border-radius: 16px; border: 1px solid rgba(255,255,255,0.13); background: rgba(8,9,12,0.92); -webkit-backdrop-filter: blur(24px) saturate(1.2); backdrop-filter: blur(24px) saturate(1.2); box-shadow: 0 34px 90px -18px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.05); overflow: hidden; animation: deskPop .18s cubic-bezier(.2,.8,.2,1); }
@keyframes deskPop { from { opacity: 0; transform: translateY(-6px); } }
.desk-spop-h { display: flex; justify-content: space-between; gap: 12px; padding: 10px 16px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(244,244,239,0.38); border-bottom: 1px solid rgba(255,255,255,0.08); }
.desk-spop-h span:last-child { color: rgba(183,255,0,0.55); }
.desk-srow { position: relative; display: grid; grid-template-columns: 3px 42px minmax(0,1fr) auto; align-items: center; gap: 13px; width: 100%; text-align: left; border: 0; cursor: pointer; padding: 12px 16px; background: transparent; transition: background .12s ease; }
.desk-srow + .desk-srow { border-top: 1px solid rgba(255,255,255,0.05); }
.desk-srow[data-active="1"] { background: rgba(183,255,0,0.045); }
.desk-srow[data-active="1"]::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #b7ff00; box-shadow: 0 0 12px rgba(183,255,0,0.55); }
.desk-srow-tick { width: 3px; height: 26px; border-radius: 2px; }
.desk-srow-st { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.03em; color: #f4f4ef; }
.desk-srow-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.desk-srow-title { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; color: #f4f4ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-hl { background: none; color: #b7ff00; }
.desk-srow-meta { font-size: 10.5px; color: rgba(244,244,239,0.4); text-transform: lowercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-srow-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.desk-srow-right b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; white-space: nowrap; }
.desk-srow-right > span { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; color: rgba(244,244,239,0.35); }
.desk-srow-await { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; color: rgba(244,244,239,0.32); text-transform: uppercase; letter-spacing: 0.08em; }
.desk-search-empty { padding: 20px 16px; color: rgba(244,244,239,0.5); font-size: 13px; }
.desk-search-empty b { color: #b7ff00; font-weight: 600; }
.desk-search-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 16px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(244,244,239,0.35); }
.desk-search-keys { color: rgba(244,244,239,0.45); }
`;
