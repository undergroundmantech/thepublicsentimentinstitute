import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme, tripToggleTheme } from './lib/theme.jsx'
import ResultMap from './ResultMap.jsx'
import { fetchRace, candColor, leaderOf, tonePalette, shade } from './electionLib.js'
import { DISPLAY, POSTER, TXT_DIM, fmtInt, yearOf, titleOf, Row, mix } from './resultRow.jsx'

// The race detail is now NATIVE to the hub — the same county choropleth the
// result cards draw (ResultMap, from our committed us-national.geojson), beside
// the full candidate breakdown. No iframe, no separate precinct app, no :3210 /
// /demographics dependency: it works on every URL with one server.

export default function RaceDetail({ race: race0, onClose }) {
  const { theme, toggle, P } = useTheme()
  const light = theme === 'light'

  // A direct link (/results/race/<id>) seeds a stub {id}; fetch the full race so
  // the breakdown + map have candidates/region_results. A card click already
  // passes the full object, so no fetch is needed there.
  const [race, setRace] = useState(race0)
  useEffect(() => {
    let alive = true
    if (race0 && Array.isArray(race0.candidates) && race0.candidates.length) {
      setRace(race0)
    } else if (race0?.id) {
      fetchRace(race0.id)
        .then((full) => { if (alive && full) setRace({ ...full, id: race0.id }) })
        .catch(() => {})
    }
    return () => { alive = false }
  }, [race0?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── URL + history (unchanged behavior): push /results/race/<id>, close on
  //    back, Escape closes. A direct link doesn't push, so we swap to /results
  //    on close instead of history.back()-ing out of the site. ──
  const pushedRef = useRef(false)
  const pushedSelfRef = useRef(false)
  useEffect(() => {
    const target = `/results/race/${race0?.id}`
    if (!pushedRef.current) {
      try {
        if (window.location.pathname !== target) {
          history.pushState({ rd: race0?.id }, '', target)
          pushedSelfRef.current = true
        }
        pushedRef.current = true
      } catch {}
    }
    const onPop = () => onClose()
    const onKey = (e) => { if (e.key === 'Escape') back() }
    window.addEventListener('popstate', onPop)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('keydown', onKey)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    if (pushedSelfRef.current) {
      history.back()
    } else {
      try { history.replaceState({}, '', '/results') } catch {}
      onClose()
    }
  }
  const handleThemeToggle = () => tripToggleTheme({ theme, toggle })

  // ── derived result state (mirrors the card's result block) ──
  const cands = [...(race?.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0))
  const winner = cands.find((c) => c.winner)
  const L = leaderOf(cands)
  const reporting = Number(race?.percent_reporting) || 0
  const anyVotes = cands.some((c) => (c.votes || 0) > 0)
  const started = reporting > 0 || anyVotes
  const projectedWinner = winner && started ? winner : null
  const tint = projectedWinner || L?.cand || cands[0]
  const accent = tint ? candColor(tint) : '#3a3d44'
  const colored = !!tint
  const marginPct = (cands[0]?.percent || 0) - (cands[1]?.percent || 0)
  const headerBg = colored ? shade(accent, marginPct) : '#3a3d44'
  const projText = projectedWinner
    ? `${projectedWinner.name} is projected to win.`
    : started && L?.cand ? `${L.cand.name} leads.`
    : started ? 'Too early to call' : 'Awaiting results'
  const stripBg = colored ? mix(accent, P.card, 0.82) : 'var(--page-elev)'
  const stripFg = colored ? mix(accent, P.stripFgTarget, 0.5) : TXT_DIM
  const chipColors = tonePalette(cands)
  const totalCounted = cands.reduce((s, c) => s + (c.votes || 0), 0)
  const reportingTxt = reporting % 1 ? reporting.toFixed(1) : reporting.toFixed(0)
  const loading = !race || !Array.isArray(race.candidates)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--page)', color: 'var(--ink)' }}>
      <style>{`
        .opa-rd-grid { position:absolute; inset:0; display:grid; grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) auto; }
        .opa-rd-map { position:relative; min-height:0; background:var(--page-sunken); }
        .opa-rd-side { min-height:0; overflow-y:auto; border-top:1px solid var(--rule); background:var(--page); }
        @media (min-width:900px) {
          .opa-rd-grid { grid-template-columns:minmax(360px,420px) 1fr; grid-template-rows:1fr; }
          .opa-rd-side { border-top:0; border-right:1px solid var(--rule); order:-1; }
        }
        .opa-rd-chrome { position:absolute; top:14px; left:14px; z-index:5; display:inline-flex; align-items:stretch; height:36px;
          border-radius:10px; overflow:hidden; backdrop-filter:blur(14px) saturate(160%); -webkit-backdrop-filter:blur(14px) saturate(160%); }
        .opa-rd-seg { appearance:none; background:transparent; border:0; cursor:pointer; display:inline-flex; align-items:center; justify-content:center;
          height:100%; color:var(--ink); font-family:${DISPLAY}; font-size:13px; font-weight:600; transition:background 140ms ease; }
        .opa-rd-seg:hover { background:${light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'}; }
      `}</style>

      {/* chrome: back + theme */}
      <div className="opa-rd-chrome" style={{ background: light ? 'rgba(255,255,255,0.86)' : 'rgba(14,15,19,0.78)', border: `1px solid ${light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)'}`, boxShadow: light ? '0 10px 24px -12px rgba(15,23,42,0.20)' : '0 10px 28px -14px rgba(0,0,0,0.7)' }}>
        <button onClick={back} aria-label="Back to results" className="opa-rd-seg" style={{ gap: 6, padding: '0 14px 0 12px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
          <span style={{ lineHeight: 1 }}>Back</span>
        </button>
        <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)' }} />
        <button onClick={handleThemeToggle} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} className="opa-rd-seg" style={{ width: 38, color: 'var(--ink-mute)' }}>
          {light
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2M19.5 12h2M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" /></svg>}
        </button>
      </div>

      <div className="opa-rd-grid">
        {/* MAP — native county choropleth (whole-state frame) */}
        <div className="opa-rd-map">
          {race?.province ? (
            <ResultMap race={race} inView whole fit="contain" />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-dim)', fontFamily: DISPLAY, fontSize: 13 }}>
              {loading ? 'Loading race…' : 'No map for this race'}
            </div>
          )}
        </div>

        {/* RESULTS */}
        <div className="opa-rd-side">
          <div style={{ padding: '64px 20px 16px', background: headerBg }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.62)' }}>{yearOf(race?.election_date) || '2026'}</div>
            <div style={{ marginTop: 4, fontFamily: POSTER, fontSize: 'clamp(20px,2.4vw,28px)', lineHeight: 1.05, letterSpacing: '0.4px', textTransform: 'uppercase', color: '#fff' }}>
              {race ? titleOf(race) : 'Race'}
            </div>
          </div>

          <div style={{ padding: '14px 20px', minHeight: 48, display: 'flex', alignItems: 'center', background: stripBg, fontFamily: '"Oswald", system-ui, sans-serif', fontSize: 12.5, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: stripFg }}>
            {loading ? 'Loading…' : projText}
          </div>

          <div style={{ padding: '6px 20px 0' }}>
            {cands.slice(0, 12).map((c, i) => (
              <Row key={(c.name || '') + i} c={c} accent={accent} last={i === 0} started={started} chip={chipColors[i]} />
            ))}
            {!loading && !cands.length ? <div style={{ padding: '18px 0', color: 'var(--ink-dim)', fontFamily: DISPLAY, fontSize: 13 }}>No candidate data.</div> : null}
          </div>

          <div style={{ padding: '14px 20px 28px' }}>
            <div style={{ position: 'relative', height: 9, borderRadius: 99, background: 'var(--rule-strong)' }} aria-hidden>
              <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.max(reporting, reporting > 0 ? 3 : 0)}%`, background: 'var(--ink)', borderRadius: 99, transition: 'width 600ms cubic-bezier(.2,.8,.2,1)' }} />
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: '#0a0d16', background: '#cfd4dd', padding: '2px 5px', borderRadius: 3, lineHeight: 1.1 }}>API</span>
                <span style={{ fontFamily: DISPLAY, fontSize: 11.5, color: TXT_DIM }}>Source: civicAPI</span>
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 12.5, color: 'var(--ink)', fontWeight: 500 }}>
                {reportingTxt}% reporting{totalCounted > 0 ? ` · ${fmtInt(totalCounted)} votes` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
