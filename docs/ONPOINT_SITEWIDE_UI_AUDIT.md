# OnPoint Politics: site-wide UI/UX audit (Phase 1)

| | |
|---|---|
| Date | 2026-10-28 |
| Branch | `ui/site-audit`, created from `origin/main` at `3d67d59a` |
| Scope | Audit and documentation only. No application code was changed. |
| Companion | [ONPOINT_FABLE_DESIGN_BRIEF.md](ONPOINT_FABLE_DESIGN_BRIEF.md) |
| Protected | `feature/election-night-intelligence-v1` at `0559aad3`. It was not merged, rebased or modified. |

## How the evidence was gathered

- **Visual (verified).** One production build was run (`next build --webpack`, exit 0, 4,539 static pages). It was served locally with `next start`. Screenshots were captured with headless Chromium over CDP (`chrome-headless-shell`; no new tooling was installed). The capture covered 22 route folders: 21 routes at 390 px and 1280 px, plus the 404 page at 390 px. Six key routes were captured at all five widths (390, 768, 1024, 1280 and 1440 px), and 7 routes were also captured in light theme at 390 px and 1280 px. That is 77 captures in total.
- **Measured (verified).** After hydration, a script ran on every capture and recorded the document `scrollWidth`, the elements overflowing the viewport, h1 count, unnamed buttons and links, unlabeled large SVGs and canvases, touch targets under 24 px, text under 10.5 px, the number of mascot nodes, and console errors. The raw data is in [audit-screenshots/report.json](audit-screenshots/report.json).
- **Code inspection (not visual).** This covered the tokens, theme infrastructure, components, accessibility markup and the diff against the intelligence branch. Findings that come only from code are marked **[code]**.
- **Limits.**
  - Pages were rendered with live data as of Oct 27 and Oct 28. There were no live returns, so the election-night states of the results pages were not exercised visually.
  - `/portal/*` requires authentication and was not captured.
  - Interaction states (open menus, hovers and focus order) were inspected in code, not captured.
  - Contrast ratios were judged from screenshots and token values, not measured with a tool.

---

## 1. Executive design assessment

OnPoint Politics already has a recognizable identity and several best-in-class experiences. The strongest are:

- the results command center (`/results/monitor`);
- the forecast race pages, with their county explorer, simulation histogram and 80 percent ranges;
- the reported-vs-projected discipline in `RaceDesk`;
- a well-built phone layer (tab bar, a masthead that hides on scroll, touch-target pass);
- a single menu definition that drives the masthead, the phone menu and the footer.

The weaknesses are structural, not cosmetic.

1. **There is no professional mode yet.** Pointy, the mascot, renders on every captured route. The global footer and the global video promo account for the 2 mascot nodes on each page. The homepage has 14 nodes, the forecast race page 6, and the polling race page 6. The default experience is effectively today's "Themed" mode.
2. **The design system is shared in name only.**
   - The global tokens live in `globals.css`. But results boards override them with a different palette (`.desk`: teal for live, `#3b7bde` for Democrats).
   - Race History brings its own palette (`#5b8fff`), and the forecast hero uses inline hex values (`#7fa6ff`, `#ff8399`).
   - There are 3,933 color literals in 158 TSX files, 2,589 inline `style={{}}` objects, and around 60 per-family CSS files totaling 8,328 lines.
3. **The masthead fails at the most common laptop width.** At 1280 px, every route scrolls sideways (document width 1426 px), and The Weighting Room button is clipped.
4. **Reported and modeled values are not separated consistently.** `RaceDesk` gets it right. The dated results boards use the same ✓ "wins" winner band for an official call and for an On Point Polling projection.

**Recommendation.** Do not redesign page by page. Do the work in this order:

1. Consolidate tokens and the appearance mechanism.
2. Rebuild the masthead.
3. Define the shared component set.
4. Migrate families onto it, starting with results and forecast.

All the mathematics and data contracts can stay exactly as they are. The work is a presentation layer on top.

---

## 2. Route-family inventory

There are 149 `page.tsx` routes. The main families:

