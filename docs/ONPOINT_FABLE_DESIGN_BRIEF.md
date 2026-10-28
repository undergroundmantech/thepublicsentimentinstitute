# OnPoint Politics: design brief for Fable 5.1

**Prepared:** 2026-10-28, from the site-wide UI/UX audit on branch `ui/site-audit` (base `origin/main` `3d67d59a`).
**Companion document:** [ONPOINT_SITEWIDE_UI_AUDIT.md](ONPOINT_SITEWIDE_UI_AUDIT.md). It contains the evidence, the issue register and the screenshots.
**Status:** This is a brief only. Nothing in it has been implemented yet.

This brief is meant to stand on its own. Fable should be able to set the art direction and the future design system from this document and the referenced screenshots, without having to rediscover the repository.

---

## 1. The assignment

OnPoint Politics (onpointpolitics.us) publishes the 2026 midterm forecast, polling averages, live election results, On Point Polling releases, a money and influence tracker (Watchdog) and several interactive tools. The individual experiences are strong. The site as a whole is not yet coherent. Many route families have their own palette, CSS file and component vocabulary. The playful mascot appears on pages that should read as authoritative.

The goal is **one premium national political analytics platform with three coherent appearance modes**. The goal is not a series of separate page redesigns.

The platform should feel:

- Credible and authoritative, with the restraint of a serious newsroom data desk.
- Editorial: the hierarchy, headlines and captions should do the explaining.
- Statistically rigorous, so that estimates never look like facts.
- Polished and modern, with interaction that rewards attention and never distracts from it.
- Exceptionally readable on a 390 px phone and on a 2560 px monitor.

---

## 2. The three appearance modes

| | **Professional Dark** (default) | **Professional Light** | **Themed** |
|---|---|---|---|
| Intent | Election night newsroom. Premium, calm, data-forward. | A fully designed light editorial system with print-quality charts and tables. | The original playful OnPoint identity, with Pointy, the illustrations and the theatrical brand moments. |
| Surfaces | Deep navy and charcoal. The current purple-black (`#0a0711` / `#110019`) should move toward navy and charcoal. | White and warm or cool neutrals, with surface separation from tone and hairlines rather than heavy shadow. | The current brand ground: purple-black, gradient orbs and grain. |
| Brand gradient | Logo and at most one hero accent per page. No ambient orbs. | Logo only, plus a very restrained hero accent. | Used freely: orbs, headline highlights, CTA bands. |
| Mascot and illustration | None. | None. | Pointy and the illustrated characters, where they add delight. |
| Motion | Purposeful only: data transitions, reveal on first view, live pulses. | Same as Dark. | Expressive: walking mascot, celebratory moments. The reduced-motion setting is still honored. |
| Party color | Restrained, and on data only. | Deepened for contrast on white, and on data only. | Same data colors as Dark. |

**Rules for all modes**

1. All three modes share the same components, data, calculations, routes and navigation. A mode changes appearance only. It never changes the content or the numbers.
2. Professional Dark and Light do not just recolor Themed. They also remove the cartoon presentation: the mascots, the speech bubbles, the decorative orbs and the playful flourishes.
3. The choice persists across navigation and across visits, and it applies before first paint so the screen never flashes.
4. The homepage includes a tasteful invitation to switch on Themed mode. It should be a small, confident card or link, not a modal.
5. Every surface supports all three modes: forecasts, polling, results, Race History, navigation, maps, `/play` and Watchdog.
6. Charts, maps and canvases read their colors from shared mode tokens at runtime. They never use per-page hex values.

