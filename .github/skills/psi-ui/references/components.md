# PSI Components

---

## Panel (`.res-panel` / `.psi-card`)

Every content card on the site uses this base. The tri-color inset top border
is applied via `::before` using the mask-composite trick — never a real border.

```css
.my-panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
  animation: psi-fade-up 0.5s var(--ease-soft) both;
}
/* Tri-color inset top border — 2.5px thick */
.my-panel::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 22px;
  background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  padding: 2.5px 2.5px 0 2.5px;
  pointer-events: none;
  z-index: 2;
}
```

---

## Panel Header (`.res-panel-header`)

```css
.res-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--panel2);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  flex-shrink: 0;
}
```

JSX pattern:
```tsx
<div className="res-panel-header">
  <span className="res-panel-tag">SECTION TITLE</span>
  <span className="res-badge res-badge-purple">LIVE</span>
</div>
```

Panel tag CSS:
```css
.res-panel-tag {
  font-family: var(--font-body);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.20em;
  text-transform: uppercase;
  color: var(--purple-soft);
}
```

---

## Badges

Base class + color modifier. Never invent badge colors — use these.

```css
/* Base */
.res-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px;
  border: 1px solid var(--border2);
  background: var(--panel2);
  color: var(--muted);
  font-family: var(--font-body);
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.10em; text-transform: uppercase;
  border-radius: var(--r-pill);
}
.res-badge-purple { border-color: rgba(124,58,237,0.40); background: rgba(124,58,237,0.08); color: var(--purple-soft); }
.res-badge-win    { border-color: rgba(74,222,128,0.28);  background: rgba(74,222,128,0.08);  color: var(--win); }
.res-badge-red    { border-color: rgba(230,57,70,0.30);   background: rgba(230,57,70,0.08);   color: var(--rep); }
.res-badge-blue   { border-color: rgba(59,130,246,0.30);  background: rgba(59,130,246,0.08);  color: var(--dem); }
```

---

## Buttons

```css
/* Primary — purple gradient */
.res-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px;
  background: var(--gradient-purple);
  border: 1px solid rgba(124,58,237,0.65);
  color: #fff;
  font-family: var(--font-numeric); font-size: 13px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
  border-radius: var(--r-pill);
  box-shadow: var(--shadow-purple);
  cursor: pointer;
  transition: background var(--dur-1) ease, transform var(--dur-1) ease;
}
.res-btn-primary:hover { background: var(--gradient-purple-soft); transform: translateY(-1px); }

/* Ghost */
.res-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--muted2);
  font-family: var(--font-body); font-size: 10px; font-weight: 700;
  letter-spacing: 0.14em; text-transform: uppercase;
  border-radius: var(--r-pill);
  cursor: pointer;
  transition: all var(--dur-1) ease;
}
.res-btn-ghost:hover { border-color: var(--border2); color: var(--muted); }

/* State toggle (tab-style) */
.res-btn-state {
  display: inline-flex; align-items: center;
  padding: 8px 16px;
  background: transparent; border: 1px solid var(--border);
  color: var(--muted2);
  font-family: var(--font-body); font-size: 10px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  border-radius: var(--r-sm); cursor: pointer;
  position: relative; overflow: hidden;
  transition: all 120ms ease;
}
.res-btn-state::before {
  content: ''; position: absolute; bottom: 0; left: 0; right: 0;
  height: 2px; background: var(--purple);
  transform: scaleX(0); transform-origin: left;
  transition: transform 200ms ease;
}
.res-btn-state:hover { color: var(--foreground); border-color: var(--border2); }
.res-btn-state:hover::before, .res-btn-state.active::before { transform: scaleX(1); }
.res-btn-state.active {
  background: rgba(124,58,237,0.10);
  border-color: rgba(124,58,237,0.40);
  color: var(--purple2);
}
```

---

## Progress / Result Bar

```css
.res-bar-track { width: 100%; height: 3px; background: var(--border2); position: relative; overflow: hidden; }
.res-bar-fill  { position: absolute; top: 0; left: 0; bottom: 0; background: var(--purple); transition: width 600ms cubic-bezier(0.22,1,0.36,1); }
```

---

## Candidate / Data Row

```css
.res-candidate-row {
  display: flex; align-items: center;
  border-bottom: 1px solid var(--border);
  padding: 10px 14px;
  position: relative;
  transition: background 120ms ease;
}
.res-candidate-row:last-child { border-bottom: none; }
.res-candidate-row:hover { background: rgba(124,58,237,0.04); }

/* Left-edge color bar */
.res-cand-bar {
  width: 3px; position: absolute; left: 0; top: 8px; bottom: 8px;
  opacity: 0.7; border-radius: 2px;
}
```

---

## Stat Block

Small summary card used inside panels:

```css
.res-stat-block {
  background: var(--panel2);
  border: 1px solid var(--border);
  padding: 10px 12px;
  border-radius: var(--r-sm);
}
```

---

## Live Dot

```css
.res-live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--rep);
  animation: res-pulse 1.8s infinite;
}
@keyframes res-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(0.82); opacity: 0.55; }
}
```

---

## Form Elements

```css
.res-input {
  width: 100%; background: var(--panel2); border: 1px solid var(--border2);
  color: var(--foreground); padding: 8px 12px;
  font-family: var(--font-body); font-size: 12px; letter-spacing: 0.04em;
  outline: none; border-radius: var(--r-sm);
  transition: border-color var(--dur-1) ease;
}
.res-input:focus { border-color: rgba(124,58,237,0.40); }
.res-input::placeholder { color: var(--muted2); }

.res-select {
  background: var(--panel2); border: 1px solid var(--border);
  color: var(--muted2); padding: 8px 12px;
  font-family: var(--font-body); font-size: 11px; letter-spacing: 0.08em;
  outline: none; border-radius: var(--r-sm);
}
```

---

## Sticky Table Header

```css
.res-thead {
  position: sticky; top: 0;
  background: var(--panel2);
  border-bottom: 1px solid var(--border);
}
.res-table-row { border-bottom: 1px solid var(--border); transition: background 100ms ease; }
.res-table-row:hover { background: rgba(124,58,237,0.04); }
```

---

## Tooltip / Map Popup

```css
.res-map-tooltip {
  background: var(--panel);
  border: 1px solid rgba(124,58,237,0.45);
  box-shadow: var(--shadow-md);
  border-radius: var(--r-md);
}
```