| Family | Representative routes | Own CSS / visual system | Captured |
|---|---|---|---|
| Home | `/` | `components/home/home2.css`, `home-deck.css`, `pointy.css`, three.js globe | yes, 5 widths + light |
| Results | `/results`, `/results/monitor`, `/results/tonight`, `/results/2026`, `/results/2026/[id]`, `/results/race/[id]`, `/results/civic/[id]`, `/results/local`, `/results/forecast`, `/results/archive/*`, dated boards (`2026-08-18`, `2026-08-25`) | `monitor.css`, `.desk` token override, `deskCss.ts`, large inline CSS strings (`ResultsDesk`, `ResultsV1`, `NightDesk`, `FloridaBoard`, `OklahomaBoard`) | monitor, hub, tonight, 2026, OK runoff |
| Forecast | `/forecast`, `/forecast/[state]/[race]`, `/forecast/statewide/*`, `/forecast/legislatures/*`, `/forecast/measures/*`, `/forecast/donors/*`, `/forecast/methodology`, `/forecast/changelog`, `/forecast/other` | `console.css`, `hub.css`, `scenarios.css`, `legislatures.css`, `donors.css`, inline `STORY_CSS` / `FX_CSS` | console, race (`/forecast/ks/senate`), statewide |
| Polling | `/polls`, `/polls/[state]/[race]`, `/polls/generic-ballot`, `/polls/approval`, the timelines, `/polls/2028`, `/polls/archive/2024/*`, legacy `/_polling/*` | `timeline.css`, `studio.css`, `polltrail.css`, legacy `whiteboard.css` / `polls2.css` | hub, generic ballot, TX Senate |
| On Point Polling | `/on-point-polling/*` (releases, situation room, weighting room, SMS, services, methodology) | `pollroom.css`, `pollmap.css` | TX release |
| Interactive tools | `/play`, `/forecast/swingometer`, `/forecast/what-if`, `/swingometer`, `/what-if`, `/maps/*` | `play.css` (pixel fonts), `swing.css`, `whatif.css`, `electoral.css`, `evconsole.css` (686 lines) | play (5 widths + light), swingometer, what-if, electoral, early vote |
| Watchdog | `/watchdog/*` (about 35 routes: ledger, war room, people, money, connections) | `watchdog.css`, `terminal.css`, `light.gen.css` (generated light theme, 546 lines), `warroom.css`, `connections.css` | hub |
| News | `/news`, `/news/story/[id]`, `/news/sources` | `news.css`, `paper.css` | hub |
| Accountability, Brasil | `/accountability/*`, `/brasil/*` | `accountability.css`, `brasil.css` | not captured (secondary) |
| Utility | `/search`, `/contact`, `/terms`, `/gone`, 404, `/portal/*` | inline | search, 404 |

**Shared chrome.** It is mounted in `app/layout.tsx`: `RolloutGate` / `SiteIntro`, `Ambient`, `Spotlight`, `Navbar` (status strip and mega menu), `TickerBar`, `Footer`, `MobileTabs`, `VideoPromo`, `YouTubePromo` and `LiteMotion`.

**Shared component library** (`app/components/opp/`): `Logo`, `GeoMap`, `USLegisMap`, `CountyExplorer`, `DotState`, `PixelStage`, `StageHero`, `Hemicycle`, `SeatHist`, `AverageStudio`, `PollTrail`, `VoteTables`, `RaceStory`, `ForecastNav`, `SectionNav`, `ScenarioNav`, `FloatTip`, `Count` and `LegisTiles`.

---

## 3. Existing design-system architecture

