import React from 'react'

// Shared ballotline presentation: the one candidate Row + the theme
// tokens + name/title helpers. Used by the grid card, the detail
// summary panel, and the per-county hover tooltip so all three are 1:1.

export const DISPLAY = '"Instrument Sans", system-ui, sans-serif'
export const POSTER = '"Anton", "Oswald", system-ui, sans-serif' // heavy condensed display
// CARD_BG stays a real hex — it's an input to mix() blends (which parse hex).
// For a theme-correct card surface in math, read P.card from useTheme().
export const CARD_BG = '#0d1117'
export const CARD_BD = 'var(--card-bd)'
export const TXT = 'var(--ink)'
export const TXT_DIM = 'var(--ink-mute)'
export const TXT_VOTE = 'var(--ink-mute)'
export const GOLD = 'var(--accent)'

export const fmtInt = (n) => (Number(n) || 0).toLocaleString('en-US')
export const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`
export const yearOf = (s) => (s ? String(s).slice(0, 4) : '')

export const mix = (a, b, t) => {
  const r = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const A = r(a), B = r(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

export const partyTag = (p) => {
  const s = String(p || '').toLowerCase()
  if (/democr/.test(s)) return 'Dem'
  if (/republic/.test(s)) return 'GOP'
  if (/nonpartisan/.test(s)) return 'NP'
  if (/independent/.test(s)) return 'Ind'
  if (/libertarian/.test(s)) return 'Lib'
  if (/green/.test(s)) return 'Grn'
  return p ? String(p).slice(0, 3) : ''
}
export const isNP = (p) => /nonpartisan/i.test(String(p || ''))

// civicAPI sometimes doubles the state in election_name ("Alabama
// Alabama Court…"). Collapse any consecutive duplicate words.
export const cleanName = (s) =>
  String(s || '').replace(/\b([\w'.-]+)(\s+\1\b)+/gi, '$1').trim()

// postal → full state name, so titles read "GEORGIA - …" like ballotline
export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}
export const titleOf = (race) => {
  const nm = cleanName(race.election_name)
  const full = STATE_NAMES[String(race.province || '').toUpperCase()]
  if (full && !nm.toLowerCase().startsWith(full.toLowerCase())) return `${full} - ${nm}`
  return nm
}

// One candidate row — ballotline: colour tick · check box (winner) ·
// name + party · votes · bold percent.
export function Row({ c, accent, last, started = true, chip }) {
  // ✓ only when civicAPI flagged this candidate AND the race has
  // started (reporting>0 or any votes). civicAPI pre-flags uncontested
  // winners at 0%, which reads as "why a checkmark before polls open?".
  const won = !!c.winner && started
  // If a `chip` color is provided (per-candidate tone for same-party
  // distinction), use it; otherwise fall back to the legacy accent-fade.
  const col = chip || (won ? accent : mix(accent, CARD_BG, 0.55))
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '9px 0',
        borderTop: last ? 'none' : '1px solid rgba(255,255,255,0.055)',
      }}
    >
      <span style={{ width: 3, alignSelf: 'stretch', minHeight: 18, flexShrink: 0, background: col, borderRadius: 2, marginRight: 11 }} />
      <span style={{ width: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {won ? (
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
            <rect x="0.5" y="0.5" width="15" height="15" rx="3.5" fill={accent} />
            <path d="M4 8.2 L6.8 11 L12 5.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ) : null}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: 7,
          fontFamily: DISPLAY,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            flex: '0 1 auto',
            minWidth: 0,
            fontSize: 14.5,
            fontWeight: won ? 700 : 600,
            color: TXT,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {c.name}
        </span>
        {partyTag(c.party) ? (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: TXT_DIM, flexShrink: 0 }}>{partyTag(c.party)}</span>
        ) : null}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontFamily: DISPLAY,
          fontSize: 13.5,
          color: TXT_VOTE,
          fontVariantNumeric: 'tabular-nums',
          paddingLeft: 16,
          marginRight: 16,
        }}
      >
        {fmtInt(c.votes)}
      </span>
      <span
        style={{
          width: 66,
          textAlign: 'right',
          fontFamily: DISPLAY,
          fontSize: 15,
          fontWeight: 800,
          color: TXT,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {fmtPct(c.percent)}
      </span>
    </div>
  )
}
