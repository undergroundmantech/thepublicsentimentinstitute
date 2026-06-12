import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import DarkNav from '@/app/components/DarkNav'
import ResultMap from './ResultMap.jsx'
import RaceDetail from './RaceDetail.jsx'
import ElectionCalendar from './ElectionCalendar.jsx'
import ElectionSearch, { SearchIcon } from './components/ElectionSearch.jsx'
import { loadElectionIndex } from './lib/electionIndex.js'
import { candColor, leaderOf, tonePalette, shade, raceHasMap } from './electionLib.js'
import { useTheme, tripToggleTheme } from './lib/theme.jsx'
import {
  DISPLAY, POSTER, CARD_BG, CARD_BD, TXT, TXT_DIM, GOLD,
  mix, fmtInt, yearOf, titleOf, Row,
} from './resultRow.jsx'

const API = 'https://civicapi.org/api/v2/race/search'
// Rollout cadence — the whole page + each race auto-refreshes every
// 14 seconds. Honest with viewers; pauses while the tab is hidden.
const REFRESH_MS = 14000

const MONTHS = [
  'JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE',
  'JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER',
]
const fmtDateLabel = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''))
  if (!m) return iso
  const mo = MONTHS[Number(m[2]) - 1] || ''
  return `${mo} ${Number(m[3])}, ${m[1]}`
}
const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const todayISO = () => isoOf(new Date())
const yesterdayISO = () => isoOf(new Date(Date.now() - 24 * 60 * 60 * 1000))

