import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme, tripToggleTheme } from './lib/theme.jsx'

// The race detail map IS the precinct app (same as the NYC/VA projects):
// a full-screen iframe of the precinct build at ?d=CIVIC&race=<id> — its real
// HoverPanel tooltip, satellite/3D/scope/border controls, search, legend.
// Zero reinvented chrome. ?warp=1 skips the precinct loader so it paints
// clean. Lives in the Elections tab; deep-links + browser-back work.

// The precinct app is its own deployment, so we embed it cross-origin in an
// iframe (exactly how the original OPA hub embedded it). PRECINCT_BASE points
// at that public, embeddable deployment, so the map works identically in local
// dev and on the live site — no second dev server to babysit.
const PRECINCT_BASE = 'https://web-conservativepollings-projects.vercel.app/demographics'

function precinctBase() {
  // To iterate on the precinct app itself, run it locally and set
  // NEXT_PUBLIC_PRECINCT_BASE=http://localhost:3210 — that override wins.
  // Otherwise everything (local + prod) uses the hosted precinct deployment.
  const envBase = process.env.NEXT_PUBLIC_PRECINCT_BASE
  if (envBase) return envBase.replace(/\/+$/, '')
  return PRECINCT_BASE
}

// Sync the iframe to the new theme. Same-origin (dev + prod-with-proxy)
// → mutate the iframe's <html data-theme> directly so the swap is
// synchronous and the View Transitions snapshot of the hub document
// catches the iframe in its new state. Cross-origin → postMessage and
// let layout.tsx's listener apply it (slightly delayed but functional).
function syncIframeTheme(iframe, next) {
  if (!iframe) return
  try {
    const doc = iframe.contentDocument
    if (doc && doc.documentElement) {
      doc.documentElement.dataset.theme = next
      doc.documentElement.style.colorScheme = next
      return
    }
  } catch {
    // Cross-origin — fall through to postMessage.
  }
  try {
    iframe.contentWindow?.postMessage({ type: 'opa-theme', theme: next }, '*')
  } catch {}
}