| Layer | File | Notes |
|---|---|---|
| Tokens | `app/globals.css` §1–2b | Surfaces, ink, brand, party, rating ramp, county ramp, type, shape, layout. There is a full alias layer for the older On Point Polling names (`--panel`, `--foreground`, `--blue`, `--rep` and others) and a complete `[data-theme="light"]` override. **Reusable: yes, this is the right base.** |
| Results token fork | `app/globals.css` (`html[data-theme] .desk`), repeated inline in `FloridaBoard`, `OklahomaBoard`, `deskCss.ts`, `archive/2026-08-04`, `NightBoard` | It is a second palette: `--dem:#3b7bde`, `--gop:#d64550`, `--live` teal, a neutral grey ground. It sets **`--mute:1.05`, a number**, which overrides the global `--mute` color inside `.desk` **[code]**. |
| Components | `app/opp.css` (scoped `.opp`), `app/chrome.css`, `app/phone.css` | `.card`, `.btn`, `.pill`, `.seg`, `.kpi`, `.tbl`, `.race`, `.tile`, `.callout` and the page-template classes. **Reusable: yes.** |
| Legacy utilities | `globals.css` §4 (`.psi-*`) | These duplicate `.opp` cards, buttons, badges and tables. |
| Motion | `app/motion.css`, plus reduced-motion blocks in 97 files | A global `prefers-reduced-motion` kill switch exists. |
| Lite / phone flags | `app/lib/lite.ts`, `LiteMotion.tsx`, `html[data-phone]` (at 860 px and below) | Good foundation for responsive behavior that does not depend on mode. |
| Theme | `app/lib/theme.ts`, `useSiteTheme.ts`, `ThemeToggle.tsx` | `html[data-theme]` plus localStorage `opp.theme`, a blocking pre-paint script, a `opp:theme` event, and a MutationObserver hook for canvas painters (9 users). Two states only. |
| Fonts | `app/layout.tsx` | Geist (display and body) and JetBrains Mono (numeric). `/play` adds Press Start 2P and Pixelify Sans. |
| Skill / docs | `.github/skills/opp-ui/SKILL.md` (+ `tokens.css`, `site.css`, `motion.md`) | Names Sora and Manrope, which conflicts with the Geist implementation. |
| Tailwind | `app/tailwind.config.ts` | Only legacy pages use it. `.bg-white` is forced to glass with `!important`. |

**Answers to the brief's six questions**

1. **Reusable tokens.** The whole of `globals.css` §1 and §2b, the rating and county ramps, and the `-rgb` triples.
2. **Hardcoded styles.** 3,933 color literals in TSX. The top files are `ResultsDesk` (265), `ResultsV1` (209), `ForecastDesk` (167), `ForecastAtlas` (129), `PollRoom` (124), `results/forecast/page` (123), `NightDesk` (84) and `StageHero` (84). Canvas painters hard-code fonts (`"ui-monospace"`) and `rgba(255,255,255,…)`.
3. **Duplicated styling.**
   - Cards, buttons, badges and tables exist in three systems: `.opp`, `.psi-*`, and per-family classes (`.wd-*`, `.sl-*`, `.sw-*`, `.evc-*`, `.cx-*`).
   - There are at least four chart lines: `AggregatePollChart`, `PollingTimeSeriesChart`, `MultiCandidateChart` (Recharts), and `AverageStudio` / `PollTrail` / `TrendChart` (custom SVG).
   - Maps exist as `GeoMap`, `USLegisMap`, `DotState`, `PixelStage`, `CountyExplorer`, the canvas monitor map and the three.js globe.
   - Sub-navs exist as `ForecastNav`, `SectionNav`, `ScenarioNav` and the per-family tab rows.
4. **Inconsistent layouts.**
   - Results boards use their own page frame (a desk header and meta grid).
   - Watchdog uses a terminal aesthetic.
   - `/play` uses a pixel frame.
   - Forecast race pages use `StageHero` and then `fx-body` with a side nav.
   - Other inner pages use `.ph` with `.layout` and 320 px side cards.
5. **Capacity for three modes.** It is good for the color scheme, because `data-theme` is respected everywhere tokens are used, and 45 files key off it. There is **no expression axis**, so mascots, orbs and the pixel hero cannot be turned off today. Pages with inline hex values do not follow the theme (see V-4).
6. **Themed-only assets.**
   - Pointy (`Mascot.tsx`) in: Footer, VideoPromo, Home (×5 and `HomeGlobe`), `ForecastConsole`, `WhatIf`, `RegConsole`, the polls `Timeline`, `Benchmarks` and `PollRoom`.
   - `Ambient` orbs and grain, `Spotlight`, `WireGlobe`, `PixelStage` / `StageHero` styling, and `SiteIntro`.
   - `/play` keeps its art in every mode.

