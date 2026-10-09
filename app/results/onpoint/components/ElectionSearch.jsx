import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useElectionIndex,
  searchElections,
  getSuggestions,
  fmtDate,
} from '../lib/electionIndex.js'
import { candColor } from '../electionLib.js'
import { useTheme } from '../lib/theme.jsx'

// Election command palette — a "hidden" smart-search prompt for the Elections
// section. A subtle trigger (or ⌘K / "/") opens it; type any election (office,
// state, candidate, party, date — not just the title) and Enter jumps straight
// into that race. Matching + the season-wide index live in lib/electionIndex.js.

const DISPLAY = '"Instrument Sans", system-ui, sans-serif'
const OSWALD = '"Oswald", system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

export function SearchIcon({ size = 18, color = 'currentColor', sw = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: 'block', flexShrink: 0 }}
    >
      <circle cx="11" cy="11" r="7.5" />
      <path d="m20 20-3.8-3.8" />
    </svg>
  )
}

// little keycap used in the footer hint + the esc chip
function Cap({ children, style }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        borderRadius: 4,
        border: '1px solid var(--rule)',
        background: 'var(--wash)',
        fontFamily: MONO,
        fontSize: 9.5,
        lineHeight: 1,
        color: 'var(--ink-mute)',
        ...style,
      }}
    >
      {children}
    </span>
  )
}

function LeaderDot({ doc }) {
  if (doc.hasResult && doc.leader?.cand) {
    const col = candColor(doc.leader.cand)
    return (
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: 99,
          background: col,
          flexShrink: 0,
          boxShadow: `0 0 0 3px ${col}26`,
        }}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{
        width: 9,
        height: 9,
        borderRadius: 99,
        border: '1.5px solid var(--ink-dimmer)',
        flexShrink: 0,
      }}
    />
  )
}

function ResultRow({ doc, active, idx, onPick, onHover }) {
  const ld = doc.hasResult ? doc.leader : null
  const col = ld?.cand ? candColor(ld.cand) : null
  const lastName = ld?.cand ? String(ld.cand.name || '').trim().split(/\s+/).pop() : null
  const meta = [doc.stateName || doc.province, doc.date ? fmtDate(doc.date) : '', doc.office]
    .filter(Boolean)
    .join('  ·  ')
  return (
    <button
      type="button"
      role="option"
      id={`opa-es-opt-${idx}`}
      aria-selected={active}
      data-idx={idx}
      onMouseEnter={onHover}
      onClick={onPick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '10px 14px 10px 18px',
        border: 'none',
        cursor: 'pointer',
        background: active ? 'var(--hover)' : 'transparent',
        borderRadius: 11,
        position: 'relative',
        transition: 'background 120ms ease',
      }}
    >
      {active ? (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 5,
            top: 9,
            bottom: 9,
            width: 3,
            borderRadius: 2,
            background: 'var(--accent)',
          }}
        />
      ) : null}
      <LeaderDot doc={doc} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontFamily: OSWALD,
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '0.01em',
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {doc.contest}
        </span>
        <span
          style={{
            display: 'block',
            marginTop: 2,
            fontFamily: MONO,
            fontSize: 10.5,
            letterSpacing: '0.03em',
            color: 'var(--ink-dim)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta}
        </span>
      </span>
      {ld?.cand ? (
        <span
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 6,
            fontFamily: DISPLAY,
            fontSize: 12,
          }}
        >
          <span
            style={{
              color: 'var(--ink-mute)',
              maxWidth: 116,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lastName}
          </span>
          <span style={{ color: col, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(doc.leader.cand.percent || 0)}%
          </span>
        </span>
      ) : null}
    </button>
  )
}

