# CHANGE ORDER 03 — Home Page: Display Fonts · Hero Redesign · Footer/Contact Redesign

**Target repo:** `thepublicsentimentinstitute-site-v2`
**Scope:** The home page only (HomeV2 route) plus the display-font token it consumes.
**Depends on:** Change Order 01 (foundation tokens) applied. Written against the
pre-fix snapshot — **reconcile file paths/line references against the updated
codebase zip before executing** (owner is applying manual fixes in parallel).
**Visual specs attached:** `spec-hero.html` (hero), `spec-footer.html` (contact/footer pane).
Open both in a browser; they are the authority for look, spacing, and behavior.
**Out of scope:** results desk (CO-02, pending), other marketing pages, domain
DNS/redirect setup (logged in §5 as strings-only prep).

---

## 1 · DISPLAY FONT REVISION — Geist for editorial display, JetBrains Mono for instruments

Decision update since CO-01: `--font-display` changes from JetBrains Mono to
**Geist at heavy weight**. The two-voice rule:

| Voice | Face | Where |
|---|---|---|
| Editorial display | **Geist 700** (variable; ~650–700), tracking −0.03em | Hero H1, home section headers, footer-pane headline, about/methodology titles |
| Instrumental | **JetBrains Mono** | ALL kickers/eyebrows/labels (even on marketing pages), data numerals, timestamps, tickers, desk/race headlines, panel titles, buttons that read as controls |

The mono kickers on marketing pages are the stitching that keeps the brand one
system — do not convert eyebrows/labels to Geist.

### 1a. `app/layout.tsx`
Change the `display` font const from `JetBrains_Mono` to `Geist`:
```tsx
const display = Geist({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
```
(`numeric` stays JetBrains Mono 500/700/800 — unchanged. If `Geist` is already
imported for body, reuse the import; two Geist instances with different
variables are fine, or share one and set weight via CSS.)

