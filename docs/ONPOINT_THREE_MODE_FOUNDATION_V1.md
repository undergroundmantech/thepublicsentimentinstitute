# OnPoint three-mode foundation v1

Branch `ui/three-mode-foundation-v1`. Not merged and not deployed.

## Source and integration

| Commit | What |
|---|---|
| `c78091a5` | Starting point: election-night race page v1 close-out |
| `f0b41367` | Merge of `origin/main` `cc5673f1` (Lester, Oct 29–30) |
| `84d6b25a` | Three appearance modes on a two-scheme token layer |
| `97649518` | Merge of `origin/main` `b89cf8b8` (Lester, Oct 30 rerun) |
| `e240cb48` | Init script writes the full Pro Dark attribute set when nothing valid is stored |
| `607fbeef` | Merge of `origin/main` `934649f6` (Lester, Oct 30: House maps, county primaries, voter simulation) |

The three-mode work touches 20 files (`git diff --stat f0b41367 84d6b25a`). Lester's commits since `cc5673f1` and ours touch no common file. The protected paths are byte-identical to `origin/main` `934649f6`: `public/forecast`, `public/results`, `public/play`, `public/watchdog`, `app/_polling`, `scripts/forecast`, `app/api/flightrecorder` and `data`. This was checked with `git diff --stat origin/main -- <paths>` returning empty.

## The three modes

| Mode | `data-mode` | `data-theme` / scheme | Browser chrome | Character |
|---|---|---|---|---|
| Pro Dark (default) | `dark` | `dark` | `#110019` | Professional; Pointy limited to essential cameos |
| Pro Light | `light` | `light` | `#f5f3fa` | Same rules on the light scheme |
| Theme | `themed` | `dark` | `#1a0832` | Full brand personality: Pointy, glow, gradient hairlines |

- **Storage and events.** `localStorage["opp.theme"]` holds the mode, and `opp:theme` events carry it.
- **Default and system preference.** The operating-system colour preference is never read. A missing, unknown, legacy or unreadable value gives Pro Dark.
- **Scheme for existing CSS.** `data-theme` and `data-opa-theme` keep only the colour scheme (`dark` or `light`). All existing `[data-theme="light"]` CSS therefore keeps working, and Theme reuses the dark scheme.
- **First paint.** `THEME_INIT_SCRIPT` is an inline, blocking script in `<head>`. It sets `data-mode`, `data-theme`, `data-opa-theme`, inline `color-scheme` and the `theme-color` meta tag before `<body>` exists, so there is no flash of the wrong mode.
- **API.** In `app/lib/theme.ts`: `getMode()`, `setMode(mode, persist)` and `readStoredMode()`. The legacy `getTheme`, `setTheme` and `toggleTheme` remain for existing callers. `useSiteMode()` lives in `app/lib/useSiteTheme.ts`.

## Tokens

`app/globals.css` §2c adds semantic tokens, with Pro Light overrides:
- surfaces, text and borders: `--surface-*`, `--text-*`, `--border-*`;
- accents and focus: `--accent-grad`, `--accent-2`, `--focus-ring`;
- components: `--btn-*`, `--card-*` (including `--card-glow`), `--table-*`, `--chart-*`, `--map-*`;
- status and shadow: `--status-*`, `--shadow-overlay`;
- atmosphere: `--ambient` and `--grain`.

§2d gives Theme its deeper background, purple-tinted lines and glass. `app/opp.css`, `app/modes.css` and `app/components/modepicker.css` read only these tokens.

## Selector

`app/components/ThemeToggle.tsx` has two variants:
- **`menu`** (masthead). The button has `aria-haspopup="menu"` and opens `role="menu"` with three `menuitemradio` items. Focus starts on the active item. Arrow keys wrap; Home, End, Escape (focus returns to the button) and Tab are handled.
- **`inline`** (phone menu). A `role="radiogroup"` with roving tabindex. Arrow keys select, and targets are at least 44 px.

## Pointy policy

- In Pro Dark and Pro Light, `.pty-cameo` is hidden unless it is `.essential` (the early-vote benchmarks and the 404 page).
- A cameo that speaks (`data-say`) keeps its words as a plain note with a gold left rule; its figure is hidden.
- `.quip` marks character-voice lines, which go with the figure.
- Theme shows all cameos.

## Masthead

`app/chrome.css` compacts the masthead in stages:
- ≤1480 px: compact navigation, Search becomes an icon.
- ≤1400 px: the gold button is hidden.
- ≤1240 px: tighter spacing.
- ≤1120 px: burger menu.

The probes found no masthead or page overflow at any captured width: 390, 768, 1024, 1280 and 1440 in all three modes.

## Canvas redraw

