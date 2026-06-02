# PSI Animations

---

## Keyframes

### Entry — `psi-fade-up`
Used on all cards, panels, and hero sections on page load.
```css
@keyframes psi-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
/* Usage */
animation: psi-fade-up 0.5s var(--ease-soft) both;
/* Stagger children with animation-delay: 0ms, 60ms, 120ms… */
```

### Live Pulse — `psi-pulse`
```css
@keyframes psi-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
animation: psi-pulse 2s infinite;
```

### Results Live Dot — `res-pulse`
```css
@keyframes res-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%       { transform: scale(0.82); opacity: 0.55; }
}
animation: res-pulse 1.8s infinite;
```

### Map County Pop — `county-pop`
```css
@keyframes county-pop {
  0%   { filter: brightness(1) drop-shadow(0 0 0px transparent); }
  40%  { filter: brightness(2.2) drop-shadow(0 0 6px rgba(124,58,237,0.6)); }
  100% { filter: brightness(1) drop-shadow(0 0 0px transparent); }
}
animation: county-pop 520ms var(--ease-out);
```

### Loading Skeleton — `res-loading-pulse`
```css
@keyframes res-loading-pulse {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 1; }
}
animation: res-loading-pulse 1.4s ease-in-out infinite;
```

---

## Motion Tokens (from `app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Snappy exits, bar fills |
| `--ease-soft` | `cubic-bezier(0.16, 1, 0.3, 1)` | Smooth entries |
| `--dur-1` | `140ms` | Micro interactions (hover states) |
| `--dur-2` | `220ms` | State transitions |
| `--dur-3` | `420ms` | Panel / card entries |

---

## Stagger Pattern

When animating a list of cards:
```tsx
{items.map((item, i) => (
  <div key={item.id} style={{ animationDelay: `${i * 60}ms` }} className="my-panel">
    …
  </div>
))}
```

---

## Hover Lift Pattern

Buttons and cards that lift on hover:
```css
transition: transform var(--dur-1) ease, box-shadow var(--dur-1) ease;
/* hover: */
transform: translateY(-1px);
box-shadow: var(--shadow-md);
```

Do NOT use `translateY(-2px)` or more — it looks heavy on dense pages.
