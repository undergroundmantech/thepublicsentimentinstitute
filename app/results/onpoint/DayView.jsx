import React from 'react'
import { DISPLAY, fmtInt, STATE_NAMES } from './resultRow.jsx'
import ResultMap from './ResultMap.jsx'
import { OSWALD, MONO, C, tonesFor } from './ElectionCalendar.jsx'
import { useTheme } from './lib/theme.jsx'

// ── The Day ─────────────────────────────────────────────────────────────
// A cinematic, full-bleed editorial spread for a single election day — the
// app's NYC-slide language, not a dashboard: the marquee contest's state map
// fills the stage, a big Oswald headline + a quiet party-tone readout float
// over it, and the rest of the day's contests fall to a generous typographic
// index below. ← Calendar returns to the month; Open full board → the grid.

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.65'/%3E%3C/svg%3E\")"

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// The eyebrow already names the state, so drop a leading state name to keep the
// headline tight ("Governor Republican Primary", not "Ohio Governor…"). Strip
// the unambiguous "Ohio - " form titleOf injects; strip a bare "Ohio " only when
// an office word follows, so a place named after its state (e.g. "Ohio Valley
// School District") is never mangled.
const OFFICE_RE = /^(us|u\.s\.|united states|state|governor|lieutenant|senate|senator|house|representative|attorney|secretary|treasurer|auditor|comptroller|commissioner|proposition|issue|amendment|measure|question|primary|mayor|council|judge|justice|supreme|court|congress|congressional|district|ballot|board|initiative|referendum|election|general|special)\b/i
function trimTitle(title, province) {
  const raw = String(title || '').trim()
  let t = raw
  const full = STATE_NAMES[String(province || '').toUpperCase()]
  if (full) {
    const esc = full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    t = t.replace(new RegExp(`^${esc}\\s*[-–—]\\s*`, 'i'), '') // "Ohio - Governor…"
    if (t === raw) {
      const m = raw.match(new RegExp(`^${esc}\\s+(.*)$`, 'i'))
      if (m && OFFICE_RE.test(m[1])) t = m[1] // "Ohio Governor…" → "Governor…"
    }
  }
  return t.trim() || raw
}

// One-accent rule: the leader keeps its true hue; everyone else recedes toward
// slate so a slide never becomes a green/red (or blue/red) clash — just a single
// confident color over neutrals. Reporting + margin stay neutral entirely.
const _rgb = (h) => { const x = String(h).replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) }
const _hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const _mix = (a, b, t) => { const A = _rgb(a), B = _rgb(b); return _hex(A.map((v, i) => v + (B[i] - v) * t)) }
const SLATE = '#777d89'
const displayTones = (cands) => tonesFor(cands).map((c, i) => (i === 0 ? c : _mix(c, SLATE, 0.62)))

function Bar({ cands, tones, h = 6 }) {
  const tt = tones || tonesFor(cands)
  const shown = cands.reduce((s, c) => s + Math.max(0, c.pct), 0)
  const rem = Math.max(0, 100 - shown)
  return (
    <span style={{ position: 'relative', display: 'flex', width: '100%', height: h, borderRadius: 99, overflow: 'hidden', background: 'var(--rule)' }}>
      {cands.map((c, i) => <span key={i} style={{ width: `${Math.max(0, c.pct)}%`, background: tt[i] }} />)}
      {rem > 0.5 ? <span style={{ flex: 1, background: C.neutral }} /> : null}
      {cands.slice(0, -1).map((c, i) => {
        const left = cands.slice(0, i + 1).reduce((s, x) => s + Math.max(0, x.pct), 0)
        return <span key={'s' + i} aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: 1, background: 'rgba(var(--page-rgb),0.65)' }} />
      })}
    </span>
  )
}

// The winner's seat — a filled, checked box (echoes the hub's result Row
// checkbox); everyone else gets a hollow box in their tone. A clear won/lost
// signal, not a generic swatch.
function Seat({ color, won }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <rect x={won ? 0.5 : 1} y={won ? 0.5 : 1} width={won ? 15 : 14} height={won ? 15 : 14} rx="4"
        fill={won ? color : 'none'} stroke={won ? 'none' : color} strokeWidth={won ? 0 : 1.6} />
      {won ? <path d="M4.3 8.4 L6.9 11 L11.7 5.6" stroke="#0b0c0e" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
    </svg>
  )
}
const statLabel = { fontFamily: MONO, fontSize: 9.5, fontWeight: 500, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim }

