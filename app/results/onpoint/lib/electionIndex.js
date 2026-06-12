import { useEffect, useState } from 'react'
import { titleOf, cleanName, partyTag, STATE_NAMES } from '../resultRow.jsx'
import { leaderOf } from '../electionLib.js'

// ─────────────────────────────────────────────────────────────────────────
// Election search index — a flat, season-wide, *searchable* catalogue of every
// contest civicAPI knows for Feb–May 2026, plus a small election-aware fuzzy
// matcher. The calendar already pulls these four month ranges to build the
// picker (then throws away all but the top-4/day); we tap the same source and
// keep the whole thing so the command palette can "jump to any election".
//
// The matcher is deliberately hand-built (no dependency) so it can be SMART
// about elections: state codes + names, office shorthand (AG → Attorney
// General, guv → Governor), party words, candidate names, and dates — with
// light typo tolerance — not just a substring match on the title.
// ─────────────────────────────────────────────────────────────────────────

const API = 'https://civicapi.org/api/v2/race/search'
const RANGES = [
  ['2026-06-01', '2026-06-30'],
      ['2026-05-01', '2026-05-31'],
  ['2026-04-01', '2026-04-30'],
  ['2026-03-01', '2026-03-31'],
  ['2026-02-01', '2026-02-28'],
]
// "Now" for recency tie-breaking — keep in step with the app's currentDate.
const TODAY_TS = Date.parse('2026-05-25')

const MONTHS_LONG = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Canonical office (normalized) → extra shorthand a user might type.
const OFFICE_ALIASES = {
  'attorney general': ['ag'],
  governor: ['guv', 'gov'],
  'lieutenant governor': ['lt gov', 'ltgov', 'lg'],
  'secretary of state': ['sos', 'sec state'],
  senate: ['sen', 'senator'],
  house: ['rep', 'congress', 'congressional', 'representative'],
  treasurer: ['treas'],
  comptroller: ['controller'],
  'district attorney': ['da'],
  superintendent: ['supt'],
  commissioner: ['comm'],
  president: ['potus', 'prez'],
}
// Normalized party tag → words a user might type.
const PARTY_ALIASES = {
  Dem: ['democrat', 'democratic', 'dem'],
  GOP: ['republican', 'gop'],
  Ind: ['independent', 'ind'],
  Lib: ['libertarian'],
  Grn: ['green'],
  NP: ['nonpartisan'],
}
// Valid 2-letter postal codes, so a typed "pa"/"ga" is read as a STATE.
const STATE_CODES = new Set(Object.keys(STATE_NAMES).map((c) => c.toLowerCase()))

// ── text utils ────────────────────────────────────────────────────────────
const norm = (s) =>
  String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Levenshtein with an early cap — only used on plausibly-close tokens.
function lev(a, b) {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = new Array(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}
function isSubseq(q, t) {
  let i = 0
  for (let j = 0; j < t.length && i < q.length; j++) if (t[j] === q[i]) i++
  return i === q.length
}

// Contest name with the leading state stripped (the row shows state
// separately, so "Alabama - Attorney General…" reads as "Attorney General…").
export function contestOf(race) {
  const nm = cleanName(race.election_name)
  const full = STATE_NAMES[String(race.province || '').toUpperCase()]
  if (full) {
    const re = new RegExp('^' + full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "\\s*[-–—:·]?\\s*", 'i')
    const stripped = nm.replace(re, '').trim()
    if (stripped) return stripped
  }
  return nm || race.election_type || 'Race'
}

export function fmtDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m) return ''
  return `${MONTHS_SHORT[(m - 1) % 12]} ${d}, ${y}`
}

// ── per-race searchable document ────────────────────────────────────────────
function buildDoc(race) {
  const province = String(race.province || '').toUpperCase()
  const stateName = STATE_NAMES[province] || ''
  const office = String(race.election_type || '')
  const contest = contestOf(race)
  const title = titleOf(race)
  const date = String(race.election_date || '').slice(0, 10)
  const ts = Date.parse(date) || 0

  const cands = Array.isArray(race.candidates) ? race.candidates : []
  const totalVotes = cands.reduce((s, c) => s + (c.votes || 0), 0)
  const reporting = Number(race.percent_reporting) || 0
  const leader = leaderOf(cands)
  const hasResult = totalVotes > 0

  // date words: "may 19 2026 2026-05-19 05-19"
  const [Y, M, D] = date.split('-')
  const monthName = MONTHS_LONG[(parseInt(M, 10) || 1) - 1] || ''
  const dateWords = `${monthName} ${parseInt(D, 10) || ''} ${Y} ${date} ${M}-${D}`

  // office shorthand
  const officeNorm = norm(`${office} ${contest}`)
  let officeAlias = ''
  for (const canon in OFFICE_ALIASES) {
    if (officeNorm.includes(canon)) officeAlias += ' ' + OFFICE_ALIASES[canon].join(' ')
  }

  // party words from the field
  let partyWords = ''
  for (const c of cands) {
    const tag = partyTag(c.party)
    partyWords += ' ' + (c.party || '') + ' ' + tag
    if (PARTY_ALIASES[tag]) partyWords += ' ' + PARTY_ALIASES[tag].join(' ')
  }
  const candWords = cands.map((c) => c.name || '').join(' ')

  // weighted fields — candidate / state / office matter most for "find it fast"
  const rawFields = [
    { w: 3.0, text: norm(candWords) },
    { w: 2.6, text: norm(`${province} ${stateName}`) },
    { w: 2.6, text: norm(`${office} ${officeAlias}`) },
    { w: 2.0, text: norm(contest) },
    { w: 1.6, text: norm(dateWords) },
    { w: 1.2, text: norm(String(race.district || '')) },
    { w: 1.0, text: norm(partyWords) },
  ].filter((f) => f.text)

  const fields = rawFields.map((f) => ({ w: f.w, toks: f.text.split(' ').filter(Boolean) }))
  const hay = rawFields.map((f) => f.text).join(' ')

  return {
    race,
    id: race.id,
    date,
    ts,
    title,
    contest,
    office,
    province,
    stateName,
    totalVotes,
    reporting,
    leader,
    hasResult,
    hay,
    fields,
  }
}