**Recommended mechanism (for Fable's information only; engineering will implement it).** Keep `html[data-theme="dark|light"]` as the color-scheme switch, because 45 files already key off it. Add `html[data-mode="pro|themed"]` as the expression switch. Themed renders on the dark palette plus an expressive token layer. One stored preference (`opp.appearance`: `dark` | `light` | `themed`) maps to both attributes in the existing pre-paint script (`app/lib/theme.ts`). Mascot components are hidden with CSS outside Themed mode. This avoids a mismatch between the server and client renders, and the mascots can be lazy-loaded later.

---

## 3. Brand assets and identity

### Keep in every mode
- **Logo lockup.** The SVG is in `app/components/opp/Logo.tsx`, with viewBox `0 0 500 200` and a masthead crop of `30 40 460 120`. The white lockup is for dark surfaces and the color lockup is for light ones. Files: `public/logo-white.svg`, `public/logo-color.svg`, `public/onpointlogo_color.svg` and `public/icon.svg`.
- **Brand gradient** `#064bf9 → #83449c → #f9064b`. In Professional modes it is a signature accent, not a background.
- **Gold** `#e7b341` (light mode `#9a6a06`) is the premium and secondary accent for The Weighting Room, the toss-up rating and eyebrow labels. Keep it scarce.
- **Gold lockup** (`public/logo-gold.png`, `public/weighting-room-gold.png`) for The Weighting Room and premium surfaces.

### Themed mode only
- **Pointy**, the On Point mascot (`app/components/home/Mascot.tsx` with `pointy.css`). It is pure SVG with poses `walk | idle | wave | point | cheer | think | sit` and props `clipboard | megaphone | ballot | magnifier | chart | flag | pointer`. It currently appears on the homepage (five placements, plus a walking Pointy in `HomeGlobe`), in the global footer, in the global video-promo bubble, on the `/forecast` console, `/forecast/what-if`, the registration maps, the polling timelines, the early-vote benchmarks and the legacy poll room. All of these become Themed-only.
- **Ambient orbs and grain** (`Ambient.tsx`, `.opp .orbs`, `.opp .grain`).
- **The pixel art map hero** (`StageHero` and `PixelStage`) on forecast race pages. Its information content (headline, candidates, win chance) must survive in Professional modes, rendered as a clean editorial hero.
- **WireGlobe and Spotlight** decorative effects.

### Self-contained exception
- **`/play`** (Campaign 2026) is a pixel-art game with its own fonts (Press Start 2P, Pixelify Sans). It keeps its own art in every mode. In Professional modes, only the chrome around it (header, footer, frame) follows the system.

---

## 4. Typography

**Current implementation.** Geist is used for display and body, and JetBrains Mono for numbers (`app/layout.tsx`). The design skill (`.github/skills/opp-ui/SKILL.md`) still names Sora, Manrope and JetBrains Mono. The documentation has drifted, and Fable should settle the question.

**Requirements**
- One display face and one text face shared by all three modes, plus a tabular numeric face for every number that has to line up.
- Body text at least 15 to 16 px on desktop and 16 px on mobile. Data labels at least 11 px. The audit found many labels from 9 to 10.5 px.
- Uppercase is reserved for eyebrows and mono labels.
- A documented type scale (display, h1 to h4, lede, body, caption, label, data-xl, data-l, data-m, data-s) replaces the roughly 40 ad hoc `font:` shorthands now spread across the CSS files.
- Fable may introduce an editorial serif for Professional headlines if it serves credibility. If it does, Themed keeps the current sans.

---

## 5. Information architecture and navigation

**Current masthead.** It has a status strip (days to Election Day, control odds, utility links) above a main bar with nine top-level items (Forecast, Polls, Results, News, Early Vote, Maps, Watchdog, Play, On Point Polling) and a right-hand cluster (Search, language, theme, The Weighting Room, Menu). The bar is followed by a scrolling ticker. One menu definition (`app/components/navMenu.ts`) drives the desktop mega menus, the phone accordion and the footer, and that structure is worth keeping.

**Problems.** See the audit for evidence.
- The masthead overflows horizontally at about 1280 px. This is a required fix.
- Nine top-level items is too many for a premium masthead. Early Vote and Maps overlap, and Play and Watchdog are a different kind of destination.
- Results is labeled live, with a pulsing dot, all the time, even when no returns are coming in.
- The theme toggle is a two-state icon button. It has to become a three-way appearance control.

**Proposed direction**
- **Five primary destinations:** Forecast, Polls, Results, Maps (with Early Vote inside it), and News & Analysis. Watchdog, On Point Polling and Play go in a secondary group ("More", or a right-side utility area) and in the footer.
- **A right-hand cluster no wider than a fixed budget:** Search (icon), Appearance (one control with three options), and one premium CTA. The language picker moves into the appearance or utility menu.
- **The live dot appears only while returns are actually coming in.**
- **Section sub-navigation (ForecastNav, SectionNav, ScenarioNav and the per-section navs) becomes one shared `SubNav` component** with sticky behavior and overflow scrolling on mobile.
- **The phone tab bar** (Forecast, Polls, Results, Maps, Menu) is good. Keep it in all modes.

---

## 6. Key page families

Each of these needs a master layout, so that individual pages are instances of it rather than one-offs.

1. **Home desk.** It should give an authoritative first impression: control odds, the closest races, the latest polls, the results desk and On Point Polling releases. In Professional modes, the 3D globe hero (`HomeGlobe`) is either restyled as a calm data globe or replaced by a national map hero. The Themed invitation lives here.
2. **Results command center** (`/results/monitor`, `/results`, `/results/tonight`, `/results/race/[id]`, and the dated boards such as the Oklahoma runoff). This family has the strictest standard for **reported vs modeled** grammar (see section 8).
3. **Forecast** (`/forecast` console, `/forecast/[state]/[race]`, `/forecast/statewide/*`, `/forecast/legislatures/*`, `/forecast/measures/*`). The race page is the flagship. It needs a clean editorial hero, KPIs (rating, model margin, 80 percent range, projected votes), the county map, vote share, the simulated distribution, Race History (pending, see section 10), polling and context.
4. **Polling** (`/polls`, `/polls/generic-ballot`, `/polls/approval`, `/polls/[state]/[race]`, the timelines and `/on-point-polling/*` releases). The averages chart and pollster table are the core. The methodology needs a consistent place to live.
5. **Interactive tools** (`/forecast/swingometer`, `/forecast/what-if`, `/maps/*`, `/play`). Use one shared "tool frame": title, control rail, canvas, readout and reset.
6. **Watchdog** (money, ledger, war room, people) and **News**. These are the largest independently styled families. They should adopt the shared tokens and components without being reorganized.
7. **Utility pages:** search, 404, terms, contact and the portal login.

---

## 7. Shared components to define

These are the components Fable should specify. Each needs Dark, Light and Themed states and phone and desktop layouts.

- **Masthead:** status strip, main bar, mega menu, phone menu, tab bar, ticker.
- **Footer**.
- **Page header:** breadcrumbs, eyebrow, h1, lede and meta row (updated time, sources).
- **Section header:** h2, sub-line and "more" link.
- **Card:** header row, body and footer, in standard, elevated, interactive and premium (gold) variants.
- **Button:** primary, secondary, ghost, premium and icon, each in three sizes.
- **Segmented control / tabs**, **filter chips**, **select** and **search input**.
- **Pill / badge:** party, rating, status (Live, Called, Projected, Estimate, Final, Too early), and premium.
- **KPI tile:** label, value, delta, sparkline and uncertainty.
- **Data table:** sticky header, numeric alignment, sortable headers, zebra or hairline rows, row hover, mobile card-collapse pattern.
- **Chart frame:** title, legend, axis style, tooltip/readout, source line, "as of" stamp and an accessible summary.
- **Map frame:** legend ramp, tooltip, zoom and reset, and a county or district table fallback.
- **Candidate row:** color chip, name, party, percent, votes and called mark.
- **Probability display:** bar, dial and needle variants, all with a stated uncertainty.
- **Modal / sheet / popover**: there should be one implementation, not three.
- **Loading skeleton**, **empty state**, **error state** and a **"data delayed" banner**.
- **Toast / call alert**: results calls.
- **Themed invitation card** and **appearance switcher**.

---

## 8. Data visualization and table standards

1. **Reported vs modeled grammar (non-negotiable).**
   - Reported counts use solid fills, full-strength ink and plain numbers.
   - Modeled, projected and estimated values use a muted or hatched fill, dashed outlines, and an explicit text label ("Projected", "Est.", "Model") right next to the number.
   - The ✓ check mark and the word "wins" are reserved for official race calls. An On Point Polling projection uses its own badge (for example a "Projection" outline pill) and never a check mark.
   - Expected-margin shading for counties with no votes counted must be clearly marked as an expectation, both in the legend and in the tooltip.
   - Every live number carries an "as of" time and its source.
   - This grammar is already partly established in `RaceDesk.tsx`: "reported figures are solid; projected figures are muted and labeled". It becomes the site-wide rule.
2. **Party colors.** Each mode has one set of `--dem`, `--gop`, `--ind` and `--oth` tokens, with defined pale, mid and deep steps and a margin ramp. Today there are at least five Democratic blues in active use (`#3d7bff`, `#3b7bde`, `#5b8fff`, `#7fa6ff`, `#1d5fc4`).
3. **Colorblind safety.** Never pair green and red alone for meaning (the approval bars do this today). Use blue/orange or add a texture or label. Rating ramps should keep their pale-to-deep order.
4. **Uncertainty is always drawn.** Margins show their 80 percent range. Probabilities are never shown with false precision (no decimals below 1 percent, and "<1%" and ">99%" at the extremes).
5. **Chart chrome.** Use hairline gridlines, a tabular mono font for axis labels at 11 px or larger, direct labels in preference to legends, and one tooltip/readout style site-wide.
6. **Accessible charts.** Every chart has `role="img"` plus an `aria-label` summary, or a visible text summary, and a "view as table" toggle for the main charts.
7. **Tables.** Numbers are right-aligned and tabular. Headers are sticky. On phones, a table either scrolls inside its own frame with a visible shadow cue or collapses to cards. The page itself must never scroll sideways.
8. **Canvas surfaces** (the results monitor, globes and maps) read colors and fonts from tokens through `useSiteTheme`-style hooks. There should be no `"ui-monospace"` strings or `rgba(255,255,255,…)` literals.

---

## 9. Desktop and mobile requirements

- **Breakpoints to design:** 390, 768, 1024, 1280 and 1440+. The current content width runs up to 2400 px. Define a reading measure (around 72ch) and data-width containers (around 1440 to 1600 px) so that very wide monitors do not stretch the tables.
- **No horizontal page scroll at any breakpoint.** Today the masthead overflows at 1280 px, and other overflows are listed in the audit.
- **Touch targets** are at least 44 × 44 px on phones. The existing phone pass (`app/phone.css`) brings many to 36 to 40 px.
- **The phone masthead** hides on scroll down and returns on scroll up, and the tab bar stays reachable. Keep both.
- **Interactive tools on phones** use a bottom-sheet control rail rather than a cramped sidebar.

---

## 10. Pending integration: Race History

The `feature/election-night-intelligence-v1` branch (HEAD `0559aad3`, not merged) adds **Race History** to forecast race pages: Win Probability, Expected Margin and Vote Totals charts with a scrubbable readout and a "Shadow" comparison. It replaces "The trend" where published history exists, and it labels "Recent model updates" as an unverified fallback.

- Reference screenshots are on that branch under `docs/screenshots/race-history/` (desktop, mobile and light-mode variants).
- Its colors are a local `.rh` token block (dark plus `[data-theme="light"]`). In the new system, `--rh-*` must alias the shared mode tokens. Its Democratic blue `#5b8fff` and Republican red `#ff4d6a` currently differ from the global `--dem` and `--gop`.
- It extends the polling-average chart styles (`studio.css`). The shared chart frame in section 7 should be designed with Race History as one of its first consumers.
- The design must also allow for a future **RaceDesk Live Timeline** on results pages that uses the same reported-vs-modeled grammar.

---

## 11. Accessibility expectations (WCAG 2.2 AA)

- Text contrast is at least 4.5:1, and large text and UI components at least 3:1, in all three modes. The muted text tokens must be checked on every surface tint.
- A visible focus ring on every interactive element. The current gold ring is good; it needs to be consistent everywhere.
- A skip link to the main content. There is none today.
- Mega menus that work with the keyboard (arrow keys, Escape, focus return), and a phone menu dialog that traps focus.
- `prefers-reduced-motion` stops the marquee, the pulses, the globe auto-rotation and the mascot movement. Live updates still appear without the animation.
- Charts and maps have text alternatives (section 8.6).
- Language: `lang` is set, and the language picker is announced.

---

## 12. Constraints and protected functionality

The redesign changes presentation only. It must not alter:

- Forecast calculations, simulation engines, model probabilities or ratings.
- Polling methodology or averages.
- Election results, results provider integrations (civicAPI and AP), race-call logic (`app/lib/raceCall.ts`) or race identifiers and URLs.
- Historical data, the shadow intelligence functionality or capture pipelines.
- Database infrastructure. PostgreSQL integration is deferred and is not part of this work.
- Data contracts between components. Visual components receive the same props.

Visual work must also keep:

- SEO metadata, JSON-LD, `llms.txt` and the canonical URLs.
- Analytics, AdSense and the consent behavior.
- The existing route map (`next.redirects.ts`).

---

## 13. Reference screenshots

Every screenshot is in `docs/audit-screenshots/<route>/<width>-<theme>.jpg`, and the index is in the audit, section 13. The most useful for art direction:

| Purpose | File |
|---|---|
| Current homepage, desktop, dark | `docs/audit-screenshots/home/1440-dark.jpg` |
| Current homepage, phone | `docs/audit-screenshots/home/390-dark.jpg` |
| Current homepage, light | `docs/audit-screenshots/home/1280-light.jpg` |
| Masthead overflow at 1280 | `docs/audit-screenshots/home/1280-dark.jpg` |
| Results command center | `docs/audit-screenshots/results-monitor/1440-dark.jpg` |
| Results board (projection vs call) | `docs/audit-screenshots/results-ok-runoff/1280-dark.jpg` |
| Forecast console | `docs/audit-screenshots/forecast/1440-dark.jpg` |
| Forecast race page (flagship) | `docs/audit-screenshots/forecast-race/1440-dark.jpg` |
| Polling hub | `docs/audit-screenshots/polls/1280-dark.jpg` |
| Generic ballot average | `docs/audit-screenshots/polls-generic-ballot/1280-dark.jpg` |
| Watchdog (separate visual system) | `docs/audit-screenshots/watchdog/1280-dark.jpg` |
| `/play` | `docs/audit-screenshots/play/1280-dark.jpg` |
| Race History (pending branch) | `docs/screenshots/race-history/phase2/*` on `feature/election-night-intelligence-v1` |

---

## 14. Deliverables requested from Fable

1. Art direction boards for Professional Dark, Professional Light and Themed.
2. A token specification for color (surfaces, ink, lines, party, ratings, ramps, status), type scale, spacing, radii, elevation and motion, in all three modes.
3. Component specifications for the list in section 7.
4. Master layouts for the page families in section 6, at 390 and 1440 px at minimum.
5. The reported vs modeled visual grammar, as a one-page standard.
6. The design of the appearance switcher and the Themed invitation.
