---
name: psi-ui
description: >
  PSI design system skill. Use when: styling a new page, adding a component,
  applying the house visual language, matching the look of the home page or
  results page, building a panel, card, badge, button, table, header, layout,
  typography, or any UI element for thepublicsentimentinstitute. Provides
  tokens, patterns, and code templates so every page looks consistent.
argument-hint: "What page or component do you want to style?"
---

# PSI UI Design System

The Public Sentiment Institute uses a unified dark-first design language built
around three accent colors (red, purple, blue), three monospace/display fonts,
and a set of reusable CSS tokens and class patterns.

Reference files:
- [Tokens & Variables](./references/tokens.md) — all CSS custom properties
- [Typography](./references/typography.md) — font vars, scale, usage rules
- [Components](./references/components.md) — panels, badges, buttons, rows
- [Layout Patterns](./references/layout.md) — grids, rails, page structure
- [Animation](./references/animation.md) — keyframes and motion tokens

---

## Procedure for Styling a New Page

1. **Read [tokens.md](./references/tokens.md)** to internalize the color and
   spacing vocabulary before writing any CSS.
2. **Wrap all page CSS in a `<style>{`…`}</style>` tag** inside the component
   — this is the project convention (no external CSS modules).
3. **Use `.res-panel` or `.psi-card` as the base surface** for any card/panel.
   Never invent a new background color — always use `var(--panel)` or
   `var(--panel2)`.
4. **Use `.res-panel-header`** (flex, space-between, 10px 14px padding,
   border-bottom, `--panel2` bg) for panel headers. Always include a
   `.res-panel-tag` label and optionally a right-side badge or stat.
5. **Use `var(--font-display)` for headlines** (Quantico, always uppercase),
   `var(--font-body)` (Geist Mono) for labels/body, and `var(--font-numeric)`
   (JetBrains Mono) for numbers and buttons.
6. **Gradient text on headline `<em>` tags:**
   ```css
   em {
     font-style: normal;
     background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
     -webkit-background-clip: text;
     -webkit-text-fill-color: transparent;
     background-clip: text;
   }
   ```
7. **Tri-color inset top border** on every panel — use the `::before`
   mask-composite pattern (see [components.md](./references/components.md)).
8. **Entry animation:** add `animation: psi-fade-up 0.5s var(--ease-soft) both`
   to panels and cards.
9. **Buttons:** use `.psi-btn` + modifier or `.res-btn-primary` /
   `.res-btn-ghost`. Never use plain `<button>` without a class.
10. **Eyebrow labels** (section subtitles above titles): 10px, fw700, 0.22em
    tracking, uppercase, `var(--purple-soft)`, `var(--font-body)`.
