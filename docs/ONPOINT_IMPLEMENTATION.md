# OnPoint Politics rebrand, implementation brief

Paste this into the site update chat along with the package. The repo is the
Next.js app currently deployed as tpsielections.com. Target: onpointpolitics.com.

## What is in the package

```
onpoint-politics.html        approved mock, three views (Homepage, Site map, Brand system)
data/                        JSON the mock reads: states.json, races.json, oh tx mi ga fl county files
assets/                      logo PNGs (color, white, gold, Weighting Room gold, icon)
logos-svg/                   the v26 SVG logo files
opp-ui/SKILL.md              design system skill, install at .github/skills/opp-ui/ and delete psi-ui
opp-ui/tokens.css            CSS variables, replaces the PSI :root block in app/globals.css
opp-ui/site.css              every component style from the mock, verbatim
opp-ui/site.js               every behavior from the mock, verbatim (maps, charts, tooltip, ticker, counters)
opp-ui/components.md         component by component spec
opp-ui/maps.md               map data, ramps, interaction
opp-ui/motion.md             animation rules
next.redirects.js            redirects array for next.config
```

## Phase 1, brand and chrome (do first, touches every page)

1. `app/globals.css`: replace the PSI `:root` and body rules with `opp-ui/tokens.css`.
   Keep the alias block so old `--panel`, `--purple`, `--font-display` references still
   resolve while pages migrate. Remove the light theme sweep, the site is dark only.
2. `app/layout.tsx`: load Sora, Manrope and JetBrains Mono with `next/font/google`
   and expose them as `--font-d`, `--font-b`, `--font-m`. Remove Quantico, Geist Mono,
   JetBrains as previously wired if they differ. Drop `ThemeToggle`.
3. `public/`: add `logo-white.svg`, `logo-color.svg`, `logo-gold.png`, `icon.svg`
   from `logos-svg/` and `assets/`. Replace `app/favicon.ico` with the icon.
   Delete `public/tpsi-logo.svg` once nothing references it.
4. `app/components/Navbar.tsx`: rebuild as `.top` per `components.md`. White lockup
   inline SVG cropped to `viewBox="30 40 460 120"`, six links, Search, gold
   Weighting Room button, mobile hamburger. Keep `RESULTS_LIVE` and the `.live` dot.
   Delete `DarkNav.tsx` if it only existed for the dark variant.
5. Add `app/components/TickerBar.tsx` reading marquee races from `public/forecast/model.json`.
6. `app/components/Footer.tsx`: rebuild as `.foot`, five columns, credits line
   `© 2026 OnPoint Politics and The Public Sentiment Institute`.
7. Add `app/components/Ambient.tsx` rendering `.orbs` and `.grain` once in `layout.tsx`.
8. Global copy: replace every `TPSI Elections`, `tpsielections.com`, `The Public
   Sentiment Institute` site title with `OnPoint Politics`. TPSI stays as the pollster
   credit on releases, methodology and the footer.
9. Metadata: `metadataBase` to `https://onpointpolitics.com`, new OG image built from
   the icon on `#110019`, titles in the form `Ohio Senate forecast | OnPoint Politics`.

## Phase 2, routes and redirects

1. Add `next.redirects.js` to `next.config` (`async redirects()`), all 301 except the
   410 group which returns a `gone` page.
2. Move pages to the new tree:

| Old | New |
|---|---|
| `app/page.tsx` | keep, rebuild per Phase 3 |
| `app/polling/donaldtrumpapproval` | `app/polls/approval` |
| `app/polling/jdvanceapproval` | `app/polls/approval/vance` |
| `app/polling/genericballot` | `app/polls/generic-ballot` |
| `app/polling/rightorwrongtrack` | `app/polls/right-track` |
| `app/polling/senatepolling` | `app/polls/senate` |
| `app/polling/governorpolling` | `app/polls/governor` |
| `app/polling/2028polling` | `app/polls/2028` |
| `app/polling/floridarepublicanprimary` etc | `app/polls/[state]/[race]` with a race registry |
| `app/polling/{st}2024president` | `app/polls/archive/2024/[state]` |
| `app/forecast` + `app/forecastratings` | `app/forecast` (one page, tabs Senate House Governor) |
| new | `app/forecast/[state]/[race]` race page, county map + side panel from the mock |
| `app/electoralmap` | `app/maps/electoral` |
| `app/partymap` | `app/maps/party-registration` |
| `app/earlyvote` | `app/maps/early-vote` |
| `app/results/tonight` | `app/results/live` |
| `app/results/onpoint` | `app/results` (becomes the default engine) |
| `app/tpsipoll`, `app/latestpoll` | `app/tpsi/polls` |
| `app/goldstandard` | `app/tpsi/methodology` |
| `app/situationroom` | `app/tpsi/situation-room` |
| `app/SMSOptIn` | `app/tpsi/sms` |
| `app/TermsAndConditions` | `app/terms` |
| `app/v2`, `app/polling/old` | delete |
| `app/portal`, `app/contact`, `app/api` | unchanged |

3. New `app/api/polls/[avg]/route.ts` returning `{ avg, updated, series, polls }` JSON
   for each tracked average, so outlets can cite the number.

## Phase 3, home page

Rebuild `app/page.tsx` to the mock's Homepage view, section by section. Data wiring:

| Section | Component | Data |
|---|---|---|
| Hero KPI stack | `HeroKpis.tsx` | `app/polling/lib/homeStats.ts` (approval, generic), `model.json.chambers` (control odds) |
| US forecast map | `ForecastMap.tsx` | `US_STATE_PATHS` + `model.json.races` for margins, office toggle |
| Seat histogram + closest races | `SeatHistogram.tsx`, `ClosestRaces.tsx` | `model.json.chambers[office]`, races sorted by `abs(stages.rate)` |
| County simulation | `CountySim.tsx` | `public/forecast/states/{ST}.json` + `counties.json[raceId]` |
| Polling averages | `AveragePanel.tsx` x2 | `buildDailyModel` series + `RAW_POLLS`, LOWESS line from `lowessTrend.ts` |
| Results desk | `ResultCard.tsx` x2 + `Countdown.tsx` | `results/_data` latest nights |
| TPSI releases | `StoryCard.tsx` x4 | release registry, mini county maps reuse `CountySim` at 320x180 |
| CTA band | `CtaBand.tsx` | static |

The JS in `opp-ui/site.js` is the reference for every calculation (rating bands,
county color mixing, histogram coloring, tooltip content, count up easing). Port
it into hooks rather than re-deriving it.

## Phase 4, inner pages

Apply the same chrome and cards to the polling average pages, forecast race page,
results pages and TPSI release page. The first version of the mock (artifact
version 1) has light theme layouts for these four templates; use their structure
with the dark tokens: crumbs, h1, meta row, `1fr 320px` layout, chart card,
poll table with the pinned average row, side panel cards, methodology callout.

## Rules the reviewer will check

- No gradient on data, tables, borders or party colors. Gradient only on one
  headline word, one primary button and the orbs.
- Blue means Democrat, red means Republican, lavender means independent.
  Shading is pale for close and deep for solid everywhere.
- Gold only for The Weighting Room, toss up and CTA eyebrows.
- Sora for headlines and big numbers, Manrope for body, JetBrains Mono for
  anything tabular, with `tabular-nums`.
- Glass cards only. No solid panel backgrounds, no inset gradient top borders,
  no fade up animation on static content.
- Uppercase only on eyebrows and mono labels.
- Every route follows the pattern, never a new route name per race.
- Old URLs 301 to the new ones and the approval tracker embed keeps working.
