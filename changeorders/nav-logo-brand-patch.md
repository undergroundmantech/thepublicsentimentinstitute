# PATCH — Logo swap + brand-gradient placement (Navbar.tsx & DarkNav.tsx)

## 1. Drop in the new logo asset
- New file `public/tpsi-logo.svg` is included in this package. Copy it to `public/`.
- Keep `public/logo.png` (square mark) for the hero; it is unchanged.
- `public/full_logo_clean.png` may remain for now (fallback) but is superseded.

## 2. Navbar.tsx — logo (CSS mask mechanism is PRESERVED)
The nav logo is a CSS mask filled with `currentColor`, so it auto-adapts to
theme. Swap the mask source from the PNG to the new SVG.

Find (around lines 104 & 108):
```css
  -webkit-mask-image: url(/full_logo_clean.png);
          mask-image: url(/full_logo_clean.png);
```
Replace both with:
```css
  -webkit-mask-image: url(/tpsi-logo.svg);
          mask-image: url(/tpsi-logo.svg);
```
Do the same in **DarkNav.tsx** (around lines 134–135):
```css
  -webkit-mask: url(/tpsi-logo.svg) left center / contain no-repeat;
          mask: url(/tpsi-logo.svg) left center / contain no-repeat;
```
Because the mask is filled with the theme's ink color, the logo renders
monochrome (near-black on light, off-white on dark). This is intended.
If a full-color gradient logo is wanted in nav instead, replace the masked
`<span>` with an `<img src="/tpsi-logo.svg">`; but monochrome-masked is the
recommended default for chrome (the gradient lives in the underrule below).

## 3. Brand gradient — the TWO sanctioned placements

### (a) Nav underrule
Navbar.tsx currently has a hardcoded tricolor at ~line 77 & ~line 103:
```css
  background: linear-gradient(90deg, #e63946 33%, #7c3aed 66%, #2563eb 100%);
```
Replace the literal gradient with the token:
```css
  background: var(--brand-grad);
```
Ensure the element carrying it renders as a 2px full-width rule under the nav
bar (height: 2px). If no such element exists, add one directly under the nav
container:
```tsx
<div aria-hidden className="nb-brandrule" />
```
```css
.nb-brandrule { height: 2px; width: 100%; background: var(--brand-grad); }
```

### (b) Active race-switcher tab (results desk)
This lands with the desk reskin (separate order). For now, if any "active tab"
indicator uses `--gradient-purple`, it will already inherit the brand gradient
via the alias in globals.css — no action needed.

## 4. Retire the ambient tri-color glow (optional, recommended)
`layout.tsx` renders three blurred color blooms (red/purple/blue) behind all
pages. With the newsroom palette this reads as noise. Either:
- Delete the `aria-hidden ... pointer-events-none fixed inset-0` glow block, OR
- Reduce each bloom opacity to ~0.02 and re-point colors to
  `var(--dem)/var(--gop)` so it's a whisper, not a wash.
Recommended: delete for the results/desk routes; keep a faint version on
marketing pages only if desired.