// Curate a day's marquee contests for the calendar hover-preview: rank by
// scope (statewide / high office) then by total votes, keep the top N with a
// compact {title, province, reporting, started, cands:[top 2]} shape.
const MARQUEE_RE = /governor|senate|president|attorney|secretary|amendment|proposition|measure|mayor|congress|house|ballot/i
function topRaces(races, n = 4) {
  const scored = (races || []).map((r) => {
    const cs = [...(r.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0))
    const votes = cs.reduce((s, c) => s + (c.votes || 0), 0)
    const marquee = /statewide/i.test(r.election_type || '') || MARQUEE_RE.test(r.election_name || '')
    return { r, cs, votes, score: (marquee ? 1e9 : 0) + votes }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, n).map(({ r, cs, votes }) => {
    const started = (Number(r.percent_reporting) || 0) > 0 || cs.some((c) => (c.votes || 0) > 0)
    return {
      title: titleOf(r),
      province: r.province || '',
      reporting: Number(r.percent_reporting) || 0,
      started,
      cands: cs.slice(0, 2).map((c) => ({
        name: c.name,
        party: c.party,
        pct: typeof c.percent === 'number' ? c.percent : votes ? ((c.votes || 0) / votes) * 100 : 0,
        won: !!c.winner && started,
      })),
      // raw essentials so the calendar can render the contest's choropleth
      race: { id: r.id, province: r.province, has_map: r.has_map, election_name: r.election_name, election_type: r.election_type, district: r.district, percent_reporting: r.percent_reporting, candidates: r.candidates },
    }
  })
}

// ── one race card — 1:1 ballotline.com: a bordered "casing" holding a
// solid colour-headed result block (left) and the cropped flat map
// (right) with a → affordance. ──
function ResultCard({ race, onOpen, compact = false }) {
  const { P } = useTheme()
  const cands = [...(race.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0))
  const winner = cands.find((c) => c.winner)
  const L = leaderOf(cands)
  const reporting = Number(race.percent_reporting) || 0
  const anyVotes = cands.some((c) => (c.votes || 0) > 0)
  // A projection is only meaningful once the race has STARTED — civicAPI
  // pre-flags `winner:true` for uncontested races at 0% reporting,
  // which reads as a bug to users ("why ✓ if election hasn't started").
  // Require some sign of activity (reporting or any votes) before
  // showing "X is projected to win" or putting the row checkmark.
  const started = reporting > 0 || anyVotes
  const projectedWinner = winner && started ? winner : null
  // Color the header by the LEADER (or first candidate) — even before
  // results land, like ballotline. Only the BANNER + ✓ are gated by
  // whether the race has actually started.
  const tint = projectedWinner || L?.cand || cands[0]
  const accent = tint ? candColor(tint) : '#3a3d44'
  const colored = !!tint
  // Header tint is the leader's color SHADED by margin: dead-heat sits
  // quiet, blowout deepens. Reads as "by how much" at a glance.
  const marginPct = (cands[0]?.percent || 0) - (cands[1]?.percent || 0)
  const headerBg = colored ? shade(accent, marginPct) : '#3a3d44'
  const projText = projectedWinner
    ? `${projectedWinner.name} is projected to win.`
    : started && L?.cand
    ? `${L.cand.name} leads.`
    : started
    ? 'Too early to call'
    : 'Awaiting results'
  const stripBg = colored ? mix(accent, P.card, 0.82) : 'var(--page-elev)'
  const stripFg = colored ? mix(accent, P.stripFgTarget, 0.5) : TXT_DIM
  // Same-party multi-candidate races (Dem-vs-Dem, GOP-vs-GOP) get
  // distinct shades per candidate so they're visually separable.
  const chipColors = tonePalette(cands)
  const top = cands.slice(0, 5)

  return (
    <div
      onClick={() => onOpen && onOpen(race)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onOpen) { e.preventDefault(); onOpen(race) } }}
      style={{
        // Mobile (cols=1) stacks vertically: result block on top,
        // map below — desktop stays side-by-side.
        display: 'flex',
        flexDirection: compact ? 'column' : 'row',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        cursor: 'pointer',
        borderRadius: 12,
        // House frost language — pitch-black hub field; the cards are
        // the glass material, glossy + tinted, never a flat opaque slab.
        background: 'var(--frost-bg)',
        backdropFilter: 'blur(22px) saturate(165%)',
        WebkitBackdropFilter: 'blur(22px) saturate(165%)',
        boxShadow: 'var(--frost-shadow)',
      }}
    >
      {/* left — solid colour-headed result block */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: compact ? '10px 12px 11px' : '13px 18px 14px', background: headerBg }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.62)' }}>
            {yearOf(race.election_date) || '2026'}
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: POSTER,
              fontSize: 'clamp(17px, 1.4vw, 22px)',
              lineHeight: 1.06,
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              color: '#fff',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {titleOf(race)}
          </div>
        </div>

        <div
          style={{
            // Strip itself: NO overflow (mixing overflowX:hidden + overflowY:
            // visible makes the visible-axis behave like 'auto' per spec,
            // which is what was producing the weird scroll handles inside
            // the strip). Inner span handles the horizontal ellipsis.
            padding: compact ? '14px 14px 14px' : '16px 18px 16px',
            minHeight: compact ? 44 : 48,
            display: 'flex',
            alignItems: 'center',
            background: stripBg,
            fontFamily: '"Oswald", system-ui, sans-serif',
            fontSize: 12.5,
            fontWeight: 700,
            lineHeight: 1.4,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            color: stripFg,
            overflow: 'visible',
          }}
        >
          <span
            style={{
              display: 'block',
              width: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {projText}
          </span>
        </div>

        <div style={{ padding: compact ? '2px 10px 0' : '2px 18px 0' }}>
          {top.map((c, i) => (
            <Row key={c.name + i} c={c} accent={accent} last={i === 0} started={started} chip={chipColors[i]} />
          ))}
        </div>

        {(() => {
          // Counted across the listed candidates (best total we have).
          const totalCounted = (race.candidates || []).reduce((s, c) => s + (c.votes || 0), 0)
          const expectedRemain =
            reporting > 0 && reporting < 100
              ? Math.max(0, Math.round((totalCounted * (100 - reporting)) / reporting))
              : 0
          const reportingTxt = reporting % 1 ? reporting.toFixed(1) : reporting.toFixed(0)
          const fmtThousands = (n) => Math.round(n).toLocaleString('en-US')
          return (
            <div style={{ marginTop: 'auto', padding: compact ? '10px 12px 12px' : '14px 18px 14px' }}>
              {/* Pill progress bar — full width on its own row, with a small
                  ink-coloured leading-edge dot ON the bar at the fill edge.
                  Matches the AP card's signature progress affordance. */}
              <div
                style={{
                  position: 'relative',
                  height: 9,
                  borderRadius: 99,
                  background: 'var(--rule-strong)',
                  overflow: 'visible',
                }}
                aria-hidden
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '0 auto 0 0',
                    width: `${Math.max(reporting, reporting > 0 ? 3 : 0)}%`,
                    background: 'var(--ink)',
                    borderRadius: 99,
                    transition: 'width 600ms cubic-bezier(.2,.8,.2,1)',
                  }}
                />
                {reporting > 0 ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: `calc(${Math.max(reporting, 3)}% - 7px)`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 13,
                      height: 13,
                      borderRadius: 99,
                      background: 'var(--ink)',
                      boxShadow:
                        '0 0 0 2px var(--card), 0 0 0 3px var(--ink)',
                      transition: 'left 600ms cubic-bezier(.2,.8,.2,1)',
                    }}
                  />
                ) : null}
              </div>

              {/* Below the bar: API brand + Source on the left, % reporting
                  + ~N remain stacked right-aligned on the right. */}
              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      color: '#0a0d16',
                      background: '#cfd4dd',
                      padding: '2px 5px',
                      borderRadius: 3,
                      lineHeight: 1.1,
                    }}
                  >
                    API
                  </span>
                  <span
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 11.5,
                      color: TXT_DIM,
                      lineHeight: 1.1,
                    }}
                  >
                    Source: civicAPI
                  </span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div
                    style={{
                      fontFamily: DISPLAY,
                      fontSize: 12.5,
                      color: TXT,
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}
                  >
                    {reportingTxt}% reporting
                  </div>
                  {expectedRemain > 0 ? (
                    <div
                      style={{
                        marginTop: 3,
                        fontFamily: DISPLAY,
                        fontSize: 10.5,
                        color: TXT_DIM,
                        lineHeight: 1.1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ~{fmtThousands(expectedRemain)} remain
                    </div>
                  ) : reporting === 0 ? (
                    <div
                      style={{
                        marginTop: 3,
                        fontFamily: DISPLAY,
                        fontSize: 10,
                        color: TXT_DIM,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        lineHeight: 1.1,
                      }}
                    >
                      awaiting
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {/* right — the map casing (mobile stacks it below). Background is
          `transparent` so the parent card's --frost-bg shows through; that
          way the map thumbnail area is the SAME surface colour as the
          result block (the previous --page var was a different shade —
          pure #fff / #0a0b0d — and produced a visible seam against the
          card's frost-bg translucent gradient). */}
      <div
        style={compact
          ? { width: '100%', height: 180, position: 'relative', background: 'transparent', borderTop: '1px solid var(--rule-soft)' }
          : { width: '40%', minWidth: 168, position: 'relative', background: 'transparent', borderLeft: '1px solid var(--rule-soft)' }
        }
      >
        {race.has_map ? (
          <ResultMap race={race} inView fit="contain" delayMs={compact ? 3200 : 0} />
        ) : (
          <div className="opa-er-map" style={{ display: 'grid', placeItems: 'center', background: 'transparent' }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 10, color: TXT_DIM, letterSpacing: '0.12em' }}>NO MAP</span>
          </div>
        )}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: 14,
            bottom: 14,
            width: 30,
            height: 30,
            borderRadius: 99,
            border: `1px solid ${CARD_BD}`,
            background: 'var(--wash)',
            color: 'var(--ink-dim)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 15,
          }}
        >
          →
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
        borderRadius: 12,
        background: 'var(--card)',
        border: `1px solid ${CARD_BD}`,
      }}
      className="opa-er-sk"
      aria-hidden
    >
      <div style={{ height: 58, background: 'var(--wash)' }} />
      <div className="opa-er-shimmer" />
    </div>
  )
}

