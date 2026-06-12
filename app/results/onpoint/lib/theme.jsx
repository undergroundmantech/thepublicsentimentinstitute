import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// ── Theme ────────────────────────────────────────────────────────────────
// The election section is dark-first; light mode is a first-class toggle.
// Almost all styling flips automatically through CSS variables keyed on
// <html data-opa-theme> — a SEPARATE attribute from the main site's
// data-theme, so toggling here never changes the rest of the TPSI site (and
// vice-versa). THIS file only carries the hex palettes that color MATH
// needs — mix()/shade()/choropleth fills parse hex and can't read var(--x).
// Components doing such math call useTheme() and read `P`; everything else just
// uses the CSS vars and never needs this hook.

export const PALETTES = {
  dark: {
    page: '#0a0b0d', pageElev: '#15171c', card: '#0d1117', cardBd: '#1c2230',
    ink: '#f1ece1', inkStrong: '#ffffff',
    accent: '#d4a73b',
    approve: '#34c4ad', disapprove: '#d4a73b', dem: '#1d4ed8', gop: '#dc2626',
    yes: '#57a07b', no: '#cf6a64',
    // electionLib shade(): low-margin counties mix toward this base
    shadeBase: '#15171c',
    faintFill: 'rgba(255,255,255,0.045)', faintStroke: 'rgba(255,255,255,0.10)',
    countyStroke: 'rgba(8,9,12,0.6)',
    // ResultCard strip foreground target (accent mixed toward this)
    stripFgTarget: '#ffffff',
    // calendar non-partisan cycle + same-party mute target
    set: ['#a779ff', '#f0894a', '#5ab6c4', '#e5859c'],
    mute: '#aeb4c0',
  },
  light: {
    page: '#ffffff', pageElev: '#f4f5f7', card: '#ffffff', cardBd: 'rgba(0,0,0,0.12)',
    ink: '#16181d', inkStrong: '#0a0b0d',
    accent: '#a8791f',
    approve: '#0f9b87', disapprove: '#b8860b', dem: '#1d4ed8', gop: '#c81e1e',
    yes: '#2f7d54', no: '#c0453f',
    shadeBase: '#eef1f4',
    faintFill: 'rgba(0,0,0,0.05)', faintStroke: 'rgba(0,0,0,0.14)',
    countyStroke: 'rgba(255,255,255,0.75)',
    stripFgTarget: '#0b0c0e',
    set: ['#7a4fd0', '#c25f1e', '#2f8c9c', '#bd4f70'],
    mute: '#8a8f99',
  },
}

const ThemeCtx = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {}, P: PALETTES.dark })

function readInitial() {
  // Read the election section's OWN attribute — NOT the global data-theme that
  // the rest of the TPSI site owns. This keeps the two theme worlds independent.
  if (typeof document !== 'undefined' && document.documentElement.dataset.opaTheme) {
    return document.documentElement.dataset.opaTheme === 'light' ? 'light' : 'dark'
  }
  try {
    const t = localStorage.getItem('opa-theme')
    if (t === 'light' || t === 'dark') return t
  } catch {}
  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitial)
  useEffect(() => {
    // Scope the flip to the election section's OWN attribute so it never
    // touches the main site's <html data-theme>. color-scheme is handled via
    // CSS on body:has(.opa-results-shell) (auto-reverts when you leave the
    // results page) rather than on <html>, so it can't leak dark scrollbars /
    // form controls onto the rest of the site.
    document.documentElement.dataset.opaTheme = theme
    try { localStorage.setItem('opa-theme', theme) } catch {}
  }, [theme])
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = { theme, toggle, setTheme, P: PALETTES[theme] || PALETTES.dark }
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

// ── Shared "trip" toggle helper ────────────────────────────────────────
// Both the hub nav (ThemeToggle in ProjectsHub) and RaceDetail's chrome
// flip the theme through this single helper so the diagonal sweep stays
// identical no matter where the user taps. Pass the current theme + the
// React `toggle()` callback. Optional `onAfterSwap` runs synchronously
// inside the View Transitions callback AFTER the DOM is mutated — used
// by RaceDetail to mirror the new theme into its iframe before the new
// snapshot is captured.
export function tripToggleTheme({ theme, toggle, onAfterSwap }) {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    try { onAfterSwap && onAfterSwap(theme === 'dark' ? 'light' : 'dark') } catch {}
    toggle()
    return
  }
  const next = theme === 'dark' ? 'light' : 'dark'
  document.startViewTransition(() => {
    // Apply the new theme up front so the post-callback snapshot has it.
    document.documentElement.dataset.opaTheme = next
    try { localStorage.setItem('opa-theme', next) } catch {}
    try { onAfterSwap && onAfterSwap(next) } catch {}
    toggle()
  })
}
