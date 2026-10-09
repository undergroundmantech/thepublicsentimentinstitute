---
name: opp-ui
description: >
  OnPoint Politics design system. Use when styling any page or component on
  onpointpolitics.com (formerly tpsielections.com): the home desk, polling
  averages, forecast and race pages, results pages, TPSI releases, nav, footer,
  cards, tables, maps, charts, buttons, badges. Replaces the old psi-ui skill.
  Provides tokens, type, components, motion and map color rules so every page
  looks like the approved rebrand mock.
argument-hint: "What page or component do you want to style?"
---

# OnPoint Politics UI

Dark first, glass surfaces, one brand gradient, party colors reserved for data.
The reference mock is `onpoint-politics.html` in this package. Match it.

Reference files in this folder:
- `tokens.css` all CSS custom properties, drop into `app/globals.css`
- `components.md` markup and class patterns
- `maps.md` map projection data, color ramps, hover behavior
- `motion.md` animation rules

## Procedure for styling a page

1. Read `tokens.css` and use only those variables. Never invent a color.
2. Page background is `var(--bg)`. Cards are `.card` (glass). Never a solid panel color.
3. Headlines use `var(--font-d)` Sora 800 with tight tracking. Body uses `var(--font-b)` Manrope. Tables, tickers, labels and any number that lines up use `var(--font-m)` JetBrains Mono with `font-variant-numeric: tabular-nums`.
4. The brand gradient `var(--grad)` is allowed in exactly three places: the highlighted word in a headline (background clip text), the one primary button on a page (`.btn.g`), and the ambient orbs behind the page. Never on data, borders, tables or party colors.
5. Gold `var(--gold)` is the secondary accent: The Weighting Room button, premium surfaces, the toss up rating, eyebrow labels on CTA bands. Nothing else.
6. Blue means Democrat, red means Republican, lavender means independent. Never use these for UI state.
7. Rating and margin shading runs pale for close and deep for solid. See `maps.md`.
8. Eyebrow labels: 11px, 700, 0.16em tracking, uppercase, `var(--mute)` or gradient text via `.eye.g`.
9. Every card has a header row (`.card-h`) with a title on the left and a mono eyebrow or a pill on the right.
10. Motion runs once on load, never loops on content. See `motion.md`.
11. Uppercase is for eyebrows and mono labels only. Body copy is sentence case.
12. Routes follow the pattern in `IMPLEMENTATION.md`. Never add a new route name per race.

## Page skeleton

```
<Review chrome is NOT part of the site, ignore it in the mock>
<header class="top">        sticky, blur, white lockup, six nav items, Search + Weighting Room buttons
<div class="ticker-bar">    "36 DAYS OUT" label + marquee of model margins
<main class="wrap">
  <section class="hero">    headline + KPI stack (approval, generic ballot, control odds)
  <section class="sec">     US forecast map + seat histogram + closest races
  <section class="sec">     county simulation map + race side panel
  <section class="sec">     polling averages, two chart cards with pinned average row
  <section class="sec">     results desk, two result cards + countdown card
  <section class="sec">     TPSI releases, four story cards with mini maps
  <section class="sec">     CTA band
<footer class="foot">       five columns, white lockup, credits
```

## Brand and logo

- White lockup on every dark surface (masthead, footer). Color lockup on white only (PDFs, embeds, social cards on light). Gold lockup for The Weighting Room and premium surfaces. Icon alone is the favicon, loading mark and avatar.
- Logo SVG viewBox is `0 0 500 200`. In the masthead crop it to `viewBox="30 40 460 120"` at 44px tall so the mark and wordmark sit on one line without the padding.
- Brand dark `#110019` is the color behind the white logo file and is the page ground for hero and footer bands. Page body is `#0a0711`.