---

## 4. Verified visual findings

| # | Route | Finding | Evidence |
|---|---|---|---|
| V-1 | All | The masthead overflows between about 1181 and 1425 px. The right cluster (Search, EN, theme, The Weighting Room) runs past the viewport, and The Weighting Room button is clipped. | `scrollWidth` is 1426 at 1280 on all 21 routes. The overflowing elements are `div.right` and `a.btn.gold`. See `home/1280-dark.jpg`. |
| V-2 | All | Pointy renders in the default experience on every page. | The mascot-node probe found 2 on every page (footer and promo), 14 on home, and 6 on the forecast race and polling race pages. |
| V-3 | `/results/2026-08-25/…` | The board has a different visual language from the rest of the site: a neutral grey desk, teal and red candidate colors, and mono microtype. The county map has no visible legend near the fold. | `results-ok-runoff/1280-dark.jpg` |
| V-4 | `/forecast/[state]/[race]` light | The hero candidate names use the dark-mode inline hex values `#7fa6ff` and `#ff8399` on a pale ground, which gives low contrast. On a phone, the pixel-map hero pushes the KPIs (rating, margin, range) to about 1.8 screens down and sits under the tab bar. | `forecast-race/390-light.jpg` |
| V-5 | `/results/monitor` | The closest-races list shows the internal status "Not linked" on every race to the public. The canvas map has no text alternative. At 1440 × 900, the Governors chamber card is cut off below the fold in the left rail. | `results-monitor/1440-dark.jpg`; canvas unlabeled 1/1 |
| V-6 | Home | The "Closest Senate races" panel is semi-transparent over the globe, so state labels (ME, NH, MA) show through the list. The hero copy invites the reader to "follow Pointy, our canvasser", which is copy that only makes sense in Themed mode. | `home/1280-dark.jpg` |
| V-7 | Home | The approval KPI bar pairs `--win` green with `--gop` red, which is not distinguishable for deuteranopes. | `home/*`; `app/page.tsx` L97 |
| V-8 | Phone | There is very small text (under 10.5 px) on several routes: early vote 110 elements, polls hub 106, OK runoff 75, polling race 51, home 33. | `report.json` `tinyText` |
| V-9 | Phone | Many hit targets are under 24 px: `/results/2026` 1,493 (map cells and links), `/forecast` 874, `/forecast/statewide` 134, `/polls` 55. | `report.json` `smallTargets` |
| V-10 | All | Every page has exactly one h1, a `main` landmark, and no unnamed buttons, links or images. There were no console errors on any route. | `report.json`. This is a good baseline. |

---

## 5. Responsive issues

- **1280 px: masthead overflow (required).** The nav switches to the burger only at 1060 px or narrower (`chrome.css`). The gold CTA hides only at 1180 px or narrower. Nine top-level items, the right cluster (about 330 px) and the 40 px logo need about 1426 px. **Fix:** Reduce the primary items to five (see the brief, §5). Give the right cluster a fixed width budget. Derive the collapse breakpoint from measured content, or use a "More" overflow menu. Verify at 1181–1440.
- **390 px.** No page overflows horizontally, which is good. The issues are vertical hierarchy (the forecast race hero, V-4), text density (V-8) and targets (V-9).
- **768 and 1024 px.** There is no overflow. Most two-column grids collapse at 960 px, so 1024 still gets the dense desktop layout. Results and forecast side rails become cramped (see the 1024 captures).
- **1440 px and wider.** `--wrap: 2400px` lets tables and charts stretch on very wide monitors. A data-width container is needed.
- **Charts.** There was no clipping at any captured width. The Recharts warning "width(-1) and height(-1)" appeared during the static build, which points to containers with no size at server render **[code/log]**.

---

## 6. Accessibility issues