export default function DayView({ day, data, today, onBack, onOpenBoard }) {
  useTheme() // re-render on theme toggle so tonesFor()/displayTones re-resolve
  const y = +day.slice(0, 4), m = +day.slice(5, 7) - 1, d = +day.slice(8, 10)
  const wd = WD[new Date(Date.UTC(y, m, d)).getUTCDay()]
  const count = data?.count || 0
  const races = data?.top || []
  const hero = races[0]
  const ht = hero ? displayTones(hero.cands || []) : []
  const leadTone = ht[0] || C.neutral
  const cands = hero?.cands || []
  const started = hero && hero.started && cands.length
  const margin = cands.length > 1 ? cands[0].pct - cands[1].pct : null
  const final = !!hero && hero.reporting >= 99
  const rest = races.slice(1, 6)

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--page)', zIndex: 20, overflow: 'auto', animation: 'opa-fade 360ms ease' }}>
      <Style />
      <div className="opa-er-bg" aria-hidden />

      {/* top bar */}
      <div style={topbar}>
        <button onClick={onBack} className="opa-dv-link" style={linkBtn}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>←</span> Calendar
        </button>
        <button onClick={onOpenBoard} className="opa-dv-link" style={{ ...linkBtn, color: C.ink70 }}>
          Open full board <span style={{ fontSize: 14 }}>→</span>
        </button>
      </div>

      {/* ── cinematic hero ── */}
      <div className="opa-dv-hero">
        {hero?.race ? (
          <div aria-hidden className="opa-dv-map">
            <div className="opa-dv-bloom" style={{ background: `radial-gradient(closest-side, ${leadTone}33 0%, ${leadTone}12 48%, transparent 74%)` }} />
            <div style={{ position: 'absolute', inset: 0 }}>
              <ResultMap key={hero.race.id} race={hero.race} inView fit="contain" bare whole />
            </div>
          </div>
        ) : null}
        <div aria-hidden className="opa-dv-veil" />
        <div aria-hidden className="opa-dv-grain" />

        {/* caption */}
        <div className="opa-dv-cap">
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.24em', textTransform: 'uppercase', color: C.dim }}>
            Returns{hero?.province ? ` · ${hero.province}` : ''} · {wd}{today ? ' · Today' : ''}
          </div>
          <h1 className="opa-dv-head">{hero ? trimTitle(hero.title, hero.province) : `${MONTHS[m]} ${d}`}</h1>

          {hero && started ? (
            <div style={{ marginTop: 'clamp(16px, 2.4vh, 26px)', maxWidth: 470 }}>
              {/* candidate ledger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {cands.map((c, j) => {
                  // civicAPI doesn't flag winners on ballot measures; once it's
                  // final, the leader is decided — fill their box so it reads done.
                  const won = c.won || (final && j === 0)
                  return (
                    <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                      <Seat color={ht[j]} won={won} />
                      <span style={{ minWidth: 0, flex: 1, fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.13em', textTransform: 'uppercase', color: won ? C.ink : C.ink70, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      <span style={{ flexShrink: 0, fontFamily: OSWALD, fontWeight: 600, fontSize: j === 0 ? 32 : 21, lineHeight: 0.9, letterSpacing: '-0.01em', color: ht[j], fontVariantNumeric: 'tabular-nums' }}>{c.pct.toFixed(1)}<span style={{ fontSize: '0.44em', color: C.dim, marginLeft: 1 }}>%</span></span>
                    </div>
                  )
                })}
              </div>

              {/* result bar — the vote split (leader accent + receded rest) */}
              <div style={{ marginTop: 17 }}><Bar cands={cands} tones={ht} h={7} /></div>

              {/* returns footer — reporting as a real progress bar, margin as its own stat */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.rule}`, display: 'flex', alignItems: 'flex-end', gap: 32 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={statLabel}>Reporting</span>
                    <span style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 15, lineHeight: 1, color: C.ink70, fontVariantNumeric: 'tabular-nums' }}>{hero.reporting.toFixed(0)}<span style={{ fontSize: '0.66em', color: C.dim }}>%</span></span>
                  </div>
                  <div style={{ position: 'relative', height: 4, borderRadius: 99, background: C.track, overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.max(hero.reporting, 2)}%`, background: final ? 'var(--ink)' : 'var(--ink-mute)', borderRadius: 99, transition: 'width 760ms cubic-bezier(.2,.8,.2,1)' }} />
                  </div>
                </div>
                {margin != null ? (
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ ...statLabel, marginBottom: 7 }}>Margin</div>
                    <div style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 21, lineHeight: 0.9, color: C.ink, fontVariantNumeric: 'tabular-nums' }}>+{margin.toFixed(1)}<span style={{ fontSize: '0.42em', color: C.dim, marginLeft: 4, letterSpacing: '0.1em' }}>PTS</span></div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim }}>Awaiting returns</div>
          )}
        </div>
      </div>

      {/* ── down-ballot index ── */}
      <div className="opa-dv-index">
        {rest.length ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, paddingBottom: 12, borderBottom: `1px solid ${C.rule}` }}>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.dim }}>Also on the ballot</span>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.04em', color: C.dim }}>{fmtInt(count)} contests</span>
            </div>
            {rest.map((r, i) => {
              const t = tonesFor(r.cands || []); const ld = r.cands?.[0]
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', alignItems: 'center', gap: 14, padding: '15px 0', borderBottom: `1px solid ${C.ruleSoft}` }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: (r.started && t[0]) || C.neutral }} />
                  <span style={{ minWidth: 0, fontFamily: DISPLAY, fontSize: 15, color: C.ink70, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trimTitle(r.title, r.province)}</span>
                  {r.started && ld
                    ? <span style={{ fontFamily: OSWALD, fontWeight: 600, fontSize: 20, color: t[0] }}>{ld.pct.toFixed(1)}<span style={{ fontSize: 11, color: C.dim }}>%</span></span>
                    : <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim }}>—</span>}
                </div>
              )
            })}
          </>
        ) : null}

        <button onClick={onOpenBoard} className="opa-dv-cta" style={ctaRow}>
          <span aria-hidden style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${C.rule}, transparent)` }} />
          <span style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.ink }}>Open the full results board</span>
          <span className="opa-dv-arr" style={{ color: C.ink70, fontSize: 16 }}>→</span>
        </button>
      </div>
    </div>
  )
}

const topbar = { position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1180, margin: '0 auto', padding: '78px 30px 0', fontFamily: MONO }
const linkBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 0, cursor: 'pointer', color: C.dim, fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', padding: 0 }
const ctaRow = { marginTop: 22, width: '100%', display: 'flex', alignItems: 'center', gap: 16, background: 'transparent', border: 0, cursor: 'pointer', padding: '4px 0' }

function Style() {
  return (
    <style>{`
      .opa-dv-link { transition: color 140ms ease; }
      .opa-dv-link:hover { color: ${C.ink} !important; }
      .opa-dv-hero { position: relative; max-width: 1180px; margin: 0 auto; min-height: clamp(420px, 66vh, 700px);
        padding: clamp(20px,5vh,52px) 30px 0; overflow: hidden; display: flex; align-items: center; }
      .opa-dv-map { position: absolute; top: 0; bottom: 0; right: -4%; width: 60%; z-index: 1; }
      .opa-dv-bloom { position: absolute; inset: -8% -6%; pointer-events: none;
        animation: opa-dv-bloom 12s ease-in-out 600ms infinite alternate; }
      .opa-dv-veil { position: absolute; inset: 0; z-index: 2; pointer-events: none; background:
        linear-gradient(90deg, var(--page) 0%, rgba(var(--page-rgb),0.92) 30%, rgba(var(--page-rgb),0.30) 58%, transparent 78%),
        linear-gradient(0deg, rgba(var(--page-rgb),0.5) 0%, transparent 22%); }
      .opa-dv-grain { position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: .05;
        mix-blend-mode: overlay; background-image: ${GRAIN}; background-size: 190px 190px; }
      .opa-dv-cap { position: relative; z-index: 3; max-width: 560px; }
      .opa-dv-head { margin: 14px 0 0; font-family: ${OSWALD}; font-weight: 700; text-transform: uppercase;
        font-size: clamp(34px, 5vw, 68px); line-height: 0.92; letter-spacing: 0.01em; color: ${C.ink};
        text-shadow: 0 2px 26px rgba(var(--page-rgb),0.7); }
      .opa-dv-index { position: relative; z-index: 3; max-width: 1180px; margin: 0 auto; padding: clamp(24px,5vh,48px) 30px 100px; }
      .opa-dv-cta { transition: opacity 140ms ease; }
      .opa-dv-cta:hover { opacity: 0.82; }
      .opa-dv-cta:hover .opa-dv-arr { color: ${C.ink} !important; }
      @keyframes opa-dv-bloom { from { opacity: .6 } to { opacity: .95 } }
      @keyframes opa-fade { from { opacity: 0 } to { opacity: 1 } }
      @media (prefers-reduced-motion: reduce) { .opa-dv-bloom { animation: none } }
      @media (max-width: 720px) {
        .opa-dv-hero { display: block; min-height: 0; padding-top: 18px; }
        .opa-dv-map { position: relative; right: 0; width: 100%; height: 240px; margin-bottom: 18px; }
        .opa-dv-veil { background: linear-gradient(0deg, var(--page) 0%, rgba(var(--page-rgb),0.4) 30%, transparent 60%); }
        .opa-dv-cap { max-width: none; }
      }
    `}</style>
  )
}
