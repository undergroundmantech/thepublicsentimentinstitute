import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from './lib/theme.jsx'

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

export default function RaceDetail({ race, onClose }) {
  const { theme } = useTheme()
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
  const clusterBg = 'rgba(var(--bg2-rgb),0.9)'
  const clusterBorder = 'rgba(var(--line-rgb),0.16)'
  const clusterShadow = '0 12px 40px rgba(0,0,0,0.5)'
  const segmentInkBase = 'var(--ink)'

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
    fontFamily: 'var(--font-b)',
    fontSize: 13,
    fontWeight: 700,
    padding: 0,
    transition: 'background 140ms ease, color 140ms ease',
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'var(--bg)',
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
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--line-rgb),0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span style={{ lineHeight: 1 }}>Back to results</span>
        </button>
      </div>

      {reachable === false ? (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1, display: 'grid', placeItems: 'center',
            padding: 24, background: 'var(--bg)', textAlign: 'center',
            fontFamily: 'var(--font-b)',
          }}
        >
          <div style={{ maxWidth: 460 }}>
            <div className="eye" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--mute)' }}>
              Precinct map unavailable
            </div>
            <h2 style={{ margin: '12px 0 8px', fontFamily: 'var(--font-d)', fontWeight: 800, letterSpacing: '-0.03em', fontSize: 26, lineHeight: 1.1, color: 'var(--ink)' }}>
              This race&apos;s map isn&apos;t responding
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, lineHeight: 1.65, color: 'var(--ink-mute)' }}>
              The detail map loads from{' '}
              <code style={{ fontFamily: 'var(--font-m)', fontSize: 12.5, padding: '1px 6px', borderRadius: 5, background: 'var(--glass2)', color: 'var(--ink)' }}>{base}</code>.{' '}
              The precinct map service may be offline for a moment. Retry below, or open it directly.
            </p>
            <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                onClick={() => setRetry((n) => n + 1)}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--bg)', background: 'var(--hi)', border: 0, borderRadius: 99, padding: '10px 20px', cursor: 'pointer' }}
              >
                Retry
              </button>
              <a
                href={src} target="_blank" rel="noreferrer"
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 99, padding: '10px 18px', textDecoration: 'none' }}
              >
                Open directly
              </a>
              <button
                onClick={() => setReachable(true)}
                style={{ fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink2)', background: 'transparent', border: '1px solid var(--line2)', borderRadius: 99, padding: '10px 18px', cursor: 'pointer' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body
  )
}
