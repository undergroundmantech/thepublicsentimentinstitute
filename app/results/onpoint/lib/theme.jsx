import React, { createContext, useContext } from 'react'

// ── Theme ────────────────────────────────────────────────────────────────
// The OnPoint Politics results desk is dark only. This module keeps its old
// API (ThemeProvider, useTheme, PALETTES, tripToggleTheme) so every consumer
// keeps working, but there is exactly one palette and no toggle. It only
// carries the hex values that color MATH needs (mix()/shade()/choropleth
// fills parse hex and cannot read var(--x)); everything else uses the site
// tokens from app/globals.css.

const DARK = {
  page: '#0a0711', pageElev: '#140e1d', card: '#120c1b', cardBd: 'rgba(255,255,255,0.09)',
  ink: '#f3eff8', inkStrong: '#ffffff',
  // UI accent is ink, never a party color and never gold
  accent: '#f3eff8',
  approve: '#3ddc97', disapprove: '#8e86a3', dem: '#3d7bff', gop: '#ff3b5c',
  yes: '#3ddc97', no: '#8e86a3',
  // electionLib shade(): low-margin counties mix toward this base
  shadeBase: '#1c1626',
  faintFill: 'rgba(255,255,255,0.045)', faintStroke: 'rgba(255,255,255,0.10)',
  countyStroke: 'rgba(10,7,17,0.7)',
  // ResultCard strip foreground target (accent mixed toward this)
  stripFgTarget: '#ffffff',
  // nonpartisan cycle: ink tones only, party hues stay reserved for parties
  set: ['#f3eff8', '#c9c2d6', '#8e86a3', '#5f5873'],
  mute: '#8e86a3',
}

// `light` is kept as an alias so any stale reference resolves to the one palette.
export const PALETTES = { dark: DARK, light: DARK }

const VALUE = { theme: 'dark', toggle: () => {}, setTheme: () => {}, P: DARK }
const ThemeCtx = createContext(VALUE)

export function ThemeProvider({ children }) {
  return <ThemeCtx.Provider value={VALUE}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

// There is no theme to flip. Kept so older callers compile; it only runs the
// optional callback with the one theme there is.
export function tripToggleTheme({ onAfterSwap } = {}) {
  try { onAfterSwap && onAfterSwap('dark') } catch {}
}
