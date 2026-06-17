// ─────────────────────────────────────────────────────────────────────────────
// PSI Race Configuration — tiering, forecast defaults, color overrides
//
// TIERS
//   spotlight  — marquee races; shown in a dedicated hero section with full
//                forecast bars, win probability, and polling priors
//   forecast   — races with polling models; shown in the main grid with win-
//                probability bars and expected-turnout annotations
//   featured   — all races we curate, track, and archive; shown in main grid
//                without forecast chrome (vote totals + projection only)
//
// Races not listed here are "other" — raw CivicAPI results we surface in a
// collapsible "All races" section but do not archive or maintain.
//
// RACE_FORECAST_DEFAULTS ported from main branch results/page.tsx.
// To add new races: add an entry to RACE_TIERS + RACE_FORECAST_DEFAULTS.
// ─────────────────────────────────────────────────────────────────────────────

// ── Race tiers ────────────────────────────────────────────────────────────────
// 'spotlight' | 'forecast' | 'featured'
// Anything not listed defaults to 'other'.
export const RACE_TIERS = {
  // ── MAY 26, 2026 — Texas Runoffs ─────────────────────────────────────────
  79766: 'spotlight',  // TX US Senate R Runoff
  79722: 'featured',   // TX AG R Runoff
  79736: 'featured',   // TX Lt Gov D Runoff
  79739: 'featured',   // TX Railroad Commissioner R Runoff
  79755: 'featured',   // TX US House 18 D Runoff

  // ── JUNE 2, 2026 ─────────────────────────────────────────────────────────
  79777: 'spotlight',  // CA Governor Open Primary
  79938: 'spotlight',  // Los Angeles Mayor Open Primary
  79893: 'featured',   // CA US House 1
  79932: 'featured',   // CA US House 7
  79884: 'featured',   // CA US House 11
  79916: 'forecast',   // CA US House 40
  79924: 'forecast',   // CA US House 48
  79945: 'spotlight',  // IA Governor R
  80210: 'forecast',   // IA US Senate D
  80211: 'forecast',   // IA US Senate R
  80204: 'featured',   // IA US House 2 D
  80205: 'featured',   // IA US House 2 R
  80458: 'featured',   // MT US Senate D
  80460: 'featured',   // MT US Senate R
  80452: 'featured',   // MT US House 1 D
  80454: 'featured',   // MT US House 1 R
  80455: 'featured',   // MT US House 2 D
  80457: 'featured',   // MT US House 2 R
  81057: 'spotlight',  // NJ US Senate D
  81058: 'spotlight',  // NJ US Senate R
  81046: 'forecast',   // NJ US House 7 D
  81047: 'featured',   // NJ US House 7 R
  81048: 'featured',   // NJ US House 8 D
  81055: 'featured',   // NJ US House 12 D
  81056: 'featured',   // NJ US House 12 R
  81014: 'spotlight',  // NM US Senate D
  81015: 'spotlight',  // NM US Senate R
  80461: 'spotlight',  // SD Governor R
  80511: 'featured',   // SD US House At-Large R
  80512: 'spotlight',  // SD US Senate R

  // ── JUNE 9, 2026 ─────────────────────────────────────────────────────────
  82664: 'spotlight',  // SC US Senate R
  82596: 'spotlight',  // SC Governor R
  82663: 'spotlight',  // SC US Senate D
  82595: 'spotlight',  // SC Governor D
  82594: 'featured',   // SC Comptroller General D
  82597: 'featured',   // SC Secretary of State D
  82592: 'featured',   // SC AG R
  82654: 'featured',   // SC US House 1 D
  82655: 'featured',   // SC US House 1 R
  82657: 'featured',   // SC US House 2 R
  82662: 'featured',   // SC US House 6 R
  83063: 'spotlight',  // ME US Senate D
  82693: 'spotlight',  // ME Governor D
  82694: 'spotlight',  // ME Governor R
  83061: 'featured',   // ME US House 2 D
  83111: 'spotlight',  // NV Governor R
  83110: 'spotlight',  // NV Governor D
  83081: 'forecast',   // NV AG R
  83080: 'forecast',   // NV AG D
  83112: 'featured',   // NV Lt Gov D
  83113: 'featured',   // NV Secretary of State R
  83150: 'featured',   // NV US House 1 R
  83149: 'featured',   // NV US House 1 D
  82403: 'spotlight',  // ND US House At-Large R
  82384: 'featured',   // ND Public Service Commissioner R

  // ── JUNE 16, 2026 ─────────────────────────────────────────────────────────
  // Georgia
  83316: 'spotlight',  // GA US Senate R Runoff
  83266: 'spotlight',  // GA Governor R Runoff
  83277: 'featured',   // GA Lt Gov R Runoff
  83276: 'featured',   // GA Lt Gov D Runoff
  83289: 'featured',   // GA Secretary of State R Runoff
  83288: 'featured',   // GA Secretary of State D Runoff
  83312: 'featured',   // GA US House 11 R Runoff
  83313: 'featured',   // GA US House 12 D Runoff
  83314: 'featured',   // GA US House 1 D Runoff
  83315: 'featured',   // GA US House 7 D Runoff
  // Alabama
  83428: 'spotlight',  // AL US Senate R Runoff
  83427: 'forecast',   // AL US Senate D Runoff
  83430: 'featured',   // AL Lt Gov R Runoff
  83431: 'featured',   // AL AG R Runoff
  // Oklahoma
  83476: 'spotlight',  // OK State Question 832 — $15 Minimum Wage
  83424: 'forecast',   // OK US Senate R
  83423: 'forecast',   // OK US Senate D
  83344: 'forecast',   // OK Governor R
  83343: 'forecast',   // OK Governor D
  83415: 'featured',   // OK US House 1 R
  // Washington DC
  83478: 'featured',   // DC US House Delegate D
  83479: 'spotlight',  // DC Mayor D
}