// Liquid-glass control surface (the AndrewPrifer/liquid-dom look, done in
// CSS so it renders in Safari + production — that library needs WebGPU and an
// experimental Chrome flag). A convex glass: light gradient top → dark base,
// a bright specular rim, blurred backdrop, and a lifted drop shadow.
const selStyle = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'var(--frost-bg)',
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  border: '1px solid var(--card-bd)',
  borderRadius: 13,
  color: 'var(--ink)',
  fontFamily: DISPLAY,
  fontSize: 14,
  padding: '12px 38px 12px 16px',
  outline: 'none',
  cursor: 'pointer',
  minWidth: 210,
  width: '100%',
  boxShadow: 'var(--shadow-card)',
  transition: 'border-color 180ms ease, box-shadow 220ms ease, background 220ms ease, transform 180ms ease',
}

// the specular gloss laid over each control (top-left light, fading out)
const glassSheen = {
  position: 'absolute', inset: 0, borderRadius: 13, pointerEvents: 'none',
  background: 'linear-gradient(133deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.07) 13%, transparent 32%)',
}

const GLASS_CSS = `
  .opa-glass:hover { border-color: var(--rule-strong) !important; transform: translateY(-1px);
    box-shadow: var(--shadow-pop) !important; }
  .opa-glass:focus { border-color: var(--accent) !important;
    box-shadow: 0 0 0 3px var(--accent-soft), var(--shadow-card) !important; }
  .opa-glass::placeholder { color: var(--ink-dim); }
  .opa-glass option { background: var(--card); color: var(--ink); }
  .opa-site-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: clamp(32px, 4.4vw, 58px);
  }
  .opa-site-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    text-decoration: none;
    min-height: 40px;
    flex-shrink: 0;
  }
  .opa-site-logo {
    display: block;
    width: 128px;
    height: 28px;
    background: var(--ink);
    -webkit-mask-image: url(/full_logo_clean.png);
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: left center;
    mask-image: url(/full_logo_clean.png);
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: left center;
  }
  .opa-site-kicker {
    font-family: "JetBrains Mono", ui-monospace, monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink-dim);
    white-space: nowrap;
    padding-left: 12px;
    border-left: 1px solid var(--rule);
  }
  .opa-site-right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    min-width: 0;
  }
  .opa-site-links {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    max-width: min(54vw, 620px);
    overflow-x: auto;
    border: 1px solid var(--card-bd);
    border-radius: 999px;
    background: var(--frost-bg);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    box-shadow: var(--shadow-card);
    scrollbar-width: none;
  }
  .opa-site-links::-webkit-scrollbar { display: none; }
  .opa-site-link,
  .opa-site-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    border-radius: 999px;
    border: 0;
    white-space: nowrap;
    font-family: ${DISPLAY};
    font-size: 12px;
    font-weight: 650;
    letter-spacing: 0.01em;
    color: var(--ink-mute);
    text-decoration: none;
    background: transparent;
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, transform 160ms ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .opa-site-link {
    padding: 0 12px;
  }
  .opa-site-link:hover,
  .opa-site-action:hover {
    color: var(--ink);
    background: var(--hover);
    text-decoration: none;
  }
  .opa-site-link.is-active {
    color: var(--ink);
    background: var(--wash);
  }
  .opa-site-action {
    gap: 7px;
    padding: 0 14px;
    min-height: 40px;
    border: 1px solid var(--card-bd);
    background: var(--frost-bg);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    box-shadow: var(--shadow-card);
  }
  .opa-site-action:active {
    transform: translateY(1px);
  }
  .opa-site-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 999px;
    border: 1px solid var(--card-bd);
    background: var(--frost-bg);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    box-shadow: var(--shadow-card);
    color: var(--ink-mute);
    cursor: pointer;
    transition: color 160ms ease, background 160ms ease, transform 160ms ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  .opa-site-toggle:hover {
    color: var(--ink);
    background: var(--hover);
  }
  .opa-site-toggle:active {
    transform: translateY(1px);
  }
  @media (max-width: 760px) {
    .opa-site-nav {
      align-items: flex-start;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 34px;
    }
    .opa-site-brand {
      width: 100%;
      justify-content: space-between;
    }
    .opa-site-logo {
      width: 108px;
      height: 24px;
    }
    .opa-site-kicker {
      font-size: 8px;
      letter-spacing: 0.14em;
      padding-left: 10px;
    }
    .opa-site-right {
      width: 100%;
      justify-content: space-between;
      gap: 8px;
    }
    .opa-site-links {
      flex: 1;
      max-width: none;
      min-width: 0;
    }
    .opa-site-link {
      min-height: 36px;
      padding: 0 11px;
      font-size: 12px;
    }
    .opa-site-action {
      min-height: 44px;
      padding: 0 15px;
      font-size: 12px;
      flex-shrink: 0;
    }
    .opa-site-toggle {
      width: 44px;
      height: 44px;
    }
  }
  @media (max-width: 390px) {
    .opa-site-kicker { display: none; }
    .opa-site-action span:last-child { display: none; }
    .opa-site-action { width: 44px; padding: 0; }
  }
  @media (max-width: 430px) {
    .opa-site-link:nth-child(5) { display: none; }
  }
`