// ── Inline vote results — shown when the precinct map isn't reachable ──────
// Renders the race's live candidate data directly so users always see results
// instead of a blank or "map unavailable" error screen.
function InlineRaceResults({ race, onRetry, mapSrc }) {
  const { P } = useTheme()
  const cands = [...(race.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0))
  const reporting = Number(race.percent_reporting) || 0
  const anyVotes = cands.some((c) => (c.votes || 0) > 0)
  const started = reporting > 0 || anyVotes
  const winner = cands.find((c) => c.winner)
  const totalVotes = cands.reduce((s, c) => s + (Number(c.votes) || 0), 0)
  const MONO = '"JetBrains Mono", ui-monospace, monospace'
  const DM = '"DM Mono", ui-monospace, monospace'

  const fmtN = (n) => Number.isFinite(n) && n > 0 ? n.toLocaleString('en-US') : '—'
  const fmtP = (n) => Number.isFinite(n) ? `${Number(n).toFixed(1)}%` : '—'

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, overflowY: 'auto',
      background: 'var(--page)', fontFamily: DM,
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '72px 24px 80px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 10 }}>
            {race.election_date ? new Date(race.election_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            {race.province ? ` · ${race.province}` : ''}
          </div>
          <h1 style={{ margin: '0 0 12px', fontFamily: MONO, fontSize: 'clamp(22px, 3.5vw, 36px)', fontWeight: 800, lineHeight: 1.1, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {race.election_name || 'Race Results'}
          </h1>
          {/* Reporting bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--rule)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(reporting, 100)}%`, height: '100%', background: reporting >= 99 ? '#16a34a' : '#d4a73b', borderRadius: 99, transition: 'width 600ms ease' }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
              {started ? `${fmtP(reporting)} reporting` : 'Awaiting results'}
            </span>
          </div>
          {winner && started && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 12px', borderRadius: 99, background: 'rgba(22,163,74,0.14)', border: '1px solid rgba(22,163,74,0.28)' }}>
              <span style={{ fontSize: 11, color: '#16a34a' }}>✓</span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#16a34a', letterSpacing: '0.05em' }}>{winner.name} projected to win</span>
            </div>
          )}
        </div>

        {/* Candidate rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cands.slice(0, 8).map((c, i) => {
            const pct = Number(c.percent) || 0
            const isWinner = !!c.winner && started
            const color = c.color || (String(c.party || '').toUpperCase() === 'D' ? '#2563eb' : String(c.party || '').toUpperCase() === 'R' ? '#e63946' : '#9d5cf0')
            return (
              <div key={c.name + i} style={{ padding: '14px 18px', borderRadius: 12, background: isWinner ? `${color}14` : 'var(--page-elev)', border: `1px solid ${isWinner ? `${color}38` : 'var(--rule)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {isWinner && <span style={{ fontSize: 13, color: '#16a34a' }}>✓</span>}
                    <span style={{ fontFamily: DM, fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{c.name}</span>
                    {c.party && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${color}20`, color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.party}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 18, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{fmtP(pct)}</span>
                    {anyVotes && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--ink-dim)', fontVariantNumeric: 'tabular-nums' }}>{fmtN(c.votes)}</span>}
                  </div>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'var(--rule)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 600ms ease' }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Total votes */}
        {anyVotes && (
          <div style={{ marginTop: 20, fontFamily: MONO, fontSize: 11, color: 'var(--ink-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'right' }}>
            {fmtN(totalVotes)} total votes counted
          </div>
        )}

        {/* Retry for map */}
        <div style={{ marginTop: 40, padding: '18px 20px', borderRadius: 12, background: 'var(--page-elev)', border: '1px solid var(--rule)' }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-dim)', marginBottom: 6 }}>Precinct Map</div>
          <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.6, color: 'var(--ink-mute)', fontFamily: DM }}>
            The precinct-level map is not reachable right now. You can retry or open the map directly.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={onRetry} style={{ fontFamily: DM, fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'var(--ink)', border: 0, borderRadius: 99, padding: '9px 18px', cursor: 'pointer', color: 'var(--page)' }}>
              Retry Map
            </button>
            <a href={mapSrc} target="_blank" rel="noreferrer" style={{ fontFamily: DM, fontSize: 13, fontWeight: 500, color: 'var(--ink-mute)', background: 'transparent', border: '1px solid var(--rule)', borderRadius: 99, padding: '9px 16px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              Open directly ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RaceDetail({ race, onClose }) {
  const { theme, toggle } = useTheme()
  const pushedRef = useRef(false)
  const iframeRef = useRef(null)
  // LIVE THEME PROPAGATION (no reload):
  // The iframe `src` is locked to the theme at MOUNT (initialThemeRef) so it
  // never changes on toggle — changing src would reload the embedded map and
  // throw away the user's zoom / pan / selection (the old jarring "refresh").
  // A theme flip is instead pushed into the live iframe via syncIframeTheme():
  // same-origin → mutate its <html data-theme> directly; cross-origin (dev)
  // → postMessage, which the precinct app's layout.tsx listener applies. The
  // precinct Map watches data-theme and rebuilds its basemap IN PLACE (camera
  // carried via camRef), so the map recolors smoothly in lockstep with the
  // hub's view-transition wipe — exactly like every other surface on the site.
  const initialThemeRef = useRef(theme)

  // Reachability of the precinct map. null = checking, true = up, false = the
  // iframe origin isn't answering (e.g. the precinct app isn't running). When
  // it's down we show a clear, retryable panel instead of a silent blank.
  const [reachable, setReachable] = useState(null)
  const [retry, setRetry] = useState(0)

  // Tracks whether THIS component instance pushed a history entry. If
  // the URL was already /results/race/<id> when we mounted (a direct
  // link or a refresh), we skip the push so Back doesn't have to pop
  // a phantom duplicate — and we know to navigate to /results
  // explicitly on close instead of calling history.back() into the void.
  const pushedSelfRef = useRef(false)
  useEffect(() => {
    const target = `/results/race/${race.id}`
    if (!pushedRef.current) {
      try {
        if (window.location.pathname !== target) {
          history.pushState({ rd: race.id }, '', target)
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

  // Whenever theme changes (e.g. user toggles via our in-race button OR
  // via the hub nav before drilling in), make sure the iframe is in
  // sync. Belt-and-suspenders: the toggle handler below already syncs
  // synchronously inside startViewTransition for snapshot fidelity, but
  // this effect catches any state drift.
  useEffect(() => {
    syncIframeTheme(iframeRef.current, theme)
  }, [theme])

  const back = () => {
    // Three paths here:
    //  1. We pushed a fresh entry in this session → history.back() pops it.
    //  2. We arrived via a direct link (no push) → swap the URL to
    //     /results so the calendar shows next, then close. history.back()
    //     would leave the site entirely.
    //  3. Already closed / no history → just onClose().
    if (pushedSelfRef.current) {
      history.back() // → popstate → onClose
    } else {
      try { history.replaceState({}, '', '/results') } catch {}
      onClose()
    }
  }

  const handleThemeToggle = () => {
    tripToggleTheme({
      theme,
      toggle,
      // Inside the View Transitions callback the hub's <html data-theme>
      // is mutated up front — now mirror that into the iframe so the new
      // snapshot captures both documents in the same state.
      onAfterSwap: (next) => syncIframeTheme(iframeRef.current, next),
    })
  }

  const light = theme === 'light'

  // src carries the MOUNT-time theme only (initialThemeRef) so a fresh load /
  // direct link / refresh paints in the right theme — and then stays put on
  // toggle (live flips go through syncIframeTheme, never a new src → no
  // reload). See the comment block where iframeRef is declared.
  const base = precinctBase()
  const src = `${base}${base.endsWith('/') ? '' : '/'}?d=CIVIC&race=${encodeURIComponent(
    race.id
  )}&warp=1&theme=${initialThemeRef.current}`

  // Probe the precinct origin so a missing/offline map surfaces as a helpful
  // panel rather than a blank page. `no-cors` only tells us reachable-or-not
  // (which is all we need); a 6 s abort treats a hang as down. Re-runs on retry.
  useEffect(() => {
    let alive = true
    setReachable(null)
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 6000)
    fetch(base, { mode: 'no-cors', signal: ac.signal })
      .then(() => { if (alive) setReachable(true) })
      .catch(() => { if (alive) setReachable(false) })
      .finally(() => clearTimeout(timer))
    return () => { alive = false; clearTimeout(timer); ac.abort() }
  }, [base, retry])

  // Unified chrome cluster. A single rounded glass pill at top-left that
  // holds Back + Theme as two segments separated by a 1px hairline. Both
  // segments share the same height/padding/typography so the cluster
  // reads as ONE control surface instead of two competing floating
  // buttons. Crisper backdrop (slight darken in light mode, slight
  // lighten in dark) keeps the pill legible against whatever the
  // basemap is doing underneath.
  const clusterBg = light
    ? 'rgba(255,255,255,0.86)'
    : 'rgba(14,15,19,0.78)'
  const clusterBorder = light
    ? 'rgba(0,0,0,0.10)'
    : 'rgba(255,255,255,0.10)'
  const clusterShadow = light
    ? '0 10px 24px -12px rgba(15,23,42,0.20), 0 0 0 0.5px rgba(0,0,0,0.04)'
    : '0 10px 28px -14px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.04)'
  const segmentInkBase = 'var(--ink)'
  const dividerColor = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)'

  const segmentStyle = {
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'transparent',
    border: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%', // fill the parent pill so mobile/desktop heights both work
    color: segmentInkBase,
    fontFamily: '"Instrument Sans", system-ui, sans-serif',
    fontSize: 13,
    fontWeight: 600,
    padding: 0,
    transition: 'background 140ms ease, color 140ms ease',
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'var(--page)',
        opacity: 1,
      }}
    >
      {/* Position the Back+Theme pill so it never collides with the
          precinct app's centered top UI stack. The precinct mounts
          Brand at top:10, TopSearchBar at top:16 (~32px tall, ~460px
          wide centered), and the Map/3D/Tilt control bar at top:104
          (mobile) / top:76 (desktop). On phones/tablets the centered
          search bar consumes ALL horizontal space at top:16, so we
          drop the pill below it (top:60). On desktops the search bar
          leaves ~280px of empty room on each flank → pill goes back to
          the conventional top-left at top:14. Encoded as a scoped
          style+class to keep the JSX clean and avoid pulling Tailwind
          into the hub. */}
      <style>{`
        .opa-rd-chrome {
          position: absolute;
          top: 60px;
          left: 10px;
          z-index: 2;
          display: inline-flex;
          align-items: stretch;
          height: 34px;
          border-radius: 10px;
          overflow: hidden;
          backdrop-filter: blur(14px) saturate(160%);
          -webkit-backdrop-filter: blur(14px) saturate(160%);
        }
        @media (min-width: 1024px) {
          .opa-rd-chrome { top: 14px; left: 14px; height: 36px; }
        }
      `}</style>
      {/* `key` is the race id ONLY — never theme. Keying on theme would
          remount (reload) the iframe on every toggle, blanking the map and
          losing zoom/selection; theme now flips in place via syncIframeTheme
          while the iframe instance stays mounted. */}
      <iframe
        key={`${race.id}-${retry}`}
        ref={iframeRef}
        title={race.election_name || 'Race detail'}
        src={src}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        allow="fullscreen"
        onLoad={(e) => {
          // Dev-only sanity check: after the iframe loads, what's its
          // data-theme? If this logs the WRONG theme, the URL param or
          // the inline init in layout.tsx is the bug — not React.
          if (process.env.NODE_ENV !== 'production') {
            try {
              const got = e.currentTarget.contentDocument?.documentElement?.dataset?.theme
              // eslint-disable-next-line no-console
              console.info(`[RaceDetail] iframe loaded with data-theme="${got}" (parent theme="${theme}")`)
            } catch {}
          }
        }}
      />
      {/* Unified chrome pill — Back + Theme as two segments of one
          control surface. Positioned per the .opa-rd-chrome rule above. */}
      <div
        className="opa-rd-chrome"
        style={{
          background: clusterBg,
          border: `1px solid ${clusterBorder}`,
          boxShadow: clusterShadow,
        }}
      >
        <button
          onClick={back}
          aria-label="Back to results"
          style={{
            ...segmentStyle,
            gap: 6,
            padding: '0 14px 0 12px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span style={{ lineHeight: 1 }}>Back</span>
        </button>
        <span aria-hidden style={{ width: 1, alignSelf: 'stretch', background: dividerColor }} />
        <button
          onClick={handleThemeToggle}
          aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
          title={light ? 'Dark mode' : 'Light mode'}
          style={{
            ...segmentStyle,
            width: 38,
            color: 'var(--ink-mute)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--ink)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-mute)' }}
        >
          {light ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2M19.5 12h2M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5" /></svg>
          )}
        </button>
      </div>

      {reachable === false ? (
        <InlineRaceResults race={race} onRetry={() => setRetry((n) => n + 1)} mapSrc={src} />
      ) : null}
    </div>,
    document.body
  )
}
