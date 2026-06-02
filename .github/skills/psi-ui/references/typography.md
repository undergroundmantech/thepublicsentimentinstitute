# PSI Typography

---

## Font Variables

| CSS Variable | Typeface | Weights | Role |
|---|---|---|---|
| `--font-display` | **Quantico** | 400, 700 | All headlines, page titles — always `text-transform: uppercase` |
| `--font-body` | **Geist Mono** | variable | Labels, body copy, eyebrows, badges, nav, footer links |
| `--font-numeric` | **JetBrains Mono** | 500, 700, 800 | Numbers, percentages, buttons, stat values |

All three are configured in `app/layout.tsx` via `next/font/google` and injected as CSS variables on `<html>`.

---

## Typography Scale

| Context | Font var | Size | Weight | Tracking | Transform |
|---|---|---|---|---|---|
| Hero headline | `--font-display` | `clamp(40px,5.6vw,76px)` | 800 | -0.028em | uppercase |
| Page title (results) | `--font-display` | `clamp(22px,2.8vw,44px)` | 900 | -0.01em | uppercase |
| Section / panel title | `--font-display` | 22px | 800 | -0.02em | uppercase |
| Footer CTA headline | `--font-display` | `clamp(24px,3vw,36px)` | 800 | -0.02em | uppercase |
| Eyebrow / page-sub | `--font-body` | 10px | 700 | 0.22em | uppercase |
| Panel tag | `--font-body` | 10px | 700 | 0.20em | uppercase |
| Table header / th | `--font-body` | 10–11px | 600–700 | 0.14–0.18em | uppercase |
| Badge / label | `--font-body` | 10–11px | 600–700 | 0.04–0.12em | uppercase |
| Body / description | `--font-body` | 14–15px | 400 | normal | — |
| Nav link | `--font-body` | 13px | 500 | normal | — |
| Candidate name | `--font-body` | 12–13px | 700–900 | 0.06em | uppercase |
| Button | `--font-numeric` | 13px | 700 | 0.02–0.06em | uppercase |
| Stat / percent big | `--font-numeric` | `clamp(20px,2.5vw,28px)` | 800 | tabular-nums | — |
| Metric number | `--font-numeric` | 26px | 800 | -0.02em | — |
| Small / legal | `--font-body` | 11–12px | 400 | normal | — |

---

## Gradient Text Pattern

Used on `<em>` tags inside headlines (never use `font-style: italic`):

```css
em {
  font-style: normal;
  background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

JSX example:
```tsx
<h1>Election <em>Night</em></h1>
<h2>Public <em>Sentiment</em> Institute</h2>
```

---

## Eyebrow Pattern

Appears above every major section title:

```tsx
<div style={{
  fontFamily: "var(--font-body)",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "var(--purple-soft)",
  marginBottom: "8px",
}}>JUNE 2ND PRIMARY ELECTIONS · 2026</div>
<h1>...</h1>
```

---

## Tabular Numbers

Always use `font-variant-numeric: tabular-nums` on stat values so columns align:

```css
font-family: var(--font-numeric);
font-variant-numeric: tabular-nums;
```
