import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from './lib/theme.jsx'
import {
  loadGeo,
  fetchRace,
  featuresForState,
  makeProjector,
  geomToPath,
  regionKey,
  candColor,
  leaderOf,
  tonePalette,
  regionFill,
  PARTY,
} from './electionLib.js'

// One race's choropleth — OUR county shapes (us-national.geojson),
// framed to ONLY the regions actually in the contest (a school-district
// levy shows just that county, not the whole greyed state) and recolored
// from civicAPI region_results via the hybrid palette. Lazy: nothing
// fetched until in view. Never blank — a miss degrades to a tinted
// silhouette. Visual language matches the site's frosted tooltip maps.

const VB_W = 360
const VB_H = 252
const fillForRegion = regionFill // shared with the detail MapLibre choropleth
const mapFrameStyle = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
}

export default function ResultMap({ race, inView, fit = 'contain', bare = false, whole = false, delayMs = 0 }) {
  const { P, theme } = useTheme()
  const [phase, setPhase] = useState('idle') // idle|loading|ready|fallback
  const [paths, setPaths] = useState(null)
  const [tint, setTint] = useState(PARTY.none)
  const acRef = useRef(null)

  // Deps are [inView, race.id] only — never `phase` (a setState would
  // re-run + abort itself and wedge the skeleton). Remounts are cheap:
  // geometry is memoized, race detail cached in electionLib.
  useEffect(() => {
    if (!inView) return
    let alive = true
    setPhase('loading')
    const ac = new AbortController()
    acRef.current = ac
    const load = async () => {
      try {
        const [geo, detail] = await Promise.all([
          loadGeo(),
          fetchRace(race.id, ac.signal),
        ])
        if (!alive) return
        const rr = detail?.region_results || {}
        const byKey = {}
        for (const k of Object.keys(rr)) {
          const r = rr[k]
          const kk = regionKey(race.province, r?.name || k)
          if (kk) byKey[kk] = r
        }
        // ONLY the counties actually in this race (its district/area),
        // not the whole state.
        const stateFeats = featuresForState(geo, race.province)
        const inRace = stateFeats.filter((f) => {
          const id = String(f.properties?.county_id || '')
          const nm = id.slice(id.indexOf('-') + 1).replace(/_/g, ' ')
          return byKey[regionKey(race.province, nm)]
        })
        // Race-level tone palette so per-county leader colors are
        // unique per candidate — Massie counties show gold (his tone),
        // not red, in the thumbnail.
        const rc = [...(race.candidates || [])].sort(
          (a, b) => (b.votes || 0) - (a.votes || 0)
        )
        const tones = tonePalette(rc)
        const nameToColor = {}
        rc.forEach((c, i) => {
          const k = String(c.name || '').trim().toLowerCase()
          if (k) nameToColor[k] = tones[i]
        })
        const L0 = leaderOf(race.candidates)
        const tnt = L0 && L0.cand ? (tones[0] || candColor(L0.cand)) : PARTY.none
        // `whole` frames the ENTIRE state — contested areas colored, the rest
        // a faint silhouette — so a single-county race reads as a real map
        // (state outline + one lit county) instead of a colored blob.
        if (whole && stateFeats.length) {
          const proj = makeProjector(stateFeats, VB_W, VB_H, 14)
          const out = stateFeats.map((f) => {
            const id = String(f.properties?.county_id || '')
            const nm = id.slice(id.indexOf('-') + 1).replace(/_/g, ' ')
            const region = byKey[regionKey(race.province, nm)]
            return {
              d: geomToPath(f.geometry, proj.project),
              fill: region ? fillForRegion(region, nameToColor) : P.faintFill,
              faint: !region,
            }
          })
          setPaths(out)
          setPhase('ready')
          return
        }
        if (inRace.length) {
          const proj = makeProjector(inRace, VB_W, VB_H, 14)
          const out = inRace.map((f) => {
            const id = String(f.properties?.county_id || '')
            const nm = id.slice(id.indexOf('-') + 1).replace(/_/g, ' ')
            return {
              d: geomToPath(f.geometry, proj.project),
              fill: fillForRegion(byKey[regionKey(race.province, nm)], nameToColor),
            }
          })
          setPaths(out)
          setPhase('ready')
          return
        }
        setTint(tnt)
        setPhase('fallback')
      } catch (e) {
        if (!alive || e?.name === 'AbortError') return
        const L0 = leaderOf(race.candidates)
        setTint(L0 && L0.cand ? candColor(L0.cand) : PARTY.none)
        setPhase('fallback')
      }
    }
    const delay = Math.max(0, Number(delayMs) || 0)
    const timer = delay > 0 ? window.setTimeout(load, delay) : null
    if (!timer) load()
    return () => {
      alive = false
      ac.abort()
      if (timer) window.clearTimeout(timer)
    }
  }, [inView, race?.id, theme, delayMs]) // eslint-disable-line react-hooks/exhaustive-deps

  const par = fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'

  if (phase === 'idle' || phase === 'loading') {
    return (
      <div
        className="opa-er-map opa-er-sk"
        aria-hidden
        style={{ ...mapFrameStyle, ...(bare ? { background: 'transparent' } : undefined) }}
      >
        {bare ? null : <div className="opa-er-shimmer" />}
      </div>
    )
  }

  if (phase === 'fallback') {
    return (
      <div
        className="opa-er-map"
        aria-hidden
        style={{
          ...mapFrameStyle,
          display: 'grid',
          placeItems: 'center',
          background: bare ? 'transparent' : `radial-gradient(120% 120% at 50% 42%, ${tint}1c 0%, transparent 60%), var(--page-elev)`,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ opacity: bare ? 0.22 : 0.42 }}>
          <path
            d="M3 6.5 L9 4 L15 6.5 L21 4 V17.5 L15 20 L9 17.5 L3 20 Z M9 4 V17.5 M15 6.5 V20"
            stroke={tint}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className="opa-er-map" style={{ ...mapFrameStyle, ...(bare ? { background: 'transparent' } : undefined) }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="100%"
        preserveAspectRatio={par}
        style={{ display: 'block', width: '100%', height: '100%' }}
        shapeRendering="geometricPrecision"
      >
        <g>
          {paths.map((p, i) => (
            <path
              key={i}
              d={p.d}
              fill={p.fill}
              stroke={p.faint ? P.faintStroke : P.countyStroke}
              strokeWidth={fit === 'cover' ? 0.5 : 0.7}
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
      {bare ? null : <div className="opa-er-mapvig" aria-hidden />}
    </div>
  )
}
