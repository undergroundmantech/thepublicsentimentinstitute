# PSI Layout Patterns

---

## Max-Width Container

All pages use `max-width: 1240px` (results) or `max-width: 1280px` (home/nav),
centered with `margin: 0 auto` and `padding: 0 10px` (mobile-safe).

---

## Results Page — 3-Column Desktop Grid

```css
.res-body {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 280px minmax(0, 620px) 300px;
  align-items: stretch;
  gap: 8px;
  padding: 8px 10px;
  box-sizing: border-box;
}
```

- **Left col (280px)**: Race picker list — flex column, scrollable
- **Center col (620px)**: Map + county breakdown — flex column
- **Right col (300px)**: Race status + topline + forecast — flex column, `align-self: start`

### Right Rail
```css
.res-right-rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
  max-height: 1616px;
  align-self: start;
}
```

Panels stack vertically. Topline uses `max-height: 520px` with internal scroll.
Forecast uses `max-height: 560px`.

---

## Homepage Layout

```
.hp-wrap (max-width: 1280px)
  ├── .hp-hero (flex column)
  │     ├── .hp-hero-left  (grid 1.15fr | 1fr, 32px gap — spotlight + stat cards)
  │     └── .hp-hero-right (grid 1fr | 1fr, 20px gap — metric cards)
  └── .hp-charts-grid (grid 1fr | 1fr, 20px gap → 1-col < 820px)
```

---

## Navbar

```
.nb-root  — sticky top-0, z-index 200, frosted glass backdrop-filter blur(18px)
  .nb-bar — max-width 1280px, flex, align-items center, 14px/20px padding
    .nb-logo  — left
    .nb-links — pill container, margin-left auto, gap 2px
    .nb-right — right side (CTA / mobile burger)
```

Nav link active state: `align-self: flex-end; margin-bottom: 12px;` with a
2px purple underline via `::after`.

---

## Footer

```
.ft-root → .ft-shell (r-xl panel, border, shadow-md)
  .ft-cta    — grid auto | 1fr (CTA band with gradient text headline)
  .ft-stats  — grid 4-col (4 stat numbers)
  .ft-grid   — grid 1.8fr 1fr 1fr (brand col + 2 link cols)
  .ft-bottom — flex space-between (copyright + legal links)
```

---

## Responsive Breakpoints

| Breakpoint | Behavior |
|---|---|
| `< 1024px` | 3-col grid collapses; right rail moves below map |
| `< 820px` | Homepage 2-col charts → 1-col |
| `< 768px` | Navbar hamburger menu appears; desktop links hidden |
| `< 600px` | Results body single column; race picker becomes horizontal scroll strip |

---

## Scrollable Panel Body Pattern

When a panel section needs to scroll internally (e.g. topline results, forecast):

```tsx
/* Outer panel clips, inner body scrolls */
<div className="res-panel" style={{ display: "flex", flexDirection: "column", maxHeight: 520, overflow: "hidden" }}>
  <div className="res-panel-header" style={{ flexShrink: 0 }}>…</div>
  <div style={{ overflowY: "auto", flex: 1, minHeight: 0, scrollbarGutter: "stable", padding: "6px 6px 6px 12px" }}>
    {/* content */}
  </div>
</div>
```

Key rules:
- Outer panel: `overflow: hidden`, NOT `overflow-y: auto`
- Inner scroll div: `flex: 1; min-height: 0; overflow-y: auto`
- Use `scrollbarGutter: "stable"` (not `stable both-edges`) to avoid double-gutter
- Never put `scrollbar-gutter` on the outer panel

---

## Page Header Pattern

```tsx
<div className="res-page-header">
  <div className="res-page-header-inner"> {/* max-width 1240px, 16px/10px padding */}
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div className="res-page-sub">SECTION LABEL · YEAR</div>
        <h1 className="res-page-title">Page <em>Title</em></h1>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {/* badges / controls */}
      </div>
    </div>
  </div>
</div>
```