| Area | Status | Recommendation |
|---|---|---|
| Skip link | **Missing** on every page **[code]** | Add a "Skip to content" link targeting `main`. |
| Focus | There is a gold `:focus-visible` ring globally and in the nav, which is good. Per-family controls (`.sl-*`, `.sw-*`, Watchdog) vary **[code]**. | Use one focus token for all controls. |
| Mega menu | Hover opens it, the caret button has `aria-expanded`, and Escape closes it. There is no arrow-key movement and no focus return to the trigger **[code]**. | Use a disclosure pattern with focus management. |
| Phone menu | `role="dialog" aria-modal`, Escape and scroll lock are present. **There is no focus trap and no initial focus** **[code]**. | Trap focus and focus the close button first. |
| Theme toggle | Labeled ("Switch to light mode"). | Replace it with a labeled three-option radio group. |
| Charts | Most large SVGs are labeled (the probe found 0 unlabeled). The results monitor canvas is unlabeled. No chart offers a table view. | Add an `aria-label` summary on canvases and a "View as table" option on the main charts. |
| Color | Party blue and red are fine. Green and red are paired for approval (V-7). Light-mode inline colors fail contrast (V-4). | Use mode tokens only. |
| Motion | There is a global reduced-motion kill switch (`globals.css`, `opp.css`). The marquee, pulses, globe and mascot all stop. | Keep it. Make sure live updates still appear without animation. |
| Touch and text | See V-8 and V-9. | 44 px targets and an 11 px minimum label size. |
| Loading and errors | **There are no `loading.tsx` or `error.tsx` files anywhere.** Only the root `not-found.tsx` exists **[code]**. | Add route-family skeletons and error boundaries, plus a "data delayed" state for live feeds. |
| Language | `lang="en"` is set. Google-translate-based language picker. | Announce the language change. |

---

## 7. Issue register

Totals: **2 P0, 15 P1, 7 P2.** Themes: "All" means the issue affects all three future modes. "Pro" means Professional Dark and Light only.

### P0 — Critical

| ID | Route / component | Description | Evidence | Recommended correction | Themes |
|---|---|---|---|---|---|
| P0-1 | `results/2026-08-25/OklahomaBoard.tsx` L836–848, the same pattern in `FloridaBoard.tsx` | The winner band shows a ✓ and "{name} wins the Republican runoff" whether the race was officially called or only projected by On Point Polling. Only the small eyebrow changes ("race called" vs "On Point Polling projection"). A projection is presented as a called result. | [code]; `results-ok-runoff/1280-dark.jpg` shows the called state | Reserve ✓ and "wins" for official calls. Projections use a distinct outline "Projection" badge and "projected to win" wording (as `RaceDesk` already does). Apply this through a shared `RaceStatus` component. | All |
| P0-2 | `results/monitor/Monitor.tsx` L115 and L305, `Chambers.tsx` L4–16 | Before any votes are counted, states, counties and hemicycle seats are drawn in their *forecast* or *expected* margin color ("faintly"), using the same ramp as reported returns. The legend shows only "D +40 … R +40". On election night, readers can mistake expectations for returns. | [code]; legend in `results-monitor/1440-dark.jpg` | Draw uncounted units with a hatch or neutral pattern, add an "Expected (no votes yet)" legend entry, and label the tooltip "Expected". | All |

### P1 — High

