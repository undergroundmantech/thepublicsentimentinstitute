# PSI Design Tokens

All tokens are CSS custom properties defined in `app/globals.css`.

---

## Surfaces

| Variable | Dark value | Light value |
|---|---|---|
| `--background` | `#0a0b14` | `#f6f7fb` |
| `--background2` | `#11131f` | `#eef0f6` |
| `--panel` | `#161827` | `#ffffff` |
| `--panel2` | `#1d2030` | `#fbfbfd` |

---

## Text

| Variable | Dark | Light |
|---|---|---|
| `--foreground` | `#f4f5fb` | `#0b0d1c` |
| `--foreground2` | `#c8cbdb` | `#2b2f44` |
| `--muted` | `#aab0c6` | `#6b7088` |
| `--muted2` | `#8a90a8` | `#9aa0b4` |

---

## Borders

| Variable | Value |
|---|---|
| `--border` | `rgba(244,245,251,0.08)` (dark) |
| `--border2` | `rgba(244,245,251,0.14)` (dark) |
| `--border3` | `rgba(244,245,251,0.22)` (dark) |

---

## Color Palette

| Variable | Value | Use |
|---|---|---|
| `--purple` | `hsl(271,50%,65%)` dark | Primary accent |
| `--purple2` | `hsl(271,50%,74%)` dark | Lighter tint |
| `--purple-soft` | `hsl(271,45%,58%)` dark | Eyebrows, tags |
| `--purple-dim` | `rgba(124,58,237,0.18)` | Tinted surface |
| `--purple-glow` | `hsla(271,50%,65%,0.35)` | Selection / focus glow |
| `--red` | `#e63946` | Rep / danger / tri-color left |
| `--red2` | `#ff4d5a` | Brighter red variant |
| `--red-dim` | `rgba(230,57,70,0.18)` | Tinted surface |
| `--blue` | `#2563eb` | Dem / info / tri-color right |
| `--blue2` | `#3b82f6` | Brighter blue variant |
| `--blue-dim` | `rgba(37,99,235,0.18)` | Tinted surface |
| `--dem` | `#2563eb` | Party alias |
| `--rep` | `#e63946` | Party alias |
| `--win` | `#16a34a` | Win / positive green |

---

## Shadows

| Variable | Purpose |
|---|---|
| `--shadow-sm` | Cards, small panels |
| `--shadow-md` | Modals, hover elevation |
| `--shadow-lg` | Overlays, dropdowns |
| `--shadow-purple` | `0 12px 40px rgba(124,58,237,0.34)` |
| `--shadow-red` | `0 12px 40px rgba(230,57,70,0.30)` |
| `--shadow-blue` | `0 12px 40px rgba(37,99,235,0.30)` |

---

## Gradients

| Variable | Value |
|---|---|
| `--gradient-purple` | `linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #5b21b6 100%)` |
| `--gradient-purple-soft` | `linear-gradient(135deg, #9333ea 0%, #6d28d9 50%, #4c1d95 100%)` |
| Tri-color (inline) | `linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%)` |

---

## Border Radius

| Variable | Value |
|---|---|
| `--r-sm` | `10px` |
| `--r-md` | `16px` |
| `--r-lg` | `22px` |
| `--r-xl` | `28px` |
| `--r-pill` | `9999px` |

---

## Letter-Spacing

| Variable | Value | Use |
|---|---|---|
| `--trk-1` | `0.04em` | Tight labels |
| `--trk-2` | `0.08em` | Table headers |
| `--trk-3` | `0.14em` | Eyebrows |

---

## Motion

| Variable | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--ease-soft` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--dur-1` | `140ms` |
| `--dur-2` | `220ms` |
| `--dur-3` | `420ms` |
