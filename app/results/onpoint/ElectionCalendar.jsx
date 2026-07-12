import React, { useEffect, useMemo, useState } from 'react'
import { Manrope } from 'next/font/google'
import { fmtInt } from './resultRow.jsx'
import { useTheme } from './lib/theme.jsx'

const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], display: 'swap' })

// ── The Month ───────────────────────────────────────────────────────────
// The site's design language applied to an almanac page: Manrope throughout,
// a hairline-ruled month grid on the bare field, quiet small-caps labels, and
// color only where it carries data — candidate tones in the muted family, a
// single lime mark for today (lime = "now" everywhere on this site). Clicking
// a day opens the cinematic Day view (see DayView.jsx).

// Legacy exports — DayView still composes with these.
export const OSWALD = '"Oswald", system-ui, sans-serif'
export const MONO = '"JetBrains Mono", ui-monospace, monospace'
export const C = {
  ink: 'var(--ink)',
  ink70: 'var(--ink-mute)',
  dim: 'var(--ink-dim)',
  faint: 'var(--ink-dimmer)',
  ghost: 'var(--rule-soft)',
  rule: 'var(--rule)',
  ruleSoft: 'var(--rule-soft)',
  track: 'var(--rule)',
  neutral: 'var(--neutral)',
}

const isLight = () => typeof document !== 'undefined' && document.documentElement.dataset.opaTheme === 'light'