| ID | Route / component | Description | Evidence | Recommended correction | Themes |
|---|---|---|---|---|---|
| P1-1 | `Navbar`, `chrome.css` | Masthead overflow at 1181–1425 px (V-1). | probe | Restructure the nav (brief §5) and set the breakpoints from measured content. | All |
| P1-2 | Global (Footer, VideoPromo), Home, Forecast console, What-if, maps, timelines | The mascot and decorative theatrics are in the default experience (V-2). | probe; [code] | Add the `data-mode` expression axis and gate the mascot, orbs, Spotlight, SiteIntro and the pixel hero to Themed. | Pro |
| P1-3 | `globals.css` `.desk`, results boards | A forked palette for results, and `--mute` redefined as a number inside `.desk`. | [code] | Delete the fork and map results onto the global tokens. Give the multiplier a different name. | All |
| P1-4 | Site-wide | At least five Democratic blues and four Republican reds in active use (`#3d7bff`, `#3b7bde`, `#5b8fff`, `#7fa6ff`, `#1d5fc4`; `#ff3b5c`, `#d64550`, `#ff4d6a`, `#ff8399`). | [code] | One party token set per mode, read by SVG, canvas and Recharts. | All |
| P1-5 | Forecast race hero (`StageHero` props, `page.tsx` L206–215) | Inline dark hex values break light-mode contrast. The phone hero buries the KPIs (V-4). | screenshot | Use tokens for colors. In Professional modes, use an editorial hero with the KPIs above the fold. | All |
| P1-6 | `results/monitor` | "Not linked" is shown to the public. The canvas has no label. The left rail is cut off at 1440 × 900 (V-5). | screenshot | Hide internal states and replace them with "No returns yet". Add an `aria-label` summary. Make the rail scroll independently. | All |
| P1-7 | Results family | Five board implementations (`ResultsDesk`, `ResultsV1`, `NightDesk`, `FloridaBoard`/`OklahomaBoard`, `RaceDesk`) with inline CSS strings. | [code] | Converge on the `RaceDesk` grammar and a shared results layout. | All |
| P1-8 | Watchdog, Brasil, News, Early vote, Play chrome | Independent visual systems, including a generated light stylesheet for Watchdog. | CSS inventory | Adopt the shared tokens, cards and tables without reorganizing the content. | All |
| P1-9 | Nav IA | Nine top-level items. Early Vote and Maps overlap. The Results live dot pulses all the time. | screenshot | Five primary items plus "More". Show the live dot only while returns are coming in. | All |
| P1-10 | Accessibility: skip link and menus | No skip link. The phone menu has no focus trap. The mega menu has no arrow-key support. | [code] | See §6. | All |
| P1-11 | Phone text size | V-8. | probe | An 11 px minimum label size, enforced through the type scale. | All |
| P1-12 | Phone targets | V-9. | probe | 44 px targets. Map cells get a tap-to-select list fallback. | All |
| P1-13 | Loading and error states | There are no `loading.tsx` or `error.tsx` files. Live feeds have no "delayed" state. | [code] | Shared skeleton, error and empty components per family. | All |
| P1-14 | Charts | Four chart implementations with different axes, tooltips and colors. No table view. | [code] | A shared chart frame (brief §7–8). Race History is the first consumer. | All |
| P1-15 | Theme control | Two-state toggle. The appearance choice cannot express Themed. | [code] | A three-way appearance control with one stored key, migrated from `opp.theme`. | All |

### P2 — Refinement

| ID | Area | Description | Correction |
|---|---|---|---|
| P2-1 | Home hero | Semi-transparent race panel over the globe labels (V-6). | Solid surface or offset layout. |
| P2-2 | Home approval bar | Green and red pairing (V-7). | Approve and disapprove tokens that are not green and red. |
| P2-3 | Docs | The skill names Sora and Manrope, but the build uses Geist. | Update the skill after Fable sets the typography. |
| P2-4 | Layout | `--wrap: 2400px` stretches tables on ultrawide monitors. | Reading and data-width containers. |
| P2-5 | Typography | Around 40 ad hoc `font:` shorthands. Mono microtype letter-spacing varies. | Type scale tokens. |
| P2-6 | Legacy utilities | `.psi-*` classes duplicate `.opp`. `.bg-white !important` override. | Retire them after migration. |
| P2-7 | Ticker | A perpetual marquee in the default experience. | Pause on focus and hover (already done for hover). Consider a static "key races" strip in Professional modes. |

---

## 8. Three-theme design strategy