const SITE_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/polling', label: 'Polling' },
  { href: '/forecastratings', label: 'Forecasts' },
  { href: '/results', label: 'Results' },
  { href: '/contact', label: 'Contact' },
]

// Diagonal-sweep theme toggle for the masthead — same trip helper the race
// detail chrome uses, so the dark/light flip is identical everywhere (and
// runs through the View Transitions wipe). Lives in the nav so it's reachable
// from both the calendar landing AND a day's results grid.
function ThemeToggleButton() {
  const { theme, toggle } = useTheme()
  const light = theme === 'light'
  return (
    <button
      type="button"
      className="opa-site-toggle"
      onClick={() => tripToggleTheme({ theme, toggle })}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      title={light ? 'Dark mode' : 'Light mode'}
    >
      {light ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2M19.5 12h2M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" /></svg>
      )}
    </button>
  )
}

function ResultsTopNav({ selectedDate, onCalendar, onSearch }) {
  // The shared site nav (same as polling + the electoral map) on its own row,
  // with the hub's theme toggle + contextual back-action in a slim strip below.
  return (
    <>
      <style>{`
        /* DarkNav is ivory-on-dark; flip it for the hub's light theme. */
        [data-opa-theme="light"] .dn-logo-img { background: #0a0a0a; }
        [data-opa-theme="light"] .dn-link { color: rgba(10,10,10,0.62); }
        [data-opa-theme="light"] .dn-link:hover, [data-opa-theme="light"] .dn-link.on { color: #0a0a0a; }
        [data-opa-theme="light"] .dn-drop { background: rgba(250,250,248,0.98); border-color: rgba(10,10,10,0.1); }
        [data-opa-theme="light"] .dn-drop-link { color: rgba(10,10,10,0.75); }
        [data-opa-theme="light"] .dn-drop-link:hover { background: rgba(10,10,10,0.05); color: #0a0a0a; }
        [data-opa-theme="light"] .dn-burger { border-color: rgba(10,10,10,0.18); background: rgba(10,10,10,0.04); }
        [data-opa-theme="light"] .dn-burger span { background: #0a0a0a; }
        [data-opa-theme="light"] .dn-mobile { background: rgba(250,250,248,0.99); border-color: rgba(10,10,10,0.1); }
        [data-opa-theme="light"] .dn-mob-link { color: rgba(10,10,10,0.8); }
        [data-opa-theme="light"] .dn-mob-link:hover, [data-opa-theme="light"] .dn-mob-link.on { background: rgba(10,10,10,0.05); color: #0a0a0a; }
        [data-opa-theme="light"] .dn-mob-idx { color: rgba(10,10,10,0.34); }
        .opa-utility { display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin: -16px 0 14px; }
        .opa-search-util {
          display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px;
          border-radius: 99px; border: 1px solid var(--card-bd); background: var(--frost-bg);
          backdrop-filter: blur(16px) saturate(180%); -webkit-backdrop-filter: blur(16px) saturate(180%);
          color: var(--ink-mute); cursor: pointer; box-shadow: var(--shadow-card);
          font-family: inherit; font-size: 12.5px; font-weight: 600; letter-spacing: 0.02em;
          transition: border-color 180ms ease, color 180ms ease;
        }
        .opa-search-util:hover { color: var(--ink); border-color: var(--ink-mute); }
      `}</style>
      <DarkNav />
      <div className="opa-utility">
        {onSearch ? (
          <button type="button" onClick={onSearch} className="opa-search-util" aria-label="Search elections" title="Search elections  ( / )">
            <SearchIcon size={14} color="currentColor" />
            <span>Search</span>
            <span style={kbdCapStyle}>/</span>
          </button>
        ) : null}
        <ThemeToggleButton />
        {selectedDate ? (
          <Link href="/results" onClick={onCalendar} className="opa-site-action" aria-label="Back to all elections">
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>←</span>
            <span>All elections</span>
          </Link>
        ) : null}
      </div>
    </>
  )
}