export default function ElectionSearch({ open, onClose, onPick }) {
  const { theme } = useTheme()
  // Search intentionally spans every race CivicAPI returns, not just the
  // 24-race coverage gate (_data/coverage.2026-08-04) — this is the "find any
  // election" utility, not a covered-races display surface.
  const { index, error } = useElectionIndex(open)
  const [query, setQuery] = useState('')
  const dq = useDeferredValue(query)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const restoreRef = useRef(null)

  const searching = dq.trim().length > 0
  const results = useMemo(() => {
    if (!index) return []
    return searching ? searchElections(index, dq, 9) : getSuggestions(index, 6)
  }, [index, dq, searching])

  // Reset the highlight whenever the query (or open state) changes.
  useEffect(() => {
    setActive(0)
  }, [dq, open])

  // Focus the input on open; restore focus to the trigger on close.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement
      const t = setTimeout(() => inputRef.current?.focus(), 40)
      return () => clearTimeout(t)
    }
    setQuery('')
    const el = restoreRef.current
    if (el && el.focus) setTimeout(() => el.focus(), 0)
  }, [open])

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const el = list.querySelector(`[data-idx="${active}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [active, results])

  const choose = (doc) => {
    if (doc) onPick?.(doc.race)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (results.length ? (a + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(results[active])
    }
  }

  const scrim = theme === 'light' ? 'rgba(17,20,28,0.30)' : 'rgba(5,6,8,0.58)'

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="opa-es"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose?.()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '11vh 16px 24px',
            background: scrim,
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        >
          <style>{`
            .opa-es-input::placeholder { color: var(--ink-dim); }
            .opa-es-body::-webkit-scrollbar { width: 8px; }
            .opa-es-body::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
          `}</style>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search elections"
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            onKeyDown={onKeyDown}
            style={{
              width: 'min(640px, 96vw)',
              maxHeight: '72vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16,
              background: 'var(--frost-bg)',
              backdropFilter: 'blur(28px) saturate(170%)',
              WebkitBackdropFilter: 'blur(28px) saturate(170%)',
              border: '1px solid var(--rule)',
              boxShadow: 'var(--shadow-pop), inset 0 1px 0 rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            {/* search field */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '15px 16px 13px' }}>
              <SearchIcon size={20} color="var(--ink-mute)" sw={2} />
              <input
                ref={inputRef}
                className="opa-es-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any election — office, state, candidate, date…"
                spellCheck={false}
                autoComplete="off"
                role="combobox"
                aria-expanded="true"
                aria-controls="opa-es-list"
                aria-activedescendant={results.length ? `opa-es-opt-${active}` : undefined}
                aria-label="Search elections"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--ink)',
                  fontFamily: DISPLAY,
                  fontSize: 17,
                  fontWeight: 500,
                  padding: 0,
                }}
              />
              <Cap style={{ height: 18, fontSize: 10 }}>esc</Cap>
            </div>

            <div style={{ height: 1, background: 'var(--rule-soft)' }} />

            {/* body */}
            <div
              ref={listRef}
              id="opa-es-list"
              role="listbox"
              aria-label="Elections"
              className="opa-es-body"
              style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px' }}
            >
              {error ? (
                <div style={emptyStyle}>Couldn’t load the election index.</div>
              ) : !index ? (
                <div style={emptyStyle}>Loading elections…</div>
              ) : searching && results.length === 0 ? (
                <div style={emptyStyle}>
                  No elections match “{dq.trim()}”.
                </div>
              ) : (
                <>
                  <div style={labelStyle}>
                    {searching
                      ? `${results.length} result${results.length === 1 ? '' : 's'}`
                      : 'Jump to a recent contest'}
                  </div>
                  {results.map((doc, i) => (
                    <ResultRow
                      key={doc.id ?? i}
                      doc={doc}
                      idx={i}
                      active={i === active}
                      onHover={() => setActive(i)}
                      onPick={() => choose(doc)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* footer hint */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 14px',
                borderTop: '1px solid var(--rule-soft)',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...hintStyle }}>
                <Cap>↑</Cap>
                <Cap>↓</Cap>
                <span style={{ marginRight: 4 }}>navigate</span>
                <Cap>↵</Cap>
                <span style={{ marginRight: 4 }}>open</span>
                <Cap>esc</Cap>
                <span>close</span>
              </span>
              <span style={hintStyle}>
                {index ? `${index.count.toLocaleString('en-US')} elections` : ''}
              </span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

const emptyStyle = {
  padding: '40px 16px',
  textAlign: 'center',
  fontFamily: DISPLAY,
  fontSize: 14,
  color: 'var(--ink-dim)',
}
const labelStyle = {
  padding: '8px 12px 6px',
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--ink-dim)',
}
const hintStyle = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: '0.04em',
  color: 'var(--ink-dim)',
}