1. **Two attributes, one preference.** `data-theme` (`dark`/`light`) stays as the color scheme. A new `data-mode` (`pro`/`themed`) controls expression. A single stored value (`opp.appearance`: `dark` | `light` | `themed`) is applied in the existing blocking script, and the old `opp.theme` value is migrated. Themed uses `data-theme="dark"`, so every existing dark rule keeps working.
2. **Expression is controlled with CSS.** Mascot, orb, Spotlight and pixel-hero elements render on the server and are hidden with `[data-mode="pro"]`, which avoids hydration mismatches. They can be lazy-loaded later as an optimization.
3. **Professional Dark** moves the surfaces from purple-black toward navy and charcoal, limits the gradient to the logo and one accent, and drops the orbs and grain.
4. **Professional Light** is a separately designed token set, not a derived one. It has deepened party colors, hairline separation, and print-grade tables.
5. **Themed** is today's identity: purple-black, orbs, Pointy, the pixel hero and expressive motion.
6. **Canvas and SVG painters** read tokens through an extended `useSiteTheme` that returns resolved token values. No hex values remain in the painters.
7. **The homepage invitation** is a small card in the "Start here" deck, plus an "Appearance" item in the masthead control.

---

## 9. Shared-component consolidation opportunities

| Consolidate | From | Into |
|---|---|---|
| Cards, buttons, badges, tables | `.opp`, `.psi-*`, `.wd-*`, `.sl-*`, `.sw-*`, `.evc-*`, `.cx-*` | One `.opp` component layer on tokens |
| Race status and calls | Winner bands in each board, monitor call toasts, `RaceDesk` labels | `RaceStatus`, `CallBadge`, `ProjectionBadge` |
| Results page frame | 5 board implementations | `ResultsLayout` (desk header, meta grid, reported card, projection card, map, county table) |
| Charts | Recharts wrappers, `AverageStudio`, `PollTrail`, `TrendChart`, Race History | A `ChartFrame` plus shared axis, tooltip and readout primitives |
| Maps | `GeoMap`, `USLegisMap`, `DotState`, `CountyExplorer`, the monitor canvas | A shared `MapLegend`, `MapTooltip` and color-ramp API. The renderers can stay separate. |
| Sub-navigation | `ForecastNav`, `SectionNav`, `ScenarioNav`, per-family tabs | `SubNav` |
| Heroes | `StageHero`, `.ph`, results desk header, `.hero` | `PageHeader` with an optional `Themed` art slot |
| Overlays | `VideoPromo`, `YouTubePromo`, `SiteIntro`, `FloatTip`, `.tip` | `Sheet` / `Popover` / `Toast` |

---

## 10. Recommended redesign sequence

1. **Milestone 1: foundation (recommended first).** Three-mode token sets and the appearance mechanism. Masthead rebuild, which fixes P1-1 and P1-9. Skip link and menu accessibility. Mascot gating. Visual regression is checked with this audit's capture script at the five widths.
2. **Milestone 2: data integrity grammar.** `RaceStatus` and projection badges (P0-1). Expected-vs-reported map treatment (P0-2). Consolidated party tokens (P1-3, P1-4). This must ship before Election Day (Nov 3).
3. **Milestone 3: results family** on `ResultsLayout`.
4. **Milestone 4: forecast family**, including the editorial race hero and Race History integration.
5. **Milestone 5: polling family** and the shared `ChartFrame`.
6. **Milestone 6: tools and maps** in a shared tool frame. `/play` chrome only.
7. **Milestone 7: Watchdog, News, Accountability and Brasil** token adoption.
8. **Milestone 8: loading, error and empty states**, and retirement of legacy `.psi-*` / Tailwind.

**Timing note.** Election Day is 6 days away. Milestones 1 and 2 are the only ones that are realistic, and the only ones that are safe, before Nov 3. Everything after them should land after the certification window.

---

## 11. Pending Race History integration

