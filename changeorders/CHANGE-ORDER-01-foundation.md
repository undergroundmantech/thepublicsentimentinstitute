# CHANGE ORDER 01 — Site-Wide Foundation Reskin
### Fonts · Colors · Logo/Brand · (results-desk redesign is a SEPARATE later order)

**Target repo:** `thepublicsentimentinstitute-site-v2`
**Nature:** Token-layer reskin. High-volume, mechanical, grep-verifiable.
**Scope boundary:** This order changes ONLY the design foundation (typography,
color tokens, logo, brand gradient) across every route. It does NOT restructure
the election/results desk — that is Change Order 02, pending.

---

## Why this is safe to do mechanically
The codebase routes ~everything through CSS variables in `app/globals.css`
(`:root` + `:root[data-theme="dark"]`) and `--font-*` vars in `app/layout.tsx`.
Rewrite those two files → the change propagates to all components that read the
tokens. The only non-automatic part is ~795 hardcoded hex literals in ~60 files
(Phase 2), which is a controlled find-and-replace.

---

## Execution order (do in sequence; commit after each phase)

### PHASE 0 — Branch & baseline
```bash
git checkout -b reskin/foundation-01
npm install
npm run build      # confirm the build is green BEFORE changes
```

### PHASE 1 — Core token/font/logo swap (3 files + 1 asset)

**1a. Fonts — `app/layout.tsx`**
Apply `replacement-files/app/layout-fonts-block.tsx`.
- Replace the font import + FONTS block (Quantico/Geist_Mono/Fraunces/JetBrains
  → JetBrains Mono display + Geist body + JetBrains Mono numeric).
- Update `<html className=...>` to drop `serif.variable`, use `display/body/numeric`.
- Update `<body className=...>` from `mono.className` → `body.className`.

**1b. Color tokens — `app/globals.css`**
Apply `replacement-files/app/globals-tokens-block.css`.
- Replace the `:root{}` (light) and `:root[data-theme="dark"]{}` blocks.
- Legacy aliases (`--purple/--red/--blue/--background/--foreground/...`) are
  RETAINED and re-pointed, so token-referencing components survive untouched.

**1c. Typography rules — `app/globals.css`**
Apply `replacement-files/app/globals-typography-patch.css`.
- Replace the `h1..h6` rule (removes forced UPPERCASE; mixed-case display).
- Strip `text-transform: uppercase` from the old "always uppercase" selector
  group; uppercase now lives only on `.psi-kicker`/eyebrow utilities.

**1d. Logo + brand gradient**
Apply `replacement-files/app/nav-logo-brand-patch.md`.
- Copy `replacement-files/public/tpsi-logo.svg` → `public/tpsi-logo.svg`.
- Swap mask sources in `Navbar.tsx` and `DarkNav.tsx` to `/tpsi-logo.svg`.
- Replace hardcoded nav tricolor with `var(--brand-grad)`; ensure a 2px
  underrule element exists.
- (Recommended) delete/neutralize the ambient tri-color glow in `layout.tsx`.

```bash
npm run build      # must stay green
git add -A && git commit -m "reskin(01): phase 1 — tokens, fonts, logo, brand gradient"
```

### PHASE 2 — Hardcoded hex migration (~795 literals, ~60 files)
Follow `replacement-files/phase2-color-migration.md` exactly.
- Prefer `var(--token)` over new literals where possible.
- WATCH primary semantics: second candidate in same-party primaries → `--c2`.
- Run the verification greps (must return 0 legacy literals, 0 Quantico/Fraunces).

```bash
npm run build
git add -A && git commit -m "reskin(01): phase 2 — migrate hardcoded palette to newsroom tokens"
```

### PHASE 3 — Visual QA (both themes, key routes)
Toggle light/dark via the footer switch on each:
- `/` (home)   · `/results` (desk — expect it to inherit tokens even pre-CO-02)
- `/polling/genericballot` · a per-race polling page · `/forecastratings`
- `/electoralmap` · `/tpsipoll` · a 404 page

Checklist per route:
- [ ] No leftover purple `#7c3aed` chrome anywhere
- [ ] Headings are JetBrains Mono, mixed case (not shouty uppercase)
- [ ] Body/UI is Geist; numerals are tabular JetBrains Mono
- [ ] Party color only in data (no big red/blue blocks as surfaces)
- [ ] Brand gradient appears ONLY at nav underrule (+ active tab on desk)
- [ ] Logo crisp in both themes
- [ ] No console errors; no horizontal overflow

```bash
git commit -am "reskin(01): phase 3 — visual QA fixes"
# open PR: reskin/foundation-01 -> main
```

---

## Rollback
Everything is on `reskin/foundation-01`. Revert = `git checkout main`.
The `NEXT_PUBLIC_SITE_V2` flag is untouched, so V1/V2 gating still works.

## Explicitly OUT of scope (Change Order 02)
- Results desk restructure (6-col bento, gauge family, race clock, forecast
  panel with box-whisker drawer, expected-vote bars, tier/triage system).
- Anything in `app/results/**` beyond inherited token/font/logo changes.