### 1b. `app/globals.css` heading rule
Update the `h1..h6` rule installed by CO-01:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-display), system-ui, sans-serif;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.04;
  text-transform: none;
  text-wrap: balance;
}
h1 { font-size: clamp(34px, 5.6vw, 72px); letter-spacing: -0.032em; }
```
Keep `.psi-kicker` / eyebrow utilities on `var(--font-numeric)` (mono) exactly
as CO-01 defined them. The `.title-longform` escape hatch from CO-01 is now
redundant (display is proportional) — leave it in place, harmless.

### 1c. Desk exception (forward note, no action now)
Internal desk/race headlines remain JetBrains Mono via their own component
classes (CO-02 will set `font-family: var(--font-numeric)` explicitly on desk
panel titles). Nothing to do in this order.

---

## 2 · HERO REDESIGN (visual spec: `spec-hero.html`)

Replace the current centered hero composition in the HomeV2 hero component.
**Copy is UNCHANGED** except one fix noted below. Structure:

### 2a. Composition
- **Centered block, left-justified text.** The content stack (eyebrow, H1,
  sub, CTAs) is a single block horizontally CENTERED on the page
  (`margin-inline: auto`, width `min(~780px, 100%)`), with all text inside it
  LEFT-aligned (`text-align: left`). The block sits centered; the ragged edge
  reads editorial. Do not center-align the text itself.
- **Remove the large hero logo** entirely. The nav carries the mark; the hero
  carries the *name* instead (2b). No logo duplication.
- Element order: eyebrow → H1 → sub → CTA row.

### 2b. Masthead eyebrow (replaces hero logo)
```
● LIVE DESK · THE PUBLIC SENTIMENT INSTITUTE
```
- JetBrains Mono, 11px, 700, letter-spacing .24em, uppercase.
- "● LIVE DESK" segment in `--live` mint with pulsing 6px dot
  (`animation: pulse 1.8s infinite` → 50% opacity .35).
- "THE PUBLIC SENTIMENT INSTITUTE" in muted ink (`--ink3`); this is the
  institutional masthead line — full name lives here, not as display type.

### 2c. Headline & sub (copy preserved)
- H1: `Polling averages and forecasts for live election results.` in
  **Geist 700**, clamp(38px, 6.4vw, 84px), tracking −0.03em, line-height ~0.98,
  `text-wrap: balance`, soft text-shadow for separation.
- The phrase **"live election results"** gets the brand-gradient text fill:
  ```css
  .g{color:transparent;background:var(--brand-grad);-webkit-background-clip:text;background-clip:text}
  ```
- Sub (copy fix: **"election night"** — remove the hyphen from
  "election-night"): Geist 400, clamp(15px,1.7vw,19px), `--ink2`, max 44ch.

### 2d. CTAs (labels unchanged)
- Primary `Explore the polling →`: light layered pill — white gradient fill,
  inset highlight + violet inner glow, 999px radius, hover lift −2px, arrow
  nudges +4px. (Exact shadows in spec CSS.)
- Secondary `See the forecast →`: glass pill — `rgba(255,255,255,.06)` fill,
  1px `rgba(255,255,255,.16)` border, `backdrop-filter: blur(14px)`.
- **Remove the acid-lime treatment** from the nav "Take the survey" button →
  solid ink pill (`--ink` bg, canvas text, mono 700 12px). Lime is off-palette.

### 2e. Background — KEEP the existing world-map dot field; recolor only
**AMENDED (owner decision): the original dot-field component (the world-map
dot canvas currently in production) is RETAINED. Do NOT replace it with an
abstract field. This is a color-only change:**
- Recolor the dot/bloom palette from the current purple/gray to the brand
  hues at low saturation — warm reds/magentas (rgb 210,73,75 / 164,65,151)
  and cool violet/blue (109,62,233 / 63,96,232). Keep overall luminance at or
  below current levels so the type wins.
- Replace the purple ambient blooms with brand-hue radials
  (`mix-blend-mode: screen`, low opacity) per the values in `spec-hero.html`'s
  `.blooms` rule.
- OPTIONAL (recommended, owner may decline): add the radial `veil` overlay
  (near-canvas at the content block, fading out ~68%) so the headline sits in
  a slightly calmer pocket — this darkens the map behind the type without
  touching the component. Zero changes to the dot geometry, map shape,
  animation, or interaction hints.
- NOTE: `spec-hero.html`'s canvas background is a STAND-IN, not the spec.
  Background authority = the existing production component + the color values
  above. Everything else in `spec-hero.html` (type, layout, CTAs, eyebrow,
  foot) remains authoritative.

### 2f. Hero foot — RETAIN the V2 scroll mouse
**AMENDED (owner decision): keep the existing V2 animated mouse/scroll
indicator at the base of the hero exactly as it is in production** — same
element, same animation, same placement. Do NOT replace it with the minimal
bar shown in `spec-hero.html` (that foot row is a stand-in). Only permitted
touch: recolor its strokes/labels to the new tokens (`--ink3` idle, `--ink2`
hover) if it still carries legacy colors. The right-side
`FIELD SIMULATION · MOVE YOUR CURSOR` hint stays as-is (mono 10px, `--ink3`).

### 2g. Nav accents
- Active link underline: 2px `--live` mint (not lime, not gradient).
- "Situation Room" dot: `--live` mint with pulse.
- Nav logo: monochrome ink fill (mask or `path{fill:var(--ink)}`), the
  gradient stays out of chrome.

---

## 3 · FOOTER / CONTACT PANE REDESIGN (visual spec: `spec-footer.html`)

Replaces the current full-bleed gradient contact section at the bottom of the
home page.

### 3a. Backdrop
- Keep a gradient backdrop but **recolor to brand**: layered radials + linear
  (#07070b → #241a5e → #6d3ee9 → #b5468f with red/magenta radial accents —
  exact stops in spec). Add vignette overlay to settle it.
- Remove the current navy→pink wash and the corner "N" badge.

### 3b. The glass pane (60/40 split)
Single centered card, `min(920px, 100%)`:
- Surface `rgba(10,10,14,.52)`, `backdrop-filter: blur(26px) saturate(1.35)`,
  1px `rgba(255,255,255,.14)` border, 22px radius, deep shadow + inset top light.
- **No gradient top rule** (explicitly removed by owner).
- Grid `60fr / 40fr`; collapses to stacked <680px (divider becomes horizontal).

**Left (identity):**
- Kicker: mint dot + `THE PUBLIC SENTIMENT INSTITUTE` (mono, .24em).
- Headline: `Work with the desk.` in **Geist 700**, clamp(40px,5.4vw,64px),
  with "desk" in brand-gradient text fill.
- One body line (NO em dash):
  `Polling, forecasts, and election night intelligence for teams that need the call right, not just first.`

**Right (action):** faint lift `rgba(255,255,255,.02)`, left hairline divider:
- Label `START A CONVERSATION` (mono, .2em, muted).
- Primary CTA button: **`Email the desk →`** — full-width light pill, 14px
  radius, arrow right-aligned via `margin-left:auto`, hover lift + arrow nudge.
  `href="mailto:…"`.
- Address line beneath (small mono, clickable, same mailto):
  current `tpsinstitutecontact@gmail.com`.
- Note: `TYPICAL REPLY WITHIN ONE BUSINESS DAY` (mono 10px, uppercase) —
  placeholder copy, owner may revise.
- Flex spacer, then foot block above a hairline: TPSI logo (18px, mono ink),
  link row `POLLING / FORECASTS / RESULTS / CONTACT` (mono 11px uppercase),
  and `© 2026 The Public Sentiment Institute · Florida`.

### 3c. Copy rules enforced
- No em dashes anywhere in this section.
- Organization name (full) appears in kicker + ©; product voice says TPSI.

---

## 4 · IMPLEMENTATION NOTES FOR CODESPACE
1. Locate the hero + footer by content grep, not line number (codebase has
   drifted): `grep -rn "Take the survey\|FIELD SIMULATION" app/` for the hero;
   `grep -rn "Work with public sentiment\|partner with the desk" app/` for the
   footer section.
2. Background: modify ONLY the color constants of the existing dot-field
   component (grep for the current canvas/dot component in the hero). No new
   component, no geometry changes.
3. Keep all existing nav links/routes untouched.
4. The spec HTML files are single-file references — lift CSS values verbatim
   where sensible; translate class names to the project's conventions.
5. Commit sequence: `co03: display font -> Geist` → `co03: hero redesign` →
   `co03: footer pane redesign`. Build green after each.

## 5 · DOMAIN PREP (strings only — do NOT change DNS/deploy config)
Pending purchase of `tpsielections.com`. When owner confirms, in the same PR:
- `app/layout.tsx` metadata: `metadataBase`, OG url → `https://tpsielections.com`.
- Footer © keeps the full institutional name (unchanged).
- Optional (owner call): contact email swap to a domain address — HOLD until
  mailbox exists; keep gmail for now.

## 6 · ACCEPTANCE CHECKLIST
- [ ] Home H1 renders Geist 700, mixed case, gradient fill on "live election results"
- [ ] Eyebrows/kickers/labels remain JetBrains Mono (site-wide spot check)
- [ ] Hero logo removed; masthead eyebrow present; nav logo monochrome ink
- [ ] Hero content block centered on page with left-justified text
- [ ] No acid-lime anywhere; live signals are mint `--live`
- [ ] Field: original world-map dot field retained, recolored to brand hues (no purple), type remains readable over it
- [ ] V2 scroll mouse retained at hero base, animation intact (tokens-only recolor if needed)
- [ ] Footer: glass 60/40 pane, brand-recolored backdrop, no gradient top rule, `Email the desk →` one line, address beneath
- [ ] "election night" unhyphenated; zero em dashes in hero/footer copy
- [ ] `npm run build` green; no console errors; no horizontal overflow at 360/768/1440