- **Branch.** `origin/feature/election-night-intelligence-v1` at `0559aad3`. Merge base `44d06d08`; 12 ahead, 13 behind `origin/main`.
- **Shared-file conflicts.** None. No file has changed on both sides since the merge base (verified with `comm` over both name lists). The branch modifies these files, which `main` also owns: `app/forecast/[state]/[race]/page.tsx` (adds the `history` section and nav item, and renames "The trend" to "Recent model updates" as a labeled fallback), `app/api/flightrecorder/*`, `app/api/results/public-snapshot/route.ts`, `next.config.ts` and `package.json`.
- **Design implications.**
  1. The `.rh` token block (`--rh-d:#5b8fff`, `--rh-r:#ff4d6a`, plus a light override) must alias the shared mode tokens.
  2. Race History extends `studio.css`, so the shared `ChartFrame` should be designed with it as a consumer.
  3. The forecast race page redesign (Milestone 4) has to be done on top of, or after, the branch merge. Otherwise the two will produce a real conflict in `page.tsx`.
  4. The "Shadow" comparison and the reported-vs-modeled grammar must use the same visual language as the results desk.
- **Reference screenshots.** `docs/screenshots/race-history/` and `…/phase2/` on the intelligence branch.

---

## 12. Deferred PostgreSQL TODO confirmation

`docs/ELECTION_INTELLIGENCE_FINAL_HANDOFF.md` on the intelligence branch (`0559aad3`) still contains:

- section C, "Awaiting PostgreSQL setup (deferred; nothing connected, created or migrated)", which includes the `ObjectStore` adapter interface and `INTELLIGENCE_CAPTURE_STORE=postgres`;
- the "Deferred TODO (after the UI audit)" checklist, with 11 open items: schema, isolated database, restricted credentials, adapter, linked records, immutable replay, collection at 30 s and 10 min, Race History and Live Timeline integration, publication-state integrity, preflight and backups, and deployment and rollback.

The file exists only on that branch. It was not copied or merged into this audit branch. No database work was started, and none is part of this redesign.

---

## 13. Screenshot evidence index

All files are in `docs/audit-screenshots/<route>/<width>-<theme>.jpg`. They are JPEG at quality 62, captured up to 2.2 viewport heights. Viewport heights: 390×844, 768×1024, 1024×768, 1280×800, 1440×900. Probe data is in `report.json`.

| Route folder | Path | Widths (dark) | Light |
|---|---|---|---|
| `home` | `/` | 390, 768, 1024, 1280, 1440 | 390, 1280 |
| `results-monitor` | `/results/monitor` | 390, 768, 1024, 1280, 1440 | 390, 1280 |
| `results-hub` | `/results` | 390, 1280 | — |
| `results-tonight` | `/results/tonight` | 390, 1280 | — |
| `results-2026` | `/results/2026` | 390, 1280 | — |
| `results-ok-runoff` | `/results/2026-08-25/oklahoma-governor-republican-runoff` | 390, 1280 | 390, 1280 |
| `forecast` | `/forecast` | 390, 768, 1024, 1280, 1440 | 390, 1280 |
| `forecast-race` | `/forecast/ks/senate` | 390, 768, 1024, 1280, 1440 | 390, 1280 |
| `forecast-statewide` | `/forecast/statewide` | 390, 1280 | — |
| `polls` | `/polls` | 390, 768, 1024, 1280, 1440 | 390, 1280 |
| `polls-generic-ballot` | `/polls/generic-ballot` | 390, 1280 | — |
| `polls-race` | `/polls/tx/senate-paxton-talarico` | 390, 1280 | — |
| `opp-release-tx` | `/on-point-polling/polls/texas-2026` | 390, 1280 | — |
| `play` | `/play` | 390, 768, 1024, 1280, 1440 | 390, 1280 |
| `swingometer` | `/forecast/swingometer` | 390, 1280 | — |
| `what-if` | `/forecast/what-if` | 390, 1280 | — |
| `maps-electoral` | `/maps/electoral` | 390, 1280 | — |
| `maps-early-vote` | `/maps/early-vote` | 390, 1280 | — |
| `watchdog` | `/watchdog` | 390, 1280 | — |
| `news` | `/news` | 390, 1280 | — |
| `search` | `/search` | 390, 1280 | — |
| `not-found` | `/this-page-does-not-exist` | 390 | — |

The capture driver is kept outside the repository (`~/research/siteaudit/shot.mjs`). It can be added under `scripts/` in Milestone 1 if it is wanted for regression checks.