// ── Forecast defaults ─────────────────────────────────────────────────────────
// raceRule: PLURALITY | MAJORITY | TOP_TWO | THRESHOLD_35_RUNOFF | THRESHOLD_35_CONVENTION
// pollAvg: { "Candidate surname": number (%) }
// expectedTurnout: number (estimated total votes)
// overrideReporting: number (0–100 override for percent_reporting)
// manualCall: "Candidate name" (forces a winner regardless of API)
// colorOverrides: { "surname": "#hex" }
// turnoutBlendK: number (how much to trust poll priors when turnout is uncertain)
export const RACE_FORECAST_DEFAULTS = {
  // ── CALIFORNIA (JUNE 2) ───────────────────────────────────────────────────
  79777: { raceRule: 'TOP_TWO', expectedTurnout: 9_500_000, pollAvg: { 'Becerra': 29.0, 'Steyer': 22.0, 'Hilton': 25.0, 'Bianco': 10.0 }, overrideReporting: 90.9, turnoutBlendK: 2 }, // CA Governor
  79893: { raceRule: 'TOP_TWO', overrideReporting: 0 },         // CA US House 1
  79932: { raceRule: 'TOP_TWO', overrideReporting: 0 },         // CA US House 7
  79884: { raceRule: 'TOP_TWO', overrideReporting: 0 },         // CA US House 11
  79916: { raceRule: 'TOP_TWO', expectedTurnout: 225_000, pollAvg: { 'Calvert': 32.0, 'Kim': 18.0, 'Kin-Varet': 15.0, 'Ramirez': 10.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // CA US House 40
  79924: { raceRule: 'TOP_TWO', expectedTurnout: 287_500, pollAvg: { 'Desmond': 28.5, 'Campa-Najjar': 17.5, 'von Wilpert': 14.0, 'Riker': 9.0, "O'Neil": 8.5, 'Chavez': 6.5, 'Contreras': 4.5, 'Schaefer': 3.5, 'Shaw': 2.5, 'Porter': 2.0, 'Clemons': 1.5, 'Reyna': 1.5 }, overrideReporting: 0, turnoutBlendK: 2 }, // CA US House 48

  // ── IOWA (JUNE 2) ─────────────────────────────────────────────────────────
  79945: { raceRule: 'THRESHOLD_35_CONVENTION', expectedTurnout: 210_000, pollAvg: { 'Feenstra': 52.0, 'Lahn': 38.0, 'Steen': 10.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // IA Governor R
  80204: { raceRule: 'THRESHOLD_35_CONVENTION', overrideReporting: 0 }, // IA US House 2 D
  80205: { raceRule: 'THRESHOLD_35_CONVENTION', overrideReporting: 0 }, // IA US House 2 R
  80210: { raceRule: 'THRESHOLD_35_CONVENTION', expectedTurnout: 122_000, pollAvg: { 'Turek': 65.0, 'Wahls': 32.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // IA US Senate D
  80211: { raceRule: 'THRESHOLD_35_CONVENTION', overrideReporting: 0 }, // IA US Senate R

  // ── NEW JERSEY (JUNE 2) ───────────────────────────────────────────────────
  81046: { raceRule: 'PLURALITY', expectedTurnout: 57_500, pollAvg: { 'Bennett': 62.0 }, overrideReporting: 0, turnoutBlendK: 2 }, // NJ-07 D

  // ── SOUTH DAKOTA (JUNE 2) ─────────────────────────────────────────────────
  80461: { raceRule: 'THRESHOLD_35_RUNOFF', overrideReporting: 99.9 }, // SD Governor R
  80511: { raceRule: 'THRESHOLD_35_RUNOFF', overrideReporting: 99.9 }, // SD US House At-Large R
  80512: { raceRule: 'THRESHOLD_35_RUNOFF', overrideReporting: 99.9 }, // SD US Senate R

  // ── NEW MEXICO (JUNE 2) ───────────────────────────────────────────────────
  81014: { raceRule: 'PLURALITY', overrideReporting: 99.9, pollsCloseIso: '2026-06-02T21:00:00-04:00', manualCall: 'Ben Luján' }, // NM US Senate D
  81015: { raceRule: 'PLURALITY', overrideReporting: 0, pollsCloseIso: '2026-06-02T21:00:00-04:00' },  // NM US Senate R

  // ── SOUTH CAROLINA (JUNE 9) ───────────────────────────────────────────────
  82664: { raceRule: 'MAJORITY', expectedTurnout: 400_000, pollAvg: { 'Graham': 51.0, 'Lynch': 26.4, 'Dismukes': 6.6, 'Herrmann': 5.4, 'Mitchell': 4.2, 'Cowen': 2.0 } }, // SC US Senate R
  82596: { raceRule: 'MAJORITY', expectedTurnout: 380_000, pollAvg: { 'Mace': 15.0, 'Evette': 24.9, 'Norman': 17.2, 'Reddy': 16.4, 'Wilson': 21.0 } }, // SC Governor R
  82663: { raceRule: 'MAJORITY', expectedTurnout: 130_000, pollAvg: { 'Andrews': 62.0, 'Brown': 24.0, 'Bruce': 8.0, 'Freeman': 4.0, 'Giracello': 2.0 } }, // SC US Senate D
  82595: { raceRule: 'MAJORITY', expectedTurnout: 110_000, pollAvg: { 'Johnson': 40.0, 'Webster': 33.0, 'McLeod': 18.0, 'Bennett': 9.0 } }, // SC Governor D
  82594: { raceRule: 'MAJORITY', expectedTurnout: 95_000 },    // SC Comptroller D
  82597: { raceRule: 'MAJORITY', expectedTurnout: 95_000 },    // SC Secretary of State D
  82592: { raceRule: 'MAJORITY', expectedTurnout: 340_000 },   // SC AG R
  82654: { raceRule: 'MAJORITY', expectedTurnout: 40_000 },    // SC US House 1 D
  82655: { raceRule: 'MAJORITY', expectedTurnout: 85_000 },    // SC US House 1 R
  82657: { raceRule: 'MAJORITY', expectedTurnout: 75_000 },    // SC US House 2 R
  82662: { raceRule: 'MAJORITY', expectedTurnout: 70_000 },    // SC US House 6 R

  // ── MAINE (JUNE 9) ────────────────────────────────────────────────────────
  83063: { raceRule: 'PLURALITY', expectedTurnout: 200_000, pollAvg: { 'Platner': 66.0, 'Mills': 20.0, 'Costello': 4.0 } }, // ME US Senate D
  82693: { raceRule: 'PLURALITY', expectedTurnout: 210_000, pollAvg: { 'Shah': 29.0, 'Jackson': 28.0, 'King': 14.0, 'Pingree': 12.0, 'Bellows': 11.0 } }, // ME Governor D
  82694: { raceRule: 'PLURALITY', expectedTurnout: 160_000, pollAvg: { 'Charles': 36.0, 'Bush': 20.0, 'Mason': 13.0, 'Midgley': 11.0, 'Jones': 7.0, 'Wessels': 1.0 } }, // ME Governor R
  83061: { raceRule: 'PLURALITY', expectedTurnout: 55_000 },   // ME US House 2 D

  // ── NEVADA (JUNE 9) ───────────────────────────────────────────────────────
  83111: { raceRule: 'PLURALITY', expectedTurnout: 165_000, pollAvg: { 'Lombardo': 78.0, 'Hansen': 12.0, 'Winterhawk': 6.0 } }, // NV Governor R
  83110: { raceRule: 'PLURALITY', expectedTurnout: 155_000, pollAvg: { 'Ford': 68.0, 'Hill': 22.0, 'Other': 10.0 } }, // NV Governor D
  83081: { raceRule: 'PLURALITY', expectedTurnout: 155_000 },  // NV AG R
  83080: { raceRule: 'PLURALITY', expectedTurnout: 145_000 },  // NV AG D
  83112: { raceRule: 'PLURALITY', expectedTurnout: 140_000 },  // NV Lt Gov D
  83113: { raceRule: 'PLURALITY', expectedTurnout: 150_000 },  // NV Secretary of State R
  83150: { raceRule: 'PLURALITY', expectedTurnout: 50_000 },   // NV US House 1 R
  83149: { raceRule: 'PLURALITY', expectedTurnout: 55_000 },   // NV US House 1 D

  // ── NORTH DAKOTA (JUNE 9) ─────────────────────────────────────────────────
  82403: { raceRule: 'PLURALITY', expectedTurnout: 120_000 },  // ND US House At-Large R
  82384: { raceRule: 'PLURALITY', expectedTurnout: 100_000 },  // ND Public Service Commissioner R

  // ── GEORGIA (JUNE 16) — runoffs use PLURALITY (top-2, winner-take-all) ────
  83316: { raceRule: 'PLURALITY', expectedTurnout: 400_000, pollAvg: { 'Collins': 58.0, 'Dooley': 42.0 }, pollsCloseIso: '2026-06-16T19:00:00-04:00', turnoutBlendK: 2 }, // GA US Senate R Runoff
  83266: { raceRule: 'PLURALITY', expectedTurnout: 380_000, pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA Governor R Runoff
  83277: { raceRule: 'PLURALITY', expectedTurnout: 350_000, pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA Lt Gov R Runoff
  83276: { raceRule: 'PLURALITY', expectedTurnout: 120_000, pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA Lt Gov D Runoff
  83289: { raceRule: 'PLURALITY', expectedTurnout: 350_000, pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA SoS R Runoff
  83288: { raceRule: 'PLURALITY', expectedTurnout: 120_000, pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA SoS D Runoff
  83312: { raceRule: 'PLURALITY', expectedTurnout: 65_000,  pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA US House 11 R Runoff
  83313: { raceRule: 'PLURALITY', expectedTurnout: 40_000,  pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA US House 12 D Runoff
  83314: { raceRule: 'PLURALITY', expectedTurnout: 35_000,  pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA US House 1 D Runoff
  83315: { raceRule: 'PLURALITY', expectedTurnout: 45_000,  pollsCloseIso: '2026-06-16T19:00:00-04:00' }, // GA US House 7 D Runoff

  // ── ALABAMA (JUNE 16) ────────────────────────────────────────────────────
  83428: { raceRule: 'PLURALITY', expectedTurnout: 400_000, pollAvg: { 'Moore': 51.0, 'Hudson': 49.0 }, pollsCloseIso: '2026-06-16T20:00:00-04:00', turnoutBlendK: 2 }, // AL US Senate R Runoff
  83427: { raceRule: 'PLURALITY', expectedTurnout: 100_000, pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // AL US Senate D Runoff
  83430: { raceRule: 'PLURALITY', expectedTurnout: 350_000, pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // AL Lt Gov R Runoff
  83431: { raceRule: 'PLURALITY', expectedTurnout: 350_000, pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // AL AG R Runoff

  // ── OKLAHOMA (JUNE 16) ───────────────────────────────────────────────────
  83476: { raceRule: 'PLURALITY', expectedTurnout: 225_000, pollAvg: { 'Yes': 54.0, 'No': 46.0 }, pollsCloseIso: '2026-06-16T20:00:00-04:00', turnoutBlendK: 2 }, // OK SQ 832
  83424: { raceRule: 'PLURALITY', expectedTurnout: 280_000, pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // OK US Senate R
  83423: { raceRule: 'PLURALITY', expectedTurnout: 85_000,  pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // OK US Senate D
  83344: { raceRule: 'PLURALITY', expectedTurnout: 280_000, pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // OK Governor R
  83343: { raceRule: 'PLURALITY', expectedTurnout: 85_000,  pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // OK Governor D
  83415: { raceRule: 'PLURALITY', expectedTurnout: 65_000,  pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // OK US House 1 R

  // ── WASHINGTON DC (JUNE 16) ──────────────────────────────────────────────
  83479: { raceRule: 'PLURALITY', expectedTurnout: 87_500, pollAvg: { 'George': 43.0, 'McDuffie': 38.0 }, pollsCloseIso: '2026-06-16T20:00:00-04:00', turnoutBlendK: 2 }, // DC Mayor D
  83478: { raceRule: 'PLURALITY', expectedTurnout: 75_000,  pollsCloseIso: '2026-06-16T20:00:00-04:00' }, // DC US House Delegate D
}

// ── Helper: get tier for a race by CivicAPI race id ──────────────────────────
// Returns 'spotlight' | 'forecast' | 'featured' | 'other'
export function getRaceTier(id) {
  const numId = Number(id)
  if (!numId) return 'other'
  return RACE_TIERS[numId] || (RACE_FORECAST_DEFAULTS[numId] ? 'forecast' : 'other')
}

// ── Helper: get forecast config for a race ────────────────────────────────────
export function getForecastDefaults(id) {
  return RACE_FORECAST_DEFAULTS[Number(id)] || null
}

// ── Tier display config ───────────────────────────────────────────────────────
export const TIER_LABELS = {
  spotlight: 'Spotlight Races',
  forecast:  'Forecast Races',
  featured:  'Featured Races',
  other:     'All Other Races',
}

export const TIER_ORDER = ['spotlight', 'forecast', 'featured', 'other']
