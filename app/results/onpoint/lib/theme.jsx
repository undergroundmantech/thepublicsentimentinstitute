import React, { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { THEME_EVENT, getTheme, toggleTheme, setTheme } from '../../../lib/theme'

// ── Theme ────────────────────────────────────────────────────────────────
// Follows the site theme (<html data-theme>, owned by app/lib/theme.ts and the
// masthead toggle). This module only carries the hex values that color MATH
// needs (mix()/shade()/choropleth fills parse hex and cannot read var(--x));
// everything else uses the site tokens from app/globals.css.

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

const LIGHT = {
  page: '#f5f3fa', pageElev: '#ffffff', card: '#ffffff', cardBd: 'rgba(17,0,25,0.10)',
  ink: '#16092a', inkStrong: '#110019',
  accent: '#16092a',
  approve: '#0f9d63', disapprove: '#6a6180', dem: '#2a63f0', gop: '#e8264b',
  yes: '#0f9d63', no: '#6a6180',
  shadeBase: '#e6e1f0',
  faintFill: 'rgba(17,0,25,0.04)', faintStroke: 'rgba(17,0,25,0.10)',
  countyStroke: 'rgba(245,243,250,0.8)',
  stripFgTarget: '#110019',
  set: ['#16092a', '#463d5a', '#6a6180', '#9b93ad'],
  mute: '#6a6180',
}

export const PALETTES = { dark: DARK, light: LIGHT }

const subscribe = (cb) => {
  window.addEventListener(THEME_EVENT, cb)
  return () => window.removeEventListener(THEME_EVENT, cb)
}

function makeValue(theme) {
  return { theme, toggle: toggleTheme, setTheme, P: PALETTES[theme] }
}
const VALUES = { dark: makeValue('dark'), light: makeValue('light') }
const ThemeCtx = createContext(VALUES.dark)

export function ThemeProvider({ children }) {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark')
  const value = useMemo(() => VALUES[theme], [theme])
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>
}

export const useTheme = () => useContext(ThemeCtx)

// Flip the site theme, then run the optional callback with the new value.
export function tripToggleTheme({ onAfterSwap } = {}) {
  const next = toggleTheme()
  try { onAfterSwap && onAfterSwap(next) } catch {}
}