function ChevronDown() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <path d="M6 9l6 6 6-6" stroke="var(--ink-mute)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// little ⌘K keycap inside the masthead search trigger
const kbdCapStyle = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: 16, height: 16, padding: '0 3px', borderRadius: 4,
  border: '1px solid var(--rule)', background: 'var(--wash)',
  fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, lineHeight: 1,
  color: 'var(--ink-mute)',
}
// compact glassy magnifier button (calendar landing)
const searchIconBtnStyle = {
  display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0,
  borderRadius: 11, border: '1px solid var(--card-bd)', background: 'var(--frost-bg)',
  backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  color: 'var(--ink-mute)', cursor: 'pointer', boxShadow: 'var(--shadow-card)',
  transition: 'border-color 180ms ease, box-shadow 220ms ease, transform 180ms ease',
}

// Pull a race id straight from /results/race/<id> — used so a direct
// link can render RaceDetail without first loading the day's grid.
function deepLinkRaceId() {
  if (typeof window === 'undefined') return null
  const m = window.location.pathname.match(/\/results\/race\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export default function ElectionResults() {
  // The "no `?date=`" case shows a date-picker menu first (May 19 LIVE +
  // May 16); picking a date sets the URL and loads that day's grid.
  const [selectedDate, setSelectedDate] = useState(() => {
    if (typeof window === 'undefined') return null
    const q = new URLSearchParams(window.location.search).get('date')
    return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null
  })
  // Browser back/forward syncs the URL → picker/grid.
  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search).get('date')
      setSelectedDate(q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // Warm the browser cache for the 6 MB national county geojson the
  // precinct app needs for every civic detail. Fires the moment the
  // user lands on /results — by the time they pick a date and tap a
  // race, the file is already in the HTTP cache and the iframe loads
  // the detail instantly instead of waiting 1-2 s.
  useEffect(() => {
    try {
      fetch('/demographics/civic/us-national.geojson', { credentials: 'omit' })
        .catch(() => {})
    } catch {}
  }, [])
  const date = selectedDate
  const [races, setRaces] = useState(null) // null = loading
  const [err, setErr] = useState(false)
  // Landing picker: live list of every election date in February–June 2026,
  // grouped by month with race counts. null = loading, [] = none.
  const [pickerDates, setPickerDates] = useState(null)
  const [pickerErr, setPickerErr] = useState(false)
  const [stateF, setStateF] = useState('')
  const [officeF, setOfficeF] = useState('')
  // Default to the marquee races that actually render a county map (statewide /
  // federal contests + statewide measures); hide the local single-tile clutter.
  const [mapsOnly, setMapsOnly] = useState(true)
  const [cols, setCols] = useState(2)
  const [winRows, setWinRows] = useState({ a: 0, b: 6 })
  // Pre-seed openRace from a /results/race/<id> deep link so the user
  // lands straight in the race instead of seeing the calendar picker
  // flash first. We pass a stub object — RaceDetail only needs `id` to
  // build the iframe URL; the missing fields don't affect rendering.
  // Once the date grid loads (if it does), the deep-link effect below
  // will swap in the full race object so back-navigation has full
  // context.
  const [openRace, setOpenRace] = useState(() => {
    const id = deepLinkRaceId()
    return id ? { id, election_name: '' } : null
  })
  // Smart-search command palette (⌘K / "/" / the masthead trigger).
  const [searchOpen, setSearchOpen] = useState(false)
  const deepRef = useRef(false)
  const scrollRef = useRef(null)
  const wrapRef = useRef(null)

  // initial + polling fetch
  useEffect(() => {
    // No date selected yet → don't fetch; the picker is shown instead.
    if (!date) {
      setRaces(null)
      setErr(false)
      return
    }
    // Reset to a clean loading state when the date changes. Also clear any
    // filters carried over from a previously-opened day — otherwise a State
    // or Office filter from the last date can match nothing on the new one
    // and the grid reads "No races match these filters".
    setRaces(null)
    setStateF('')
    setOfficeF('')
    let alive = true
    const pull = () => {
      const ac = new AbortController()
      fetch(`${API}?startDate=${date}&endDate=${date}&limit=50000`, { signal: ac.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
        .then((j) => {
          if (!alive) return
          const arr = (j.races || []).slice().sort(
            (a, b) =>
              (a.province || 'ZZ').localeCompare(b.province || 'ZZ') ||
              String(a.election_name).localeCompare(String(b.election_name))
          )
          setRaces(arr)
          setErr(false)
        })
        .catch((e) => {
          if (alive && e?.name !== 'AbortError') setErr(true)
        })
      return ac
    }
    let ac = pull()
    const timer = setInterval(() => {
      if (document.hidden) return
      ac.abort()
      ac = pull()
    }, REFRESH_MS)
    return () => {
      alive = false
      ac.abort()
      clearInterval(timer)
    }
  }, [date])

  // Build the landing date list from the live API: every election date in
  // February–June 2026, with race counts. Fetched once when the picker is
  // shown; gzip keeps the month ranges ~1 MB on the wire.
  useEffect(() => {
    if (date) return // only the picker needs this
    let alive = true
    setPickerDates(null)
    setPickerErr(false)
    const RANGES = [
      ['2026-06-01', '2026-06-30'],
      ['2026-05-01', '2026-05-31'],
      ['2026-04-01', '2026-04-30'],
      ['2026-03-01', '2026-03-31'],
      ['2026-02-01', '2026-02-28'],
    ]
    Promise.all(
      RANGES.map(([s, e]) =>
        fetch(`${API}?startDate=${s}&endDate=${e}&limit=50000`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
          .then((j) => j.races || [])
      )
    )
      .then((lists) => {
        if (!alive) return
        const map = new Map() // iso -> races[]
        for (const list of lists) {
          for (const r of list) {
            const iso = String(r.election_date || '').slice(0, 10)
            if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue
            let a = map.get(iso)
            if (!a) { a = []; map.set(iso, a) }
            a.push(r)
          }
        }
        // Keep only a compact, curated preview per day (the marquee contests)
        // so the calendar can show live results on hover without re-fetching.
        const arr = [...map.entries()]
          .map(([iso, races]) => ({ iso, count: races.length, top: topRaces(races, 4) }))
          .sort((a, b) => b.iso.localeCompare(a.iso))
        setPickerDates(arr)
      })
      .catch(() => alive && setPickerErr(true))
    return () => { alive = false }
  }, [date])

  // deep link: /results/race/:id opens that race once loaded
  useEffect(() => {
    if (deepRef.current || !races) return
    const m = window.location.pathname.match(/\/results\/race\/([^/]+)/)
    if (!m) return
    deepRef.current = true
    const r = races.find((x) => String(x.id) === decodeURIComponent(m[1]))
    if (r) setOpenRace(r)
  }, [races])

  // responsive columns
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth || window.innerWidth
      // Mobile drops to 1 column so each card has room for the map +
      // candidate names + reporting bar.
      setCols(w < 820 ? 1 : 2)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Warm the season-wide search index the moment Elections mounts so the
  // command palette opens instantly (one fetch, shared/module-cached).
  useEffect(() => {
    loadElectionIndex().catch(() => {})
  }, [])
  // Global shortcuts: ⌘K / Ctrl-K toggles the palette; "/" opens it (unless
  // you're already typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((o) => !o)
        return
      }
      if (e.key === '/' && !searchOpen) {
        const t = e.target
        const typing =
          t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
        if (typing) return
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  const provinces = useMemo(
    () => (races ? [...new Set(races.map((r) => r.province).filter(Boolean))].sort() : []),
    [races]
  )
  const offices = useMemo(
    () => (races ? [...new Set(races.map((r) => r.election_type).filter(Boolean))].sort() : []),
    [races]
  )

  const filtered = useMemo(() => {
    if (!races) return []
    return races.filter(
      (r) =>
        (!stateF || r.province === stateF) &&
        (!officeF || r.election_type === officeF) &&
        (!mapsOnly || raceHasMap(r))
    )
  }, [races, stateF, officeF, mapsOnly])
  // How many races exist on this day before the "maps only" cut — so the UI can
  // say "168 of 5,992" and offer to reveal the rest.
  const totalForDay = races
    ? races.filter((r) => (!stateF || r.province === stateF) && (!officeF || r.election_type === officeF)).length
    : 0

  // virtualization geometry — cards on mobile (1-col) get a taller
  // stacked layout (result block + map below). Heights bumped (480→520,
  // 300→330) to accommodate the projection strip's larger min-height
  // (44/48px) plus its breathing padding (14/14 → ~28px vertical) plus
  // the footer's two-line right-aligned reporting + "~N remain" stack.
  // Previous tight CARD_H clipped the bottom of the remain line under
  // the card's overflow:hidden corner-clip.
  const CARD_H = cols === 1 ? 520 : 330
  const GAP = 18
  const ROW = CARD_H + GAP
  const rows = Math.ceil(filtered.length / cols)
  const totalH = rows * ROW

  const recompute = () => {
    const el = scrollRef.current
    if (!el) return
    const a = Math.max(0, Math.floor(el.scrollTop / ROW) - 2)
    const b = Math.min(rows, Math.ceil((el.scrollTop + el.clientHeight) / ROW) + 2)
    setWinRows((w) => (w.a === a && w.b === b ? w : { a, b }))
  }
  useEffect(() => {
    recompute()
  }, [filtered, cols, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = []
  for (let r = winRows.a; r < winRows.b; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (i >= filtered.length) break
      visible.push({ i, r, c, race: filtered[i] })
    }
  }
  const colW = `calc((100% - ${(cols - 1) * GAP}px) / ${cols})`

  const pickDate = (d) => {
    try { history.pushState(null, '', `/results?date=${d}`) } catch {}
    setSelectedDate(d)
  }

  const openCalendar = () => {
    try { history.pushState(null, '', '/results') } catch {}
    setSelectedDate(null)
    setOpenRace(null)
  }

  // A search result → jump straight into that race. RaceDetail keys off the
  // race object, so the detail opens immediately; setting the date loads that
  // day's grid behind it (so closing the detail lands you on the right day).
  const onPickSearch = (race) => {
    setSearchOpen(false)
    if (!race) return
    const d = String(race.election_date || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d !== selectedDate) {
      try { history.pushState(null, '', `/results?date=${d}`) } catch {}
      setSelectedDate(d)
    }
    setOpenRace(race)
  }

  // One palette element reused across every render branch (it portals to
  // <body>, so its position in the tree doesn't matter).
  const searchPortal = (
    <ElectionSearch open={searchOpen} onClose={() => setSearchOpen(false)} onPick={onPickSearch} />
  )

  // ── Deep-link short-circuit. If the user landed on /results/race/<id>
  //    (no `?date=`), render RaceDetail directly over a dark backdrop so
  //    they don't see the calendar picker flash. Closing the race takes
  //    them to the calendar. With `?date=` set, this branch isn't taken
  //    and we render the normal date grid (with RaceDetail overlaid via
  //    the conditional at the bottom).
  if (!date && openRace) {
    return (
      <>
        {searchPortal}
        <div style={{ position: 'absolute', inset: 0, background: 'var(--page)', zIndex: 20 }} />
        <RaceDetail race={openRace} onClose={() => setOpenRace(null)} />
      </>
    )
  }

  // ── Calendar picker: shown when no `?date=` param is set. The full
  //    civicAPI calendar (Feb–May 2026) rendered as a month grid; pick a
  //    day that held a contest to open that day's results.
  if (!date) {
    const totalRaces = (pickerDates || []).reduce((s, d) => s + d.count, 0)
    const loadingCal = pickerDates == null && !pickerErr
    return (
      <div style={{ position: 'absolute', inset: 0, background: 'var(--page)', zIndex: 20, overflow: 'auto', animation: 'opa-fade 420ms ease' }}>
        {searchPortal}
        <div className="opa-er-bg" aria-hidden />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 960, margin: '0 auto', padding: '28px 30px 100px' }}>
          <style>{GLASS_CSS}</style>
          <ResultsTopNav selectedDate={null} onCalendar={openCalendar} onSearch={() => setSearchOpen(true)} />
          {/* masthead */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: TXT_DIM }}>
              <span style={{ width: 7, height: 7, borderRadius: 99, background: '#8A9BBF' }} />
              Election Calendar · 2026
            </span>
          </div>
          <h1 style={{ margin: 0, fontFamily: POSTER, fontSize: 'clamp(44px, 7.6vw, 104px)', lineHeight: 0.88, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--ink)' }}>
            Election Results
          </h1>
          <p style={{ marginTop: 16, marginBottom: 0, maxWidth: 600, fontFamily: DISPLAY, fontSize: 15.5, lineHeight: 1.65, color: 'var(--ink-mute)' }}>
            Every contest civicAPI has called this season, February through June
            {loadingCal || !pickerDates ? '.' : ` — ${fmtInt(totalRaces)} races across ${pickerDates.length} election days.`} Pick a day to open its returns.
          </p>

          <div style={{ marginTop: 42 }}>
            <ElectionCalendar
              dates={pickerDates}
              loading={loadingCal}
              error={pickerErr}
              onPick={pickDate}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={recompute}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--page)',
        zIndex: 20,
        overflow: 'auto',
        animation: 'opa-fade 420ms ease',
      }}
    >
      <div className="opa-er-bg" aria-hidden />
      <div ref={wrapRef} style={{ position: 'relative', zIndex: 1, maxWidth: 1360, margin: '0 auto', padding: cols === 1 ? '18px 14px 72px' : '24px 28px 80px' }}>
        <style>{GLASS_CSS}</style>
        <ResultsTopNav selectedDate={date} onCalendar={openCalendar} />
        {/* masthead — ballotline 1:1: giant Anton title left, the three
            controls (STATE · OFFICE TYPE · SEARCH) top-right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 36, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: POSTER,
                fontSize: 'clamp(44px, 8vw, 116px)',
                lineHeight: 0.86,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                color: 'var(--ink)',
              }}
            >
              Election Results
            </h1>
            <div style={{ marginTop: 10, fontFamily: DISPLAY, fontSize: 13, color: TXT_DIM, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: POSTER, fontWeight: 700, letterSpacing: '0.16em', color: 'var(--ink)', fontSize: 12 }}>
                {fmtDateLabel(date)}
              </span>
              {date === todayISO() || date === yesterdayISO() ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 7px',
                    borderRadius: 6,
                    background: '#e23950',
                    color: '#fff',
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: 9,
                    letterSpacing: '0.18em',
                  }}
                >
                  <span aria-hidden style={{ width: 5, height: 5, borderRadius: 99, background: '#fff', animation: 'opa-er-pulse 2s ease-in-out infinite' }} />
                  LIVE
                </span>
              ) : null}
              <span style={{ opacity: 0.6 }}>·</span>
              {races == null
                ? 'Loading…'
                : `${fmtInt(filtered.length)} ${mapsOnly ? 'mapped ' : ''}${filtered.length === 1 ? 'race' : 'races'}${mapsOnly && totalForDay > filtered.length ? ` of ${fmtInt(totalForDay)}` : ''}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            {[
              {
                lbl: 'State',
                el: (
                  <span style={{ position: 'relative', display: 'block' }}>
                    <select value={stateF} onChange={(e) => setStateF(e.target.value)} style={selStyle} className="opa-glass" aria-label="State">
                      <option value="">All States</option>
                      {provinces.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <span aria-hidden style={glassSheen} />
                    <ChevronDown />
                  </span>
                ),
              },
              {
                lbl: 'Show',
                el: (
                  <span style={{ position: 'relative', display: 'block' }}>
                    <button
                      onClick={() => setMapsOnly((v) => !v)}
                      className="opa-glass"
                      aria-pressed={mapsOnly}
                      aria-label="Show only races with maps"
                      title={mapsOnly ? 'Showing only races with maps — click for all races' : 'Showing all races — click for maps only'}
                      style={{ ...selStyle, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', color: 'var(--ink)' }}
                    >
                      <span style={{ flex: 1, textAlign: 'left', fontFamily: DISPLAY, fontSize: 14, whiteSpace: 'nowrap' }}>
                        {mapsOnly ? 'Maps only' : 'All races'}
                      </span>
                      <span aria-hidden style={{ position: 'relative', width: 34, height: 18, borderRadius: 99, flexShrink: 0, background: mapsOnly ? 'var(--accent)' : 'var(--rule-strong)', transition: 'background 200ms ease' }}>
                        <span style={{ position: 'absolute', top: 2, left: mapsOnly ? 18 : 2, width: 14, height: 14, borderRadius: 99, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.35)', transition: 'left 200ms cubic-bezier(.2,.8,.2,1)' }} />
                      </span>
                    </button>
                    <span aria-hidden style={glassSheen} />
                  </span>
                ),
              },
              {
                lbl: 'Office Type',
                el: (
                  <span style={{ position: 'relative', display: 'block' }}>
                    <select value={officeF} onChange={(e) => setOfficeF(e.target.value)} style={selStyle} className="opa-glass" aria-label="Office type">
                      <option value="">All Office Types</option>
                      {offices.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                    <span aria-hidden style={glassSheen} />
                    <ChevronDown />
                  </span>
                ),
              },
              {
                lbl: 'Search',
                el: (
                  <span style={{ position: 'relative', display: 'block' }}>
                    <button
                      onClick={() => setSearchOpen(true)}
                      className="opa-glass"
                      aria-label="Search elections"
                      title="Search elections  ( / or ⌘K )"
                      style={{
                        ...selStyle,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        textAlign: 'left',
                        color: 'var(--ink-dim)',
                      }}
                    >
                      <SearchIcon size={16} color="var(--ink-mute)" />
                      <span style={{ flex: 1, fontFamily: DISPLAY, fontSize: 14 }}>Search elections…</span>
                      <span style={{ display: 'inline-flex', gap: 3 }}>
                        <span style={kbdCapStyle}>⌘</span>
                        <span style={kbdCapStyle}>K</span>
                      </span>
                    </button>
                    <span aria-hidden style={glassSheen} />
                  </span>
                ),
              },
            ].map((f) => (
              <div key={f.lbl}>
                <div
                  style={{
                    fontFamily: DISPLAY,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-mute)',
                    marginBottom: 8,
                  }}
                >
                  {f.lbl}
                </div>
                {f.el}
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 26 }} />

        {/* grid */}
        {err && races == null ? (
          <div style={{ padding: '80px 0', textAlign: 'center', fontFamily: DISPLAY, color: 'var(--ink-dim)' }}>
            Couldn’t reach civicAPI.{' '}
            <button
              onClick={() => location.reload()}
              style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
            >
              Retry
            </button>
          </div>
        ) : races == null ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: GAP }}>
            {Array.from({ length: cols * 3 }).map((_, i) => (
              <div key={i} style={{ height: CARD_H }}>
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center', fontFamily: DISPLAY, fontSize: 15, color: 'var(--ink-dim)' }}>
            {mapsOnly && totalForDay > 0 ? (
              <>
                No mapped races on this day.{' '}
                <button
                  onClick={() => setMapsOnly(false)}
                  style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                >
                  Show all {fmtInt(totalForDay)} races
                </button>
              </>
            ) : (
              'No races match these filters.'
            )}
          </div>
        ) : (
          <div style={{ position: 'relative', height: totalH }}>
            {visible.map(({ i, r, c, race }) => (
              <div
                key={race.id ?? i}
                style={{
                  position: 'absolute',
                  top: r * ROW,
                  left: `calc(${c} * (${colW} + ${GAP}px))`,
                  width: colW,
                  height: CARD_H,
                }}
              >
                <ResultCard race={race} onOpen={setOpenRace} compact={cols === 1} />
              </div>
            ))}
          </div>
        )}
      </div>
      {openRace ? <RaceDetail race={openRace} onClose={() => setOpenRace(null)} /> : null}
      {searchPortal}
    </div>
  )
}