// ── matcher ─────────────────────────────────────────────────────────────────
function tokMatch(qt, t) {
  if (qt === t) return 1
  if (t.startsWith(qt)) return 0.82
  // Short tokens (state codes, "ag") only match exact/prefix — otherwise "ag"
  // would light up every "magistrate"/"village" on the ballot.
  if (qt.length <= 2) return 0
  if (t.includes(qt)) return 0.55
  const thr = qt.length <= 4 ? 1 : 2
  if (Math.abs(qt.length - t.length) <= thr && lev(qt, t) <= thr) return 0.42
  if (qt.length >= 3 && isSubseq(qt, t)) return 0.3
  return 0
}

function scoreDoc(doc, qTokens) {
  let total = 0
  for (const qt of qTokens) {
    let best = 0
    for (const f of doc.fields) {
      for (const t of f.toks) {
        const m = tokMatch(qt, t)
        if (m > 0) {
          const s = f.w * m
          if (s > best) best = s
        }
      }
    }
    if (best <= 0) return -1 // AND semantics: every typed token must land
    total += best
  }
  return total
}

// Cheap gate before the full scorer: each token's first ≤3 chars must appear
// somewhere in the haystack. Keeps typo recall (most typos aren't in the stem)
// while skipping the vast majority of non-matches.
function prefilter(doc, qTokens) {
  for (const qt of qTokens) {
    const probe = qt.length <= 3 ? qt : qt.slice(0, 3)
    if (!doc.hay.includes(probe)) return false
  }
  return true
}

// Tiny tie-breaker so equally-relevant contests sort by "happening now".
function recencyBonus(doc) {
  let b = 0
  if (doc.ts) {
    const days = Math.abs(doc.ts - TODAY_TS) / 86400000
    b += Math.max(0, 0.35 * (1 - Math.min(days, 180) / 180))
  }
  if (doc.hasResult) b += 0.12
  return b
}

export function searchElections(index, query, limit = 9) {
  if (!index) return []
  const q = norm(query)
  if (!q) return []
  const qTokens = q.split(' ').filter(Boolean)
  if (!qTokens.length) return []
  // A typed 2-letter state code ("pa", "ga") should strongly prefer that
  // state's contests over incidental name-prefix hits ("Patton", "Parke").
  const codeTokens = qTokens.filter((t) => STATE_CODES.has(t))
  const out = []
  for (const doc of index.docs) {
    if (!prefilter(doc, qTokens)) continue
    let s = scoreDoc(doc, qTokens)
    if (s < 0) continue
    if (qTokens.length > 1 && doc.hay.includes(q)) s += 2.5 // exact phrase
    if (codeTokens.length) {
      const pv = doc.province.toLowerCase()
      for (const ct of codeTokens) if (pv === ct) s += 2.2
    }
    // first-token contest-prefix nudge — only for "real" tokens (≥3 chars),
    // so a bare "pa" doesn't reward "Parke County".
    if (qTokens[0].length >= 3 && doc.contest && norm(doc.contest).startsWith(qTokens[0])) s += 0.5
    s += recencyBonus(doc)
    out.push({ doc, s })
  }
  out.sort((a, b) => b.s - a.s || b.doc.ts - a.doc.ts || b.doc.totalVotes - a.doc.totalVotes)
  return out.slice(0, limit).map((x) => x.doc)
}

// Empty-state list: what's most relevant "right now" — closest to today and
// already reporting, then by turnout.
export function getSuggestions(index, limit = 6) {
  if (!index) return []
  return [...index.docs]
    .sort(
      (a, b) =>
        recencyBonus(b) + (b.hasResult ? 0.25 : 0) - (recencyBonus(a) + (a.hasResult ? 0.25 : 0)) ||
        b.totalVotes - a.totalVotes
    )
    .slice(0, limit)
}

// ── loader (module-singleton; one fetch per page session) ───────────────────
let _promise = null
export function loadElectionIndex() {
  if (_promise) return _promise
  _promise = Promise.all(
    RANGES.map(([s, e]) =>
      fetch(`${API}?startDate=${s}&endDate=${e}&limit=50000`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
        .then((j) => j.races || [])
    )
  )
    .then((lists) => {
      const map = new Map() // dedupe by id across the four ranges
      for (const list of lists) {
        for (const r of list) {
          if (r && r.id != null && !map.has(r.id)) map.set(r.id, r)
        }
      }
      const docs = [...map.values()].map(buildDoc)
      return { docs, count: docs.length, builtAt: Date.now() }
    })
    .catch((e) => {
      _promise = null // allow a later retry
      throw e
    })
  return _promise
}

// Small hook: builds/returns the index when `active` first becomes true.
export function useElectionIndex(active) {
  const [index, setIndex] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!active) return
    let alive = true
    loadElectionIndex()
      .then((ix) => alive && setIndex(ix))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [active])
  return { index, error }
}