// Candidate tones — the site's muted data family. Partisan races get the soft
// periwinkle/coral; everyone else cycles a desaturated set. Light variants are
// deepened for contrast on white.
const SET_DARK = ['#b3a4ec', '#dfb28d', '#92c2cb', '#e6a8b7']
const SET_LIGHT = ['#7a5fc4', '#b07034', '#3d8b9a', '#b65f7c']
export function tone(name, party) {
  const nm = String(name || '').toLowerCase(), pt = String(party || '').toLowerCase()
  const L = isLight()
  if (nm === 'yes' || nm === 'for' || nm === 'approve') return L ? '#3f8a68' : '#7cbb9f'
  if (nm === 'no' || nm === 'against' || nm === 'reject') return L ? '#b8534f' : '#d98c86'
  if (/democr/.test(pt)) return L ? '#4a63b8' : '#8aa3f2'
  if (/republic/.test(pt)) return L ? '#bb5a64' : '#ef8b94'
  return null
}
// tiny color mixer so same-party runners-up read as a muted variant of the
// SAME hue, never a clashing accent.
const _rgb = (h) => { const x = String(h).replace('#', ''); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) }
const _hex = (a) => '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
const _mix = (a, b, t) => { const A = _rgb(a), B = _rgb(b); return _hex(A.map((v, i) => v + (B[i] - v) * t)) }
const MUTE = '#aeb4c0'
const MUTE_LIGHT = '#8a8f99'
export function tonesFor(cands) {
  let k = 0
  const L = isLight()
  const set = L ? SET_LIGHT : SET_DARK
  const mute = L ? MUTE_LIGHT : MUTE
  const base = (cands || []).map((c) => tone(c.name, c.party) || set[k++ % set.length])
  const seen = {}
  return base.map((col) => {
    const n = (seen[col] = (seen[col] || 0) + 1)
    return n === 1 ? col : _mix(col, mute, Math.min(0.36 + (n - 2) * 0.22, 0.72))
  })
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n) => String(n).padStart(2, '0')
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`
const ymRank = (y, m) => y * 12 + m

export default function ElectionCalendar({ dates, loading, error, onPick }) {
  useTheme() // re-render on theme toggle so tone()/tonesFor() re-resolve
  const list = dates || []
  const { byIso, previewByIso, minYM, maxYM } = useMemo(() => {
    const c = {}, pv = {}
    for (const d of list) { c[d.iso] = d.count; pv[d.iso] = d.top || [] }
    const s = [...list].sort((a, b) => a.iso.localeCompare(b.iso))
    const toYM = (iso) => [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1]
    return { byIso: c, previewByIso: pv, minYM: s.length ? toYM(s[0].iso) : null, maxYM: s.length ? toYM(s[s.length - 1].iso) : null }
  }, [list])

  const [cursor, setCursor] = useState(null)
  useEffect(() => { if (!cursor && maxYM) setCursor(maxYM) }, [cursor, maxYM])

  const now = new Date()
  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate())
  const [vy, vm] = cursor || maxYM || [now.getFullYear(), now.getMonth()]

  const { cells, monthDays, monthRaces } = useMemo(() => {
    const startWeekday = new Date(Date.UTC(vy, vm, 1)).getUTCDay()
    const dim = new Date(Date.UTC(vy, vm + 1, 0)).getUTCDate()
    const rws = Math.ceil((startWeekday + dim) / 7)
    const gridStart = Date.UTC(vy, vm, 1 - startWeekday)
    const cs = []; let races = 0, days = 0
    for (let i = 0; i < rws * 7; i++) {
      const dt = new Date(gridStart + i * 86400000)
      const yy = dt.getUTCFullYear(), mm = dt.getUTCMonth(), dd = dt.getUTCDate()
      const iso = isoOf(yy, mm, dd), count = byIso[iso] || 0
      cs.push({ iso, day: dd, inMonth: mm === vm, count })
      if (mm === vm && count > 0) { races += count; days++ }
    }
    return { cells: cs, monthDays: days, monthRaces: races }
  }, [vy, vm, byIso])

  const canPrev = minYM && ymRank(vy, vm) > ymRank(minYM[0], minYM[1])
  const canNext = maxYM && ymRank(vy, vm) < ymRank(maxYM[0], maxYM[1])
  const step = (dir) => setCursor((prev) => { const [cy, cm] = prev || [vy, vm]; let r = ymRank(cy, cm) + dir; if (minYM) r = Math.max(r, ymRank(minYM[0], minYM[1])); if (maxYM) r = Math.min(r, ymRank(maxYM[0], maxYM[1])); return [Math.floor(r / 12), r % 12] })

  return (
    <div className={manrope.className} style={{ width: '100%', letterSpacing: '-0.01em' }}>
      <Style />

      {/* month header — editorial: light large month, quiet meta, ghost nav */}
      <div className="opa-cal-head" style={head}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 650, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.dim }}>The calendar</span>
          <h2 className="opa-cal-month" style={{ margin: 0, fontFamily: manrope.style.fontFamily, fontWeight: 510, fontSize: 'clamp(32px, 3.6vw, 52px)', letterSpacing: '-0.03em', color: C.ink, lineHeight: 0.94, whiteSpace: 'nowrap' }}>
            {MONTHS[vm]} <span style={{ color: C.dim, fontWeight: 480 }}>{vy}</span>
          </h2>
        </div>
        <div className="opa-cal-head-r" style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 4 }}>
          <span style={{ fontSize: 12.5, fontWeight: 550, color: C.dim, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {loading ? 'Loading…' : (
              <>
                <span style={{ color: C.ink70 }}>{monthDays}</span> election days
                <span style={{ color: C.ghost, margin: '0 8px' }}>·</span>
                <span style={{ color: C.ink70 }}>{fmtInt(monthRaces)}</span> contests
              </>
            )}
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            <Nav dir="prev" onClick={() => step(-1)} disabled={!canPrev || loading} />
            <Nav dir="next" onClick={() => step(1)} disabled={!canNext || loading} />
          </div>
        </div>
      </div>

      {/* weekday rail */}
      <div className="opa-cal-weekhead" style={weekHead}>{WDS.map((w, i) => <span key={i} style={{ fontSize: 9.5, fontWeight: 650, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.dim, padding: '0 0 10px 2px' }}>{w}</span>)}</div>

      {error ? (
        <div style={{ padding: '70px 0', textAlign: 'center', fontSize: 14.5, color: C.dim }}>Couldn’t load the calendar. <button onClick={() => location.reload()} style={retryBtn}>Retry</button></div>
      ) : loading ? (
        <div style={{ ...grid, borderTop: `1px solid ${C.rule}`, borderLeft: `1px solid ${C.ruleSoft}` }}>
          {Array.from({ length: 35 }).map((_, i) => <div key={i} style={{ ...cellBase, borderRight: `1px solid ${C.ruleSoft}`, borderBottom: `1px solid ${C.ruleSoft}` }}><span className="opa-cal-sk" style={{ width: 20, height: 20, background: 'var(--rule-soft)', borderRadius: 4 }} /></div>)}
        </div>
      ) : (
        <div className="opa-cal-grid" style={{ ...grid, borderTop: `1px solid ${C.rule}`, borderLeft: `1px solid ${C.ruleSoft}` }}>
          {cells.map((c) => {
            const ruled = { borderRight: `1px solid ${C.ruleSoft}`, borderBottom: `1px solid ${C.ruleSoft}` }
            const isToday = c.iso === todayIso
            // numeral + (today) a lime underline — lime means "now" sitewide.
            const numeral = (size, color, weight = 520) => (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span className="opa-cal-num" style={{ fontWeight: weight, fontSize: size, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{c.day}</span>
                {isToday ? <span aria-hidden className="opa-cal-today" style={{ width: 15, height: 2, borderRadius: 2 }} /> : null}
              </span>
            )
            if (!c.inMonth) return <div key={c.iso} style={{ ...cellBase, ...ruled }}><span style={{ fontSize: 15, fontWeight: 480, color: C.ghost, fontVariantNumeric: 'tabular-nums' }}>{c.day}</span></div>
            if (c.count <= 0) return <div key={c.iso} style={{ ...cellBase, ...ruled }}>{numeral(15, isToday ? C.ink70 : C.faint, 480)}</div>
            const m = previewByIso[c.iso]?.[0]
            const tones = m?.cands?.length ? tonesFor(m.cands) : []
            const t = tones[0] || C.ink70
            const t2 = tones[1] || C.ink70
            const surname = m?.cands?.[0] ? String(m.cands[0].name || '').trim().split(/\s+/).pop() : ''
            const lead = m?.cands?.[0]
            const runner = m?.cands?.[1]
            const leadPct = Number(lead?.pct || 0)
            const runnerPct = Number(runner?.pct || 0)
            const margin = leadPct - runnerPct
            const totalPct = leadPct + runnerPct || 100
            const leadFrac = totalPct > 0 ? leadPct / totalPct : 0.5
            const province = m?.province ? String(m.province).slice(0, 2).toUpperCase() : ''
            const hasResults = leadPct > 0 || runnerPct > 0
            const extraRaces = Math.max(0, c.count - 1)
            return (
              <button key={c.iso} className="opa-cal-day" onClick={() => onPick && onPick(c.iso)}
                style={{ ...cellBase, ...ruled, borderTop: 0, borderLeft: 0, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', letterSpacing: 'inherit' }}>
                <span aria-hidden className="opa-cal-hover" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'var(--rule-soft)', opacity: 0, transition: 'opacity 180ms ease' }} />

                {/* top: numeral left · quiet state code right — no chrome */}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  {numeral('clamp(19px, 1.8vw, 24px)', C.ink)}
                  {province ? <span className="opa-cal-chip" style={{ fontSize: 9.5, fontWeight: 650, letterSpacing: '0.14em', color: C.dim, lineHeight: 1.4 }}>{province}</span> : null}
                </span>

                {/* bottom: surname in its tone · margin in tabular ivory.
                    The meaningful number is HOW CLOSE the headline race is. */}
                <span className="opa-cal-meta" style={{ position: 'relative', zIndex: 1, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 650, letterSpacing: '0', color: t, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{surname || '—'}</span>
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 650, color: hasResults ? C.ink70 : C.dim, fontVariantNumeric: 'tabular-nums' }}>
                      {hasResults ? `+${margin.toFixed(1)}` : (c.count > 1 ? `${c.count} races` : '')}
                    </span>
                  </span>
                  {extraRaces > 0 ? (
                    <span style={{ fontSize: 9.5, fontWeight: 550, color: C.dim, letterSpacing: '0.02em' }}>+{extraRaces} more</span>
                  ) : null}
                </span>

                {/* proportional two-segment bar — tight races read as even halves */}
                <span aria-hidden className="opa-cal-bar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, zIndex: 1, display: 'flex' }}>
                  {hasResults ? (
                    <>
                      <span style={{ width: `${Math.round(leadFrac * 100)}%`, background: t }} />
                      <span style={{ width: `${Math.round((1 - leadFrac) * 100)}%`, background: t2, opacity: 0.7 }} />
                    </>
                  ) : (
                    <span style={{ width: '100%', background: t, opacity: 0.4 }} />
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Nav({ dir, onClick, disabled }) {
  return (
    <button className="opa-cal-nav" onClick={onClick} disabled={disabled} aria-label={dir === 'prev' ? 'Previous month' : 'Next month'}
      style={{ width: 34, height: 32, border: 0, borderRadius: 9, background: 'transparent', color: C.ink, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: disabled ? 0.18 : 0.7 }}>
        <path d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

const head = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 22 }
const weekHead = { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }
const cellBase = { position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 100, padding: '11px 12px 10px', overflow: 'hidden' }
const retryBtn = { background: 'none', border: 0, color: C.ink70, cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }

function Style() {
  return (
    <style>{`
      .opa-cal-day { appearance: none; -webkit-appearance: none; outline: none; -webkit-tap-highlight-color: transparent; }
      .opa-cal-day:hover .opa-cal-hover { opacity: 1; }
      .opa-cal-day:focus-visible .opa-cal-hover { opacity: 1; box-shadow: inset 0 0 0 1.5px var(--ink-mute); }
      .opa-cal-day:active { transform: translateY(0.5px); }
      .opa-cal-bar { transition: height 160ms ease; }
      .opa-cal-day:hover .opa-cal-bar { height: 3px; }
      .opa-cal-today { background: #b7ff00; box-shadow: 0 0 8px rgba(183,255,0,0.5); }
      [data-opa-theme="light"] .opa-cal-today { background: #5e9400; box-shadow: none; }
      .opa-cal-nav { transition: background 140ms ease; }
      .opa-cal-nav:hover:not(:disabled) { background: rgba(255,255,255,0.07); }
      [data-opa-theme="light"] .opa-cal-nav:hover:not(:disabled) { background: rgba(0,0,0,0.06); }
      .opa-cal-nav:disabled { cursor: default; }
      .opa-cal-sk { animation: opa-cal-pulse 1.3s ease-in-out infinite; }
      @keyframes opa-cal-pulse { 0%,100% { opacity:.45 } 50% { opacity:1 } }

      /* Tablet & below — drop the meta row; cells become numeral + state code
         + color bar. Still readable at a glance, no cramp. */
      @media (max-width: 680px) {
        .opa-cal-grid > * { min-height: 64px !important; padding: 8px 9px !important; }
        .opa-cal-meta { display: none !important; }
        .opa-cal-bar { height: 3px !important; }
      }

      /* Phones — header stacks, numerals stay legible at arm's length. */
      @media (max-width: 440px) {
        .opa-cal-head { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; margin-bottom: 14px !important; }
        .opa-cal-month { font-size: 30px !important; }
        .opa-cal-head-r { width: 100% !important; justify-content: space-between !important; gap: 12px !important; padding-bottom: 0 !important; }
        .opa-cal-grid > * { min-height: 58px !important; padding: 7px 7px !important; }
        .opa-cal-num { font-size: 16px !important; }
        .opa-cal-weekhead > span { padding-bottom: 7px !important; font-size: 8.5px !important; letter-spacing: 0.14em !important; }
      }

      @media (max-width: 360px) {
        .opa-cal-chip { display: none !important; }
        .opa-cal-grid > * { padding: 6px 6px !important; min-height: 54px !important; }
      }
    `}</style>
  )
}