`ForecastHub` (`GrandHemicycle`, `Spectrum`) and `USLegisMap` include the mode in their draw-effect dependencies, so canvases repaint on a switch without a reload.

## Validation

### Unit tests

`node --test scripts/test-theme-modes.mjs scripts/test-national-tally.mjs scripts/test-result-clarity.mjs`: 18 of 18 pass. The 8 theme tests cover:
- the init script for nothing stored, an unknown value and blocked storage;
- that the init script never consults the system preference;
- `setMode` attributes, storage and events;
- the essential-cameo class.

### Browser behaviour

These checks drive headless Chromium against the production build.

Result: **30 of 30 pass** (`next start` on the build below, 1280 px desktop and 390 px touch).

| Area | Checks |
|---|---|
| Default | With nothing stored the page is Pro Dark, and the attributes, `color-scheme` and `theme-color` agree. |
| First paint | For each stored value (dark, light, themed), the mode is applied before `<body>` exists, and the root attributes, `color-scheme` and meta `theme-color` agree. |
| Fallbacks | An unknown stored value falls back to Pro Dark. With `localStorage` blocked, the page stays on Pro Dark and renders. |
| Keyboard | Enter opens the menu with focus on the active item. ArrowDown steps through the items and wraps. Home and End work. Escape closes the menu and returns focus to the button. Enter selects an item, then storage, attributes and meta agree and the menu closes. |
| Persistence | Theme survives a reload, a client-side navigation (the same document, `/polls`) and a deep link (race page). Switching to Pro Light works without a reload. |
| Pointy policy | In Pro Dark, `/` and `/forecast` render only speaking cameos shown as notes; no figure is visible. |
| Canvas | The legislature map on `/forecast?office=legislatures` reads CSS tokens; its pixels change on a mode switch with no reload. The fixed ambient dust layer is mode-agnostic by design, so it isn't checked. |
| Mobile | The masthead appearance button is at least 40 px. The phone menu (opened from the tab bar, because the phone layout hides the masthead burger) is a three-radio `radiogroup` with targets at least 44 px. Tapping Theme applies it. ArrowLeft selects and focuses Pro Light. |
| Hydration | No hydration warnings in any load. |

Three earlier failures were harness bugs, not product bugs, and were fixed in the harness:
- synthetic key events without a `\r` text;
- the burger check targeting the hidden masthead burger instead of the tab-bar Menu button;
- the canvas check hashing the ambient layer.

### Screenshots

The capture covers 5 routes × 3 modes × 5 widths. All 75 images were captured and inspected; 30 are kept here (390 and 1280 px). `probes.json` holds DOM probe data for 67 of them: 8 Pro Dark shots from the first pass predate the probe file.

| Route | Folder |
|---|---|
| `/` | `home/` |
| `/results/2026` | `results-national/` |
| `/results/2026/sen-GA` | `results-race/` |
| `/forecast` | `forecast/` |
| `/forecast/ia/senate` | `forecast-race/` |

Probe results:
- Every shot: the mode, scheme, `color-scheme` and `theme-color` agree; no horizontal overflow; no masthead overflow; no console errors; one `h1`; no images without alt text; no unnamed buttons.
- Pro modes: cameos render only on `/` and `/forecast`. The behaviour checks below confirm these are speaking cameos shown as notes, with no figure.

### Production build

The final `npm run build` (`next build --webpack`) ran on `607fbeef`, the integrated tree after merging `origin/main` `934649f6`.
- **Exit 0.** It compiled in 2.4 minutes and generated 4,546 static pages in 9.3 minutes.
- **Only warning:** the existing `middleware` → `proxy` deprecation notice.
- **Protected data:** the protected forecast, polling and results data paths are byte-identical to `origin/main`.

**Pending:** `origin/main` then moved to `0ed4399e` (intent-only link prefetch, request-volume cuts), which merged cleanly as `8338b18d`. The protected paths are still identical, and the unit tests pass 18 of 18. `NationalDesk.tsx`, which exists only on this branch, now uses the same `@/app/components/Link`. A production build of the merged tree hasn't completed yet: two attempts were killed when the codespace ran out of memory while the editor's language servers were running. Rerun it before review.

## Exceptions and follow-ups

- **Legacy desks.** The retired `opa-theme` desks keep their own light CSS inline in TSX and follow the scheme attribute only.
- **`app/_polling`.** Untouched (protected).
- **Theme on data pages.** Theme differs from Pro Dark only subtly there: background depth, hairlines and glow. This is intentional so data stays legible, but it is worth a design review.
- **Build memory.** Local builds need `NODE_OPTIONS=--max-old-space-size=2600`, and the build must run detached from the editor terminal. A codespace with the editor's TypeScript server running has little headroom.
